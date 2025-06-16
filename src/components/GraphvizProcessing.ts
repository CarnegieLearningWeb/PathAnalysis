import Papa from 'papaparse';
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
 * Counts the edges between steps and outcomes in the step sequences.
 * @param stepSequences - The step sequences.
 * @param outcomeSequences - The outcome sequences.
 * @returns Various edge-related counts and statistics.
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
    // Use Maps for better performance with frequent operations
    const totalNodeEdges = new Map<string, Set<string>>();
    const edgeOutcomeCounts = new Map<string, Map<string, number>>();
    let maxEdgeCount = 0;
    const edgeCounts = new Map<string, number>();
    const totalVisits = new Map<string, number>();
    const studentEdgeCounts = new Map<string, Set<string>>();
    const repeatVisits = new Map<string, Map<string, number>>();
    const firstAttemptOutcomes = new Map<string, Map<string, number>>();
    const top5Sequences = getTopSequences(stepSequences, 5);

    // Pre-calculate all student-problem combinations to avoid repeated lookups
    const allCombinations: Array<{
        studentId: string;
        problemName: string;
        steps: string[];
        outcomes: string[];
    }> = [];

    for (const [studentId, innerStepSequences] of Object.entries(stepSequences)) {
        const innerOutcomeSequences = outcomeSequences[studentId] || {};
        
        for (const [problemName, steps] of Object.entries(innerStepSequences)) {
            if (steps.length >= 2) {
                allCombinations.push({
                    studentId,
                    problemName,
                    steps,
                    outcomes: innerOutcomeSequences[problemName] || []
                });
            }
        }
    }

    // Single pass through all combinations
    for (const { studentId, steps, outcomes } of allCombinations) {
        for (let i = 0; i < steps.length - 1; i++) {
            const currentStep = steps[i];
            const nextStep = steps[i + 1];
            const outcome = outcomes[i + 1];
            const edgeKey = `${currentStep}->${nextStep}`;

            // Initialize collections if needed
            if (!studentEdgeCounts.has(edgeKey)) {
                studentEdgeCounts.set(edgeKey, new Set());
                totalVisits.set(edgeKey, 0);
                repeatVisits.set(edgeKey, new Map());
                edgeOutcomeCounts.set(edgeKey, new Map());
            }
            if (!totalNodeEdges.has(currentStep)) {
                totalNodeEdges.set(currentStep, new Set());
            }

            // Add student to edge and node tracking
            studentEdgeCounts.get(edgeKey)!.add(studentId);
            totalNodeEdges.get(currentStep)!.add(studentId);
            
            // Increment counters
            totalVisits.set(edgeKey, totalVisits.get(edgeKey)! + 1);
            
            // Track repeat visits
            const edgeRepeatVisits = repeatVisits.get(edgeKey)!;
            const currentRepeatCount = (edgeRepeatVisits.get(studentId) || 0) + 1;
            edgeRepeatVisits.set(studentId, currentRepeatCount);

            // Track first attempt outcomes
            if (currentRepeatCount === 1) {
                if (!firstAttemptOutcomes.has(edgeKey)) {
                    firstAttemptOutcomes.set(edgeKey, new Map());
                }
                const firstAttemptMap = firstAttemptOutcomes.get(edgeKey)!;
                firstAttemptMap.set(outcome, (firstAttemptMap.get(outcome) || 0) + 1);
            }

            // Update edge count and max
            const currentEdgeCount = studentEdgeCounts.get(edgeKey)!.size;
            edgeCounts.set(edgeKey, currentEdgeCount);
            maxEdgeCount = Math.max(maxEdgeCount, currentEdgeCount);

            // Track outcomes
            const outcomeMap = edgeOutcomeCounts.get(edgeKey)!;
            outcomeMap.set(outcome, (outcomeMap.get(outcome) || 0) + 1);
        }
    }

    // Convert Maps back to objects for compatibility
    const totalNodeEdgesCounts: { [key: string]: number } = {};
    totalNodeEdges.forEach((students, node) => {
        totalNodeEdgesCounts[node] = students.size;
    });

    const edgeCountsObj: { [key: string]: number } = {};
    const ratioEdgesObj: { [key: string]: number } = {};
    edgeCounts.forEach((count, edge) => {
        edgeCountsObj[edge] = count;
        const [start] = edge.split('->');
        ratioEdgesObj[edge] = count / (totalNodeEdgesCounts[start] || 1);
    });

    const totalVisitsObj: { [key: string]: number } = {};
    totalVisits.forEach((count, edge) => {
        totalVisitsObj[edge] = count;
    });

    const repeatVisitsObj: { [key: string]: { [studentId: string]: number } } = {};
    repeatVisits.forEach((studentMap, edge) => {
        repeatVisitsObj[edge] = {};
        studentMap.forEach((count, studentId) => {
            repeatVisitsObj[edge][studentId] = count;
        });
    });

    const edgeOutcomeCountsObj: { [key: string]: { [outcome: string]: number } } = {};
    edgeOutcomeCounts.forEach((outcomeMap, edge) => {
        edgeOutcomeCountsObj[edge] = {};
        outcomeMap.forEach((count, outcome) => {
            edgeOutcomeCountsObj[edge][outcome] = count;
        });
    });

    const firstAttemptOutcomesObj: { [key: string]: { [outcome: string]: number } } = {};
    firstAttemptOutcomes.forEach((outcomeMap, edge) => {
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
        topSequences: top5Sequences,
        firstAttemptOutcomes: firstAttemptOutcomesObj
    };
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
 * Normalizes edge thicknesses based on edge counts.
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

    Object.keys(edgeCounts).forEach((edge) => {
        const count = edgeCounts[edge];
        normalized[edge] = (count / maxEdgeCount) * maxThickness;
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
 * Function to generate a Graphviz DOT string for visualizing a sequence graph.
 *
 * @param normalizedThicknesses - A dictionary mapping edges to their normalized thickness values.
 * @param ratioEdges - A dictionary of edge ratios (i.e., percentage of students traversing from one step to another).
 * @param edgeOutcomeCounts - A dictionary that tracks the count of outcomes for each edge.
 * @param edgeCounts - A dictionary tracking the total number of transitions between steps (edges).
 * @param totalNodeEdges - A dictionary of total transitions starting from a specific node.
 * @param threshold - Minimum thickness value to include an edge in the visualization.
 * @param minVisits - Minimum number of visits an edge must have to be included in the graph.
 * @param selectedSequence - The selected sequence of steps used to color the nodes.
 *
 * @param justTopSequence
 * @param totalVisits
 * @param repeatVisits
 * @param errorMode
 * @param firstAttemptOutcomes
 * @returns A string in Graphviz DOT format that represents the graph.
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
    firstAttemptOutcomes: { [key: string]: { [outcome: string]: number } }
): string {
    if (!selectedSequence || selectedSequence.length === 0) {
        return 'digraph G {\n"Error" [label="No valid sequences found to display."];\n}';
    }

    let dotString = 'digraph G {\ngraph [size="8,6!", dpi=150];\n';
    let totalSteps = selectedSequence.length;
    let steps = selectedSequence;

    if (justTopSequence) {
        for (let rank = 0; rank < totalSteps; rank++) {
            const currentStep = steps[rank];
            const nextStep = steps[rank + 1];
            const edgeKey = `${currentStep}->${nextStep}`;
            const thickness = normalizedThicknesses[edgeKey] || 1;
            const outcomes = edgeOutcomeCounts[edgeKey] || {};
            const firstAttempts = firstAttemptOutcomes[edgeKey] || {};
            const edgeCount = edgeCounts[edgeKey] || 0;
            const visits = totalVisits[edgeKey] || 0;
            const totalCount = totalNodeEdges[currentStep] || 0;
            const color = calculateColor(rank, totalSteps);
            const edgeColor = calculateEdgeColors(outcomes, errorMode);
            
            let nodeTooltip = `Rank:\n\t\t${rank + 1}\nColor:\n\t\t${color}\nTotal Students:\n\t\t${totalNodeEdges[currentStep] || 0}`;

            dotString += `    "${currentStep}" [rank=${rank + 1}, style=filled, fillcolor="${color}", tooltip="${nodeTooltip}"];\n`;

            if (edgeCount > minVisits) {
                let tooltip = `${currentStep} to ${nextStep}\n\n`
                    + `Student Statistics:\n`
                    + `- Total Students at ${currentStep}: \n\t\t${totalCount}\n`
                    + `- Unique Students on this path: \n\t\t${edgeCount}\n`
                    + `- Total Edge Visits: \n\t\t${visits}\n`;

                // Add repeat visit information for all edges
                if (repeatVisits[edgeKey]) {
                    const repeatCounts = Object.values(repeatVisits[edgeKey]);
                    const studentsWithRepeats = repeatCounts.filter(count => count > 1).length;
                    const maxRepeats = Math.max(...repeatCounts);
                    tooltip += `- Students who repeated this path: \n\t\t${studentsWithRepeats}\n`
                        + `- Maximum visits by a student: \n\t\t${maxRepeats}\n`;
                }

                tooltip += `\nPath Statistics:\n`
                    + `- Ratio: \n\t\t${((ratioEdges[edgeKey] || 0) * 100).toFixed(2)}% of students at ${currentStep} go to ${nextStep}\n`
                    + `- All Outcomes: \n\t\t${Object.entries(outcomes).map(([outcome, count]) => `${outcome}: ${count}`).join('\n\t\t')}\n`
                    + `- First Attempt Outcomes: \n\t\t${Object.entries(firstAttempts).map(([outcome, count]) => `${outcome}: ${count}`).join('\n\t\t')}\n`
                    + `\nVisual Properties:\n`
                    + `- Edge Color: \n\t\tHex: ${edgeColor}\n`;

                dotString += `    "${currentStep}" -> "${nextStep}" [penwidth=${thickness}, color="${edgeColor}", tooltip="${tooltip}"];\n`;
            }
        }
    } else {
        for (let rank = 0; rank < totalSteps; rank++) {
            const currentStep = steps[rank];
            const color = calculateColor(rank, totalSteps);
            let nodeTooltip = `Rank:\n\t\t${rank + 1}\nColor:\n\t\t${color}\nTotal Students:\n\t\t${totalNodeEdges[currentStep] || 0}`;

            dotString += `    "${currentStep}" [rank=${rank + 1}, style=filled, fillcolor="${color}", tooltip="${nodeTooltip}"];\n`;
        }

        for (const edgeKey of Object.keys(normalizedThicknesses)) {
            if (normalizedThicknesses[edgeKey] >= threshold) {
                const [currentStep, nextStep] = edgeKey.split('->');
                const thickness = normalizedThicknesses[edgeKey];
                const outcomes = edgeOutcomeCounts[edgeKey] || {};
                const firstAttempts = firstAttemptOutcomes[edgeKey] || {};
                const edgeCount = edgeCounts[edgeKey] || 0;
                const visits = totalVisits[edgeKey] || 0;
                const totalCount = totalNodeEdges[currentStep] || 0;
                const edgeColor = calculateEdgeColors(outcomes, errorMode);
                const outcomesStr = Object.entries(outcomes)
                    .map(([outcome, count]) => `${outcome}: ${count}`)
                    .join('\n\t\t');
                const firstAttemptsStr = Object.entries(firstAttempts)
                    .map(([outcome, count]) => `${outcome}: ${count}`)
                    .join('\n\t\t');

                if (edgeCount > minVisits) {
                    let tooltip = `${currentStep} to ${nextStep}\n\n`
                        + `Student Statistics:\n`
                        + `- Total Students at ${currentStep}: \n\t\t${totalCount || 0}\n`
                        + `- Unique Students on this path: \n\t\t${edgeCount}\n`
                        + `- Total Edge Visits: \n\t\t${visits}\n`;

                    // Add repeat visit information for all edges
                    if (repeatVisits[edgeKey]) {
                        const repeatCounts = Object.values(repeatVisits[edgeKey]);
                        const studentsWithRepeats = repeatCounts.filter(count => count > 1).length;
                        const maxRepeats = Math.max(...repeatCounts);
                        tooltip += `- Students who repeated this path: \n\t\t${studentsWithRepeats}\n`
                            + `- Maximum visits by a student: \n\t\t${maxRepeats}\n`;
                    }

                    tooltip += `\nPath Statistics:\n`
                        + `- Ratio: \n\t\t${((ratioEdges[edgeKey] || 0) * 100).toFixed(2)}% of students at ${currentStep} go to ${nextStep}\n`
                        + `- All Outcomes: \n\t\t${outcomesStr}\n`
                        + `- First Attempt Outcomes: \n\t\t${firstAttemptsStr}\n`
                        + `\nVisual Properties:\n`
                        + `- Edge Color: \n\t\tHex: ${edgeColor}\n`
                        + `\t\tRGB: ${[parseInt(edgeColor.substring(1, 3), 16), parseInt(edgeColor.substring(3, 5), 16), parseInt(edgeColor.substring(5, 7), 16)]}`;

                    dotString += `    "${currentStep}" -> "${nextStep}" [penwidth=${thickness}, color="${edgeColor}", tooltip="${tooltip}"];\n`;
                }
            }
        }
    }

    dotString += '}';
    return dotString;
}

/**
 * Calculates the minimum number of students on any edge in the selected sequence.
 * This is the smallest number of unique students that traverse any edge in the sequence.
 * @param edgeCounts - Dictionary mapping edge keys to the number of unique students
 * @param selectedSequence - The selected sequence of steps
 * @returns The minimum number of students on any edge in the sequence
 */
export function calculateMaxMinEdgeCount(
    edgeCounts: { [key: string]: number },
    selectedSequence: string[],
    filteredEdgeCounts?: { [key: string]: number }
): number {
    if (!selectedSequence || selectedSequence.length < 2) {
        console.log("No valid sequence provided");
        return 0;
    }

    let minStudentCount = Infinity;
    console.log("Edge counts:", edgeCounts);
    console.log("Filtered edge counts:", filteredEdgeCounts);
    console.log("Selected sequence:", selectedSequence);

    // Check each edge in the sequence
    for (let i = 0; i < selectedSequence.length - 1; i++) {
        const currentStep = selectedSequence[i];
        const nextStep = selectedSequence[i + 1];
        const edgeKey = `${currentStep}->${nextStep}`;
        
        // Use filtered counts if available, otherwise fall back to main counts
        const studentCount = filteredEdgeCounts ? 
            (filteredEdgeCounts[edgeKey] || 0) : 
            (edgeCounts[edgeKey] || 0);
            
        minStudentCount = Math.min(minStudentCount, studentCount);
    }

    return minStudentCount;
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