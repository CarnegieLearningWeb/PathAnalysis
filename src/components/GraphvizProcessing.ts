import * as Papa from 'papaparse';
import {SequenceCount} from "@/Context";

// import {autoType} from "d3";

interface CSVRow {
    'Session Id'?: string;
    'Time': string;
    'Step Name': string;
    'Outcome': string;
    'CF (Workspace Progress Status)': string;
    'Problem Name': string;
    'Anon Student Id': string;
}


/**
 * Parses CSV data, replaces missing step names with 'DoneButton', and sorts by session ID and time.
 * @param csvData - The raw CSV data as a string.
 * @returns The transformed and sorted CSV rows.
 */
export const loadAndSortData = (csvData: string): CSVRow[] => {
    const parsedData = Papa.parse<CSVRow>(csvData, {
        header: true,
        skipEmptyLines: true,
    }).data;

    const transformedData = parsedData.map(row => ({
        'Session Id': row['Session Id'],
        'Time': row['Time'],
        'Step Name': row['Step Name'] || 'DoneButton',
        'Outcome': row['Outcome'],
        'CF (Workspace Progress Status)': row['CF (Workspace Progress Status)'],
        'Problem Name': row['Problem Name'],
        'Anon Student Id': row['Anon Student Id']
    }));
    
    // Cache Date objects to avoid repeated parsing during sort
    const dateCache = new Map<string, number>();
    const getTimestamp = (timeStr: string): number => {
        if (!dateCache.has(timeStr)) {
            dateCache.set(timeStr, new Date(timeStr).getTime());
        }
        return dateCache.get(timeStr)!;
    };
    
    return transformedData.sort((a, b) => {
        if (a['Anon Student Id'] === b['Anon Student Id']) {
            if (a['Problem Name'] === b['Problem Name']) {
                return getTimestamp(a['Time']) - getTimestamp(b['Time']);
            }
            return a['Problem Name'].localeCompare(b['Problem Name']);
        }
        return a['Anon Student Id'].localeCompare(b['Anon Student Id']);
    });
};


/**
 * Creates step sequences from sorted data, optionally allowing self-loops.
 * @param sortedData - The sorted CSV rows.
 * @param selfLoops - A boolean to include self-loops.
 * @returns A dictionary mapping session IDs to sequences of step names.
 */
export const createStepSequences = (sortedData: CSVRow[], selfLoops: boolean): { [key: string]: { [key: string]: string[] } } => {
    return sortedData.reduce((acc, row) => {
        const studentId: string = row['Anon Student Id'];
        const problemName: string = row['Problem Name'];

        if (!acc[studentId]) acc[studentId] = {}; // Initialize student entry if not present
        if (!acc[studentId][problemName]) acc[studentId][problemName] = []; // Initialize problem entry if not present

        const stepName = row['Step Name'];
        if (selfLoops || acc[studentId][problemName].length === 0 || acc[studentId][problemName][acc[studentId][problemName].length - 1] !== stepName) {
            acc[studentId][problemName].push(stepName);
        }

        return acc;
    }, {} as { [key: string]: { [key: string]: string[] } });
};
/**
 * Creates outcome sequences from sorted data.
 * @param sortedData - The sorted CSV rows.
 * @returns A dictionary mapping session IDs to sequences of outcomes.
 */
export const createOutcomeSequences = (sortedData: CSVRow[]): { [key: string]: { [key: string]: string[] } } => {
    return sortedData.reduce((acc, row) => {
        const studentId = row['Anon Student Id'];
        const problemName = row['Problem Name'];

        if (!acc[studentId]) acc[studentId] = {}; // Initialize student entry if not present
        if (!acc[studentId][problemName]) acc[studentId][problemName] = []; // Initialize problem entry if not present

        acc[studentId][problemName].push(row['Outcome']); // Store outcome sequence under student & problem

        return acc;
    }, {} as { [key: string]: { [key: string]: string[] } });
};

/**
 * Finds the top N most frequent step sequences.
 * @param stepSequences - The step sequences for all sessions.
 * @param topN - The number of top sequences to return (default is 5).
 * @returns An array of the top sequences and their counts.
 */
export function getTopSequences(stepSequences: { [key: string]: { [key: string]: string[] } }, topN: number = 5) {
    const sequenceCounts: { [sequence: string]: number } = {};

    // Iterate through the outer object
    Object.values(stepSequences).forEach((nestedObj) => {
        // Iterate through the inner object to access each sequence (which is an array)
        Object.values(nestedObj).forEach((sequence) => {
            const sequenceKey = JSON.stringify(sequence); // Convert sequence array to a string key

            // Count occurrences of each unique sequence
            sequenceCounts[sequenceKey] = (sequenceCounts[sequenceKey] || 0) + 1;
        });
    });

    // Filter sequences of length 5 or greater, then sort and take top N
    const sortedSequences = Object.entries(sequenceCounts)
        .filter(([sequence]) => JSON.parse(sequence).length >= 5)
        .sort(([, countA], [, countB]) => countB - countA)
        .slice(0, topN);

    // Convert back to array format
    const topSequences = sortedSequences.map(([sequenceKey, count]) => ({
        sequence: JSON.parse(sequenceKey), // Convert the string back to an array
        count,
    }));

    console.log("Processing topSequences: ", topSequences);
    return topSequences;
}


interface EdgeCounts {
    edgeCounts: { [key: string]: number };
    totalNodeEdges: { [key: string]: number };
    ratioEdges: { [key: string]: number };
    edgeOutcomeCounts: { [key: string]: { [outcome: string]: number } };
}


/**
 * Helper type for pre-calculated student-problem combinations to improve performance
 */
type StudentProblemCombination = {
    studentId: string;
    problemName: string;
    steps: string[];
    outcomes: string[];
};

/**
 * Helper type for internal tracking data structures using Maps for better performance
 */
type EdgeTrackingMaps = {
    totalNodeEdges: Map<string, Set<string>>;
    edgeOutcomeCounts: Map<string, Map<string, number>>;
    edgeCounts: Map<string, number>;
    totalVisits: Map<string, number>;
    studentEdgeCounts: Map<string, Set<string>>;
    repeatVisits: Map<string, Map<string, number>>;
    firstAttemptOutcomes: Map<string, Map<string, number>>;
};

/**
 * Pre-calculates all valid student-problem combinations to avoid nested object lookups.
 * Only includes problems with at least 2 steps (required for edge creation).
 * 
 * @param stepSequences - Student step sequences by studentId -> problemName -> steps[]
 * @param outcomeSequences - Student outcome sequences by studentId -> problemName -> outcomes[]
 * @returns Array of pre-calculated combinations for efficient processing
 */
const prepareStudentProblemCombinations = (
    stepSequences: { [key: string]: { [key: string]: string[] } },
    outcomeSequences: { [key: string]: { [key: string]: string[] } }
): StudentProblemCombination[] => {
    const combinations: StudentProblemCombination[] = [];

    for (const [studentId, innerStepSequences] of Object.entries(stepSequences)) {
        const innerOutcomeSequences = outcomeSequences[studentId] || {};
        
        for (const [problemName, steps] of Object.entries(innerStepSequences)) {
            // Only include problems with at least 2 steps (needed to create edges)
            if (steps.length >= 2) {
                combinations.push({
                    studentId,
                    problemName,
                    steps,
                    outcomes: innerOutcomeSequences[problemName] || []
                });
            }
        }
    }

    return combinations;
};

/**
 * Initializes all tracking data structures using Maps for O(1) performance.
 * Maps are more efficient than objects for frequent key-value operations.
 * 
 * @returns Object containing initialized tracking Maps
 */
const initializeTrackingMaps = (): EdgeTrackingMaps => ({
    totalNodeEdges: new Map<string, Set<string>>(),
    edgeOutcomeCounts: new Map<string, Map<string, number>>(),
    edgeCounts: new Map<string, number>(),
    totalVisits: new Map<string, number>(),
    studentEdgeCounts: new Map<string, Set<string>>(),
    repeatVisits: new Map<string, Map<string, number>>(),
    firstAttemptOutcomes: new Map<string, Map<string, number>>()
});

/**
 * Initializes tracking data structures for a new edge if they don't exist.
 * This lazy initialization pattern avoids creating empty structures for unused edges.
 * 
 * @param edgeKey - The edge identifier (format: "sourceNode->targetNode")
 * @param currentStep - The source node of the edge
 * @param maps - The tracking data structures
 */
const initializeEdgeTracking = (
    edgeKey: string,
    currentStep: string,
    maps: EdgeTrackingMaps
): void => {
    // Initialize edge-specific tracking if this is a new edge
    if (!maps.studentEdgeCounts.has(edgeKey)) {
        maps.studentEdgeCounts.set(edgeKey, new Set());
        maps.totalVisits.set(edgeKey, 0);
        maps.repeatVisits.set(edgeKey, new Map());
        maps.edgeOutcomeCounts.set(edgeKey, new Map());
    }
    
    // Initialize node tracking if this is a new source node
    if (!maps.totalNodeEdges.has(currentStep)) {
        maps.totalNodeEdges.set(currentStep, new Set());
    }
};

/**
 * Updates all tracking metrics for a single edge traversal by a student.
 * This includes student counts, visit counts, repeat visits, outcomes, and first attempts.
 * 
 * @param edgeKey - The edge identifier (format: "sourceNode->targetNode")
 * @param currentStep - The source node of the edge
 * @param studentId - The student making the traversal
 * @param outcome - The outcome of this step attempt
 * @param maps - The tracking data structures
 * @returns The updated maximum edge count across all edges
 */
const updateEdgeMetrics = (
    edgeKey: string,
    currentStep: string,
    studentId: string,
    outcome: string,
    maps: EdgeTrackingMaps,
    currentMaxEdgeCount: number
): number => {
    // Track unique students for this edge and source node
    maps.studentEdgeCounts.get(edgeKey)!.add(studentId);
    maps.totalNodeEdges.get(currentStep)!.add(studentId);
    
    // Increment total visit counter (includes repeat visits)
    maps.totalVisits.set(edgeKey, maps.totalVisits.get(edgeKey)! + 1);
    
    // Track repeat visits per student per edge
    const edgeRepeatVisits = maps.repeatVisits.get(edgeKey)!;
    const currentRepeatCount = (edgeRepeatVisits.get(studentId) || 0) + 1;
    edgeRepeatVisits.set(studentId, currentRepeatCount);

    // Track first attempt outcomes (ignore subsequent attempts)
    if (currentRepeatCount === 1) {
        if (!maps.firstAttemptOutcomes.has(edgeKey)) {
            maps.firstAttemptOutcomes.set(edgeKey, new Map());
        }
        const firstAttemptMap = maps.firstAttemptOutcomes.get(edgeKey)!;
        firstAttemptMap.set(outcome, (firstAttemptMap.get(outcome) || 0) + 1);
    }

    // Update edge student count and track maximum
    const currentEdgeCount = maps.studentEdgeCounts.get(edgeKey)!.size;
    maps.edgeCounts.set(edgeKey, currentEdgeCount);
    const newMaxEdgeCount = Math.max(currentMaxEdgeCount, currentEdgeCount);

    // Track all outcomes (including repeat attempts)
    const outcomeMap = maps.edgeOutcomeCounts.get(edgeKey)!;
    outcomeMap.set(outcome, (outcomeMap.get(outcome) || 0) + 1);

    return newMaxEdgeCount;
};

/**
 * Processes all student learning paths to generate edge and node metrics.
 * Uses a single-pass algorithm for optimal performance.
 * 
 * @param combinations - Pre-calculated student-problem combinations
 * @param maps - Initialized tracking data structures
 * @returns The maximum edge count found across all edges
 */
const processStudentPaths = (
    combinations: StudentProblemCombination[],
    maps: EdgeTrackingMaps
): number => {
    let maxEdgeCount = 0;

    // Single pass through all student paths for optimal performance
    for (const { studentId, steps, outcomes } of combinations) {
        // Process each consecutive step pair to create edges
        for (let i = 0; i < steps.length - 1; i++) {
            const currentStep = steps[i];
            const nextStep = steps[i + 1];
            const outcome = outcomes[i + 1]; // Outcome corresponds to the target step
            const edgeKey = `${currentStep}->${nextStep}`;

            // Lazy initialization of tracking structures
            initializeEdgeTracking(edgeKey, currentStep, maps);

            // Update all metrics for this edge traversal
            maxEdgeCount = updateEdgeMetrics(
                edgeKey,
                currentStep,
                studentId,
                outcome,
                maps,
                maxEdgeCount
            );
        }
    }

    return maxEdgeCount;
};

/**
 * Converts internal Map data structures back to plain objects for API compatibility.
 * Also calculates ratio edges (edge count relative to source node total).
 * 
 * @param maps - The tracking data structures using Maps
 * @param maxEdgeCount - The maximum edge count for normalization
 * @param topSequences - Pre-calculated top sequences
 * @returns Final result object with all metrics
 */
const convertMapsToObjects = (
    maps: EdgeTrackingMaps,
    maxEdgeCount: number,
    topSequences: SequenceCount[]
) => {
    // Convert node edge counts (unique students per node)
    const totalNodeEdgesCounts: { [key: string]: number } = {};
    maps.totalNodeEdges.forEach((students, node) => {
        totalNodeEdgesCounts[node] = students.size;
    });

    // Convert edge counts and calculate ratios
    const edgeCountsObj: { [key: string]: number } = {};
    const ratioEdgesObj: { [key: string]: number } = {};
    maps.edgeCounts.forEach((count, edge) => {
        edgeCountsObj[edge] = count;
        // Calculate ratio of edge count to source node total
        const [sourceNode] = edge.split('->');
        ratioEdgesObj[edge] = count / (totalNodeEdgesCounts[sourceNode] || 1);
    });

    // Convert total visits (includes repeat visits)
    const totalVisitsObj: { [key: string]: number } = {};
    maps.totalVisits.forEach((count, edge) => {
        totalVisitsObj[edge] = count;
    });

    // Convert repeat visit tracking (nested Map -> nested object)
    const repeatVisitsObj: { [key: string]: { [studentId: string]: number } } = {};
    maps.repeatVisits.forEach((studentMap, edge) => {
        repeatVisitsObj[edge] = {};
        studentMap.forEach((count, studentId) => {
            repeatVisitsObj[edge][studentId] = count;
        });
    });

    // Convert outcome counts (nested Map -> nested object)
    const edgeOutcomeCountsObj: { [key: string]: { [outcome: string]: number } } = {};
    maps.edgeOutcomeCounts.forEach((outcomeMap, edge) => {
        edgeOutcomeCountsObj[edge] = {};
        outcomeMap.forEach((count, outcome) => {
            edgeOutcomeCountsObj[edge][outcome] = count;
        });
    });

    // Convert first attempt outcomes (nested Map -> nested object)
    const firstAttemptOutcomesObj: { [key: string]: { [outcome: string]: number } } = {};
    maps.firstAttemptOutcomes.forEach((outcomeMap, edge) => {
        firstAttemptOutcomesObj[edge] = {};
        outcomeMap.forEach((count, outcome) => {
            firstAttemptOutcomesObj[edge][outcome] = count;
        });
    });

    return {
        edgeCounts: edgeCountsObj,
        totalNodeEdges: totalNodeEdgesCounts,
        ratioEdges: ratioEdgesObj,
        edgeOutcomeCounts: edgeOutcomeCountsObj,
        maxEdgeCount,
        totalVisits: totalVisitsObj,
        repeatVisits: repeatVisitsObj,
        topSequences,
        firstAttemptOutcomes: firstAttemptOutcomesObj
    };
};

/**
 * Counts unique students following each edge and tracks various learning analytics metrics.
 * This is the main function for analyzing student learning path data.
 * 
 * Key features:
 * - Counts each student only once per edge (unique student counting)
 * - Tracks total visits including repeat attempts
 * - Records first attempt outcomes separately from all outcomes
 * - Calculates edge ratios relative to source node traffic
 * - Uses optimized data structures (Maps/Sets) for better performance
 * 
 * Performance optimizations:
 * - Single-pass algorithm through all data
 * - Pre-calculated student-problem combinations
 * - Map/Set data structures for O(1) operations
 * - Lazy initialization of tracking structures
 * 
 * @param stepSequences - Student learning paths: studentId -> problemName -> step[]
 * @param outcomeSequences - Student outcomes: studentId -> problemName -> outcome[]
 * @returns Comprehensive edge and node analytics including counts, ratios, and sequences
 */
export const countEdges = (
    stepSequences: { [key: string]: { [key: string]: string[] } },
    outcomeSequences: { [key: string]: { [key: string]: string[] } }
): {
    totalNodeEdges: { [p: string]: number };
    edgeOutcomeCounts: { [p: string]: { [p: string]: number } };
    maxEdgeCount: number;
    ratioEdges: { [key: string]: number };
    edgeCounts: { [key: string]: number };
    totalVisits: { [key: string]: number };
    repeatVisits: { [key: string]: { [studentId: string]: number } };
    topSequences: SequenceCount[];
    firstAttemptOutcomes: { [key: string]: { [outcome: string]: number } };
} => {
    // Step 1: Pre-calculate student-problem combinations for efficient processing
    const combinations = prepareStudentProblemCombinations(stepSequences, outcomeSequences);
    
    // Step 2: Initialize high-performance tracking data structures
    const trackingMaps = initializeTrackingMaps();
    
    // Step 3: Calculate top sequences (independent of edge processing)
    const topSequences = getTopSequences(stepSequences, 5);
    
    // Step 4: Process all student paths in a single optimized pass
    const maxEdgeCount = processStudentPaths(combinations, trackingMaps);
    
    // Step 5: Convert internal data structures to API-compatible format
    return convertMapsToObjects(trackingMaps, maxEdgeCount, topSequences);
};


/**
 * Normalizes edge thicknesses based on their ratios for better visual representation.
 * @param ratioEdges - The edge ratios to normalize.
 * @param maxThickness - The maximum allowed thickness.
 * @returns Normalized thicknesses for each edge.
 */
export function normalizeThicknessesRatios(
    ratioEdges: { [key: string]: number },
    maxThickness: number
): { [key: string]: number } {
    const normalized: { [key: string]: number } = {};
    const maxRatio = Math.max(...Object.values(ratioEdges), 1);

    Object.keys(ratioEdges).forEach((edge) => {
        const ratio = ratioEdges[edge];
        normalized[edge] = (ratio / maxRatio) * maxThickness;
    });

    return normalized;
}


/**
 * Normalizes edge thicknesses based on edge counts using improved scaling.
 * Uses square root scaling for better visual distribution when dealing with high values.
 * @param edgeCounts - The raw edge counts.
 * @param maxEdgeCount - The maximum edge count.
 * @param maxThickness - The maximum allowed thickness.
 * @returns Normalized thicknesses for each edge.
 */
export function normalizeThicknesses(
    edgeCounts: { [key: string]: number },
    maxEdgeCount: number,
    maxThickness: number
): { [key: string]: number } {
    const normalized: { [key: string]: number } = {};
    const minThickness = 0.5; // Ensure edges are always visible

    // Use square root scaling for better visual distribution with high values
    const maxSqrt = Math.sqrt(maxEdgeCount);

    Object.keys(edgeCounts).forEach((edge) => {
        const count = edgeCounts[edge];
        // Apply square root scaling to compress the range
        const sqrtCount = Math.sqrt(count);
        let thickness = (sqrtCount / maxSqrt) * maxThickness;
        
        // Ensure minimum thickness for visibility
        thickness = Math.max(thickness, minThickness);
        
        normalized[edge] = thickness;
    });

    return normalized;
}


/**
 * Calculates the color of a node based on its rank in a sequence.
 * @param rank - The rank of the node.
 * @param totalSteps - The total number of steps in the sequence.
 * @returns A hex color representing the node's color.
 */
export function calculateColor(rank: number, totalSteps: number): string {
    const ratio = rank / totalSteps;

    const white = {r: 255, g: 255, b: 255};
    const lightBlue = {r: 0, g: 166, b: 255};

    const r = Math.round(white.r * (1 - ratio) + lightBlue.r * ratio);
    const g = Math.round(white.g * (1 - ratio) + lightBlue.g * ratio);
    const b = Math.round(white.b * (1 - ratio) + lightBlue.b * ratio);

    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Calculates the color of an edge based on the most frequent outcome.
 * @param outcomes - A dictionary of outcomes and their counts.
 * @param errorMode
 * @returns A color representing the most frequent outcome.
 */
function calculateEdgeColors(outcomes: { [outcome: string]: number }, errorMode: boolean): string {
    const colorMap: { [key: string]: string } = errorMode ? {
        'ERROR': '#ff0000',        // Red
        'INITIAL_HINT': '#0000ff', // Blue
        'HINT_LEVEL_CHANGE': '#0000ff',
        'JIT': '#ffff00',          // Yellow
        'FREEBIE_JIT': '#ffff00'
        // 'OK' intentionally excluded
    } : {
        'ERROR': '#ff0000',
        'OK': '#00ff00',           // Green
        'INITIAL_HINT': '#0000ff',
        'HINT_LEVEL_CHANGE': '#0000ff',
        'JIT': '#ffff00',
        'FREEBIE_JIT': '#ffff00'
    };

    if (Object.keys(outcomes).length === 0) {
        return '#00000000'; // Transparent
    }

    let weightedR = 0, weightedG = 0, weightedB = 0;
    let totalCount = 0;
    let contributingOutcomes = 0;

    Object.entries(outcomes).forEach(([outcome, count]) => {
        if (errorMode && outcome === 'OK') return; // Skip OK in errorMode

        const color = colorMap[outcome];
        if (!color) return; // Skip if not in colorMap

        const [r, g, b] = [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16));
        weightedR += r * count;
        weightedG += g * count;
        weightedB += b * count;
        totalCount += count;
        contributingOutcomes++;
    });

    // If nothing contributed but 'OK' was present (and we're in errorMode), return black
    if (contributingOutcomes === 0 && errorMode && outcomes['OK']) {
        return '#00000090'; // Black with alpha
    }

    if (totalCount === 0) {
        return '#00000000'; // Fully transparent fallback
    }

    const rHex = Math.round(weightedR / totalCount).toString(16).padStart(2, '0');
    const gHex = Math.round(weightedG / totalCount).toString(16).padStart(2, '0');
    const bHex = Math.round(weightedB / totalCount).toString(16).padStart(2, '0');

    return `#${rHex}${gHex}${bHex}90`; // Final color
}

/**
 * Helper function to create a detailed tooltip for edges containing student statistics and outcomes.
 * Provides comprehensive information about student paths, visits, outcomes, and visual properties.
 * 
 * @param currentStep - Source step name
 * @param nextStep - Target step name  
 * @param edgeKey - Edge identifier (currentStep->nextStep)
 * @param edgeCount - Number of unique students traversing this edge
 * @param totalCount - Total number of students at the source node
 * @param visits - Total visits (including repeats) for this edge
 * @param ratioEdges - Edge ratio data for calculating percentages
 * @param outcomes - All outcome counts for this edge
 * @param firstAttempts - First attempt outcome counts for this edge
 * @param repeatVisits - Repeat visit data per student
 * @param edgeColor - Color representing the edge's dominant outcomes
 * @returns Formatted tooltip string for display on hover
 */
const createEdgeTooltip = (
    currentStep: string,
    nextStep: string,
    edgeKey: string,
    edgeCount: number,
    totalCount: number,
    visits: number,
    ratioEdges: { [key: string]: number },
    outcomes: { [outcome: string]: number },
    firstAttempts: { [outcome: string]: number },
    repeatVisits: { [key: string]: { [studentId: string]: number } },
    edgeColor: string,
    uniqueStudentMode: boolean = false
): string => {
    // Build basic statistics section with mode-appropriate labels
    const countLabel = uniqueStudentMode ? 'Unique Students on this path' : 'Total Visits on this path';
    const countValue = uniqueStudentMode ? edgeCount : visits;
    let tooltip = `${currentStep} to ${nextStep}\n\n`
        + `Statistics:\n`
        + `- Total Students at ${currentStep}: \n\t\t${totalCount}\n`
        + `- ${countLabel}: \n\t\t${countValue}\n`
        + `- Unique Students on this path: \n\t\t${edgeCount}\n`
        + `- Total Edge Visits: \n\t\t${visits}\n`;

    // Add repeat visit analysis if data exists
    if (repeatVisits[edgeKey]) {
        const repeatCounts = Object.values(repeatVisits[edgeKey]);
        const studentsWithRepeats = repeatCounts.filter(count => count > 1).length;
        const maxRepeats = Math.max(...repeatCounts);
        tooltip += `- Students who repeated this path: \n\t\t${studentsWithRepeats}\n`
            + `- Maximum visits by a student: \n\t\t${maxRepeats}\n`;
    }

    // Add path statistics and outcome analysis
    const ratioPercent = ((ratioEdges[edgeKey] || 0) * 100).toFixed(2);
    const outcomesStr = Object.entries(outcomes)
        .map(([outcome, count]) => `${outcome}: ${count}`)
        .join('\n\t\t');
    const firstAttemptsStr = Object.entries(firstAttempts)
        .map(([outcome, count]) => `${outcome}: ${count}`)
        .join('\n\t\t');

    tooltip += `\nPath Statistics:\n`
        + `- Ratio: \n\t\t${ratioPercent}% of students at ${currentStep} go to ${nextStep}\n`
        + `- All Outcomes: \n\t\t${outcomesStr}\n`
        + `- First Attempt Outcomes: \n\t\t${firstAttemptsStr}\n`
        + `\nVisual Properties:\n`
        + `- Edge Color: \n\t\tHex: ${edgeColor}\n`;

    return tooltip;
};

/**
 * Helper function to create a tooltip for nodes showing rank, color, and student count.
 * 
 * @param rank - Position of the node in the selected sequence (0-based)
 * @param color - Hex color of the node
 * @param studentCount - Number of students who visited this node
 * @returns Formatted tooltip string for node display
 */
const createNodeTooltip = (rank: number, color: string, studentCount: number): string => {
    return `Rank:\n\t\t${rank + 1}\nColor:\n\t\t${color}\nTotal Students:\n\t\t${studentCount}`;
};

/**
 * Generates nodes and edges for the "justTopSequence" mode where only the selected sequence is visualized.
 * This creates a linear path showing just the selected sequence with proper node coloring and edge connections.
 * 
 * @param selectedSequence - Array of step names in the selected sequence
 * @param normalizedThicknesses - Edge thickness values for visualization
 * @param edgeOutcomeCounts - Outcome counts for each edge
 * @param firstAttemptOutcomes - First attempt outcomes for each edge
 * @param edgeCounts - Number of unique students per edge
 * @param totalVisits - Total visits per edge (including repeats)
 * @param totalNodeEdges - Student counts per node
 * @param ratioEdges - Edge ratios for percentage calculations
 * @param repeatVisits - Repeat visit data per student per edge
 * @param minVisits - Minimum visits required to show an edge
 * @param errorMode - Whether to use error-focused coloring
 * @returns DOT string for nodes and edges in top sequence mode
 */
const generateTopSequenceVisualization = (
    selectedSequence: string[],
    normalizedThicknesses: { [key: string]: number },
    edgeOutcomeCounts: { [key: string]: { [outcome: string]: number } },
    firstAttemptOutcomes: { [key: string]: { [outcome: string]: number } },
    edgeCounts: { [key: string]: number },
    totalVisits: { [key: string]: number },
    totalNodeEdges: { [key: string]: number },
    ratioEdges: { [key: string]: number },
    repeatVisits: { [key: string]: { [studentId: string]: number } },
    minVisits: number,
    errorMode: boolean,
    uniqueStudentMode: boolean = false
): string => {
    let dotContent = '';
    const totalSteps = selectedSequence.length;

    // Generate nodes and edges for the linear sequence
    for (let rank = 0; rank < totalSteps; rank++) {
        const currentStep = selectedSequence[rank];
        const color = calculateColor(rank, totalSteps);
        const studentCount = totalNodeEdges[currentStep] || 0;
        const nodeTooltip = createNodeTooltip(rank, color, studentCount);

        // Add node definition with color and tooltip
        dotContent += `    "${currentStep}" [rank=${rank + 1}, style=filled, fillcolor="${color}", tooltip="${nodeTooltip}"];\n`;

        // Add edge to next node if not the last node
        if (rank < totalSteps - 1) {
            const nextStep = selectedSequence[rank + 1];
            const edgeKey = `${currentStep}->${nextStep}`;
            const thickness = normalizedThicknesses[edgeKey] || 1;
            const outcomes = edgeOutcomeCounts[edgeKey] || {};
            const firstAttempts = firstAttemptOutcomes[edgeKey] || {};
            const edgeCount = edgeCounts[edgeKey] || 0;
            const visits = totalVisits[edgeKey] || 0;
            const visitsForFiltering = uniqueStudentMode ? edgeCount : visits;
            const totalCount = totalNodeEdges[currentStep] || 0;
            const edgeColor = calculateEdgeColors(outcomes, errorMode);

            // Only show edge if it meets minimum visit threshold (using mode-appropriate count)
            if (visitsForFiltering >= minVisits) {
                const tooltip = createEdgeTooltip(
                    currentStep, nextStep, edgeKey, edgeCount, totalCount, visits,
                    ratioEdges, outcomes, firstAttempts, repeatVisits, edgeColor, uniqueStudentMode
                );

                dotContent += `    "${currentStep}" -> "${nextStep}" [penwidth=${thickness}, color="${edgeColor}", tooltip="${tooltip}"];\n`;
            }
        }
    }

    return dotContent;
};

/**
 * Generates nodes and edges for the full graph mode showing all qualifying edges.
 * This creates a complete network visualization with all edges that meet the threshold criteria.
 * 
 * @param selectedSequence - Array of step names for node coloring
 * @param normalizedThicknesses - Edge thickness values with threshold filtering
 * @param edgeOutcomeCounts - Outcome counts for each edge
 * @param firstAttemptOutcomes - First attempt outcomes for each edge
 * @param edgeCounts - Number of unique students per edge
 * @param totalVisits - Total visits per edge (including repeats)
 * @param totalNodeEdges - Student counts per node
 * @param ratioEdges - Edge ratios for percentage calculations
 * @param repeatVisits - Repeat visit data per student per edge
 * @param threshold - Minimum thickness threshold to show an edge
 * @param minVisits - Minimum visits required to show an edge
 * @param errorMode - Whether to use error-focused coloring
 * @returns DOT string for nodes and edges in full graph mode
 */
const generateFullGraphVisualization = (
    selectedSequence: string[],
    normalizedThicknesses: { [key: string]: number },
    edgeOutcomeCounts: { [key: string]: { [outcome: string]: number } },
    firstAttemptOutcomes: { [key: string]: { [outcome: string]: number } },
    edgeCounts: { [key: string]: number },
    totalVisits: { [key: string]: number },
    totalNodeEdges: { [key: string]: number },
    ratioEdges: { [key: string]: number },
    repeatVisits: { [key: string]: { [studentId: string]: number } },
    threshold: number,
    minVisits: number,
    errorMode: boolean,
    uniqueStudentMode: boolean = false
): string => {
    let dotContent = '';
    const totalSteps = selectedSequence.length;

    // First, collect all nodes that will appear in edges
    const allNodesInEdges = new Set<string>();
    for (const edgeKey of Object.keys(normalizedThicknesses)) {
        const thickness = normalizedThicknesses[edgeKey];
        if (thickness >= threshold) {
            const edgeCount = edgeCounts[edgeKey] || 0;
            const visits = totalVisits[edgeKey] || 0;
            const visitsForFiltering = uniqueStudentMode ? edgeCount : visits;
            
            if (visitsForFiltering >= minVisits) {
                const [currentStep, nextStep] = edgeKey.split('->');
                if (currentStep && nextStep) {
                    allNodesInEdges.add(currentStep);
                    allNodesInEdges.add(nextStep);
                }
            }
        }
    }

    // Generate all nodes that will appear, with coloring based on selected sequence
    for (const nodeName of allNodesInEdges) {
        const sequenceRank = selectedSequence.indexOf(nodeName);
        const color = sequenceRank >= 0 ? calculateColor(sequenceRank, totalSteps) : '#ffffff'; // White for nodes not in sequence
        const rank = sequenceRank >= 0 ? sequenceRank + 1 : 0;
        const studentCount = totalNodeEdges[nodeName] || 0;
        const nodeTooltip = createNodeTooltip(sequenceRank, color, studentCount);

        dotContent += `    "${nodeName}" [rank=${rank}, style=filled, fillcolor="${color}", tooltip="${nodeTooltip}"];\n`;
    }

    // Then, generate all qualifying edges
    for (const edgeKey of Object.keys(normalizedThicknesses)) {
        const thickness = normalizedThicknesses[edgeKey];
        
        // Only show edges that meet both thickness and visit thresholds
        if (thickness >= threshold) {
            const [currentStep, nextStep] = edgeKey.split('->');
            const outcomes = edgeOutcomeCounts[edgeKey] || {};
            const firstAttempts = firstAttemptOutcomes[edgeKey] || {};
            const edgeCount = edgeCounts[edgeKey] || 0;
            const visits = totalVisits[edgeKey] || 0;
            const visitsForFiltering = uniqueStudentMode ? edgeCount : visits;
            const totalCount = totalNodeEdges[currentStep] || 0;
            const edgeColor = calculateEdgeColors(outcomes, errorMode);

            // Apply minimum visits filter (using mode-appropriate count)
            if (visitsForFiltering >= minVisits) {
                const tooltip = createEdgeTooltip(
                    currentStep, nextStep, edgeKey, edgeCount, totalCount, visits,
                    ratioEdges, outcomes, firstAttempts, repeatVisits, edgeColor, uniqueStudentMode
                );

                dotContent += `    "${currentStep}" -> "${nextStep}" [penwidth=${thickness}, color="${edgeColor}", tooltip="${tooltip}"];\n`;
            }
        }
    }

    return dotContent;
};

/**
 * Main function to generate a Graphviz DOT string for visualizing student learning path graphs.
 * Creates interactive visualizations with detailed tooltips, color coding, and filtering options.
 *
 * The function supports two visualization modes:
 * 1. justTopSequence: Shows only the selected sequence as a linear path
 * 2. Full graph: Shows all qualifying edges and nodes in a network layout
 *
 * Visual features:
 * - Node colors: Gradient from white (start) to light blue (end) based on sequence position
 * - Edge colors: Weighted blend of outcome colors (red=error, green=success, blue=hints, yellow=interventions)
 * - Edge thickness: Proportional to number of students following that path
 * - Interactive tooltips: Detailed statistics on hover
 *
 * @param normalizedThicknesses - Edge thickness values normalized for visualization (0-max thickness)
 * @param ratioEdges - Percentage of students at source node who follow each edge
 * @param edgeOutcomeCounts - Count of all outcomes for each edge (includes repeat attempts)
 * @param edgeCounts - Number of unique students who traversed each edge
 * @param totalNodeEdges - Number of unique students who visited each node
 * @param threshold - Minimum thickness required to show an edge in full graph mode
 * @param minVisits - Minimum number of student visits required to show an edge
 * @param selectedSequence - Sequence of steps used for node coloring and top sequence mode
 * @param justTopSequence - If true, show only the selected sequence; if false, show full graph
 * @param totalVisits - Total number of visits for each edge (includes repeat attempts)
 * @param repeatVisits - Per-student visit counts for each edge (for repeat visit analysis)
 * @param errorMode - If true, use error-focused coloring (excludes OK outcomes from edge colors)
 * @param firstAttemptOutcomes - Count of outcomes only from first attempts (excludes repeats)
 * @returns Complete Graphviz DOT string ready for rendering
 */
export function generateDotString(
    normalizedThicknesses: { [key: string]: number },
    ratioEdges: { [key: string]: number },
    edgeOutcomeCounts: EdgeCounts['edgeOutcomeCounts'],
    edgeCounts: EdgeCounts['edgeCounts'],
    totalNodeEdges: EdgeCounts['totalNodeEdges'],
    threshold: number,
    minVisits: number,
    selectedSequence: SequenceCount["sequence"],
    justTopSequence: boolean,
    totalVisits: { [key: string]: number },
    repeatVisits: { [key: string]: { [studentId: string]: number } },
    errorMode: boolean,
    firstAttemptOutcomes: { [key: string]: { [outcome: string]: number } },
    uniqueStudentMode: boolean = false
): string {
    // Validate input - return error graph if no valid sequence provided
    if (!selectedSequence || selectedSequence.length === 0) {
        return 'digraph G {\n"Error" [label="No valid sequences found to display."];\n}';
    }

    // Determine which counts to use based on mode
    const visitsToUse = uniqueStudentMode ? edgeCounts : totalVisits;
    const outcomesToUse = uniqueStudentMode ? firstAttemptOutcomes : edgeOutcomeCounts;
    
    console.log("generateDotString: Using unique student mode:", uniqueStudentMode);
    console.log("generateDotString: Min visits threshold:", minVisits);
    console.log("generateDotString: Thickness threshold:", threshold);

    // Initialize DOT string with Graphviz header and configuration
    let dotString = 'digraph G {\ngraph [size="8,6!", dpi=150];\n';

    // Use appropriate edge counts for tooltips and statistics based on mode
    const edgeCountsToUse = uniqueStudentMode ? edgeCounts : totalVisits;
    
    // Generate visualization content based on mode
    if (justTopSequence) {
        // Top sequence mode: show only the selected sequence as a linear path
        dotString += generateTopSequenceVisualization(
            selectedSequence,
            normalizedThicknesses,
            outcomesToUse,
            firstAttemptOutcomes,
            edgeCountsToUse,
            visitsToUse,
            totalNodeEdges,
            ratioEdges,
            repeatVisits,
            minVisits,
            errorMode,
            uniqueStudentMode
        );
    } else {
        // Full graph mode: show all qualifying edges and nodes
        dotString += generateFullGraphVisualization(
            selectedSequence,
            normalizedThicknesses,
            outcomesToUse,
            firstAttemptOutcomes,
            edgeCountsToUse,
            visitsToUse,
            totalNodeEdges,
            ratioEdges,
            repeatVisits,
            threshold,
            minVisits,
            errorMode,
            uniqueStudentMode
        );
    }

    // Close DOT string and return complete graph definition
    dotString += '}';
    return dotString;
}

/**
 * Calculates the maximum minimum threshold that keeps all nodes connected in the graph.
 * This finds the highest threshold where:
 * 1. No nodes in the entire graph become disconnected (isolated)
 * 2. The selected sequence remains fully connected
 * 3. All paths remain viable
 * 
 * @param countsToUse - Dictionary mapping edge keys to the counts to use for analysis
 * @param selectedSequence - The selected sequence of steps to prioritize in analysis
 * @returns The maximum minimum threshold that keeps all nodes connected
 */
export function calculateMaxMinEdgeCount(
    countsToUse: { [key: string]: number },
    selectedSequence: string[]
): number {
    
    console.log("=== calculateMaxMinEdgeCount Debug ===");
    console.log("Selected sequence:", selectedSequence);
    console.log("Counts data type:", Object.keys(countsToUse).length > 0 ? 'valid' : 'empty');
    console.log("Total edge counts available:", Object.keys(countsToUse).length);
    console.log("Sample counts:", Object.entries(countsToUse).slice(0, 3));

    // Get all unique nodes from the graph
    const allNodes = new Set<string>();
    Object.keys(countsToUse).forEach(edgeKey => {
        const [fromNode, toNode] = edgeKey.split('->');
        if (fromNode && toNode) {
            allNodes.add(fromNode);
            allNodes.add(toNode);
        }
    });

    // Also ensure all nodes from selected sequence are included
    selectedSequence.forEach(node => allNodes.add(node));

    console.log("All nodes in graph:", Array.from(allNodes));
    console.log("Total nodes:", allNodes.size);
    console.log("Selected sequence nodes:", selectedSequence);

    if (allNodes.size === 0) {
        console.log("No nodes found in graph, returning 0");
        return 0;
    }

    // Get all unique edge counts and sort them in descending order
    const edgeCounts_values = Object.values(countsToUse).filter(count => count > 0);
    const uniqueCounts = [...new Set(edgeCounts_values)].sort((a, b) => b - a);
    
    console.log("Unique edge counts (descending):", uniqueCounts);

    // Find the highest threshold that keeps all nodes connected
    let maxValidThreshold = 0;

    for (const threshold of uniqueCounts) {
        // Create a graph with only edges that meet this threshold
        const validEdges = Object.entries(countsToUse)
            .filter(([_, count]) => count >= threshold)
            .map(([edge, count]) => ({ edge, count }));

        console.log(`Testing threshold ${threshold}: ${validEdges.length} edges qualify`);

        // Check if all nodes remain connected with this threshold
        const isGraphConnected = checkGraphConnectivity(validEdges, allNodes);
        
        // Additional check: ensure selected sequence remains connected
        const isSequenceConnected = checkSequenceConnectivity(validEdges, selectedSequence);
        
        // Additional check: ensure non-first nodes have preceding nodes
        const hasValidPredecessors = checkNodePredecessors(validEdges, allNodes, selectedSequence);
        
        if (isGraphConnected && isSequenceConnected && hasValidPredecessors) {
            maxValidThreshold = threshold;
            console.log(`✓ Threshold ${threshold} keeps all nodes and sequence connected`);
            break; // Since we're going in descending order, this is the maximum valid threshold
        } else {
            console.log(`✗ Threshold ${threshold} disconnects nodes (graph: ${isGraphConnected}, sequence: ${isSequenceConnected}, predecessors: ${hasValidPredecessors})`);
        }
    }

    console.log("Final maxMinEdgeCount:", maxValidThreshold);
    console.log("=== End calculateMaxMinEdgeCount Debug ===");
    
    return maxValidThreshold;
}

/**
 * Checks if the selected sequence remains connected with the given edges.
 * Validates that each consecutive pair of nodes in the sequence has a valid path.
 * 
 * @param edges - Available edges with their counts
 * @param selectedSequence - The sequence to validate connectivity for
 * @returns True if the sequence remains fully connected
 */
function checkSequenceConnectivity(
    edges: Array<{edge: string, count: number}>, 
    selectedSequence: string[]
): boolean {
    if (selectedSequence.length <= 1) return true;
    
    // Build adjacency list from available edges
    const adjacencyList = new Map<string, Set<string>>();
    
    edges.forEach(({ edge }) => {
        const [fromNode, toNode] = edge.split('->');
        if (fromNode && toNode) {
            if (!adjacencyList.has(fromNode)) {
                adjacencyList.set(fromNode, new Set());
            }
            adjacencyList.get(fromNode)!.add(toNode);
        }
    });
    
    // Check each consecutive pair in the sequence
    for (let i = 0; i < selectedSequence.length - 1; i++) {
        const currentNode = selectedSequence[i];
        const nextNode = selectedSequence[i + 1];
        
        // Check if there's a direct edge from current to next
        const hasDirectPath = adjacencyList.get(currentNode)?.has(nextNode);
        
        if (!hasDirectPath) {
            console.log(`Sequence break: no path from ${currentNode} to ${nextNode}`);
            return false;
        }
    }
    
    console.log("Selected sequence remains fully connected");
    return true;
}

/**
 * Ensures that nodes which aren't first nodes in any path still have at least one preceding node.
 * This prevents orphaning of intermediate nodes when applying threshold filters.
 * 
 * @param edges - Available edges with their counts
 * @param allNodes - All nodes in the graph
 * @param selectedSequence - The selected sequence (first node is considered a valid starting point)
 * @returns True if all non-first nodes have at least one incoming edge
 */
function checkNodePredecessors(
    edges: Array<{edge: string, count: number}>, 
    allNodes: Set<string>,
    _selectedSequence: string[]
): boolean {
    // Build incoming edge map
    const incomingEdges = new Map<string, Set<string>>();
    
    // Initialize all nodes with empty sets
    allNodes.forEach(node => {
        incomingEdges.set(node, new Set());
    });
    
    // Track incoming edges for each node (excluding self-loops)
    edges.forEach(({ edge }) => {
        const [fromNode, toNode] = edge.split('->');
        if (fromNode && toNode && fromNode !== toNode) { // Skip self-loops
            incomingEdges.get(toNode)?.add(fromNode);
        }
    });
    
    // Find all nodes that could be legitimate starting points
    const nodesWithoutPredecessors = new Set<string>();
    const nodesWithPredecessors = new Set<string>();
    
    for (const node of allNodes) {
        const hasIncomingEdges = (incomingEdges.get(node)?.size ?? 0) > 0;
        if (hasIncomingEdges) {
            nodesWithPredecessors.add(node);
        } else {
            nodesWithoutPredecessors.add(node);
        }
    }
    
    // If we have some nodes with predecessors and some without, that's fine
    // This allows for multiple entry points in the graph
    // Only fail if ALL nodes lack predecessors (which would be unusual) or if we have
    // too many isolated nodes (more than half the graph)
    const totalNodes = allNodes.size;
    const isolatedNodes = nodesWithoutPredecessors.size;
    
    if (totalNodes > 1 && isolatedNodes === totalNodes) {
        // All nodes are isolated - this suggests a problem with the threshold
        console.log("All nodes have no predecessors - threshold may be too high");
        return false;
    }
    
    if (totalNodes > 2 && isolatedNodes > totalNodes / 2) {
        // More than half the nodes are isolated - likely too restrictive
        console.log(`Too many isolated nodes: ${isolatedNodes}/${totalNodes}`);
        return false;
    }
    
    // Log the nodes without predecessors for debugging
    if (nodesWithoutPredecessors.size > 0) {
        console.log(`Nodes without predecessors (acceptable starting points): ${Array.from(nodesWithoutPredecessors).join(', ')}`);
    }
    
    console.log("All nodes have valid predecessors or are legitimate starting points");
    return true;
}

/**
 * Checks if a graph is connected (all nodes can reach each other) given a set of edges.
 * Uses depth-first search to verify connectivity.
 */
function checkGraphConnectivity(
    edges: Array<{edge: string, count: number}>, 
    allNodes: Set<string>
): boolean {
    if (allNodes.size === 0) return true;
    if (edges.length === 0 && allNodes.size > 1) return false;

    // Build adjacency list
    const adjacencyList = new Map<string, Set<string>>();
    
    // Initialize all nodes
    allNodes.forEach(node => {
        adjacencyList.set(node, new Set());
    });

    // Add edges (bidirectional for connectivity check)
    // Skip self-loops as they don't contribute to graph connectivity
    edges.forEach(({ edge }) => {
        const [fromNode, toNode] = edge.split('->');
        if (fromNode && toNode && fromNode !== toNode) { // Skip self-loops
            adjacencyList.get(fromNode)?.add(toNode);
            adjacencyList.get(toNode)?.add(fromNode); // Make it bidirectional for connectivity
        }
    });

    // Check if all nodes are reachable from any starting node using DFS
    const startNode = Array.from(allNodes)[0];
    const visited = new Set<string>();
    const stack = [startNode];

    while (stack.length > 0) {
        const currentNode = stack.pop()!;
        if (visited.has(currentNode)) continue;
        
        visited.add(currentNode);
        const neighbors = adjacencyList.get(currentNode) || new Set();
        
        neighbors.forEach(neighbor => {
            if (!visited.has(neighbor)) {
                stack.push(neighbor);
            }
        });
    }

    // Graph is connected if we visited all nodes
    const isConnected = visited.size === allNodes.size;
    
    if (!isConnected) {
        const disconnectedNodes = Array.from(allNodes).filter(node => !visited.has(node));
        console.log("Disconnected nodes:", disconnectedNodes);
    } else {
        console.log("All graph nodes remain connected");
    }
    
    return isConnected;
}

/**
 * Analyzes transitions from Equation Answer to Final Answer based on Equation Answer outcomes.
 * @param stepSequences - The step sequences.
 * @param outcomeSequences - The outcome sequences.
 * @returns Analysis of transitions and outcomes.
 */
export function analyzeEquationAnswerTransitions(
    stepSequences: { [key: string]: { [key: string]: string[] } },
    outcomeSequences: { [key: string]: { [key: string]: string[] } }
): {
    equationAnswerOutcomes: { [outcome: string]: number };
    equationToFinalTransitions: { [outcome: string]: { [finalOutcome: string]: number } };
} {
    const equationAnswerOutcomes: { [outcome: string]: number } = {};
    const equationToFinalTransitions: { [outcome: string]: { [finalOutcome: string]: number } } = {};

    Object.keys(stepSequences).forEach((studentId) => {
        const innerStepSequences = stepSequences[studentId];
        const innerOutcomeSequences = outcomeSequences[studentId] || {};

        Object.keys(innerStepSequences).forEach((problemName) => {
            const steps = innerStepSequences[problemName];
            const outcomes = innerOutcomeSequences[problemName] || [];

            // Find Equation Answer and its outcome
            for (let i = 0; i < steps.length; i++) {
                if (steps[i].toLowerCase().includes('equationanswer')) {
                    const equationOutcome = outcomes[i];
                    equationAnswerOutcomes[equationOutcome] = (equationAnswerOutcomes[equationOutcome] || 0) + 1;

                    // Look for next Final Answer
                    for (let j = i + 1; j < steps.length; j++) {
                        if (steps[j].toLowerCase().includes('finalanswer')) {
                            const finalOutcome = outcomes[j];
                            if (!equationToFinalTransitions[equationOutcome]) {
                                equationToFinalTransitions[equationOutcome] = {};
                            }
                            equationToFinalTransitions[equationOutcome][finalOutcome] = 
                                (equationToFinalTransitions[equationOutcome][finalOutcome] || 0) + 1;
                            break;
                        }
                    }
                }
            }
        });
    });

    return {
        equationAnswerOutcomes,
        equationToFinalTransitions
    };
}

/**
 * Formats the equation answer transition analysis into a readable string.
 * @param stats - The analysis results from analyzeEquationAnswerTransitions.
 * @returns A formatted string showing the analysis results.
 */
export function formatEquationAnswerStats(stats: {
    equationAnswerOutcomes: { [outcome: string]: number };
    equationToFinalTransitions: { [outcome: string]: { [finalOutcome: string]: number } };
}): string {
    let output = "Final Answer Outcome Analysis Based on Equation Answer Outcomes:\n\n";

    // Final Answer outcomes first
    output += "Final Answer Outcomes:\n";
    const finalAnswerOutcomes: { [outcome: string]: number } = {};
    Object.values(stats.equationToFinalTransitions).forEach(transitions => {
        Object.entries(transitions).forEach(([outcome, count]) => {
            finalAnswerOutcomes[outcome] = (finalAnswerOutcomes[outcome] || 0) + count;
        });
    });
    const totalFinalAnswers = Object.values(finalAnswerOutcomes).reduce((sum, count) => sum + count, 0);
    Object.entries(finalAnswerOutcomes).forEach(([outcome, count]) => {
        const percentage = ((count / totalFinalAnswers) * 100).toFixed(1);
        output += `${outcome}: ${count} (${percentage}%)\n`;
    });

    // Equation Answer outcomes
    // output += "\nEquation Answer First Attempt Outcomes:\n";
    // const totalFirstAttempts = Object.values(stats.equationAnswerOutcomes).reduce((sum, count) => sum + count, 0);
    // Object.entries(stats.equationAnswerOutcomes).forEach(([outcome, count]) => {
    //     const percentage = ((count / totalFirstAttempts) * 100).toFixed(1);
    //     output += `${outcome}: ${count} (${percentage}%)\n`;
    // });

    // Transitions based on Equation Answer outcome
    output += "\Final Answer Outcomes based on Equation Answer outcome:\n";
    Object.entries(stats.equationToFinalTransitions).forEach(([equationOutcome, finalOutcomes]) => {
        output += `\nWhen Equation Answer was ${equationOutcome}:\n`;
        const totalTransitions = Object.values(finalOutcomes).reduce((sum, count) => sum + count, 0);
        Object.entries(finalOutcomes).forEach(([finalOutcome, count]) => {
            const percentage = ((count / totalTransitions) * 100).toFixed(1);
            output += `  → ${finalOutcome}: ${count} (${percentage}%)\n`;
        });
    });

    return output;
}