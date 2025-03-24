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
    console.log(transformedData)
    return transformedData.sort((a, b) => {
    if (a['Anon Student Id'] === b['Anon Student Id']) {
        if (a['Problem Name'] === b['Problem Name']) {
            return new Date(a['Time']).getTime() - new Date(b['Time']).getTime();
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
// export const createStepSequences = (sortedData: CSVRow[], selfLoops: boolean): { [key: string]: string[] } => {
//     return sortedData.reduce((acc, row) => {
//         const sessionId = row['Session Id'];
//         if (!acc[sessionId]) acc[sessionId] = [];
//         // console.log(acc['stepName'], sessionId)
//         const stepName = row['Step Name'];
//         if (selfLoops || acc[sessionId].length === 0 || acc[sessionId][acc[sessionId].length - 1] !== stepName) {
//             acc[sessionId].push(stepName);
//         }
//
//         return acc;
//     }, {} as { [key: string]: string[] });
// };
export const createStepSequences = (sortedData: CSVRow[], selfLoops: boolean): { [key: string]: { [key: string]: string[] }}  => {
    return sortedData.reduce((acc, row) => {
        const studentId:string = row['Anon Student Id'];
        const problemName:string = row['Problem Name'];

        if (!acc[studentId]) acc[studentId] = {}; // Initialize student entry if not present
        if (!acc[studentId][problemName]) acc[studentId][problemName] = []; // Initialize problem entry if not present

        // console.log(acc['stepName'], sessionId)
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
// export const createOutcomeSequences = (sortedData: CSVRow[]): { [key: string]: string[] } => {
//     return sortedData.reduce((acc, row) => {
//         const sessionId = row['Session Id'];
//
//         if (!acc[sessionId]) acc[sessionId] = [];
//         acc[sessionId].push(row['Outcome']);
//         return acc;
//     }, {} as { [key: string]: string[] });
// };
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
} => {
    const totalNodeEdges: { [key: string]: Set<string> } = {};
    const edgeOutcomeCounts: { [key: string]: { [outcome: string]: number } } = {};
    let maxEdgeCount = 0;
    const ratioEdges: { [key: string]: number } = {};
    const edgeCounts: { [key: string]: number } = {};
    const totalVisits: { [key: string]: number } = {};
    const studentEdgeCounts: { [key: string]: Set<string> } = {};
    const repeatVisits: { [key: string]: { [studentId: string]: number } } = {};
    const top5Sequences = getTopSequences(stepSequences, 5);

    Object.keys(stepSequences).forEach((studentId) => {
        const innerStepSequences = stepSequences[studentId];
        const innerOutcomeSequences = outcomeSequences[studentId] || {};

        Object.keys(innerStepSequences).forEach((problemName) => {
            const steps = innerStepSequences[problemName];
            const outcomes = innerOutcomeSequences[problemName] || [];

            if (steps.length < 2) return;

            for (let i = 0; i < steps.length - 1; i++) {
                const currentStep = steps[i];
                const nextStep = steps[i + 1];
                const outcome = outcomes[i + 1];

                const edgeKey = `${currentStep}->${nextStep}`;
                
                if (!studentEdgeCounts[edgeKey]) {
                    studentEdgeCounts[edgeKey] = new Set();
                }
                if (!totalNodeEdges[currentStep]) {
                    totalNodeEdges[currentStep] = new Set();
                }
                if (!totalVisits[edgeKey]) {
                    totalVisits[edgeKey] = 0;
                }
                if (!repeatVisits[edgeKey]) {
                    repeatVisits[edgeKey] = {};
                }
                
                studentEdgeCounts[edgeKey].add(studentId);
                totalNodeEdges[currentStep].add(studentId);
                totalVisits[edgeKey]++;
                
                // Track repeat visits for all edges
                repeatVisits[edgeKey][studentId] = (repeatVisits[edgeKey][studentId] || 0) + 1;
                
                edgeCounts[edgeKey] = studentEdgeCounts[edgeKey].size;
                
                edgeOutcomeCounts[edgeKey] = edgeOutcomeCounts[edgeKey] || {};
                edgeOutcomeCounts[edgeKey][outcome] = (edgeOutcomeCounts[edgeKey][outcome] || 0) + 1;

                if (edgeCounts[edgeKey] > maxEdgeCount) {
                    maxEdgeCount = edgeCounts[edgeKey];
                }
            }
        });
    });

    const totalNodeEdgesCounts: { [key: string]: number } = {};
    Object.keys(totalNodeEdges).forEach(node => {
        totalNodeEdgesCounts[node] = totalNodeEdges[node].size;
    });

    Object.keys(edgeCounts).forEach((edge) => {
        const [start] = edge.split('->');
        ratioEdges[edge] = edgeCounts[edge] / (totalNodeEdgesCounts[start] || 1);
    });

    return {
        edgeCounts,
        totalNodeEdges: totalNodeEdgesCounts,
        ratioEdges,
        edgeOutcomeCounts,
        maxEdgeCount,
        totalVisits,
        repeatVisits,
        topSequences: top5Sequences
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
 * @returns A color representing the most frequent outcome.
 */
function calculateEdgeColors(outcomes: { [outcome: string]: number }): string {
    const colorMap: { [key: string]: string } = {
        'ERROR': '#ff0000',  // Red
        'OK': '#00ff00',     // Green
        'INITIAL_HINT': '#0000ff', // Blue
        'HINT_LEVEL_CHANGE': '#0000ff', // Blue
        'JIT': '#ffff00',    // Yellow
        'FREEBIE_JIT': '#ffff00' // Yellow
    };

    if (Object.keys(outcomes).length === 0) {
        return '#00000000'; // Transparent black
    }

    const totalCount = Object.values(outcomes).reduce((sum, count) => sum + count, 0);
    let weightedR = 0, weightedG = 0, weightedB = 0;

    Object.entries(outcomes).forEach(([outcome, count]) => {
        const color = colorMap[outcome] || '#000000'; // Default to black if outcome is not found
        const [r, g, b] = [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16)); // Extract RGB values
        const weight = count / totalCount;
        weightedR += r * weight;
        weightedG += g * weight;
        weightedB += b * weight;
    });

    // Convert RGB values to hex and add alpha transparency
    return `#${Math.round(weightedR).toString(16).padStart(2, '0')}${Math.round(weightedG).toString(16).padStart(2, '0')}${Math.round(weightedB).toString(16).padStart(2, '0')}90`;
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
 * @param min_visits - Minimum number of visits an edge must have to be included in the graph.
 * @param selectedSequence - The selected sequence of steps used to color the nodes.
 *
 * @param justTopSequence
 * @returns A string in Graphviz DOT format that represents the graph.
 */
export function generateDotString(
    normalizedThicknesses: { [key: string]: number },
    ratioEdges: { [key: string]: number },
    edgeOutcomeCounts: EdgeCounts['edgeOutcomeCounts'],
    edgeCounts: EdgeCounts['edgeCounts'],
    totalNodeEdges: EdgeCounts['totalNodeEdges'],
    threshold: number,
    min_visits: number,
    selectedSequence: SequenceCount["sequence"],
    justTopSequence: boolean,
    totalVisits: { [key: string]: number },
    repeatVisits: { [key: string]: { [studentId: string]: number } }
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
            const edgeCount = edgeCounts[edgeKey] || 0;
            const visits = totalVisits[edgeKey] || 0;
            const totalCount = totalNodeEdges[currentStep] || 0;
            const color = calculateColor(rank, totalSteps);
            const edgeColor = calculateEdgeColors(outcomes);
            const node_tooltip = `Rank:\n\t\t ${rank + 1}\nColor:\n\t\t ${color}`;

            dotString += `    "${currentStep}" [rank=${rank + 1}, style=filled, fillcolor="${color}", tooltip="${node_tooltip}"];\n`;

            if (edgeCount > min_visits) {
                let tooltip = `${currentStep} to ${nextStep}\n`
                    + `- Unique Students: \n\t\t ${edgeCount}\n`
                    + `- Total Edge Visits: \n\t\t ${visits}\n`
                    + `- Total Students at ${currentStep}: \n\t\t${totalNodeEdges[currentStep] || 0}\n`
                    + `- Ratio: \n\t\t${((ratioEdges[edgeKey] || 0) * 100).toFixed(2)}% of students at ${currentStep} go to ${nextStep}\n`
                    + `- Outcomes: \n\t\t ${Object.entries(outcomes).map(([outcome, count]) => `${outcome}: ${count}`).join('\n\t\t ')}\n`
                    + `- Color Codes: \n\t\t Hex: ${color}`;

                // Add repeat visit information for all edges
                if (repeatVisits[edgeKey]) {
                    const repeatCounts = Object.values(repeatVisits[edgeKey]);
                    const studentsWithRepeats = repeatCounts.filter(count => count > 1).length;
                    const maxRepeats = Math.max(...repeatCounts);
                    tooltip += `\n- Repeat Visits:\n\t\t ${studentsWithRepeats} students visited this edge multiple times\n\t\t Maximum visits by a student: ${maxRepeats}`;
                }

                dotString += `    "${currentStep}" -> "${nextStep}" [penwidth=${thickness}, color="${edgeColor}", tooltip="${tooltip}"];\n`;
            }
        }
    } else {
        for (let rank = 0; rank < totalSteps; rank++) {
            const step = steps[rank];
            const color = calculateColor(rank, totalSteps);
            const node_tooltip = `Rank:\n\t\t ${rank + 1}\nColor:\n\t\t ${color}`;

            dotString += `    "${step}" [rank=${rank + 1}, style=filled, fillcolor="${color}", tooltip="${node_tooltip}"];\n`;
        }
        
        for (const edge of Object.keys(normalizedThicknesses)) {
            if (normalizedThicknesses[edge] >= threshold) {
                const [currentStep, nextStep] = edge.split('->');
                const thickness = normalizedThicknesses[edge];
                const outcomes = edgeOutcomeCounts[edge] || {};
                const edgeCount = edgeCounts[edge] || 0;
                const visits = totalVisits[edge] || 0;
                const totalCount = totalNodeEdges[currentStep] || 0;
                const color = calculateEdgeColors(outcomes);
                const outcomesStr = Object.entries(outcomes)
                    .map(([outcome, count]) => `${outcome}: ${count}`)
                    .join('\n\t\t ');

                if (edgeCount > min_visits) {
                    let tooltip = `- Total Students at ${currentStep}: \n\t\t${totalNodeEdges[currentStep] || 0}\n\n`
                        + `${currentStep} to ${nextStep}\n`
                        + `- Unique Students on edge (each student only counted once): \n\t\t ${edgeCount}\n`
                        + `- Edge taken ${visits} times\n`
                        + `- Ratio: \n\t\t${((ratioEdges[edge] || 0) * 100).toFixed(2)}% of students at ${currentStep} go to ${nextStep}\n`
                        + `- Outcomes: \n\t\t ${outcomesStr}\n`
                        + `- Color Codes: \n\t\t Hex: ${color}\n\t\t RGB: ${[parseInt(color.substring(1, 3), 16), parseInt(color.substring(3, 5), 16), parseInt(color.substring(5, 7), 16)]}`;

                    // Add repeat visit information for all edges
                    if (repeatVisits[edge]) {
                        const repeatCounts = Object.values(repeatVisits[edge]);
                        const studentsWithRepeats = repeatCounts.filter(count => count > 1).length;
                        const maxRepeats = Math.max(...repeatCounts);
                        tooltip += `\n- Repeat Visits:\n\t\t ${studentsWithRepeats} students visited this edge multiple times\n\t\t Maximum visits by a student: ${maxRepeats}`;
                    }

                    dotString += `    "${currentStep}" -> "${nextStep}" [penwidth=${thickness}, color="${color}", tooltip="${tooltip}"];\n`;
                }
            }
        }
    }

    dotString += '}';
    return dotString;
}