// Export-side helpers for the Path Analysis graphs: the masthead baked onto an
// exported image, the population counts it states, and the README bundled with a
// download. Ported from the Streamlit tool's data/path_analysis_graphviz.py so
// the two tools' exports read the same, with this tool's actual inputs (an
// uploaded MATHia transaction CSV) substituted for the Streamlit page's
// section/problem selection.
//
// Pure and DOM-free so it stays testable; the React side supplies the DOT
// strings, titles, and counts.

import { OUTCOME_LEGEND, NODE_FILL_LEGEND } from './GraphvizProcessing';

// --- Export title block -----------------------------------------------------
// An exported image is usually read away from the app, so it carries a small
// masthead: which problem it is (heading + subheading, derived from the ids),
// which population/view it shows (caption), and the threshold caveat (footnote,
// set in the bottom-right corner so it reads as a note rather than a title).
const TITLE_HEADING_SIZE = 22;
const TITLE_SUBHEADING_SIZE = 15;
const TITLE_CAPTION_SIZE = 11;
const TITLE_FOOTNOTE_SIZE = 9;
const TITLE_SUBHEADING_COLOR = '#333333';
const TITLE_CAPTION_COLOR = '#666666';
const TITLE_FOOTNOTE_COLOR = '#888888';
// Wrapper cluster used to hang a top title off the graph while the root's own
// label serves as the bottom-corner footnote (a graph can only carry one label).
const EXPORT_CLUSTER_NAME = 'cluster_export_body';

/** Minimal HTML-entity escaping for text placed inside an HTML-like label. */
const escapeHtml = (s: string): string =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Turn an id fragment into title-case words: "dg_hypotenuse_sought" →
 * "Dg Hypotenuse Sought".
 *
 * Separators (`_`, `-`) become spaces. Words that are all digits keep their exact
 * form (so "001" is not mangled into "1"), and words that are already
 * mixed/upper case are left alone (an acronym like "JIT" stays "JIT").
 */
export const humanizeIdFragment = (fragment: string): string => {
    const words = fragment.replace(/-/g, ' ').replace(/_/g, ' ').split(/\s+/).filter(Boolean);
    return words
        .map((w) => {
            const isDigits = /^\d+$/.test(w);
            const isLower = w === w.toLowerCase();
            return isDigits || !isLower ? w : w.charAt(0).toUpperCase() + w.slice(1);
        })
        .join(' ');
};

/**
 * Human-readable [heading, subheading] for a problem.
 *
 * The heading is the workspace id humanized; the subheading comes from the
 * problem name. Problem names usually end in a number identifying the problem
 * within the workspace, e.g. workspace "ratio_proportion_change4" and problem
 * "ratio_proportion_mix4-164" → ("Ratio Proportion Change4", "Ratio Proportion
 * Mix4: Problem 164"). Whatever of the problem name isn't already in the
 * workspace id becomes the subheading, so nothing identifying is dropped when a
 * name doesn't follow that convention.
 */
export const problemDisplayTitle = (workspaceId: string, problemName: string): [string, string] => {
    const heading = humanizeIdFragment(workspaceId);
    let remainder = problemName.startsWith(workspaceId)
        ? problemName.slice(workspaceId.length)
        : problemName;
    remainder = remainder.replace(/^[_-]+/, '').replace(/[_-]+$/, '');

    // A trailing numeric chunk is the problem's number within the workspace.
    const parts = remainder.replace(/-/g, '_').split('_').filter(Boolean);
    const number = parts.length && /^\d+$/.test(parts[parts.length - 1]) ? parts.pop()! : null;
    const descriptor = humanizeIdFragment(parts.join('_'));

    if (number && descriptor) return [heading, `${descriptor}: Problem ${number}`];
    if (number) return [heading, `Problem ${number}`];
    return [heading, descriptor];
};

/**
 * Heading/subheading for a whole dataset, which may cover more than one
 * workspace or problem. A single workspace+problem gets the same title a
 * Streamlit export would; anything broader is named by its file and counted, so
 * the masthead never implies the graph is about one problem when it isn't.
 */
export const datasetDisplayTitle = (
    datasetName: string,
    workspaceIds: string[],
    problemNames: string[]
): [string, string] => {
    if (workspaceIds.length === 1 && problemNames.length === 1) {
        return problemDisplayTitle(workspaceIds[0], problemNames[0]);
    }
    const heading = workspaceIds.length === 1
        ? humanizeIdFragment(workspaceIds[0])
        : humanizeIdFragment(datasetName);
    const scope: string[] = [];
    if (workspaceIds.length > 1) scope.push(`${workspaceIds.length.toLocaleString()} workspaces`);
    if (problemNames.length > 1) scope.push(`${problemNames.length.toLocaleString()} problems`);
    else if (problemNames.length === 1) scope.push(humanizeIdFragment(problemNames[0]));
    return [heading, scope.join(' · ')];
};

/**
 * Unique students whose path uses at least one of `edgeKeys`.
 *
 * This is the population an exported graph actually *shows*: thresholding drops
 * low-traffic edges, so the graph can represent fewer students than the view's
 * total. Students whose path is a single step (no transitions) are not
 * represented by any edge and so are not counted.
 */
export const countStudentsOnEdges = (
    stepSequences: { [student: string]: { [problem: string]: string[] } },
    edgeKeys: Set<string>
): number => {
    let count = 0;
    for (const byProblem of Object.values(stepSequences)) {
        const onGraph = Object.values(byProblem).some((steps) => {
            for (let i = 0; i < steps.length - 1; i++) {
                if (edgeKeys.has(`${steps[i]}->${steps[i + 1]}`)) return true;
            }
            return false;
        });
        if (onGraph) count++;
    }
    return count;
};

/**
 * The edges a generated DOT string actually draws. The threshold and min-visits
 * filters live inside generateDotString, so reading the emitted edges back is
 * the only way to know what survived — and it stays correct if that filtering
 * ever changes.
 */
export const drawnEdgeKeys = (dot: string): Set<string> => {
    const keys = new Set<string>();
    const pattern = /"((?:[^"\\]|\\.)*)"\s*->\s*"((?:[^"\\]|\\.)*)"/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(dot)) !== null) {
        keys.add(`${match[1]}->${match[2]}`);
    }
    return keys;
};

/** One centered line of the export masthead as an HTML-like label row. */
const titleRow = (text: string, size: number, color?: string, bold = false): string => {
    const inner = bold ? `<B>${escapeHtml(text)}</B>` : escapeHtml(text);
    const colorAttr = color ? ` COLOR="${color}"` : '';
    return `<TR><TD ALIGN="CENTER"><FONT POINT-SIZE="${size}"${colorAttr}>${inner}</FONT></TD></TR>`;
};

/**
 * Split a generated DOT string into its attribute preamble and its body. The
 * preamble is `digraph G {` plus the leading graph/node/edge attribute
 * statements; the body is everything else, minus the closing brace. Returns null
 * when the string doesn't have that shape (e.g. the "no valid sequences" stub),
 * so callers can fall back to a plain label.
 */
const splitDot = (dot: string): { preamble: string[]; body: string[] } | null => {
    const lines = dot.replace(/\s+$/, '').split('\n');
    if (lines.length < 2 || !/^\s*digraph\b/.test(lines[0])) return null;
    if (!lines[lines.length - 1].trim().endsWith('}')) return null;

    const preamble = [lines[0]];
    let i = 1;
    while (i < lines.length - 1 && /^\s*(graph|node|edge)\s*\[.*\];\s*$/.test(lines[i])) {
        preamble.push(lines[i]);
        i++;
    }
    // The last line closes the digraph; drop it (and a bare trailing "}" only).
    const last = lines[lines.length - 1].trim();
    const body = lines.slice(i, lines.length - 1);
    if (last !== '}') body.push(last.replace(/}\s*$/, ''));
    return { preamble, body };
};

/**
 * Add a multi-line masthead (and optional bottom-right footnote) to a generated
 * DOT string.
 *
 * `caption` is one line or several (empty ones are dropped), each rendered under
 * the subheading in the smaller caption style.
 *
 * Graphviz allows a single label per graph, so the body is wrapped in a
 * borderless cluster that carries the top title while the root graph's label
 * carries the footnote at the bottom right. Falls back to a plain top label if
 * the DOT doesn't have the expected preamble/body split.
 */
export const addExportTitle = (
    dot: string,
    opts: { heading: string; subheading?: string; caption?: string | string[]; footnote?: string }
): string => {
    const { heading, subheading = '', caption = '', footnote = '' } = opts;
    const rows = [titleRow(heading, TITLE_HEADING_SIZE, undefined, true)];
    if (subheading) rows.push(titleRow(subheading, TITLE_SUBHEADING_SIZE, TITLE_SUBHEADING_COLOR));
    const captionLines = (typeof caption === 'string' ? [caption] : caption).filter(Boolean);
    captionLines.forEach((line) => rows.push(titleRow(line, TITLE_CAPTION_SIZE, TITLE_CAPTION_COLOR)));
    const titleLabel =
        '<<TABLE BORDER="0" CELLBORDER="0" CELLSPACING="0" CELLPADDING="3">'
        + rows.join('')
        + '</TABLE>>';

    const split = splitDot(dot);
    if (!split) return addTitleLabel(dot, heading);

    const out = [...split.preamble];
    if (footnote) {
        out.push(
            `  label=<<FONT POINT-SIZE="${TITLE_FOOTNOTE_SIZE}" `
            + `COLOR="${TITLE_FOOTNOTE_COLOR}">${escapeHtml(footnote)}</FONT>>;`
        );
        out.push('  labelloc="b";');
        out.push('  labeljust="r";');
    }
    out.push(`  subgraph ${EXPORT_CLUSTER_NAME} {`);
    // peripheries=0 hides the cluster box: it exists only to anchor the title.
    out.push('    peripheries=0;');
    out.push(`    label=${titleLabel};`);
    out.push('    labelloc="t";');
    // Say "centered" explicitly: a cluster inherits the root's labeljust, and the
    // root sets it to "r" to push the footnote into the bottom-right corner —
    // which would drag the masthead off-center to the right with it.
    out.push('    labeljust="c";');
    out.push(...split.body);
    out.push('  }');
    out.push('}');
    return out.join('\n') + '\n';
};

/** Insert a plain top-of-graph title. Used when the masthead is switched off. */
export const addTitleLabel = (dot: string, title: string): string => {
    const split = splitDot(dot);
    const label = `  label="${title.replace(/"/g, '\\"')}";\n  labelloc="t";`;
    if (!split) return dot;
    return [...split.preamble, label, ...split.body, '}'].join('\n') + '\n';
};

/**
 * Ready a generated DOT string for export.
 *
 * Two on-screen concessions have to be undone:
 *
 * - **`size` / `dpi`.** Edge mode asks Graphviz to fit the drawing into 8×6
 *   inches so a wide network fits the panel, and both modes ask for 150 dpi to
 *   sharpen the on-screen render. Both only change the scale factor Graphviz
 *   puts on the drawing's root `<g>`, and an exported file wants neither: the
 *   size cap squeezes a tall graph into a 576×432pt sliver, and the export
 *   rasterizes at its own resolution anyway. Exports lay out at natural size,
 *   as the Streamlit tool does.
 * - **`bgcolor`.** On screen a graph inherits the page behind it. A downloaded
 *   file has no such backdrop, and a transparent PNG or SVG renders on whatever
 *   the viewer supplies — a dark background swallows the black step labels.
 */
export const prepareExportDot = (dot: string, background = 'white'): string => {
    const lines = dot.split('\n');
    const graphAttrIndex = lines.findIndex((l) => /^\s*graph\s*\[/.test(l));
    if (graphAttrIndex < 0) {
        // No graph attribute statement to amend — add one after the header.
        const headerIndex = lines.findIndex((l) => /^\s*digraph\b/.test(l));
        if (headerIndex < 0) return dot;
        lines.splice(headerIndex + 1, 0, `  graph [bgcolor="${background}"];`);
        return lines.join('\n');
    }
    let attrs = lines[graphAttrIndex];
    // Drop the fit-to-panel cap and the screen dpi, along with any separator
    // they leave behind.
    attrs = attrs
        .replace(/\bsize\s*=\s*"[^"]*"\s*,?\s*/, '')
        .replace(/\bdpi\s*=\s*[\d.]+\s*,?\s*/, '')
        .replace(/,\s*\]/, ']')
        .replace(/\[\s*,\s*/, '[');
    if (!/\bbgcolor\s*=/.test(attrs)) {
        attrs = attrs.replace(/\]\s*;\s*$/, `, bgcolor="${background}"];`).replace(/\[\s*,\s*/, '[');
    }
    lines[graphAttrIndex] = attrs;
    return lines.join('\n');
};

// --- README -----------------------------------------------------------------

const yesNo = (value: boolean): string => (value ? 'Yes' : 'No');

/** One graph in an export: its on-screen title, file stem, and population. */
export interface ReadmeGraph {
    title: string;
    baseFilename: string;
    totalStudents: number;
}

export interface ReadmeOptions {
    /** Name of the uploaded dataset (the CSV file, minus its extension). */
    datasetName: string;
    /** Workspace ids present in the data (`Level (Workspace Id)`). */
    workspaceIds: string[];
    /** Problem names present in the data (`Problem Name`). */
    problemNames: string[];
    /** Unique-student mode: each step counted once, on its first attempt. */
    firstAttemptOnly: boolean;
    includeSelfLoops: boolean;
    errorMode: boolean;
    /** 'node' (outcome bars fill each node) or 'edge' (outcome colors edges). */
    outcomeMode: 'node' | 'edge';
    highlightSelectedSequence: boolean;
    /** The edge-threshold setting in effect, e.g. "8% (per graph)". */
    thresholdLabel: string;
    graphs: ReadmeGraph[];
    generatedOn?: string;
}

/**
 * Build the Markdown README bundled into a Path Analysis export.
 *
 * Explains what the exported graphs represent, how the underlying data is
 * processed, and how to read the visual encoding — enough for a researcher who
 * receives only the `.zip` to interpret it without the live tool.
 *
 * The "Reading the graph" and palette sections are specific to one outcome mode,
 * so a both-modes export gets one README per mode.
 */
export const buildExportReadme = (opts: ReadmeOptions): string => {
    const {
        datasetName, workspaceIds, problemNames, firstAttemptOnly, includeSelfLoops,
        errorMode, outcomeMode, highlightSelectedSequence, thresholdLabel, graphs, generatedOn,
    } = opts;
    const nodeMode = outcomeMode === 'node';
    const hasSelectedSequence = graphs.some((g) => g.title.toLowerCase().includes('selected sequence'));

    let provenance = 'Path Analysis Tool';
    if (generatedOn) provenance += ` · exported ${generatedOn}`;

    /** One-line population description for a graph, by its title. */
    const graphDesc = (title: string): string => {
        const t = title.toLowerCase();
        if (t.includes('selected sequence')) return 'one chosen path, drawn top to bottom';
        if (t.includes('graduated')) return 'only students who reached GRADUATED status';
        if (t.includes('promoted')) return 'only students who reached PROMOTED status';
        return 'every student in the dataset, all transitions';
    };

    // Only the graphs actually in this export are described (with their
    // population), so the README matches the images in the bundle.
    const graphLines = graphs.length
        ? graphs
            .map((g) => `- **${g.title}** — \`${g.baseFilename}\` — ${g.totalStudents.toLocaleString()} students — ${graphDesc(g.title)}`)
            .join('\n')
        : '- (none)';

    // The palette means different marks in each mode: it fills the per-node
    // outcome bar (node mode) or colors each edge (edge mode).
    const paletteIntro = nodeMode
        ? "These colors fill each node's outcome bar:"
        : "These colors set each edge's color (its single most common outcome):";
    const outcomeLines = (nodeMode ? NODE_FILL_LEGEND : OUTCOME_LEGEND)
        .map(([label, color]) => `- **${label}** — \`${color}\``)
        .join('\n');

    // "Statistics" and "Reading the graph" describe what is ACTUALLY drawn in
    // the exported images, which depends on the outcome-coloring mode.
    let statsStep: string;
    const reading: string[] = [];
    if (nodeMode) {
        statsStep = '**Statistics.** Per step: unique students, total visits, and the '
            + "outcome mix that fills the node's bar.";
        reading.push(
            "**Nodes** are filled with a 100% stacked bar of that step's outcome mix "
            + '(colors below), so success and struggle read at the step where they happen.'
        );
        reading.push(
            '**Edges** are neutral gray flow arrows; a thicker arrow means more students '
            + 'used that transition.'
        );
        reading.push(
            highlightSelectedSequence
                ? 'Steps on the selected sequence are drawn with a bold outline, and the '
                  + 'transitions along it in a solid (not translucent) gray.'
                : 'The selected sequence is **not** marked in the full graphs — every step '
                  + 'is drawn alike.'
        );
    } else {
        statsStep = '**Statistics.** Per transition: unique students, total traversals, the '
            + 'outcome mix (edge color), and the error share; per step: visits and the '
            + 'outcome mix.';
        const thicker = 'a thicker arrow means more students used that transition'
            + (errorMode ? ' (non-error traversals, in Error mode)' : '');
        reading.push(
            `**Edges** are colored by their single most common outcome (colors below); ${thicker}.`
        );
        reading.push(
            highlightSelectedSequence
                ? '**Nodes** are tinted white → blue by their position in the selected '
                  + "sequence (off-sequence steps are gray), and the sequence's own "
                  + 'transitions are drawn in a solid, fully saturated version of their '
                  + 'outcome color.'
                : '**Nodes** are a uniform gray: the selected sequence is **not** marked in '
                  + 'the full graphs.'
        );
        if (errorMode) {
            reading.push(
                'A **dashed red** edge (or dashed red overlay) carries the error signal — an '
                + 'edge every student errored on, or the error share of a partially-errored edge.'
            );
        }
    }
    reading.push(
        'A **self-loop** (an arrow from a step back to itself) means students repeated that '
        + 'step before moving on.'
    );
    const readingBullets = reading.map((b) => `- ${b}`).join('\n');

    const definitions = [
        '**Unique students** — distinct students (each counted once), versus **visits / '
        + 'transitions**, which count every occurrence including repeats.',
    ];
    if (nodeMode) {
        definitions.push('**Success rate** (per step) — Correct ÷ (Correct + Error) at that step.');
    } else {
        definitions.push(
            "**Transition probability** — the unique students on this transition ÷ the source "
            + "step's unique students, shown in tooltips as \"N of M students\"."
        );
        definitions.push(
            '**Error rate** (per transition) — of the students on an edge, the share whose '
            + 'outcome at the source step was an error.'
        );
    }
    if (hasSelectedSequence) {
        definitions.push(
            '**Funnel / "students still on this path"** — in the Selected Sequence graph, the '
            + 'students still following the chosen path at each step (never increases along the path).'
        );
    }
    const definitionsBlock = definitions.map((d) => `- ${d}`).join('\n');

    const listOrCount = (values: string[], label: string): string =>
        values.length === 1
            ? `\`${values[0]}\``
            : `${values.length.toLocaleString()} ${label}`;

    return `# Path Analysis Export

${provenance}

This bundle contains one or more path-flow graphs plus this README. Each graph
shows how students moved from step to step while working a problem.

## This export

| Field | Value |
| --- | --- |
| Dataset | \`${datasetName}\` |
| Workspace (Level) ID | ${listOrCount(workspaceIds, 'workspaces')} |
| Problem Name | ${listOrCount(problemNames, 'problems')} |
| Outcome display | ${nodeMode ? 'Nodes' : 'Edges'} |
| First attempt only (unique students) | ${yesNo(firstAttemptOnly)} |
| Self-loops (repeated same step) | ${includeSelfLoops ? 'Included' : 'Excluded'} |
| Error mode (highlight errors) | ${yesNo(errorMode)} |
| Selected sequence marked in full graphs | ${yesNo(highlightSelectedSequence)} |
| Edge threshold setting | ${thresholdLabel} |

Each graph file name ends with \`_min<N>\`, where **N** is the minimum number of
transitions an edge needed before it was drawn in that graph (edges below the
threshold are hidden to cut noise).

### Graphs included

${graphLines}

## What the graphs represent

Each **node** is a *step* of the problem (the step name from the transaction
log); each **directed edge** A → B means students moved from step A to step B.
This export shows outcomes on the **${nodeMode ? 'nodes' : 'edges'}** — see
*Reading the graph* below. The graphs and populations included are listed under
*Graphs included* above.

## How the data is processed

1. **Source.** An uploaded MATHia transaction CSV. Each row is one step attempt
   with its outcome, attempt number, and timestamp. Rows the tutor autofilled
   (\`CF (Is Autofilled)\` true) are dropped before anything else, and a missing
   step name is read as \`DoneButton\`. The raw \`OK\` outcome is normalized to
   \`CORRECT\`.
2. **Sequencing.** For each student and problem, events are ordered by timestamp
   into a sequence of steps. With *unique students / first attempts* on, each
   step is counted once per student (and self-loops are forced off). With
   *self-loops* off, consecutive repeats of the same step are collapsed to one.
3. ${statsStep}
4. **Thresholding.** Edges below the threshold above are dropped before drawing.
   Each graph's slider is capped so the graph cannot be split into disconnected
   pieces.

## Reading the graph

This export uses **${nodeMode ? 'node' : 'edge'} outcome coloring**:

${readingBullets}

### Outcome colors (colorblind-safe Okabe-Ito palette)

${paletteIntro}

${outcomeLines}

## Definitions

${definitionsBlock}
`;
};
