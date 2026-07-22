// EXPERIMENTAL SPIKE: renders the "All Students" path graph with vis-network
// for interactivity (pan/zoom), but adopts Graphviz's layout — both node
// positions AND edge splines — computed via the bundled viz.js engine. Node
// coordinates are handed to vis-network; edges are drawn directly on
// vis-network's canvas from Graphviz's spline points so the routing matches the
// Graphviz graph exactly. Falls back to vis-network's own hierarchical layout
// + edges if Graphviz is unavailable. Deliberately minimal (no two-row nodes,
// no error overlays) — the point is to judge layout/edge fidelity.
import React, { useEffect, useRef } from 'react';
import { Network } from 'vis-network/standalone';
import { DataSet } from 'vis-data';
// @ts-ignore - viz.js (1.8, bundled via d3-graphviz) has no type declarations.
import Viz from 'viz.js';
import { OUTCOME_COLORS } from './GraphvizProcessing';

// Graphviz coordinates are in inches (y-axis points up). Scale to pixels and
// flip y for vis-network (y-axis points down).
const GV_SCALE = 90;

type Pt = { x: number; y: number };
interface GvLayout {
    nodes: { [name: string]: Pt };
    edges: { [key: string]: Pt[] }; // "tail->head" -> spline control points
}

// Split a `plain`-format line on whitespace, keeping double-quoted tokens whole.
function tokenizePlain(line: string): string[] {
    const out: string[] = [];
    const re = /"((?:[^"\\]|\\.)*)"|(\S+)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line))) out.push(m[1] !== undefined ? m[1].replace(/\\"/g, '"') : m[2]);
    return out;
}

// Run Graphviz 'dot' and return node positions + edge spline points (in
// vis-network pixel space). Returns null on any failure so the caller can fall
// back to vis-network's own layout.
function graphvizLayout(dot: string): GvLayout | null {
    try {
        const plain: string = Viz(dot, { format: 'plain', engine: 'dot' });
        const nodes: { [name: string]: Pt } = {};
        const edges: { [key: string]: Pt[] } = {};
        for (const line of plain.split('\n')) {
            if (line.startsWith('node ')) {
                const t = tokenizePlain(line);
                nodes[t[1]] = { x: parseFloat(t[2]) * GV_SCALE, y: -parseFloat(t[3]) * GV_SCALE };
            } else if (line.startsWith('edge ')) {
                const t = tokenizePlain(line);
                const n = parseInt(t[3], 10);
                const pts: Pt[] = [];
                for (let i = 0; i < n; i++) {
                    pts.push({ x: parseFloat(t[4 + 2 * i]) * GV_SCALE, y: -parseFloat(t[5 + 2 * i]) * GV_SCALE });
                }
                edges[`${t[1]}->${t[2]}`] = pts;
            }
        }
        return Object.keys(nodes).length ? { nodes, edges } : null;
    } catch {
        return null;
    }
}

interface VisNetworkGraphProps {
    edgeCounts: { [key: string]: number };
    totalVisits: { [key: string]: number };
    totalNodeEdges: { [key: string]: number };
    edgeOutcomeCounts: { [key: string]: { [outcome: string]: number } };
    firstAttemptOutcomes: { [key: string]: { [outcome: string]: number } };
    ratioEdges: { [key: string]: number };
    maxEdgeCount: number;
    selectedSequence: string[];
    uniqueStudentMode: boolean;
    colorNodesBySequence: boolean;
    minVisits: number;
    showEdgeLabels: boolean;
    // Used to derive each node's depth (mean step index) for the fallback
    // hierarchical layout when Graphviz is unavailable.
    stepSequences: { [student: string]: { [problem: string]: string[] } };
}

const OUTCOME_STRIPE_ORDER = ['CORRECT', 'ERROR', 'INITIAL_HINT', 'HINT_LEVEL_CHANGE', 'JIT', 'FREEBIE_JIT'];
const FLOW_EDGE_COLOR = '#5f6368';

// Dominant recognized outcome color for an edge (ties broken by stripe order).
function dominantOutcomeColor(outcomes: { [outcome: string]: number }): string {
    const recognized = Object.entries(outcomes).filter(([o, c]) => OUTCOME_COLORS[o] && c > 0);
    if (recognized.length === 0) return FLOW_EDGE_COLOR;
    const rank = (n: string) => {
        const i = OUTCOME_STRIPE_ORDER.indexOf(n);
        return i === -1 ? OUTCOME_STRIPE_ORDER.length : i;
    };
    let best = recognized[0];
    for (const cur of recognized) {
        if (cur[1] > best[1] || (cur[1] === best[1] && rank(cur[0]) < rank(best[0]))) best = cur;
    }
    return OUTCOME_COLORS[best[0]];
}

// White→blue gradient by position in the selected sequence.
function sequenceColor(position: number, total: number): string {
    if (total <= 1) return '#1cb0ff';
    const t = position / (total - 1);
    const r = Math.round(255 + t * (28 - 255));
    const g = Math.round(255 + t * (176 - 255));
    return `rgb(${r}, ${g}, 255)`;
}

const VisNetworkGraph: React.FC<VisNetworkGraphProps> = ({
    edgeCounts,
    totalVisits,
    totalNodeEdges,
    edgeOutcomeCounts,
    firstAttemptOutcomes,
    ratioEdges,
    maxEdgeCount,
    selectedSequence,
    uniqueStudentMode,
    colorNodesBySequence,
    minVisits,
    showEdgeLabels,
    stepSequences,
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const networkRef = useRef<Network | null>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        // Fallback hierarchy levels (mean step index) for when Graphviz is
        // unavailable — nodes seen early sit near the top.
        const idxSum: { [n: string]: number } = {};
        const idxCount: { [n: string]: number } = {};
        Object.values(stepSequences).forEach((problems) => {
            Object.values(problems).forEach((seq) => {
                seq.forEach((node, i) => {
                    idxSum[node] = (idxSum[node] || 0) + i;
                    idxCount[node] = (idxCount[node] || 0) + 1;
                });
            });
        });
        const levelFor = (n: string): number => (idxCount[n] ? Math.round(idxSum[n] / idxCount[n]) : 0);

        const countsForEdges = uniqueStudentMode ? edgeCounts : totalVisits;
        const outcomesForEdges = uniqueStudentMode ? firstAttemptOutcomes : edgeOutcomeCounts;

        // Kept edges (above threshold) with their display metadata.
        const nodeIds = new Set<string>();
        const edgeMeta: Array<{ key: string; from: string; to: string; count: number; color: string; width: number }> = [];
        for (const edgeKey of Object.keys(countsForEdges)) {
            const count = countsForEdges[edgeKey] || 0;
            if (count < minVisits) continue;
            const [from, to] = edgeKey.split('->');
            if (!from || !to) continue;
            nodeIds.add(from);
            nodeIds.add(to);
            edgeMeta.push({
                key: edgeKey,
                from,
                to,
                count,
                color: dominantOutcomeColor(outcomesForEdges[edgeKey] || {}),
                width: maxEdgeCount > 0 ? Math.max(1, (count / maxEdgeCount) * 10) : 1,
            });
        }
        const keptKeys = new Set(edgeMeta.map((e) => e.key));

        // Compute Graphviz layout (node positions + edge splines) from a bare
        // nodes+edges DOT.
        const esc = (s: string) => s.replace(/"/g, '\\"');
        const dot = [
            'digraph {',
            '  rankdir=TB;',
            ...Array.from(nodeIds).map((n) => `  "${esc(n)}";`),
            ...edgeMeta.map((e) => `  "${esc(e.from)}" -> "${esc(e.to)}";`),
            '}',
        ].join('\n');
        const gv = graphvizLayout(dot);

        const totalSteps = selectedSequence.length;
        const nodes = Array.from(nodeIds).map((id) => {
            const seqPos = selectedSequence.indexOf(id);
            const onSeq = colorNodesBySequence && seqPos >= 0;
            const bg = onSeq ? sequenceColor(seqPos, totalSteps) : '#CCCCCC';
            const students = totalNodeEdges[id] || 0;
            const p = gv ? gv.nodes[id] : undefined;
            return {
                id,
                label: id,
                ...(p ? { x: p.x, y: p.y } : { level: levelFor(id) }),
                color: {
                    background: bg,
                    border: '#2b2b2b',
                    highlight: { background: bg, border: '#1cb0ff' },
                    hover: { background: bg, border: '#1cb0ff' },
                },
                borderWidth: 1.5,
                shape: 'box',
                font: { size: 14, color: '#111111' },
                title: `${id}\n${students.toLocaleString()} students`,
            };
        });

        // vis-network's own edge objects. When Graphviz layout is available we
        // draw the Graphviz splines by default (below) and keep these in reserve;
        // once the user drags a node, we swap these in so edges follow the node.
        const visEdges = edgeMeta.map((e) => {
            const hasReverse = e.from !== e.to && keptKeys.has(`${e.to}->${e.from}`);
            const primary = e.from < e.to;
            const pct = ((ratioEdges[e.key] || 0) * 100).toFixed(1);
            return {
                id: e.key,
                from: e.from,
                to: e.to,
                label: showEdgeLabels ? e.count.toLocaleString() : undefined,
                width: e.width,
                color: { color: e.color, highlight: e.color, hover: e.color },
                arrows: 'to',
                font: { size: 11, align: hasReverse ? (primary ? 'top' : 'bottom') : 'middle', background: 'white', strokeWidth: 3, strokeColor: 'white' },
                title: `${e.from} → ${e.to}\n${e.count.toLocaleString()} ${uniqueStudentMode ? 'students' : 'visits'} (${pct}%)`,
                smooth: hasReverse
                    ? { enabled: true, type: 'curvedCW', roundness: 0.3 }
                    : { enabled: true, type: 'cubicBezier', forceDirection: 'vertical', roundness: 0.4 },
            };
        });

        // Edges to hand-draw from Graphviz splines (empty in the fallback path).
        const drawEdges = gv
            ? edgeMeta
                .map((e) => ({ ...e, points: gv.edges[e.key] }))
                .filter((e) => e.points && e.points.length >= 2)
            : [];

        // Edges live in a DataSet so we can inject the vis-network edges on drag.
        // Start empty in the Graphviz path (splines are hand-drawn); start
        // populated in the fallback path.
        const edgesDs = new DataSet<any>(gv ? [] : visEdges);
        const data = { nodes, edges: edgesDs };
        const options = {
            layout: {
                hierarchical: gv
                    ? { enabled: false }
                    : {
                        enabled: true,
                        direction: 'UD',
                        sortMethod: 'directed',
                        levelSeparation: 90,
                        nodeSpacing: 140,
                        treeSpacing: 160,
                        blockShifting: true,
                        edgeMinimization: true,
                        parentCentralization: true,
                    },
            },
            physics: { enabled: false },
            interaction: { hover: true, dragNodes: true, zoomView: true, dragView: true, tooltipDelay: 120 },
            nodes: { margin: { top: 6, bottom: 6, left: 10, right: 10 }, widthConstraint: { maximum: 200 } },
            edges: {
                color: { inherit: false },
                selfReference: { size: 22, angle: 0, renderBehindTheNode: false },
            },
        };

        const net = new Network(containerRef.current, data, options as any);
        networkRef.current = net;

        // Draw Graphviz edge splines beneath the nodes (beforeDrawing runs with
        // the view transform applied, so node-space coordinates line up). Only
        // the DEFAULT layout uses these; once a node is dragged we swap in
        // vis-network's live edges (which follow the moved node) and stop.
        if (gv) {
            let gvEdgesActive = true;
            net.on('dragStart', (params: any) => {
                if (gvEdgesActive && params?.nodes?.length) {
                    gvEdgesActive = false;
                    edgesDs.add(visEdges);
                    net.redraw();
                }
            });
            net.on('beforeDrawing', (ctx: CanvasRenderingContext2D) => {
                if (!gvEdgesActive) return;
                for (const e of drawEdges) {
                    const pts = e.points!;
                    ctx.beginPath();
                    ctx.moveTo(pts[0].x, pts[0].y);
                    let i = 1;
                    for (; i + 2 < pts.length; i += 3) {
                        ctx.bezierCurveTo(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, pts[i + 2].x, pts[i + 2].y);
                    }
                    for (; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y); // any leftover points
                    ctx.strokeStyle = e.color;
                    ctx.lineWidth = e.width;
                    ctx.lineCap = 'round';
                    ctx.lineJoin = 'round';
                    ctx.stroke();

                    // Arrowhead at the head end, aimed along the final segment.
                    const a = pts[pts.length - 2];
                    const b = pts[pts.length - 1];
                    const ang = Math.atan2(b.y - a.y, b.x - a.x);
                    const s = Math.max(9, e.width * 1.6);
                    ctx.beginPath();
                    ctx.moveTo(b.x, b.y);
                    ctx.lineTo(b.x - s * Math.cos(ang - Math.PI / 7), b.y - s * Math.sin(ang - Math.PI / 7));
                    ctx.lineTo(b.x - s * Math.cos(ang + Math.PI / 7), b.y - s * Math.sin(ang + Math.PI / 7));
                    ctx.closePath();
                    ctx.fillStyle = e.color;
                    ctx.fill();

                    // Count label at the spline midpoint.
                    if (showEdgeLabels) {
                        const mid = pts[Math.floor(pts.length / 2)];
                        const text = e.count.toLocaleString();
                        ctx.font = '11px sans-serif';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        const w = ctx.measureText(text).width;
                        ctx.fillStyle = 'rgba(255,255,255,0.85)';
                        ctx.fillRect(mid.x - w / 2 - 2, mid.y - 7, w + 4, 14);
                        ctx.fillStyle = '#111111';
                        ctx.fillText(text, mid.x, mid.y);
                    }
                }
            });
        }

        net.once('afterDrawing', () => {
            net.fit();
            // Fallback path: keep hierarchical positions but drop the axis lock
            // so nodes drag in both directions.
            if (!gv) {
                const positions = net.getPositions();
                net.setOptions({ layout: { hierarchical: { enabled: false } }, physics: false });
                Object.entries(positions).forEach(([id, p]) => net.moveNode(id, p.x, p.y));
            }
        });

        return () => {
            networkRef.current?.destroy();
            networkRef.current = null;
        };
    }, [
        edgeCounts, totalVisits, totalNodeEdges, edgeOutcomeCounts, firstAttemptOutcomes,
        ratioEdges, maxEdgeCount, selectedSequence, uniqueStudentMode, colorNodesBySequence, minVisits, showEdgeLabels, stepSequences,
    ]);

    return <div ref={containerRef} className="w-full h-full" />;
};

export default VisNetworkGraph;
