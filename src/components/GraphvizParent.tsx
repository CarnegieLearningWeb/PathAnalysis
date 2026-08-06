// React component code
import React, { useContext, useEffect, useRef, useState, useMemo } from 'react';
import { graphviz } from 'd3-graphviz';
import {
    generateDotString,
    normalizeThicknesses,
    countEdges,
    countEdgesForSelectedSequence,
    createStepSequences,
    createOutcomeSequences,
    loadAndSortData,
    calculateMaxMinEdgeCount,
    calculateConnectivityCap,
    analyzeEquationAnswerTransitions,
    formatEquationAnswerStats,
    computeSequenceFunnelCounts,
    computeSequenceErrorCounts
} from './GraphvizProcessing';
import ErrorBoundary from "@/components/errorBoundary.tsx";
import '../GraphvizContainer.css';
import { Context } from "@/Context.tsx";
import { Button } from './ui/button';
import { Download } from 'lucide-react';
import GraphMenu from './GraphMenu';
import {
    addExportTitle,
    addTitleLabel,
    buildExportReadme,
    countStudentsOnEdges,
    datasetDisplayTitle,
    drawnEdgeKeys,
    prepareExportDot,
} from './graphExport';
import {
    downloadFile,
    downloadZip,
    renderDotToFiles,
    type ExportFile,
    type ExportFormat,
} from './exportRender';

// History item interface
interface HistoryItem {
    id: string;
    type: 'node' | 'edge';
    timestamp: Date;
    title: string;
    content: string;
    graphType: string;
    expanded: boolean;
}

const titleCase = (str: string | null) => str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : '';

// Outcome-coloring modes offered by the export, independent of what's on screen:
// the same graph can be written out with node bars, edge colors, or both.
const EXPORT_OUTCOME_MODES: Array<{ label: string; mode: 'node' | 'edge' }> = [
    { label: 'Nodes', mode: 'node' },
    { label: 'Edges', mode: 'edge' },
];
// Mode suffix for filenames, used only when an export covers both modes (a
// single-mode export keeps the plain, unsuffixed stem).
const MODE_FILE_SUFFIX: { [mode: string]: string } = {
    node: 'node_outcomes',
    edge: 'edge_outcomes',
};
const EXPORT_FORMATS: Array<{ label: string; format: ExportFormat }> = [
    { label: 'PNG (image)', format: 'png' },
    { label: 'SVG (vector)', format: 'svg' },
    { label: 'DOT (source)', format: 'dot' },
];

/**
 * Everything the export needs to re-render one graph. `buildDot` re-runs that
 * graph's DOT generation with the outcome mode and sequence emphasis the export
 * asks for, rather than the ones on screen — so a download can carry both
 * coloring modes without the user toggling anything.
 */
interface ExportGraphEntry {
    title: string;
    baseFilename: string;
    minVisits: number;
    /** Unique students in this graph's population, before thresholding. */
    totalStudents: number;
    /** Selected Sequence view only: students who followed the path exactly. */
    followedCount: number | null;
    /** Full graphs: students of THIS graph who walked the sequence end to end. */
    sequenceMatchCount: number | null;
    stepSequences: { [student: string]: { [problem: string]: string[] } };
    buildDot: (opts: { nodeOutcomeMode: boolean; highlightSelectedSequence: boolean }) => string;
}

// Default edge-visibility threshold for a graph: 8% of its max edge count,
// floored at 1. Matches the Streamlit tool — given the thickness formula
// (count / max * 10), 8% hides edges thinner than 0.8pt.
const defaultMinVisits = (maxEdgeCount: number): number => Math.max(1, Math.round(maxEdgeCount * 0.08));

// Helper function to compare arrays for exact equality
const arraysEqual = (a: string[], b: string[]): boolean => {
    if (a.length !== b.length) return false;
    return a.every((val, index) => val === b[index]);
};

/**
 * Distinct students whose path through some problem is exactly `sequence` — the
 * "took it end to end" count. Students, not paths, because it is always stated
 * against a student population (this graph's students, or the ones its drawn
 * edges represent). Returns null when there is no sequence to match.
 */
const countStudentsOnExactSequence = (
    stepSequences: { [student: string]: { [problem: string]: string[] } },
    sequence: string[] | null | undefined
): number | null => {
    if (!sequence || sequence.length === 0) return null;
    let count = 0;
    Object.values(stepSequences).forEach((byProblem) => {
        if (Object.values(byProblem).some((steps) => arraysEqual(steps, sequence))) count++;
    });
    return count;
};

// Per-node outcome mix (all visits + first attempt) restricted to a set of
// students. Same per-step attribution as computeNodeOutcomeTallies, used to
// scope the Selected Sequence tooltip to exact-sequence students.
const computeScopedNodeOutcomes = (
    node: string,
    students: Set<string>,
    stepSequences: { [s: string]: { [p: string]: string[] } },
    outcomeSequences: { [s: string]: { [p: string]: string[] } }
): { all: { [o: string]: number }; firstAttempt: { [o: string]: number } } => {
    const all: { [o: string]: number } = {};
    const firstAttempt: { [o: string]: number } = {};
    students.forEach(studentId => {
        const problems = stepSequences[studentId] || {};
        const outByProblem = outcomeSequences[studentId] || {};
        let seen = false;
        Object.keys(problems).forEach(problemName => {
            const steps = problems[problemName];
            const outs = outByProblem[problemName] || [];
            for (let i = 0; i < steps.length && i < outs.length; i++) {
                if (steps[i] === node) {
                    all[outs[i]] = (all[outs[i]] || 0) + 1;
                    if (!seen) { seen = true; firstAttempt[outs[i]] = (firstAttempt[outs[i]] || 0) + 1; }
                }
            }
        });
    });
    return { all, firstAttempt };
};

interface GraphvizParentProps {
    csvData: string;
    filters: string[];
    selfLoops: boolean;
    minVisits: number; // Global default, can be overridden per graph
    onMaxEdgeCountChange: (count: number) => void;
    onMaxMinEdgeCountChange: (count: number) => void;
    errorMode: boolean;
    uniqueStudentMode: boolean;
    nodeOutcomeMode: boolean;
    showSelectedSequence: boolean;
    showAllStudents: boolean;
    colorNodesBySequence: boolean;
    showEdgeLabels: boolean;
    problemName: string;
}

const GraphvizParent: React.FC<GraphvizParentProps> = ({
    csvData,
    filters,
    selfLoops,
    minVisits,
    onMaxEdgeCountChange,
    onMaxMinEdgeCountChange,
    errorMode,
    uniqueStudentMode,
    nodeOutcomeMode,
    showSelectedSequence,
    showAllStudents,
    colorNodesBySequence,
    showEdgeLabels,
    problemName
}) => {
    const [dotString, setDotString] = useState<string | null>(null);
    const [filteredDotStrings, setFilteredDotStrings] = useState<{[key: string]: string}>({});
    const [topDotString, setTopDotString] = useState<string | null>(null);
    const { selectedSequence, setSelectedSequence, top5Sequences, setTop5Sequences } = useContext(Context);

    // Per-graph min visits state - initialized to empty, will be set when data loads
    const [minVisitsPerGraph, setMinVisitsPerGraph] = useState<{[key: string]: number}>({});

    // State for selected sequence graph filtering
    const [showOnlySequenceStudents, setShowOnlySequenceStudents] = useState<boolean>(true);

    // Node coloring (color nodes by selected sequence) is a global control,
    // lifted to App so it lives permanently in the controls panel.

    // History state management
    const [activeTab, setActiveTab] = useState<'graphs' | 'history'>('graphs');
    const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);

    // Track recent clicks to prevent duplicates
    const recentClicks = useRef<Set<string>>(new Set());

    // Export descriptors for each rendered graph, filled in by the same effects
    // that build the on-screen DOT. Held in a ref (not state): only the export
    // handlers read it, at click time, so writing it must not re-render.
    const exportRegistry = useRef<{ [graphKey: string]: ExportGraphEntry }>({});

    // Export panel controls
    const [exportOpen, setExportOpen] = useState<boolean>(false);
    const [exportGraphKeys, setExportGraphKeys] = useState<string[] | null>(null);
    const [exportModes, setExportModes] = useState<Array<'node' | 'edge'> | null>(null);
    const [exportFormats, setExportFormats] = useState<ExportFormat[]>(['png']);
    const [exportHighlightSequence, setExportHighlightSequence] = useState<boolean>(true);
    const [exportTitled, setExportTitled] = useState<boolean>(true);
    const [exportReadme, setExportReadme] = useState<boolean>(true);
    const [exportBusy, setExportBusy] = useState<boolean>(false);
    const [exportError, setExportError] = useState<string | null>(null);

    // File stem for an exported graph. The `_min<N>` suffix records the edge
    // threshold the graph was drawn at, which the README explains.
    const exportStem = (graphKey: string, minVisits: number): string =>
        `${problemName.replace(/[^a-zA-Z0-9]/g, '_')}_${graphKey}_min${minVisits}`;

    // Refs for rendering the Graphviz graphs
    const graphRefMain = useRef<HTMLDivElement>(null);
    const graphRefFilteredRefs = useRef<{[key: string]: React.RefObject<HTMLDivElement>}>({});
    const graphRefTop = useRef<HTMLDivElement>(null);

    // Create refs for each filter dynamically
    filters.forEach(filter => {
        if (!graphRefFilteredRefs.current[filter]) {
            graphRefFilteredRefs.current[filter] = React.createRef<HTMLDivElement>();
        }
    });

    // Memoized data processing for main graph - responds to both selfLoops setting and uniqueStudentMode
    const mainGraphData = useMemo(() => {
        if (!csvData) return null;
        
        const sortedData = loadAndSortData(csvData);
        // Self-loops should only be included when selfLoops is enabled AND not in unique student mode
        // In unique student mode (first attempts), self-loops are logically impossible
        const includeLoops = selfLoops && !uniqueStudentMode;
        const stepSequences = createStepSequences(sortedData, includeLoops);
        const outcomeSequences = createOutcomeSequences(sortedData);
        
        // Add equation answer analysis
        const equationStats = analyzeEquationAnswerTransitions(stepSequences, outcomeSequences);
        console.log(formatEquationAnswerStats(equationStats));
        
        const results = countEdges(stepSequences, outcomeSequences);
        
        return {
            sortedData,
            stepSequences,
            outcomeSequences,
            ...results
        };
    }, [csvData, selfLoops, uniqueStudentMode]); // Depends on both selfLoops and uniqueStudentMode

    // Dataset-level summary metrics for the whole unfiltered population.
    // Total Students counts distinct student IDs; Avg Path Length is the mean
    // length over every per-student-per-problem step sequence that feeds the
    // graph. Mirrors the Streamlit tool's create_summary_metrics, minus its
    // "Unique Paths" metric (dropped as low-signal — see decision notes).
    const summaryMetrics = useMemo(() => {
        if (!mainGraphData) return null;
        const { stepSequences } = mainGraphData;
        const totalStudents = Object.keys(stepSequences).length;
        const pathLengths: number[] = [];
        Object.values(stepSequences).forEach((byProblem: { [problem: string]: string[] }) => {
            Object.values(byProblem).forEach((seq) => pathLengths.push(seq.length));
        });
        const avgPathLength = pathLengths.length
            ? pathLengths.reduce((sum, n) => sum + n, 0) / pathLengths.length
            : 0;
        return { totalStudents, avgPathLength };
    }, [mainGraphData]);

    // Which workspace(s) and problem(s) the uploaded dataset covers. Only the
    // export uses this — to headline an image with the problem it belongs to,
    // and to say plainly when a file spans more than one.
    const datasetIdentity = useMemo(() => {
        const workspaceIds = new Set<string>();
        const problemNames = new Set<string>();
        (mainGraphData?.sortedData || []).forEach((row: any) => {
            const workspace = row['Level (Workspace Id)'];
            if (workspace) workspaceIds.add(workspace);
            if (row['Problem Name']) problemNames.add(row['Problem Name']);
        });
        const ids = Array.from(workspaceIds).sort();
        const problems = Array.from(problemNames).sort();
        const [heading, subheading] = datasetDisplayTitle(problemName, ids, problems);
        return { workspaceIds: ids, problemNames: problems, heading, subheading };
    }, [mainGraphData, problemName]);

    // Distinct students who followed the selected sequence exactly — the
    // "N students followed this sequence" caption, and the same number the
    // export states, so the image and the screen never disagree.
    const selectedSequenceCount = useMemo(() => {
        if (!mainGraphData) return 0;
        return countStudentsOnExactSequence(mainGraphData.stepSequences, selectedSequence) ?? 0;
    }, [mainGraphData, selectedSequence]);

    // Memoized filtered graph data for each filter
    const filteredGraphDataMap = useMemo(() => {
        if (!mainGraphData || filters.length === 0) return {};

        const result: {[key: string]: any} = {};

        filters.forEach(filter => {
            const filteredData = mainGraphData.sortedData.filter(row => row['CF (Workspace Progress Status)'] === filter);
            const filteredStepSequences = createStepSequences(filteredData, selfLoops && !uniqueStudentMode);
            const filteredOutcomeSequences = createOutcomeSequences(filteredData);

            const results = countEdges(filteredStepSequences, filteredOutcomeSequences);

            result[filter] = {
                filteredData,
                filteredStepSequences,
                filteredOutcomeSequences,
                edgeCounts: results.edgeCounts,
                totalNodeEdges: results.totalNodeEdges,
                ratioEdges: results.ratioEdges,
                edgeOutcomeCounts: results.edgeOutcomeCounts,
                maxEdgeCount: results.maxEdgeCount,
                totalVisits: results.totalVisits,
                repeatVisits: results.repeatVisits,
                firstAttemptOutcomes: results.firstAttemptOutcomes,
                edgeErrorStudentCounts: results.edgeErrorStudentCounts,
                nodeOutcomeCounts: results.nodeOutcomeCounts
            };
        });

        return result;
    }, [filters, mainGraphData, selfLoops, uniqueStudentMode]);

    // Highest min-visits threshold that keeps each graph in one connected
    // component. Used to cap the per-graph slider so the user can't fragment the
    // graph. Graph-only (independent of the selected sequence), so it is keyed
    // on the data + mode, not on selectedSequence.
    const connectivityCaps = useMemo(() => {
        const caps: {[key: string]: number} = {};
        if (mainGraphData) {
            const counts = uniqueStudentMode ? mainGraphData.edgeCounts : mainGraphData.totalVisits;
            caps['all_students'] = calculateConnectivityCap(counts);
        }
        Object.entries(filteredGraphDataMap).forEach(([filter, data]: [string, any]) => {
            const counts = uniqueStudentMode ? data.edgeCounts : data.totalVisits;
            caps[`filtered_graph_${filter}`] = calculateConnectivityCap(counts);
        });
        return caps;
    }, [mainGraphData, filteredGraphDataMap, uniqueStudentMode]);

    // 8% default clamped to the connectivity cap, so the initial threshold never
    // exceeds what keeps the graph connected (matches the Streamlit tool).
    const cappedDefault = (maxEdgeCount: number, cap: number | undefined): number =>
        Math.min(defaultMinVisits(maxEdgeCount), Math.max(1, cap ?? maxEdgeCount));

    // The min-visits threshold in effect for a graph: the user's stored value
    // (or the capped 8% default), itself clamped to the connectivity cap so it
    // can never exceed the slider max after a mode/data change desyncs them.
    const effectiveMinVisits = (key: string, maxEdgeCount: number): number => {
        const cap = connectivityCaps[key] ?? maxEdgeCount;
        const value = minVisitsPerGraph[key] ?? cappedDefault(maxEdgeCount, connectivityCaps[key]);
        return Math.min(value, cap);
    };

    // Main graph calculation - STATIC (only responds to uniqueStudentMode)
    useEffect(() => {
        if (mainGraphData) {
            const {
                edgeCounts: newEdgeCounts,
                totalNodeEdges,
                ratioEdges,
                edgeOutcomeCounts,
                maxEdgeCount,
                totalVisits,
                repeatVisits,
                topSequences
            } = mainGraphData;

            // Update the maxEdgeCount in the parent component based on mode
            const maxCountToUse = uniqueStudentMode ? maxEdgeCount : Math.max(...Object.values(totalVisits), 1);
            console.log("GraphvizParent: Setting maxEdgeCount to:", maxCountToUse, "for mode:", uniqueStudentMode ? "unique students" : "total visits");
            onMaxEdgeCountChange(maxCountToUse);

            // Calculate and update the maximum minimum-edge count
            const sequenceToUse = selectedSequence || topSequences[0]?.sequence;
            if (sequenceToUse) {
                console.log("GraphvizParent: Calculating maxMinEdgeCount for MAIN graph");
                console.log("GraphvizParent: Sequence length:", sequenceToUse.length);
                console.log("GraphvizParent: Total edge count keys:", Object.keys(newEdgeCounts).length);
                console.log("GraphvizParent: Unique student mode:", uniqueStudentMode);
                
                // Use edgeCounts (unique students) or totalVisits based on mode
                const countsToUse = uniqueStudentMode ? newEdgeCounts : totalVisits;
                const maxMinEdgeCount = calculateMaxMinEdgeCount(countsToUse, sequenceToUse);
                console.log("GraphvizParent: Setting maxMinEdgeCount to:", maxMinEdgeCount);
                onMaxMinEdgeCountChange(maxMinEdgeCount);
            }

            if (JSON.stringify(top5Sequences) !== JSON.stringify(topSequences) || top5Sequences === null) {
                setTop5Sequences(topSequences);
                if (topSequences && selectedSequence === undefined) {
                    setSelectedSequence(topSequences[0].sequence);
                }
            }

            // Use appropriate data for thickness normalization based on mode
            const countsForThickness = uniqueStudentMode ? newEdgeCounts : totalVisits;
            const maxCountForThickness = uniqueStudentMode ? maxEdgeCount : Math.max(...Object.values(totalVisits), 1);
            const normalizedThicknesses = normalizeThicknesses(countsForThickness, maxCountForThickness, 10);
            
            console.log("GraphvizParent: Using counts for thickness:", uniqueStudentMode ? "unique students" : "total visits");
            console.log("GraphvizParent: Max count for thickness:", maxCountForThickness);

            // Main graph - responds to uniqueStudentMode and minVisits slider
            // Use mode-appropriate edge counts
            const edgeCountsForGraph = uniqueStudentMode ? newEdgeCounts : totalVisits;
            
            // Use simple fixed threshold for connectivity, but allow minVisits to control visibility
            const optimalThreshold = 1;
            
            // Everything about the DOT except which mode carries the outcome
            // signal and whether the sequence is marked, so the export can
            // re-render this exact graph either way without re-deriving inputs.
            const mainMinVisits = effectiveMinVisits('all_students', maxEdgeCount);
            const buildMainDot = (opts: { nodeOutcomeMode: boolean; highlightSelectedSequence: boolean }) =>
                generateDotString(
                    normalizedThicknesses,
                    ratioEdges,
                    edgeOutcomeCounts,
                    edgeCountsForGraph,
                    totalNodeEdges,
                    optimalThreshold, // Use calculated optimal threshold
                    mainMinVisits, // Use per-graph minVisits (capped) or capped 8% default
                    sequenceToUse,
                    false,
                    totalVisits,
                    repeatVisits,
                    errorMode, // Use actual errorMode setting
                    mainGraphData.firstAttemptOutcomes,
                    uniqueStudentMode,
                    opts.highlightSelectedSequence,
                    maxCountForThickness,
                    mainGraphData.edgeErrorStudentCounts,
                    null, // sequenceFunnelCounts (full graph)
                    null, // sequenceErrorCounts (full graph)
                    opts.nodeOutcomeMode,
                    mainGraphData.nodeOutcomeCounts,
                    showEdgeLabels,
                );

            const dotString = buildMainDot({
                nodeOutcomeMode,
                highlightSelectedSequence: colorNodesBySequence,
            });

            exportRegistry.current['all_students'] = {
                title: 'All Students, All Paths',
                baseFilename: exportStem('all_students', mainMinVisits),
                minVisits: mainMinVisits,
                totalStudents: Object.keys(mainGraphData.stepSequences).length,
                followedCount: null,
                sequenceMatchCount: countStudentsOnExactSequence(mainGraphData.stepSequences, sequenceToUse),
                stepSequences: mainGraphData.stepSequences,
                buildDot: buildMainDot,
            };

            setDotString(dotString);

            // For the selected sequence graph, use progressive filtering
            // Only count students who completed the FULL sequence (if checkbox is enabled)
            const sequenceToUseForCounting = selectedSequence || topSequences[0]?.sequence || [];

            // "None" selected (empty but defined sequence): skip the Selected
            // Sequence graph entirely — there is no path to show. The full graphs
            // still render (all nodes gray) via the main graph above.
            if (sequenceToUseForCounting.length < 2) {
                setTopDotString(null);
                delete exportRegistry.current['selected_sequence'];
                return;
            }

            const sequenceResults = countEdgesForSelectedSequence(
                mainGraphData.stepSequences,
                mainGraphData.outcomeSequences,
                sequenceToUseForCounting,
                showOnlySequenceStudents  // Pass the checkbox state
            );

            // Use the filtered edge counts for the selected sequence graph
            const sequenceCountsForThickness = uniqueStudentMode ? sequenceResults.edgeCounts : sequenceResults.totalVisits;
            const sequenceMaxCount = uniqueStudentMode ? sequenceResults.maxEdgeCount : Math.max(...Object.values(sequenceResults.totalVisits), 1);
            const sequenceNormalizedThicknesses = normalizeThicknesses(sequenceCountsForThickness, sequenceMaxCount, 10);

            // When "only students on this path" is on, show funnel-style counts
            // (monotonically non-increasing along the path) and path-scoped error
            // counts for the error overlay. Off → raw per-edge counts, no funnel.
            const funnelCounts = showOnlySequenceStudents
                ? computeSequenceFunnelCounts(mainGraphData.stepSequences, sequenceToUseForCounting)
                : null;
            const seqErrorCounts = showOnlySequenceStudents
                ? computeSequenceErrorCounts(mainGraphData.stepSequences, mainGraphData.outcomeSequences, sequenceToUseForCounting)
                : null;

            const seqMinVisits = minVisitsPerGraph['selected_sequence'] ?? 0;
            const buildTopDot = (opts: { nodeOutcomeMode: boolean }) =>
                generateDotString(
                    sequenceNormalizedThicknesses,
                    sequenceResults.ratioEdges,
                    sequenceResults.edgeOutcomeCounts,
                    uniqueStudentMode ? sequenceResults.edgeCounts : sequenceResults.totalVisits,
                    sequenceResults.totalNodeEdges,
                    0, // Use threshold 0 to show ALL edges for static top graph
                    seqMinVisits, // Use per-graph minVisits or default to 0
                    selectedSequence || topSequences[0]?.sequence || [],
                    true,
                    sequenceResults.totalVisits,
                    sequenceResults.repeatVisits,
                    errorMode, // Honor Error Mode; overlays are path-scoped for this graph
                    sequenceResults.firstAttemptOutcomes,
                    uniqueStudentMode,
                    colorNodesBySequence,
                    sequenceMaxCount,
                    sequenceResults.edgeErrorStudentCounts,
                    funnelCounts,
                    seqErrorCounts,
                    opts.nodeOutcomeMode,
                    mainGraphData.nodeOutcomeCounts,
                    showEdgeLabels,
                );

            exportRegistry.current['selected_sequence'] = {
                title: 'Selected Sequence',
                baseFilename: exportStem('selected_sequence', seqMinVisits),
                minVisits: seqMinVisits,
                totalStudents: Object.keys(mainGraphData.stepSequences).length,
                // This view IS the path, so its honest population is the students
                // who followed it — not everyone who used one of its transitions.
                followedCount: countStudentsOnExactSequence(mainGraphData.stepSequences, sequenceToUseForCounting) ?? 0,
                sequenceMatchCount: null,
                stepSequences: mainGraphData.stepSequences,
                // The sequence emphasis toggle is about the FULL graphs; this
                // view is the sequence, so it ignores the override.
                buildDot: buildTopDot,
            };

            setTopDotString(buildTopDot({ nodeOutcomeMode }));
        }
    }, [mainGraphData, selectedSequence, setTop5Sequences, top5Sequences, onMaxEdgeCountChange, onMaxMinEdgeCountChange, uniqueStudentMode, minVisits, errorMode, nodeOutcomeMode, minVisitsPerGraph, showOnlySequenceStudents, colorNodesBySequence, showEdgeLabels, connectivityCaps]); // Responds to uniqueStudentMode, minVisits, errorMode, nodeOutcomeMode, minVisitsPerGraph, showOnlySequenceStudents, colorNodesBySequence, showEdgeLabels, connectivityCaps and selectedSequence

    // Initialize minVisits for main graphs when data loads
    React.useEffect(() => {
        if (!mainGraphData) return;

        const newMinVisits = {...minVisitsPerGraph};
        let changed = false;

        // Initialize main graphs - selected sequence should start at 0
        if (!('selected_sequence' in minVisitsPerGraph)) {
            newMinVisits['selected_sequence'] = 0;
            changed = true;
        }
        if (!('all_students' in minVisitsPerGraph)) {
            newMinVisits['all_students'] = cappedDefault(mainGraphData.maxEdgeCount, connectivityCaps['all_students']);
            changed = true;
        }

        if (changed) {
            setMinVisitsPerGraph(newMinVisits);
        }
    }, [mainGraphData, connectivityCaps]);

    // Initialize minVisits for filtered graphs when they load
    React.useEffect(() => {
        if (Object.keys(filteredGraphDataMap).length === 0) return;

        const newMinVisits = {...minVisitsPerGraph};
        let changed = false;

        filters.forEach(filter => {
            const key = `filtered_graph_${filter}`;
            const filteredData = filteredGraphDataMap[filter];

            if (filteredData && !(key in newMinVisits)) {
                // Set to 8% of the filtered graph's maxEdgeCount, clamped to cap
                newMinVisits[key] = cappedDefault(filteredData.maxEdgeCount, connectivityCaps[key]);
                changed = true;
            }
        });

        if (changed) {
            setMinVisitsPerGraph(newMinVisits);
        }
    }, [filters, filteredGraphDataMap, connectivityCaps]);

    // Filtered graphs calculation - runs when filters change
    useEffect(() => {
        if (Object.keys(filteredGraphDataMap).length > 0) {
            const newFilteredDotStrings: {[key: string]: string} = {};

            Object.entries(filteredGraphDataMap).forEach(([filter, filteredGraphData]) => {
                const {
                    edgeCounts: filteredEdgeCounts,
                    totalNodeEdges: filteredTotalNodeEdges,
                    ratioEdges: filteredRatioEdges,
                    edgeOutcomeCounts: filteredEdgeOutcomeCounts,
                    maxEdgeCount: filteredMaxEdgeCount,
                    totalVisits: filteredTotalVisits,
                    repeatVisits: filteredRepeatVisits
                } = filteredGraphData;

                const sequenceToUse = selectedSequence || top5Sequences?.[0]?.sequence;

                // Use appropriate data for filtered thickness normalization based on mode
                const filteredCountsForThickness = uniqueStudentMode ? filteredEdgeCounts : filteredTotalVisits;
                const visitValues = Object.values(filteredTotalVisits) as number[];
                const filteredMaxCountForThickness = uniqueStudentMode ? filteredMaxEdgeCount : Math.max(...visitValues, 1);
                const normalizedThicknesses = normalizeThicknesses(filteredCountsForThickness, filteredMaxCountForThickness, 10);

                const graphKey = `filtered_graph_${filter}`;
                const filteredMinVisits = effectiveMinVisits(graphKey, filteredMaxEdgeCount);
                const buildFilteredDot = (opts: { nodeOutcomeMode: boolean; highlightSelectedSequence: boolean }) =>
                    generateDotString(
                        normalizedThicknesses,
                        filteredRatioEdges,
                        filteredEdgeOutcomeCounts,
                        filteredEdgeCounts,
                        filteredTotalNodeEdges,
                        1,
                        filteredMinVisits, // Use per-graph minVisits (capped) or capped 8% default
                        sequenceToUse,
                        false,
                        filteredTotalVisits,
                        filteredRepeatVisits,
                        errorMode,
                        filteredGraphData.firstAttemptOutcomes,
                        uniqueStudentMode,
                        opts.highlightSelectedSequence,
                        filteredMaxCountForThickness,
                        filteredGraphData.edgeErrorStudentCounts,
                        null, // sequenceFunnelCounts (full graph)
                        null, // sequenceErrorCounts (full graph)
                        opts.nodeOutcomeMode,
                        filteredGraphData.nodeOutcomeCounts,
                        showEdgeLabels,
                    );

                exportRegistry.current[graphKey] = {
                    title: `Filtered Graph: ${titleCase(filter)}`,
                    baseFilename: exportStem(graphKey, filteredMinVisits),
                    minVisits: filteredMinVisits,
                    totalStudents: Object.keys(filteredGraphData.filteredStepSequences || {}).length,
                    followedCount: null,
                    sequenceMatchCount: countStudentsOnExactSequence(
                        filteredGraphData.filteredStepSequences || {}, sequenceToUse
                    ),
                    stepSequences: filteredGraphData.filteredStepSequences || {},
                    buildDot: buildFilteredDot,
                };

                newFilteredDotStrings[filter] = buildFilteredDot({
                    nodeOutcomeMode,
                    highlightSelectedSequence: colorNodesBySequence,
                });
            });

            setFilteredDotStrings(newFilteredDotStrings);
        } else {
            setFilteredDotStrings({});
            Object.keys(exportRegistry.current)
                .filter((key) => key.startsWith('filtered_graph_'))
                .forEach((key) => delete exportRegistry.current[key]);
            // Reset max min edge count to the main graph's value
            if (mainGraphData) {
                const sequenceToUse = selectedSequence || top5Sequences?.[0]?.sequence;
                if (sequenceToUse) {
                    const resetCountsToUse = uniqueStudentMode ? mainGraphData.edgeCounts : mainGraphData.totalVisits;
                    const maxMinEdgeCount = calculateMaxMinEdgeCount(resetCountsToUse, sequenceToUse);
                    onMaxMinEdgeCountChange(maxMinEdgeCount);
                }
            }
        }
    }, [filteredGraphDataMap, minVisits, minVisitsPerGraph, selectedSequence, top5Sequences, errorMode, nodeOutcomeMode, mainGraphData, onMaxMinEdgeCountChange, uniqueStudentMode, showEdgeLabels, connectivityCaps]);

    // Cleanup all event listeners when component unmounts
    useEffect(() => {
        return () => {
            // Clean up all event listeners for all graphs
            eventListenersRef.current.forEach((_, filename) => {
                cleanupEventListeners(filename);
            });
        };
    }, []);

    // Graphs currently on screen, in display order — the export's menu of what
    // can be written out.
    const exportableGraphs = useMemo(() => {
        const keys: string[] = [];
        if (showSelectedSequence && topDotString) keys.push('selected_sequence');
        if (showAllStudents && dotString) keys.push('all_students');
        filters.forEach((filter) => {
            if (filteredDotStrings[filter]) keys.push(`filtered_graph_${filter}`);
        });
        return keys;
    }, [showSelectedSequence, topDotString, showAllStudents, dotString, filters, filteredDotStrings]);

    // Default to every graph on screen and the outcome mode on screen, until the
    // user picks otherwise (null = "follow the screen").
    const effectiveExportGraphKeys = (exportGraphKeys ?? exportableGraphs)
        .filter((key) => exportableGraphs.includes(key));
    const effectiveExportModes: Array<'node' | 'edge'> =
        exportModes ?? [nodeOutcomeMode ? 'node' : 'edge'];

    /**
     * The view, how many students the drawn graph represents, and — when the
     * sequence is marked — how many of them walked it end to end. Thresholding
     * drops low-traffic edges, so a graph can represent fewer students than its
     * population; the gap is spelled out only when there actually is one.
     */
    const populationLines = (entry: ExportGraphEntry, dot: string, highlight: boolean): string[] => {
        if (entry.followedCount !== null) {
            return [`${entry.title} — ${entry.followedCount.toLocaleString()} students followed this path`];
        }
        const shown = countStudentsOnEdges(entry.stepSequences, drawnEdgeKeys(dot));
        const lines = shown >= entry.totalStudents
            ? [`${entry.title} — ${entry.totalStudents.toLocaleString()} students`]
            : [`${entry.title} — ${shown.toLocaleString()} of ${entry.totalStudents.toLocaleString()} students represented`];
        // The marked path only means something if the reader knows how much of
        // this population actually walked it.
        if (highlight && entry.sequenceMatchCount !== null) {
            lines.push(
                `Selected sequence marked — ${entry.sequenceMatchCount.toLocaleString()} of these students took it end to end`
            );
        }
        return lines;
    };

    /** Bottom-right note: the coloring mode and the edge threshold in force. */
    const exportFootnote = (entry: ExportGraphEntry, mode: 'node' | 'edge'): string => {
        const coloring = mode === 'node' ? 'Node-outcome coloring' : 'Edge-outcome coloring';
        const threshold = entry.minVisits > 1
            ? `edges shown require at least ${entry.minVisits.toLocaleString()} ${uniqueStudentMode ? 'students' : 'transitions'}`
            : 'all transitions shown';
        return [coloring, threshold].join(' · ');
    };

    /**
     * Render the requested graphs, in the requested outcome modes and formats,
     * into files. Exports re-render their own DOT rather than screenshotting the
     * live SVG — that's what lets an image carry a masthead, an opaque canvas,
     * and the outcome mode that isn't currently on screen.
     */
    const buildExportFiles = async (
        graphKeys: string[],
        modes: Array<'node' | 'edge'>,
        formats: ExportFormat[],
        opts: { titled: boolean; highlight: boolean; readme: boolean }
    ): Promise<{ files: ExportFile[]; errors: string[] }> => {
        const files: ExportFile[] = [];
        const errors: string[] = [];
        // Only tag names with the mode when both are in the bundle; a single-mode
        // export keeps the plain stem.
        const tagMode = modes.length > 1;
        const stemFor = (entry: ExportGraphEntry, mode: 'node' | 'edge') =>
            tagMode ? `${entry.baseFilename}_${MODE_FILE_SUFFIX[mode]}` : entry.baseFilename;

        // Which attempts the paths were built from is always stated: unique
        // students and all visits produce different paths, and an image passed
        // around otherwise gives no way to tell them apart.
        const attemptsNote = uniqueStudentMode ? 'Unique students (first attempts)' : 'All visits';
        const subheading = datasetIdentity.subheading
            ? `${datasetIdentity.subheading} · ${attemptsNote}`
            : attemptsNote;

        for (const mode of modes) {
            for (const graphKey of graphKeys) {
                const entry = exportRegistry.current[graphKey];
                if (!entry) continue;
                const stem = stemFor(entry, mode);
                try {
                    const body = prepareExportDot(
                        entry.buildDot({ nodeOutcomeMode: mode === 'node', highlightSelectedSequence: opts.highlight })
                    );
                    const dot = opts.titled
                        ? addExportTitle(body, {
                            heading: datasetIdentity.heading,
                            subheading,
                            caption: populationLines(entry, body, opts.highlight),
                            footnote: exportFootnote(entry, mode),
                        })
                        : addTitleLabel(body, entry.title + (tagMode ? ` — ${mode} outcomes` : ''));
                    files.push(...(await renderDotToFiles(dot, stem, formats)));
                } catch (err) {
                    errors.push(`${stem}: ${err instanceof Error ? err.message : String(err)}`);
                }
            }
        }

        // A README describes one outcome mode, so a both-modes export gets one
        // per mode. Only bundled if at least one graph made it out.
        if (opts.readme && files.length) {
            modes.forEach((mode) => {
                const readme = buildExportReadme({
                    datasetName: problemName,
                    workspaceIds: datasetIdentity.workspaceIds,
                    problemNames: datasetIdentity.problemNames,
                    firstAttemptOnly: uniqueStudentMode,
                    includeSelfLoops: selfLoops && !uniqueStudentMode,
                    errorMode,
                    outcomeMode: mode,
                    highlightSelectedSequence: opts.highlight,
                    thresholdLabel: 'Per-graph slider (8% of the busiest edge by default)',
                    graphs: graphKeys
                        .map((key) => exportRegistry.current[key])
                        .filter(Boolean)
                        .map((entry) => ({
                            title: entry.title,
                            baseFilename: stemFor(entry, mode),
                            // The Selected Sequence view's population is the
                            // students who followed that path, which is what its
                            // own masthead states — not everyone in the dataset.
                            totalStudents: entry.followedCount ?? entry.totalStudents,
                        })),
                    generatedOn: new Date().toISOString().slice(0, 10),
                });
                files.push({
                    name: tagMode ? `README_${MODE_FILE_SUFFIX[mode]}.md` : 'README.md',
                    data: readme,
                });
            });
        }
        return { files, errors };
    };

    /** Export one graph in the mode on screen — the per-graph download button. */
    const exportSingleGraph = async (graphKey: string) => {
        setExportBusy(true);
        setExportError(null);
        try {
            const { files, errors } = await buildExportFiles(
                [graphKey],
                [nodeOutcomeMode ? 'node' : 'edge'],
                ['png'],
                { titled: true, highlight: colorNodesBySequence, readme: false }
            );
            if (files.length === 1) downloadFile(files[0]);
            else if (files.length > 1) await downloadZip(files, `${exportStem(graphKey, exportRegistry.current[graphKey]?.minVisits ?? 0)}.zip`);
            if (errors.length) setExportError(errors.join('; '));
        } catch (err) {
            setExportError(err instanceof Error ? err.message : String(err));
        } finally {
            setExportBusy(false);
        }
    };

    /** Export panel: the chosen graphs × outcome modes × formats, plus READMEs. */
    const prepareExport = async () => {
        setExportBusy(true);
        setExportError(null);
        try {
            const { files, errors } = await buildExportFiles(
                effectiveExportGraphKeys,
                effectiveExportModes,
                exportFormats,
                { titled: exportTitled, highlight: exportHighlightSequence, readme: exportReadme }
            );
            if (files.length === 1) downloadFile(files[0]);
            else if (files.length > 1) {
                await downloadZip(files, `${problemName.replace(/[^a-zA-Z0-9]/g, '_')}_path_analysis.zip`);
            }
            setExportError(errors.length ? errors.join('; ') : null);
        } catch (err) {
            setExportError(err instanceof Error ? err.message : String(err));
        } finally {
            setExportBusy(false);
        }
    };

    // Number of files the current selection will produce — one per graph × mode
    // × format, plus one README per mode.
    const exportFileCount = effectiveExportGraphKeys.length * effectiveExportModes.length * exportFormats.length
        + (exportReadme && effectiveExportGraphKeys.length && exportFormats.length ? effectiveExportModes.length : 0);

    const numberOfGraphs = [
        showSelectedSequence && topDotString,
        showAllStudents && dotString,
        ...Object.values(filteredDotStrings)
    ].filter(Boolean).length;

    // Helper functions for history management
    const formatTime = (date: Date): string => {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };

    const formatContent = (content: string): string => {
        return content.replace(/\\n/g, '\n');
    };

    const toggleHistoryItem = (itemId: string) => {
        setHistoryItems(prev => prev.map(item => 
            item.id === itemId ? { ...item, expanded: !item.expanded } : item
        ));
    };

    // Helper function to parse edge names that may contain arrows in step names
    const parseEdgeName = (edgeName: string): [string, string] => {
        const lastArrowIndex = edgeName.lastIndexOf('->');
        if (lastArrowIndex === -1) {
            return [edgeName, ''];
        }
        
        const currentStep = edgeName.substring(0, lastArrowIndex);
        const nextStep = edgeName.substring(lastArrowIndex + 2);
        
        return [currentStep, nextStep];
    };

    // Helper function to calculate progress status statistics for students at a
    // node. `restrictToStudents`, when given, limits the population to that set
    // (used by the Selected Sequence graph to scope to exact-sequence students).
    const calculateNodeProgressStats = (nodeName: string, restrictToStudents?: Set<string> | null): { graduated: number; promoted: number; other: number; total: number } => {
        if (!mainGraphData) return { graduated: 0, promoted: 0, other: 0, total: 0 };

        const { stepSequences, sortedData } = mainGraphData;
        const studentsAtNode = new Set<string>();

        // Find all students who visited this node
        // stepSequences has structure: { [studentId]: { [problemName]: string[] } }
        if (stepSequences && Object.keys(stepSequences).length > 0) {
            Object.entries(stepSequences).forEach(([studentId, studentProblems]) => {
                if (restrictToStudents && !restrictToStudents.has(studentId)) return;
                // studentProblems is { [problemName]: string[] }
                if (studentProblems && typeof studentProblems === 'object') {
                    Object.values(studentProblems).forEach((problemSequence: string[]) => {
                        if (Array.isArray(problemSequence) && problemSequence.includes(nodeName)) {
                            studentsAtNode.add(studentId);
                        }
                    });
                }
            });
        }

        // Each student's progress status is a per-student property, so we take it
        // from any of their rows (last wins). We deliberately do NOT filter by
        // the file-derived problemName — it rarely matches the CSV's internal
        // Problem Name, which left every bucket at zero.
        let graduatedCount = 0;
        let promotedCount = 0;
        let otherCount = 0;

        if (sortedData && sortedData.length > 0) {
            const studentProgressMap = new Map<string, string>();
            sortedData.forEach((row: any) => {
                const studentId = row['Anon Student Id'];
                const progressStatus = row['CF (Workspace Progress Status)'];
                if (studentId && progressStatus) {
                    studentProgressMap.set(studentId, progressStatus);
                }
            });

            studentsAtNode.forEach(studentId => {
                const progressStatus = studentProgressMap.get(studentId);

                if (progressStatus === 'GRADUATED') {
                    graduatedCount++;
                } else if (progressStatus === 'PROMOTED') {
                    promotedCount++;
                } else if (progressStatus) {
                    otherCount++;
                }
            });
        }

        // Total is the number of students with a known status (so the buckets
        // always sum to the total, rather than a broader visitor count).
        return {
            graduated: graduatedCount,
            promoted: promotedCount,
            other: otherCount,
            total: graduatedCount + promotedCount + otherCount
        };
    };

    // Generate node tooltip content
    const generateNodeTooltip = (nodeName: string, graphType: string): string => {
        if (!mainGraphData) return `Node: ${nodeName}`;
        
        const { stepSequences, outcomeSequences, nodeOutcomeCounts, nodeFirstAttemptOutcomes } = mainGraphData;

        // Calculate statistics based on mode
        let totalVisitors = 0;
        let totalNodeVisits = 0;
        const visitCounts: { [studentId: string]: number } = {};

        // Check if this is the selected sequence graph and we need to filter
        const isSelectedSequenceGraph = graphType === 'Selected Sequence';
        const sequenceToFilter = isSelectedSequenceGraph ? selectedSequence : null;

        // On the Selected Sequence graph, every stat (visits, outcomes, progress)
        // is scoped to the students who followed the EXACT sequence, so the
        // populations line up. Elsewhere sequenceStudents is null (all students).
        const sequenceStudents: Set<string> | null = (isSelectedSequenceGraph && sequenceToFilter)
            ? new Set<string>(
                Object.entries(stepSequences)
                    .filter(([, problems]) =>
                        problems && typeof problems === 'object' &&
                        Object.values(problems).some((seq: string[]) =>
                            Array.isArray(seq) && arraysEqual(seq, sequenceToFilter)))
                    .map(([studentId]) => studentId))
            : null;

        if (stepSequences && Object.keys(stepSequences).length > 0) {
            Object.entries(stepSequences).forEach(([studentId, studentProblems]) => {
                // studentProblems is { [problemName]: string[] }
                if (studentProblems && typeof studentProblems === 'object') {

                    // Skip students who didn't follow the exact selected sequence.
                    if (sequenceStudents && !sequenceStudents.has(studentId)) {
                        return;
                    }

                    let studentNodeVisits = 0;
                    Object.values(studentProblems).forEach((problemSequence: string[]) => {
                        if (Array.isArray(problemSequence)) {
                            if (uniqueStudentMode) {
                                // In unique student mode, count only if student visited this node
                                const nodeVisits = problemSequence.filter(step => step === nodeName).length;
                                if (nodeVisits > 0) {
                                    studentNodeVisits = 1; // Count as 1 unique visit regardless of repeats
                                }
                            } else {
                                // In total visits mode, count all visits including repeats
                                const nodeVisits = problemSequence.filter(step => step === nodeName).length;
                                studentNodeVisits += nodeVisits;
                            }
                        }
                    });
                    
                    if (studentNodeVisits > 0) {
                        visitCounts[studentId] = studentNodeVisits;
                        totalNodeVisits += studentNodeVisits;
                    }
                }
            });
            totalVisitors = Object.keys(visitCounts).length;
        }
        
        const avgVisitsPerStudent = totalVisitors > 0 ? (totalNodeVisits / totalVisitors).toFixed(1) : '0';
        
        // Calculate correct student visit statistics
        let studentsWithSingleVisit = 0;
        let studentsWithMultipleVisits = 0;
        
        Object.values(visitCounts).forEach((visitCount: number) => {
            if (visitCount > 1) {
                studentsWithMultipleVisits++;
            } else {
                studentsWithSingleVisit++;
            }
        });
        
        
        const singleVisits = studentsWithSingleVisit;
        const multipleVisits = studentsWithMultipleVisits;
        
        // Note: Removed graph connectivity section to match history tab format
        
        // Calculate progress status statistics (scoped to the exact-sequence
        // students on the Selected Sequence graph).
        const progressStats = calculateNodeProgressStats(nodeName, sequenceStudents);
        const graduatedPercentage = progressStats.total > 0 ? ((progressStats.graduated / progressStats.total) * 100).toFixed(1) : '0';
        const promotedPercentage = progressStats.total > 0 ? ((progressStats.promoted / progressStats.total) * 100).toFixed(1) : '0';

        // Outcome statistics for THIS node — each step's own outcome (per-node
        // tally), not its successors'. This colors/labels terminal nodes like
        // FinalAnswer correctly, matching the striped node-outcome fills. On the
        // Selected Sequence graph these are scoped to exact-sequence students so
        // they line up with the visit counts above; elsewhere the precomputed
        // full-dataset tally is used.
        let nodeOutcomes: { [outcome: string]: number };
        let nodeFirstAttempts: { [outcome: string]: number };
        if (sequenceStudents) {
            const scoped = computeScopedNodeOutcomes(nodeName, sequenceStudents, stepSequences, outcomeSequences);
            nodeOutcomes = scoped.all;
            nodeFirstAttempts = scoped.firstAttempt;
        } else {
            nodeOutcomes = nodeOutcomeCounts[nodeName] || {};
            nodeFirstAttempts = nodeFirstAttemptOutcomes[nodeName] || {};
        }

        const totalOutcomes = Object.values(nodeOutcomes).reduce((sum, count) => sum + count, 0);
        const totalFirstAttempts = Object.values(nodeFirstAttempts).reduce((sum, count) => sum + count, 0);

        const outcomeSummary = Object.entries(nodeOutcomes)
            .sort(([,a], [,b]) => b - a)
            .map(([outcome, count]) => {
                const percentage = totalOutcomes > 0 ? ((count / totalOutcomes) * 100).toFixed(1) : '0';
                return `${outcome}: ${count.toLocaleString()} (${percentage}%)`;
            })
            .slice(0, 5) // Show top 5 outcomes
            .join('\n      ');
        
        const firstAttemptSummary = Object.entries(nodeFirstAttempts)
            .sort(([,a], [,b]) => b - a)
            .map(([outcome, count]) => {
                const percentage = totalFirstAttempts > 0 ? ((count / totalFirstAttempts) * 100).toFixed(1) : '0';
                return `${outcome}: ${count.toLocaleString()} (${percentage}%)`;
            })
            .slice(0, 5) // Show top 5 first attempt outcomes
            .join('\n      ');
        
        const activityLabel = uniqueStudentMode ? 'Student Activity' : 'Visit Activity';
        const visitorsLabel = uniqueStudentMode ? 'Total Students Visited' : 'Total Students Who Visited';
        const visitsLabel = uniqueStudentMode ? 'Total Visits (including repeats)' : 'Total Visits to This Node';
        const otherPercentage = progressStats.total > 0 ? ((progressStats.other / progressStats.total) * 100).toFixed(1) : '0.0';
        
        return `${activityLabel}:\n`
            + `    • ${visitorsLabel}: ${totalVisitors.toLocaleString()}\n`
            + `    • ${visitsLabel}: ${totalNodeVisits.toLocaleString()}\n`
            + `    • Students with single visit: ${singleVisits.toLocaleString()}\n`
            + `    • Students with multiple visits: ${multipleVisits.toLocaleString()}\n`
            + `    • Average visits per student: ${avgVisitsPerStudent}\n\n`
            + `Student Progress Status:\n`
            + `    • Graduated: ${progressStats.graduated.toLocaleString()} (${graduatedPercentage}%)\n`
            + `    • Promoted: ${progressStats.promoted.toLocaleString()} (${promotedPercentage}%)\n`
            + `    • Other: ${progressStats.other.toLocaleString()} (${otherPercentage}%)\n`
            + `    • Total students tracked: ${progressStats.total.toLocaleString()}\n\n`
            + `Learning Outcomes:\n`
            + `    • All Outcomes:\n`
            + `      ${outcomeSummary || 'No outcome data available'}\n\n`
            + `    • First Attempt Outcomes:\n`
            + `      ${firstAttemptSummary || 'No first attempt data available'}`;
    };
    

    // Helper function to calculate exact progress status statistics for an edge
    const calculateEdgeProgressStats = (edgeName: string): { graduated: number; promoted: number; other: number; total: number; graduatedPercentage: string; promotedPercentage: string } => {
        if (!mainGraphData) return { graduated: 0, promoted: 0, other: 0, total: 0, graduatedPercentage: '0', promotedPercentage: '0' };
        
        const { stepSequences, sortedData } = mainGraphData;
        const [fromStep, toStep] = parseEdgeName(edgeName);
        const studentsOnEdge = new Set<string>();
        
        // Find all students who took this specific transition
        if (stepSequences && Object.keys(stepSequences).length > 0) {
            Object.entries(stepSequences).forEach(([studentId, studentProblems]) => {
                if (studentProblems && typeof studentProblems === 'object') {
                    Object.values(studentProblems).forEach((problemSequence: string[]) => {
                        if (Array.isArray(problemSequence)) {
                            if (uniqueStudentMode) {
                                // In unique student mode, only count the first occurrence of this transition
                                for (let i = 0; i < problemSequence.length - 1; i++) {
                                    if (problemSequence[i] === fromStep && problemSequence[i + 1] === toStep) {
                                        studentsOnEdge.add(studentId);
                                        break; // Only count first occurrence per student
                                    }
                                }
                            } else {
                                // In total visits mode, we still count unique students but they represent all who ever made this transition
                                for (let i = 0; i < problemSequence.length - 1; i++) {
                                    if (problemSequence[i] === fromStep && problemSequence[i + 1] === toStep) {
                                        studentsOnEdge.add(studentId);
                                        break; // Still only add each student once to the set
                                    }
                                }
                            }
                        }
                    });
                }
            });
        }
        
        // Count progress status for students who took this transition. As in
        // calculateNodeProgressStats, status is a per-student property taken from
        // any of their rows (last wins); we do NOT filter by the file-derived
        // problemName, which rarely matches the CSV's Problem Name.
        let graduatedCount = 0;
        let promotedCount = 0;
        let otherCount = 0;

        if (sortedData && sortedData.length > 0 && studentsOnEdge.size > 0) {
            const studentProgressMap = new Map<string, string>();
            sortedData.forEach((row: any) => {
                const studentId = row['Anon Student Id'];
                const progressStatus = row['CF (Workspace Progress Status)'];
                if (studentId && progressStatus) {
                    studentProgressMap.set(studentId, progressStatus);
                }
            });

            studentsOnEdge.forEach(studentId => {
                const progressStatus = studentProgressMap.get(studentId);
                if (progressStatus === 'GRADUATED') {
                    graduatedCount++;
                } else if (progressStatus === 'PROMOTED') {
                    promotedCount++;
                } else if (progressStatus) {
                    otherCount++;
                }
            });
        }

        // Total is the number of students with a known status, so buckets sum to it.
        const total = graduatedCount + promotedCount + otherCount;
        const graduatedPercentage = total > 0 ? ((graduatedCount / total) * 100).toFixed(1) : '0';
        const promotedPercentage = total > 0 ? ((promotedCount / total) * 100).toFixed(1) : '0';
        
        // Note: Progress status is always based on unique students regardless of mode
        // because progress status is a property of individual students, not visits
        
        return {
            graduated: graduatedCount,
            promoted: promotedCount,
            other: otherCount,
            total,
            graduatedPercentage,
            promotedPercentage
        };
    };

    // Generate edge tooltip content
    const generateEdgeTooltip = (edgeName: string, _graphType: string): string => {
        if (!mainGraphData) return `Edge: ${edgeName}`;
        
        const { edgeCounts, edgeOutcomeCounts, totalNodeEdges, ratioEdges, totalVisits } = mainGraphData;
        const outcomes = edgeOutcomeCounts[edgeName] || {};
        const [currentStep, _nextStep] = parseEdgeName(edgeName);
        
        // Use different counts based on mode
        const edgeCount = uniqueStudentMode ? (edgeCounts[edgeName] || 0) : (totalVisits[edgeName] || 0);
        
        // Calculate total visits to the start node by summing all outgoing edges
        const totalVisitsFromStartNode = Object.keys(totalVisits)
            .filter(edge => edge.startsWith(`${currentStep}->`))
            .reduce((sum, edge) => sum + (totalVisits[edge] || 0), 0);
            
        const totalAtStartNode = uniqueStudentMode ? 
            (totalNodeEdges[currentStep] || 0) : 
            (totalVisitsFromStartNode || totalNodeEdges[currentStep] || 0);
        
        const ratioPercentage = ((ratioEdges[edgeName] || 0) * 100).toFixed(1);
        const totalOutcomes = Object.values(outcomes).reduce((sum, count) => sum + count, 0);
        
        const pathCount = edgeCount;
        const totalAtStart = totalAtStartNode;
        const notTakingPath = Math.max(0, totalAtStart - pathCount); // Ensure non-negative
        
        // Calculate progress status statistics
        const progressStats = calculateEdgeProgressStats(edgeName);
        
        // All outcomes breakdown
        const allOutcomes = Object.entries(outcomes)
            .sort(([,a], [,b]) => b - a)
            .map(([outcome, count]) => {
                const percentage = totalOutcomes > 0 ? ((count / totalOutcomes) * 100).toFixed(1) : '0';
                return `${outcome}: ${count.toLocaleString()} (${percentage}%)`;
            })
            .join('\n      ');
        
        // Calculate actual first attempt outcomes from mainGraphData
        const edgeFirstAttemptOutcomes = mainGraphData?.firstAttemptOutcomes?.[edgeName] || {};
        const totalFirstAttempts = Object.values(edgeFirstAttemptOutcomes).reduce((sum, count) => sum + count, 0);
        
        const firstAttemptOutcomes = Object.entries(edgeFirstAttemptOutcomes)
            .sort(([,a], [,b]) => b - a)
            .map(([outcome, count]) => {
                const percentage = totalFirstAttempts > 0 ? ((count / totalFirstAttempts) * 100).toFixed(1) : '0';
                return `${outcome}: ${count.toLocaleString()} (${percentage}%)`;
            })
            .join('\n      ');
        
        // Calculate visual thickness (normalized) based on mode
        const countsForThickness = uniqueStudentMode ? edgeCounts : totalVisits;
        const maxCount = Math.max(...Object.values(countsForThickness));
        const thickness = maxCount > 0 ? ((pathCount / maxCount) * 10).toFixed(1) : '1.0';
        
        const modeLabel = uniqueStudentMode ? 'Students' : 'Visits';
        const pathLabel = uniqueStudentMode ? 'Students taking this path' : 'Total visits on this path';
        const startLabel = uniqueStudentMode ? `Students at ${currentStep}` : `Total visits to ${currentStep}`;
        const notTakingLabel = uniqueStudentMode ? 'Students NOT taking this path' : 'Visits to other paths from this node';
        
        return `${modeLabel} Flow:\n`
            + `    • ${pathLabel}: ${pathCount.toLocaleString()}\n`
            + `    • ${startLabel}: ${totalAtStart.toLocaleString()}\n`
            + `    • ${notTakingLabel}: ${notTakingPath.toLocaleString()}\n`
            + `    • Transition Probability: ${ratioPercentage}%\n`
            + `      (${pathCount.toLocaleString()} of ${totalAtStart.toLocaleString()} ${modeLabel.toLowerCase()})\n\n`
            + `Student Progress Status:\n`
            + `    • Graduated: ${progressStats.graduated.toLocaleString()} (${progressStats.graduatedPercentage}%)\n`
            + `    • Promoted: ${progressStats.promoted.toLocaleString()} (${progressStats.promotedPercentage}%)\n`
            + `    • Other: ${progressStats.other.toLocaleString()} (${progressStats.total > 0 ? ((progressStats.other / progressStats.total) * 100).toFixed(1) : '0.0'}%)\n`
            + `    • Total students tracked: ${progressStats.total.toLocaleString()}\n\n`
            + `Transition Outcomes:\n`
            + `    • All Outcomes:\n`
            + `      ${allOutcomes || 'No outcome data'}\n\n`
            + `    • First Attempt Outcomes:\n`
            + `      ${firstAttemptOutcomes || 'No first attempt data'}\n\n`
            + `Visual Properties:\n`
            + `    • Edge Thickness: ${thickness} (normalized)\n`
            + `    • Path Frequency: ${pathCount.toLocaleString()} ${modeLabel.toLowerCase()}\n`
            + `    • Min ${modeLabel} Threshold: ${minVisits.toLocaleString()}`;
    };

    // Store references to attached event listeners for cleanup. `elements`/
    // `handlers` are the per-node/edge click handlers; `svg`/`svgHandlers` are
    // the graph-level zoom/pan handlers, which MUST also be removed on re-render
    // (d3-graphviz reuses the same <svg>, so otherwise they stack and every
    // wheel/drag fires N times — erratic, compounding zoom/pan).
    const eventListenersRef = useRef<Map<string, {
        elements: Element[];
        handlers: ((e: Event) => void)[];
        svg?: SVGSVGElement;
        svgHandlers?: Array<{ type: string; handler: EventListener }>;
    }>>(new Map());

    // Store transform states for each graph to persist across tab switches
    const transformStates = useRef<{[key: string]: {
        scale: number;
        translateX: number;
        translateY: number;
        initialScale: number;
        initialTranslateX: number;
        initialTranslateY: number;
        isDragging: boolean;
        lastMouseX: number;
        lastMouseY: number;
    }}>({});

    // Cleanup function to remove all event listeners for a specific graph
    const cleanupEventListeners = (filename: string) => {
        const listeners = eventListenersRef.current.get(filename);
        if (listeners) {
            listeners.elements.forEach((element, index) => {
                const handler = listeners.handlers[index];
                if (handler) {
                    element.removeEventListener('click', handler);
                }
            });
            // Remove the graph-level zoom/pan listeners so they don't accumulate.
            if (listeners.svg && listeners.svgHandlers) {
                listeners.svgHandlers.forEach(({ type, handler }) => {
                    listeners.svg!.removeEventListener(type, handler);
                });
            }
            eventListenersRef.current.delete(filename);
        }
    };

    // Render Graphviz graphs using d3-graphviz with advanced centering and zoom functionality
    const renderGraph = (
        dot: string | null,
        ref: React.RefObject<HTMLDivElement>,
        filename: string,
        numberOfGraphs: number
    ) => {
        if (dot && ref.current) {
            // Clean up existing event listeners for this graph
            cleanupEventListeners(filename);
            
            // Dynamically adjust width based on the number of graphs and which graph it is
            // Selected Sequence is narrower since it only displays vertically
            // Container widths: Selected Sequence = 350px, Others = 475px/575px
            // Each has outer padding (p-4 = 32px) and inner white div padding (p-4 = 32px)
            // So available space = container - 64px total padding
            const isSelectedSequence = filename === 'selected_sequence';
            let width: number;

            if (isSelectedSequence) {
                width = 350 - 64; // 286px for vertical-only Selected Sequence
            } else {
                width = numberOfGraphs >= 3 ? 475 - 64 : 575 - 64; // 411px or 511px
            }

            const height = 575 - 64; // 511px to match inner div height minus padding

            try {
                graphviz(ref.current)
                    .width(width)
                    .height(height)
                    .engine('dot')
                    .zoom(false)
                    .fit(false)
                    .tweenShapes(false)
                    .renderDot(dot);

                // Add advanced centering, zoom and pan functionality after rendering
                setTimeout(() => {
                    if (ref.current) {
                        const svg = ref.current.querySelector('svg') as SVGSVGElement;
                        if (svg) {
                            const gElement = svg.querySelector('g') as SVGGElement;

                            // Calculate initial centering and scaling
                            let initialScale = 1;
                            let initialTranslateX = 0;
                            let initialTranslateY = 0;

                            if (gElement) {
                                const bbox = gElement.getBBox();
                                
                                if (bbox.width > 0 && bbox.height > 0) {
                                    // Center within the SVG's ACTUAL coordinate space. d3-graphviz
                                    // gives the <svg> a viewBox, so the visible drawing area is the
                                    // viewBox (same user-space getBBox reports in) — NOT the pixel
                                    // width/height we requested. Centering in the real space (and a
                                    // proportional margin so it's unit-independent) removes the
                                    // vertical offset that previously needed a hand-tuned nudge.
                                    const vb = svg.viewBox && svg.viewBox.baseVal;
                                    const viewW = (vb && vb.width) ? vb.width : (svg.width.baseVal.value || width);
                                    const viewH = (vb && vb.height) ? vb.height : (svg.height.baseVal.value || height);

                                    const marginFrac = 0.06; // 6% breathing room on every side
                                    const availableWidth = viewW * (1 - 2 * marginFrac);
                                    const availableHeight = viewH * (1 - 2 * marginFrac);

                                    // Scale down to fit; never scale up past 1:1.
                                    if (bbox.width > availableWidth || bbox.height > availableHeight) {
                                        initialScale = Math.min(availableWidth / bbox.width, availableHeight / bbox.height);
                                    } else {
                                        initialScale = 1.0;
                                    }

                                    const scaledWidth = bbox.width * initialScale;
                                    const scaledHeight = bbox.height * initialScale;
                                    const scaledBboxTopLeftX = bbox.x * initialScale;
                                    const scaledBboxTopLeftY = bbox.y * initialScale;

                                    // Center in the SVG's coordinate space — no magic nudge.
                                    initialTranslateX = (viewW - scaledWidth) / 2 - scaledBboxTopLeftX;
                                    initialTranslateY = (viewH - scaledHeight) / 2 - scaledBboxTopLeftY;

                                    console.log(`Centering calculation for ${filename}:`, {
                                        containerSize: { width, height },
                                        bbox: { x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height },
                                        scale: initialScale,
                                        scaledDimensions: { width: scaledWidth, height: scaledHeight },
                                        translate: { x: initialTranslateX, y: initialTranslateY }
                                    });
                                }
                            }

                            // Always reset to correct initial centering values for new renders
                            // This ensures proper centering every time the graph is rendered
                            transformStates.current[filename] = {
                                scale: initialScale,
                                translateX: initialTranslateX,
                                translateY: initialTranslateY,
                                initialScale: initialScale,
                                initialTranslateX: initialTranslateX,
                                initialTranslateY: initialTranslateY,
                                isDragging: false,
                                lastMouseX: 0,
                                lastMouseY: 0
                            };

                            // Create local transform state for interaction handling
                            // Always start with the correctly calculated centering values
                            const transformState = {
                                scale: transformStates.current[filename].scale,
                                translateX: transformStates.current[filename].translateX,
                                translateY: transformStates.current[filename].translateY,
                                isDragging: false,
                                lastMouseX: 0,
                                lastMouseY: 0
                            };

                            // Function to update SVG transform
                            const updateTransform = () => {
                                if (gElement) {
                                    gElement.setAttribute('transform', 
                                        `translate(${transformState.translateX}, ${transformState.translateY}) scale(${transformState.scale})`
                                    );
                                }
                            };

                            // Apply current transform
                            updateTransform();

                            // Zoom constraints. The floor is relative to the
                            // initial fit-to-container scale: 0.6x fit stops the
                            // graph from being shrunk into an unreadable speck
                            // (an absolute floor let a large graph, already fit
                            // to a small scale, zoom out far past useful).
                            const minScale = 0.6 * (transformStates.current[filename].initialScale || 1);
                            const maxScale = 3.0;

                            // Reset view function
                            const resetView = () => {
                                transformState.scale = transformStates.current[filename].initialScale;
                                transformState.translateX = transformStates.current[filename].initialTranslateX;
                                transformState.translateY = transformStates.current[filename].initialTranslateY;
                                // Update persistent state
                                transformStates.current[filename].scale = transformState.scale;
                                transformStates.current[filename].translateX = transformState.translateX;
                                transformStates.current[filename].translateY = transformState.translateY;
                                updateTransform();
                            };

                            // Mouse wheel zoom with focal point
                            const wheelHandler = (e: WheelEvent) => {
                                e.preventDefault();
                                const rect = svg.getBoundingClientRect();
                                const mouseX = e.clientX - rect.left;
                                const mouseY = e.clientY - rect.top;
                                
                                const scaleFactor = e.deltaY > 0 ? 0.98 : 1.02;
                                const newScale = Math.max(minScale, Math.min(maxScale, transformState.scale * scaleFactor));
                                
                                if (newScale !== transformState.scale) {
                                    const scaleChange = newScale / transformState.scale;
                                    transformState.translateX = mouseX - scaleChange * (mouseX - transformState.translateX);
                                    transformState.translateY = mouseY - scaleChange * (mouseY - transformState.translateY);
                                    transformState.scale = newScale;
                                    // Update persistent state
                                    transformStates.current[filename].scale = transformState.scale;
                                    transformStates.current[filename].translateX = transformState.translateX;
                                    transformStates.current[filename].translateY = transformState.translateY;
                                    updateTransform();
                                }
                            };

                            // Pan functionality with boundary constraints
                            const mouseDownHandler = (e: MouseEvent) => {
                                if (e.button === 0) { // Left mouse button
                                    transformState.isDragging = true;
                                    transformState.lastMouseX = e.clientX;
                                    transformState.lastMouseY = e.clientY;
                                    svg.style.cursor = 'grabbing';
                                }
                            };

                            const mouseMoveHandler = (e: MouseEvent) => {
                                if (transformState.isDragging) {
                                    const deltaX = e.clientX - transformState.lastMouseX;
                                    const deltaY = e.clientY - transformState.lastMouseY;
                                    
                                    let newTranslateX = transformState.translateX + deltaX;
                                    let newTranslateY = transformState.translateY + deltaY;
                                    
                                    // Apply pan boundaries to prevent dragging completely outside container
                                    if (gElement) {
                                        const bbox = gElement.getBBox();
                                        const scaledWidth = bbox.width * transformState.scale;
                                        const scaledHeight = bbox.height * transformState.scale;
                                        
                                        // Calculate boundaries with padding
                                        const padding = 50;
                                        
                                        if (scaledWidth > width) {
                                            const minX = width - (bbox.x * transformState.scale + scaledWidth) - padding;
                                            const maxX = -bbox.x * transformState.scale + padding;
                                            newTranslateX = Math.max(minX, Math.min(maxX, newTranslateX));
                                        }
                                        
                                        if (scaledHeight > height) {
                                            const minY = height - (bbox.y * transformState.scale + scaledHeight) - padding;
                                            const maxY = -bbox.y * transformState.scale + padding;
                                            newTranslateY = Math.max(minY, Math.min(maxY, newTranslateY));
                                        }
                                    }
                                    
                                    transformState.translateX = newTranslateX;
                                    transformState.translateY = newTranslateY;
                                    transformState.lastMouseX = e.clientX;
                                    transformState.lastMouseY = e.clientY;
                                    updateTransform();
                                }
                            };

                            const mouseUpHandler = () => {
                                transformState.isDragging = false;
                                svg.style.cursor = 'default';
                            };

                            // Double-click to reset view
                            const doubleClickHandler = (e: MouseEvent) => {
                                e.preventDefault();
                                resetView();
                            };

                            // Add zoom and pan event listeners. Track each so
                            // cleanupEventListeners can remove them on the next
                            // render (the <svg> persists across d3-graphviz
                            // updates, so untracked listeners would stack).
                            const svgHandlers: Array<{ type: string; handler: EventListener }> = [
                                { type: 'wheel', handler: wheelHandler as EventListener },
                                { type: 'dblclick', handler: doubleClickHandler as EventListener },
                                { type: 'mousedown', handler: mouseDownHandler as EventListener },
                                { type: 'mousemove', handler: mouseMoveHandler as EventListener },
                                { type: 'mouseup', handler: mouseUpHandler as EventListener },
                            ];
                            svg.addEventListener('wheel', wheelHandler, { passive: false });
                            svg.addEventListener('dblclick', doubleClickHandler);
                            svg.addEventListener('mousedown', mouseDownHandler);
                            svg.addEventListener('mousemove', mouseMoveHandler);
                            svg.addEventListener('mouseup', mouseUpHandler);

                            const newListeners: {
                                elements: Element[];
                                handlers: ((e: Event) => void)[];
                                svg?: SVGSVGElement;
                                svgHandlers?: Array<{ type: string; handler: EventListener }>;
                            } = {
                                elements: [],
                                handlers: [],
                                svg,
                                svgHandlers
                            };

                            // Add node click handlers - use Set to avoid duplicates more efficiently
                            const nodeSelectors = ['.node', 'g.node', '[class*="node"]', 'ellipse', 'circle'];
                            const nodeSet = new Set<Element>();
                            
                            nodeSelectors.forEach(selector => {
                                const found = svg.querySelectorAll(selector);
                                found.forEach(node => nodeSet.add(node));
                            });
                            
                            const nodes = Array.from(nodeSet);

                            nodes.forEach(node => {
                                const handler = (e: Event) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    
                                    let title = node.querySelector('title')?.textContent;
                                    let nodeName = '';
                                    
                                    if (title) {
                                        nodeName = title.split('\n')[0];
                                    } else {
                                        // Try to get title from parent group
                                        const parentGroup = node.closest('g');
                                        if (parentGroup) {
                                            const titleInGroup = parentGroup.querySelector('title')?.textContent;
                                            if (titleInGroup) {
                                                nodeName = titleInGroup.split('\n')[0];
                                            }
                                        }
                                    }
                                    
                                    // If still no title, try to get it from sibling elements
                                    if (!nodeName && node.parentElement) {
                                        const siblingTitle = node.parentElement.querySelector('title')?.textContent;
                                        if (siblingTitle) {
                                            nodeName = siblingTitle.split('\n')[0];
                                        }
                                    }
                                    
                                    if (nodeName) {
                                        // Add duplicate prevention similar to edges
                                        const clickId = `${nodeName}-${filename}-${Date.now()}`;
                                        
                                        // Check if this exact click was processed recently (within 500ms)
                                        const recentClickThreshold = 500;
                                        const now = Date.now();
                                        const recentClickIds = Array.from(recentClicks.current).filter(id => {
                                            const timestamp = parseInt(id.split('-').pop() || '0');
                                            return now - timestamp < recentClickThreshold;
                                        });
                                        
                                        // Check if this node was clicked very recently
                                        const isDuplicate = recentClickIds.some(id => 
                                            id.startsWith(`${nodeName}-${filename}-`)
                                        );
                                        
                                        if (isDuplicate) {
                                            console.log(`Prevented duplicate node click: ${nodeName}`);
                                            return;
                                        }
                                        
                                        // Add this click to recent clicks
                                        recentClicks.current.add(clickId);
                                        
                                        // Clean up old click IDs to prevent memory leak
                                        setTimeout(() => {
                                            recentClicks.current.delete(clickId);
                                        }, recentClickThreshold);
                                        
                                        console.log(`Node clicked: ${nodeName} in ${filename}`);
                                        
                                        const graphType = filename === 'selected_sequence' ? 'Selected Sequence' :
                                                        filename === 'all_students' ? 'All Students' :
                                                        filename.startsWith('filtered_graph_') ? `Filtered Graph: ${titleCase(filename.replace('filtered_graph_', ''))}` : 'Filtered Graph';
                                        
                                        const tooltipContent = generateNodeTooltip(nodeName, graphType);
                                        
                                        const historyItem: HistoryItem = {
                                            id: `node-${Date.now()}-${Math.random()}`,
                                            type: 'node',
                                            timestamp: new Date(),
                                            title: `Node: ${nodeName}`,
                                            content: tooltipContent,
                                            graphType,
                                            expanded: false
                                        };
                                        
                                        setHistoryItems(prev => [historyItem, ...prev].slice(0, 50));
                                    }
                                };
                                
                                node.addEventListener('click', handler);
                                (node as HTMLElement).style.cursor = 'pointer';
                                
                                newListeners.elements.push(node);
                                newListeners.handlers.push(handler);
                            });

                            // Add edge click handlers - use Set to avoid duplicates more efficiently
                            const edgeSelectors = ['.edge', 'g.edge', '[class*="edge"]'];
                            const edgeSet = new Set<Element>();
                            
                            edgeSelectors.forEach(selector => {
                                const found = svg.querySelectorAll(selector);
                                found.forEach(edge => edgeSet.add(edge));
                            });
                            
                            const edges = Array.from(edgeSet);

                            edges.forEach(edge => {
                                const handler = (e: Event) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    let title = edge.querySelector('title')?.textContent;
                                    let edgeName = '';
                                    
                                    if (title) {
                                        edgeName = title.split('\n')[0];
                                    } else {
                                        const parentGroup = edge.closest('g');
                                        if (parentGroup) {
                                            const titleInGroup = parentGroup.querySelector('title')?.textContent;
                                            if (titleInGroup) {
                                                edgeName = titleInGroup.split('\n')[0];
                                            }
                                        }
                                    }
                                    
                                    if (edgeName) {
                                        // Create a unique identifier for this click
                                        const clickId = `${edgeName}-${filename}-${Date.now()}`;
                                        
                                        // Check if this exact click was processed recently (within 500ms)
                                        const recentClickThreshold = 500;
                                        const now = Date.now();
                                        const recentClickIds = Array.from(recentClicks.current).filter(id => {
                                            const timestamp = parseInt(id.split('-').pop() || '0');
                                            return now - timestamp < recentClickThreshold;
                                        });
                                        
                                        // Check if this edge was clicked very recently
                                        const isDuplicate = recentClickIds.some(id => 
                                            id.startsWith(`${edgeName}-${filename}-`)
                                        );
                                        
                                        if (isDuplicate) {
                                            return;
                                        }
                                        
                                        // Add this click to recent clicks
                                        recentClicks.current.add(clickId);
                                        
                                        // Clean up old click IDs to prevent memory leak
                                        setTimeout(() => {
                                            recentClicks.current.delete(clickId);
                                        }, recentClickThreshold);
                                        
                                        const graphType = filename === 'selected_sequence' ? 'Selected Sequence' :
                                                        filename === 'all_students' ? 'All Students' :
                                                        filename.startsWith('filtered_graph_') ? `Filtered Graph: ${titleCase(filename.replace('filtered_graph_', ''))}` : 'Filtered Graph';
                                        
                                        // Create history item with basic info immediately
                                        const historyItem: HistoryItem = {
                                            id: `edge-${Date.now()}-${Math.random()}`,
                                            type: 'edge',
                                            timestamp: new Date(),
                                            title: `Edge: ${edgeName}`,
                                            content: `Loading detailed statistics for ${edgeName}...`,
                                            graphType,
                                            expanded: false
                                        };
                                        
                                        setHistoryItems(prev => [historyItem, ...prev].slice(0, 50));
                                        
                                        // Generate detailed tooltip content asynchronously
                                        setTimeout(() => {
                                            const tooltipContent = generateEdgeTooltip(edgeName, graphType);
                                            setHistoryItems(prev => 
                                                prev.map(item => 
                                                    item.id === historyItem.id 
                                                        ? { ...item, content: tooltipContent }
                                                        : item
                                                )
                                            );
                                        }, 0);
                                    }
                                };
                                
                                edge.addEventListener('click', handler);
                                (edge as HTMLElement).style.cursor = 'pointer';
                                
                                newListeners.elements.push(edge);
                                newListeners.handlers.push(handler);
                            });

                            // Store the listeners for this graph
                            eventListenersRef.current.set(filename, newListeners);

                            // Add reset view button overlay to parent container (sibling of GraphMenu)
                            const graphContainer = ref.current;
                            if (graphContainer) {
                                const parentContainer = graphContainer.parentElement;
                                if (parentContainer && !parentContainer.querySelector('.reset-view-btn')) {
                                    const resetButton = document.createElement('button');
                                    resetButton.className = 'reset-view-btn';
                                    resetButton.innerHTML = '↻';
                                    resetButton.title = 'Reset View (or double-click graph)';
                                    resetButton.style.cssText = `
                                        position: absolute;
                                        top: 8px;
                                        right: 8px;
                                        width: 32px;
                                        height: 32px;
                                        border: 1px solid #d1d5db;
                                        border-radius: 4px;
                                        background: rgba(255, 255, 255, 1);
                                        box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
                                        cursor: pointer;
                                        font-size: 16px;
                                        display: flex;
                                        align-items: center;
                                        justify-content: center;
                                        z-index: 10;
                                        transition: background-color 0.2s;
                                    `;
                                    resetButton.addEventListener('mouseover', () => {
                                        resetButton.style.background = 'rgba(249, 250, 251, 1)';
                                    });
                                    resetButton.addEventListener('mouseout', () => {
                                        resetButton.style.background = 'rgba(255, 255, 255, 1)';
                                    });
                                    resetButton.addEventListener('click', resetView);
                                    parentContainer.appendChild(resetButton);
                                }
                            }
                        }
                    }
                }, 100);

            } catch (error) {
                console.error("Error rendering graph:", error);
            }
        }
    };


    useEffect(() => {
        if (showSelectedSequence && topDotString && graphRefTop.current) {
            renderGraph(topDotString, graphRefTop, 'selected_sequence', numberOfGraphs);
        }
    }, [topDotString, numberOfGraphs, showSelectedSequence]);

    useEffect(() => {
        if (showAllStudents && dotString && graphRefMain.current) {
            renderGraph(dotString, graphRefMain, 'all_students', numberOfGraphs);
        }
    }, [dotString, numberOfGraphs, showAllStudents]);

    useEffect(() => {
        filters.forEach(filter => {
            const dotString = filteredDotStrings[filter];
            const ref = graphRefFilteredRefs.current[filter];
            if (dotString && ref?.current) {
                renderGraph(dotString, ref, `filtered_graph_${filter}`, numberOfGraphs);
            }
        });
    }, [filteredDotStrings, numberOfGraphs, filters]);


    return (
        <div className="graphviz-container w-full flex flex-col">
            {/* Tab Navigation */}
            <div className="flex border-b border-gray-300 mb-4">
                <button
                    onClick={() => setActiveTab('graphs')}
                    className={`px-4 py-2 font-medium ${
                        activeTab === 'graphs'
                            ? 'border-b-2 border-blue-500 text-blue-600'
                            : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                    Graphs
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={`px-4 py-2 font-medium ${
                        activeTab === 'history'
                            ? 'border-b-2 border-blue-500 text-blue-600'
                            : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                    History {historyItems.length > 0 && (
                        <span className="ml-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                            {historyItems.length}
                        </span>
                    )}
                </button>
            </div>

            <ErrorBoundary>
                {/* Graphs Tab */}
                <div 
                    className="graphs-tab flex flex-col w-full h-full"
                    style={{ display: activeTab === 'graphs' ? 'flex' : 'none' }}
                >
                    {/* Dataset-level summary (whole unfiltered population) */}
                    {summaryMetrics && (
                        <div className="flex justify-center gap-10 mb-4">
                            <div className="flex flex-col items-center">
                                <span className="text-2xl font-semibold text-gray-800">
                                    {summaryMetrics.totalStudents.toLocaleString()}
                                </span>
                                <span className="text-xs uppercase tracking-wide text-gray-500">Total Students</span>
                            </div>
                            <div className="flex flex-col items-center">
                                <span className="text-2xl font-semibold text-gray-800">
                                    {summaryMetrics.avgPathLength.toFixed(1)} steps
                                </span>
                                <span className="text-xs uppercase tracking-wide text-gray-500">Avg Path Length</span>
                            </div>
                        </div>
                    )}
                    <div className="graphs flex justify-center w-full h-[650px] overflow-x-auto">
                        {showSelectedSequence && topDotString && (
                            <div
                                className={`graph-item flex flex-col items-center w-[350px] border-2 border-gray-700 rounded-lg p-4 bg-gray-100 flex-shrink-0`}>
                                <h2 className="text-lg font-semibold text-center mb-1">Selected Sequence</h2>
                                <p className="text-sm text-gray-500 text-center mb-2">
                                    👥 {selectedSequenceCount.toLocaleString()} students followed this sequence
                                </p>
                                <div className="w-full h-[575px] border-2 border-gray-700 rounded-lg p-4 bg-white flex items-center justify-center relative">
                                    <GraphMenu
                                        maxValue={mainGraphData?.maxEdgeCount || 100}
                                        value={minVisitsPerGraph['selected_sequence'] ?? 0}
                                        onChange={(value: number) => setMinVisitsPerGraph({...minVisitsPerGraph, 'selected_sequence': value})}
                                        uniqueStudentMode={uniqueStudentMode}
                                        showSlider={false}
                                        showSequenceFilter={true}
                                        showOnlySequenceStudents={showOnlySequenceStudents}
                                        onSequenceFilterChange={(value: boolean) => setShowOnlySequenceStudents(value)}
                                    />
                                    <div ref={graphRefTop} className="w-full h-full"></div>
                                </div>
                                <div className="w-full flex justify-center mt-2">
                                    <ExportButton onClick={() => exportSingleGraph('selected_sequence')} disabled={exportBusy} />
                                </div>
                            </div>
                        )}
                        {showAllStudents && dotString && (
                            <div
                                className={`graph-item flex flex-col items-center ${numberOfGraphs >= 3 ? 'w-[475px]' : 'w-[575px]'} border-2 border-gray-700 rounded-lg p-4 bg-gray-100 flex-shrink-0`}>
                                <h2 className="text-lg font-semibold text-center mb-1">All Students, All Paths</h2>
                                <p className="text-sm text-gray-500 text-center mb-2">
                                    👥 {(summaryMetrics?.totalStudents ?? 0).toLocaleString()} students attempted this problem
                                </p>
                                <div className="w-full h-[575px] border-2 border-gray-700 rounded-lg p-4 bg-white flex items-center justify-center relative">
                                    <GraphMenu
                                        maxValue={connectivityCaps['all_students'] ?? (mainGraphData?.maxEdgeCount || 100)}
                                        value={effectiveMinVisits('all_students', mainGraphData?.maxEdgeCount || 100)}
                                        onChange={(value: number) => setMinVisitsPerGraph({...minVisitsPerGraph, 'all_students': value})}
                                        uniqueStudentMode={uniqueStudentMode}
                                    />
                                    <div ref={graphRefMain} className="w-full h-full"></div>
                                </div>
                                <div className="w-full flex justify-center mt-2">
                                    <ExportButton onClick={() => exportSingleGraph('all_students')} disabled={exportBusy} />
                                </div>
                            </div>
                        )}
                        {filters.map(filter => {
                            const dotString = filteredDotStrings[filter];
                            const ref = graphRefFilteredRefs.current[filter];
                            const graphKey = `filtered_graph_${filter}`;
                            const filteredGraphData = filteredGraphDataMap[filter];
                            if (!dotString || !ref) return null;

                            // Unique students in this status subset, plus a Streamlit-style phrase.
                            const subsetCount = Object.keys(filteredGraphData?.filteredStepSequences || {}).length;
                            const statusPhrase = filter === 'GRADUATED' ? 'graduated'
                                : filter === 'PROMOTED' ? 'were promoted'
                                : `matched ${titleCase(filter)}`;

                            return (
                                <div
                                    key={filter}
                                    className={`graph-item flex flex-col items-center ${numberOfGraphs >= 3 ? 'w-[475px]' : 'w-[575px]'} border-2 border-gray-700 rounded-lg p-4 bg-gray-100 flex-shrink-0`}>
                                    <h2 className="text-lg font-semibold text-center mb-1">Filtered Graph: {titleCase(filter)}</h2>
                                    <p className="text-sm text-gray-500 text-center mb-2">
                                        👥 {subsetCount.toLocaleString()} students who completed this problem {statusPhrase}
                                    </p>
                                    <div className="relative w-full h-[575px] border-2 border-gray-700 rounded-lg p-4 bg-white flex items-center justify-center">
                                        <GraphMenu
                                            maxValue={connectivityCaps[graphKey] ?? (filteredGraphData?.maxEdgeCount || 100)}
                                            value={effectiveMinVisits(graphKey, filteredGraphData?.maxEdgeCount || 100)}
                                            onChange={(value: number) => setMinVisitsPerGraph({...minVisitsPerGraph, [graphKey]: value})}
                                            uniqueStudentMode={uniqueStudentMode}
                                        />
                                        <div ref={ref} className="w-full h-full"></div>
                                    </div>
                                    <div className="w-full flex justify-center mt-2">
                                        <ExportButton onClick={() => exportSingleGraph(graphKey)} disabled={exportBusy} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Export panel — writes out the graphs on screen, in either
                        or both outcome modes, with a README describing them. */}
                    {exportableGraphs.length > 0 && (
                        <div className="mt-4 border border-gray-300 rounded-lg bg-white">
                            <button
                                onClick={() => setExportOpen(!exportOpen)}
                                className="w-full flex items-center justify-between px-4 py-2 text-left font-medium text-gray-700 hover:bg-gray-50"
                            >
                                <span>💾 Export Graphs</span>
                                <span className="text-gray-400 text-sm">{exportOpen ? '▲' : '▼'}</span>
                            </button>
                            {exportOpen && (
                                <div className="px-4 pb-4 pt-1 border-t border-gray-200">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
                                        <div>
                                            <h4 className="text-sm font-medium mb-1">Graphs</h4>
                                            {exportableGraphs.map((key) => (
                                                <label key={key} className="flex items-center gap-2 text-sm text-gray-700">
                                                    <input
                                                        type="checkbox"
                                                        checked={effectiveExportGraphKeys.includes(key)}
                                                        onChange={(e) => {
                                                            const next = new Set(effectiveExportGraphKeys);
                                                            if (e.target.checked) next.add(key);
                                                            else next.delete(key);
                                                            setExportGraphKeys(exportableGraphs.filter((k) => next.has(k)));
                                                        }}
                                                    />
                                                    {exportRegistry.current[key]?.title ?? key}
                                                </label>
                                            ))}
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-medium mb-1">Outcome coloring</h4>
                                            {EXPORT_OUTCOME_MODES.map(({ label, mode }) => (
                                                <label key={mode} className="flex items-center gap-2 text-sm text-gray-700">
                                                    <input
                                                        type="checkbox"
                                                        checked={effectiveExportModes.includes(mode)}
                                                        onChange={(e) => {
                                                            const next = new Set(effectiveExportModes);
                                                            if (e.target.checked) next.add(mode);
                                                            else next.delete(mode);
                                                            setExportModes(
                                                                EXPORT_OUTCOME_MODES.filter((m) => next.has(m.mode)).map((m) => m.mode)
                                                            );
                                                        }}
                                                    />
                                                    {label}
                                                </label>
                                            ))}
                                            <p className="text-xs text-gray-500 mt-1">
                                                Pick both to get the node-bar and edge-color version of every selected
                                                graph in one download — the mode on screen doesn't limit what you export.
                                            </p>
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-medium mb-1">Formats</h4>
                                            {EXPORT_FORMATS.map(({ label, format }) => (
                                                <label key={format} className="flex items-center gap-2 text-sm text-gray-700">
                                                    <input
                                                        type="checkbox"
                                                        checked={exportFormats.includes(format)}
                                                        onChange={(e) => {
                                                            const next = new Set(exportFormats);
                                                            if (e.target.checked) next.add(format);
                                                            else next.delete(format);
                                                            setExportFormats(
                                                                EXPORT_FORMATS.filter((f) => next.has(f.format)).map((f) => f.format)
                                                            );
                                                        }}
                                                    />
                                                    {label}
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="mt-3 space-y-1">
                                        <label className="flex items-start gap-2 text-sm text-gray-700">
                                            <input
                                                type="checkbox"
                                                checked={exportTitled}
                                                onChange={(e) => setExportTitled(e.target.checked)}
                                                className="mt-1"
                                            />
                                            <span>
                                                Label images with the problem name
                                                <span className="block text-xs text-gray-500">
                                                    Prints a heading on each image: the workspace and problem, the view and
                                                    how many students it represents, and the edge threshold as a corner note.
                                                </span>
                                            </span>
                                        </label>
                                        <label className="flex items-start gap-2 text-sm text-gray-700">
                                            <input
                                                type="checkbox"
                                                checked={exportHighlightSequence}
                                                onChange={(e) => setExportHighlightSequence(e.target.checked)}
                                                disabled={!selectedSequence || selectedSequence.length === 0}
                                                className="mt-1"
                                            />
                                            <span>
                                                Mark the selected sequence in the full graphs
                                                <span className="block text-xs text-gray-500">
                                                    A white→blue tint by position in edge mode, a bold outline in node mode,
                                                    and its transitions drawn at full strength. Arrow width still means
                                                    students per transition either way. The Selected Sequence graph is
                                                    unaffected.
                                                </span>
                                            </span>
                                        </label>
                                        <label className="flex items-start gap-2 text-sm text-gray-700">
                                            <input
                                                type="checkbox"
                                                checked={exportReadme}
                                                onChange={(e) => setExportReadme(e.target.checked)}
                                                className="mt-1"
                                            />
                                            <span>
                                                Include a README (data processing &amp; specifications)
                                                <span className="block text-xs text-gray-500">
                                                    A Markdown file explaining what the graphs show, how the data is
                                                    processed, and how to read them — one per exported outcome mode.
                                                </span>
                                            </span>
                                        </label>
                                    </div>
                                    <div className="mt-3 flex items-center gap-3">
                                        <Button
                                            onClick={prepareExport}
                                            disabled={
                                                exportBusy
                                                || effectiveExportGraphKeys.length === 0
                                                || effectiveExportModes.length === 0
                                                || exportFormats.length === 0
                                            }
                                        >
                                            {exportBusy
                                                ? 'Preparing…'
                                                : `Download${exportFileCount > 1 ? ` (${exportFileCount} files → .zip)` : ''}`}
                                        </Button>
                                        {exportError && (
                                            <span className="text-sm text-red-600">{exportError}</span>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* History Tab */}
                <div 
                    className="history-panel flex flex-col w-full h-full p-4 overflow-hidden"
                    style={{ display: activeTab === 'history' ? 'flex' : 'none' }}
                >
                    <div className="flex justify-between items-center mb-4 flex-shrink-0">
                        <h2 className="text-lg font-semibold">Node & Edge History</h2>
                        <div className="flex gap-2">
                            <span className="text-sm text-gray-500">
                                {historyItems.length} items
                            </span>
                            {historyItems.length > 0 && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setHistoryItems([])}
                                >
                                    Clear History
                                </Button>
                            )}
                        </div>
                    </div>

                    {historyItems.length === 0 ? (
                        <div className="flex-1 flex items-center justify-center text-gray-500">
                            <div className="text-center">
                                <p className="text-lg mb-2">No history items yet</p>
                                <p className="text-sm">Click on nodes or edges in the graphs to see their details here</p>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-4 min-h-0 pb-20">
                            {historyItems.map((item) => (
                                <div
                                    key={item.id}
                                    className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow"
                                >
                                    <div 
                                        className="flex justify-between items-start mb-2 cursor-pointer"
                                        onClick={() => toggleHistoryItem(item.id)}
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className={`inline-block w-3 h-3 rounded-full ${
                                                item.type === 'node' ? 'bg-blue-500' : 'bg-green-500'
                                            }`}></span>
                                            <h3 className="font-medium text-gray-900">{item.title}</h3>
                                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                                                {item.graphType}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-gray-500">
                                                {formatTime(item.timestamp)}
                                            </span>
                                            <span className="text-xs text-gray-400">
                                                {item.expanded ? '▼' : '▶'}
                                            </span>
                                        </div>
                                    </div>
                                    {item.expanded && (
                                        <div className="bg-gray-50 rounded p-3 text-sm font-mono whitespace-pre-wrap break-words select-text">
                                            {formatContent(item.content)}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </ErrorBoundary>
        </div>
    );
}

export default GraphvizParent;


interface ExportButtonProps {
    onClick: () => void;
    label?: string;
    disabled?: boolean;
}

function ExportButton({ onClick, label = "Export as PNG", disabled = false }: ExportButtonProps) {
    return (
        <Button
            variant={'outline'}
            onClick={onClick}
            disabled={disabled}
            className="flex h-2 items-center gap-1 hover:bg-blue-50 hover:border-blue-300 transition-all duration-200 shadow-sm text-xs"
        >
            <Download className="h-3 w-3" />
            {label}
        </Button>
    );
}