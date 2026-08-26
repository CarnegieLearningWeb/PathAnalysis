// Rendering side of the graph export: turn a DOT string into a file the browser
// can download, and bundle several of them into a .zip.
//
// Exports render their own graph rather than screenshotting the one on screen.
// That is what lets a download carry a masthead, an opaque canvas, and the OTHER
// outcome-coloring mode — none of which are on the live SVG.

import { graphviz } from 'd3-graphviz';
import JSZip from 'jszip';

/** Extra resolution for raster output, so a PNG stands up to zooming/printing. */
const PNG_SCALE = 3;
// No extra margin: Graphviz already leaves 4pt inside the drawing's background
// polygon, and padding beyond that box would add a transparent gutter outside
// the opaque canvas the export just asked for.
const EXPORT_PADDING = 0;

export type ExportFormat = 'png' | 'svg' | 'dot';

export interface ExportFile {
    name: string;
    /** Text for svg/dot, a Blob for png. */
    data: string | Blob;
}

/**
 * Render a DOT string with Graphviz off-screen and return standalone SVG markup,
 * framed to the whole drawing.
 *
 * d3-graphviz needs a real element in the document to measure into, so the host
 * div is attached (positioned far off-screen) for the duration of the render and
 * removed afterwards.
 *
 * The frame is measured, not inherited. d3-graphviz sets the svg's viewBox to the
 * graph's size in points but leaves Graphviz's own scale factor on the drawing's
 * root `<g>` — with `dpi=150` that scale is 2.08, so trusting the viewBox crops
 * the graph to its top-left corner. Dropping that transform and taking the root
 * group's real bounding box frames the drawing correctly whatever scale
 * attributes the DOT carried. getBBox needs layout, so this is measured while the
 * host is still in the document.
 */
/**
 * Re-center the export masthead using the browser's own text metrics.
 *
 * Graphviz positions label text as `text-anchor="start"` at an x it derived from
 * its built-in font metrics, which run about 10% narrower than what a browser
 * actually renders for the same Helvetica string. Start-anchored text can only
 * grow rightwards, so every masthead row lands half that difference off-center.
 * Anchoring each row's midpoint to the cluster's midpoint hands the centering to
 * whoever is doing the measuring.
 *
 * Only the title cluster is touched — the graph's own node and edge labels carry
 * the same tiny drift, but Graphviz sized their shapes around it, so "correcting"
 * them would push text out of its box.
 */
const centerClusterLabels = (svg: SVGSVGElement) => {
    svg.querySelectorAll('g.cluster').forEach((cluster) => {
        const frame = cluster.querySelector('polygon');
        if (!frame) return;
        const box = (frame as SVGPolygonElement).getBBox();
        const centerX = box.x + box.width / 2;
        Array.from(cluster.children).forEach((child) => {
            if (child.tagName.toLowerCase() !== 'text') return;
            child.setAttribute('text-anchor', 'middle');
            child.setAttribute('x', String(centerX));
        });
    });
};

const renderDotToSvgMarkup = (dot: string): Promise<{ markup: string; width: number; height: number }> =>
    new Promise((resolve, reject) => {
        const host = document.createElement('div');
        host.style.cssText = 'position:absolute;left:-99999px;top:0;width:2000px;height:2000px';
        document.body.appendChild(host);

        const cleanup = () => host.remove();
        try {
            graphviz(host)
                .zoom(false)
                .fit(false)
                .onerror((err: unknown) => {
                    cleanup();
                    reject(new Error(String(err)));
                })
                .renderDot(dot, () => {
                    try {
                        const svg = host.querySelector('svg') as SVGSVGElement | null;
                        const root = svg?.querySelector('g') as SVGGElement | null;
                        if (!svg || !root) {
                            reject(new Error('Graphviz produced no SVG'));
                            return;
                        }
                        // Drop Graphviz's scale/translate so the drawing sits in
                        // plain user units, then frame it by its own extent.
                        root.removeAttribute('transform');
                        // Before measuring: re-centering can widen the masthead
                        // past what Graphviz reserved for it, and the frame has
                        // to cover where the text actually lands.
                        centerClusterLabels(svg);
                        const box = root.getBBox();
                        const width = box.width + EXPORT_PADDING * 2;
                        const height = box.height + EXPORT_PADDING * 2;
                        svg.setAttribute(
                            'viewBox',
                            `${box.x - EXPORT_PADDING} ${box.y - EXPORT_PADDING} ${width} ${height}`
                        );
                        svg.setAttribute('width', String(width));
                        svg.setAttribute('height', String(height));
                        // The xmlns a file (as opposed to inline DOM) needs.
                        svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
                        svg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
                        resolve({
                            markup: new XMLSerializer().serializeToString(svg),
                            width,
                            height,
                        });
                    } catch (err) {
                        reject(err instanceof Error ? err : new Error(String(err)));
                    } finally {
                        cleanup();
                    }
                });
        } catch (err) {
            cleanup();
            reject(err instanceof Error ? err : new Error(String(err)));
        }
    });

/** Rasterize serialized SVG markup to a PNG blob at PNG_SCALE resolution. */
const svgToPng = (markup: string, width: number, height: number): Promise<Blob> =>
    new Promise((resolve, reject) => {
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(width * PNG_SCALE));
        canvas.height = Math.max(1, Math.round(height * PNG_SCALE));
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            reject(new Error('Could not get a 2D canvas context'));
            return;
        }
        // The DOT already asks Graphviz for a white canvas, but a graph whose
        // bgcolor didn't take would otherwise rasterize onto transparency.
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const img = new Image();
        img.onload = () => {
            ctx.scale(PNG_SCALE, PNG_SCALE);
            ctx.drawImage(img, 0, 0, width, height);
            canvas.toBlob((blob) => {
                if (blob) resolve(blob);
                else reject(new Error('Canvas produced no PNG data'));
            }, 'image/png');
        };
        img.onerror = () => reject(new Error('Failed to load the rendered SVG for rasterizing'));
        img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
    });

/**
 * Render one DOT string into the requested formats. `dot` output is the source
 * itself, so it never needs Graphviz; the raster and vector formats share a
 * single render.
 */
export const renderDotToFiles = async (
    dot: string,
    stem: string,
    formats: ExportFormat[]
): Promise<ExportFile[]> => {
    const files: ExportFile[] = [];
    if (formats.includes('dot')) {
        files.push({ name: `${stem}.dot`, data: dot });
    }
    const needsRender = formats.some((f) => f === 'png' || f === 'svg');
    if (needsRender) {
        const { markup, width, height } = await renderDotToSvgMarkup(dot);
        if (formats.includes('svg')) files.push({ name: `${stem}.svg`, data: markup });
        if (formats.includes('png')) {
            files.push({ name: `${stem}.png`, data: await svgToPng(markup, width, height) });
        }
    }
    return files;
};

/** Trigger a browser download of a single blob or text file. */
export const downloadFile = (file: ExportFile) => {
    const blob = typeof file.data === 'string'
        ? new Blob([file.data], { type: file.name.endsWith('.svg') ? 'image/svg+xml' : 'text/plain' })
        : file.data;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    link.click();
    // Revoke on the next tick — Safari needs the URL alive when the click lands.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/** Bundle several files into one .zip and download it. */
export const downloadZip = async (files: ExportFile[], zipName: string) => {
    const zip = new JSZip();
    files.forEach((file) => zip.file(file.name, file.data));
    const blob = await zip.generateAsync({ type: 'blob' });
    downloadFile({ name: zipName, data: blob });
};
