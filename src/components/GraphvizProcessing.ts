import Papa from 'papaparse';
import {SequenceCount} from "@/Context";

interface CSVRow {
    'Session Id': string;
    'Time': string;
    'Step Name': string;
    'Outcome': string;
    'CF (Workspace Progress Status)': string;
    'Problem Name': string;
    'Anon Student Id': string;
}


// TODO: Add compare first 3 and last 3 problems by student
/**
 * Parses CSV data, replaces missing step names with 'DoneButton', and sorts by session ID and time.
 * @param csvData - The raw CSV data as a string.
 * @returns The transformed and sorted CSV rows.
 */
export const loadAndSortData = (csvData: string): CSVRow[] => {
    const parsedData = Papa.parse<CSVRow>(csvData, {
        header: true,
        skipEmptyLines: true
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

    return transformedData.sort((a, b) => {
        if (a['Session Id'] === b['Session Id']) {
            return new Date(a['Time']).getTime() - new Date(b['Time']).getTime();
        }
        return a['Session Id'].localeCompare(b['Session Id']);
    });
};


/**
 * Creates step sequences from sorted data, optionally allowing self-loops.
 * @param sortedData - The sorted CSV rows.
 * @param selfLoops - A boolean to include self-loops.
 * @returns A dictionary mapping session IDs to sequences of step names.
 */
export const createStepSequences = (sortedData: CSVRow[], selfLoops: boolean): { [key: string]: string[] } => {
    return sortedData.reduce((acc, row) => {
        const sessionId = row['Session Id'];
        if (!acc[sessionId]) acc[sessionId] = [];

        const stepName = row['Step Name'];

        if (selfLoops || acc[sessionId].length === 0 || acc[sessionId][acc[sessionId].length - 1] !== stepName) {
            acc[sessionId].push(stepName);
        }

        return acc;
    }, {} as { [key: string]: string[] });
};

/**
 * Creates outcome sequences from sorted data.
 * @param sortedData - The sorted CSV rows.
 * @returns A dictionary mapping session IDs to sequences of outcomes.
 */
export const createOutcomeSequences = (sortedData: CSVRow[]): { [key: string]: string[] } => {
    return sortedData.reduce((acc, row) => {
        const sessionId = row['Session Id'];
        if (!acc[sessionId]) acc[sessionId] = [];
        acc[sessionId].push(row['Outcome']);
        return acc;
    }, {} as { [key: string]: string[] });
};

/**
 * Finds the top N most frequent step sequences.
 * @param stepSequences - The step sequences for all sessions.
 * @param topN - The number of top sequences to return (default is 5).
 * @returns An array of the top sequences and their counts.
 */
export function getTopSequences(stepSequences: { [key: string]: string[] }, topN: number = 5) {
    // Create a frequency map to count how many times each unique sequence (list) occurs
    const sequenceCounts: { [sequence: string]: number } = {};

    // Iterate over the values (which are lists) of the stepSequences dictionary
    Object.values(stepSequences).forEach((sequence) => {
        const sequenceKey = JSON.stringify(sequence); // Convert the list to a string key

        // Count occurrences of each unique sequence
        if (sequenceCounts[sequenceKey]) {
            sequenceCounts[sequenceKey]++;
        } else {
            sequenceCounts[sequenceKey] = 1;
        }
    });

    // Filter sequences of length 5 or greater then sort the sequences based on their counts in descending order and take the top N
    const sortedSequences = Object.entries(sequenceCounts)
        .filter(([sequence]) => JSON.parse(sequence).length >= 5)
        .sort(([, countA], [, countB]) => countB - countA)
        .slice(0, topN);

    // Convert to the desired format: { sequence: [step1, step2, step3], count }
    const topSequences = sortedSequences.map(([sequenceKey, count]) => ({
        sequence: JSON.parse(sequenceKey), // Convert the string back to an array
        count,
    }));

    console.log("Processing topSequences: ", topSequences); // Log the top sequences for debugging
    return topSequences; // Return the array of top sequences
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
    stepSequences: { [key: string]: string[] },
    outcomeSequences: { [key: string]: string[] }
): {
    totalNodeEdges: { [p: string]: number };
    edgeOutcomeCounts: { [p: string]: { [p: string]: number } };
    maxEdgeCount: number;
    ratioEdges: { [p: string]: number };
    edgeCounts: { [p: string]: number };
    topSequences: SequenceCount[];
} => {
    const totalNodeEdges: { [key: string]: number } = {};
    const edgeOutcomeCounts: { [key: string]: { [outcome: string]: number } } = {};
    let maxEdgeCount = 0;
    const ratioEdges: { [key: string]: number } = {};
    const edgeCounts: { [key: string]: number } = {};
    const top5Sequences = getTopSequences(stepSequences, 5);

    Object.keys(stepSequences).forEach((sessionId) => {
        const steps = stepSequences[sessionId];
        const outcomes = outcomeSequences[sessionId];

        if (steps.length < 2) return;

        for (let i = 0; i < steps.length - 1; i++) {
            const currentStep = steps[i];
            const nextStep = steps[i + 1];
            const outcome = outcomes[i + 1];

            const edgeKey = `${currentStep}->${nextStep}`;
            edgeCounts[edgeKey] = (edgeCounts[edgeKey] || 0) + 1;
            edgeOutcomeCounts[edgeKey] = edgeOutcomeCounts[edgeKey] || {};
            edgeOutcomeCounts[edgeKey][outcome] = (edgeOutcomeCounts[edgeKey][outcome] || 0) + 1;
            totalNodeEdges[currentStep] = (totalNodeEdges[currentStep] || 0) + 1;

            if (edgeCounts[edgeKey] > maxEdgeCount) maxEdgeCount = edgeCounts[edgeKey];
        }
    });

    Object.keys(edgeCounts).forEach((edge) => {
        const [start] = edge.split('->');
        ratioEdges[edge] = edgeCounts[edge] / (totalNodeEdges[start] || 0);
    });

    return {edgeCounts, totalNodeEdges, ratioEdges, edgeOutcomeCounts, maxEdgeCount, topSequences: top5Sequences};
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
 * @returns A string in Graphviz DOT format that represents the graph.
 */export function generateDotString(
    normalizedThicknesses: { [key: string]: number },
    // mostCommonSequence: string[],
    ratioEdges: { [key: string]: number },
    edgeOutcomeCounts: EdgeCounts['edgeOutcomeCounts'],
    edgeCounts: EdgeCounts['edgeCounts'],
    totalNodeEdges: EdgeCounts['totalNodeEdges'],
    threshold: number,
    min_visits: number,
    selectedSequence: SequenceCount["sequence"],
    justTopSequence: boolean
): string {
    if (!selectedSequence || selectedSequence.length === 0) {
        return 'digraph G {\n"Error" [label="No valid sequences found to display."];\n}';
    }

    let dotString = 'digraph G {\ngraph [size="8,6!", dpi=72];\n';
    let totalSteps = selectedSequence.length//stepsInSelectedSequence.length;
    let steps = selectedSequence

    if (justTopSequence) {
        for (let rank = 0; rank < totalSteps; rank++) {
            const currentStep = steps[rank];
            const nextStep = steps[rank + 1];
            const edgeKey = `${currentStep}->${nextStep}`;
            const thickness = normalizedThicknesses[edgeKey] || 1; // Default thickness if not present
            const outcomes = edgeOutcomeCounts[edgeKey] || {};
            const edgeCount = edgeCounts[edgeKey] || 0;
            const totalCount = totalNodeEdges[currentStep] || 0;
            const color = calculateColor(rank, totalSteps)
            const edgeColor = calculateEdgeColors(outcomes);
            const node_tooltip = `Rank:\n\t\t ${rank + 1}\nColor:\n\t\t ${color}`;

            dotString += `    "${currentStep}" [rank=${rank + 1}, style=filled, fillcolor="${color}", tooltip="${node_tooltip}"];\n`;

            if (edgeCount > min_visits) {
                const tooltip = `${currentStep} to ${nextStep}\n`
                    + `- Edge Count: \n\t\t ${edgeCount}\n`
                    + `- Total Count for ${currentStep}: \n\t\t${totalCount}\n`
                    + `- Ratio: \n\t\t${((ratioEdges[edgeKey] || 0) * 100).toFixed(2)}% of students at ${currentStep} go to ${nextStep}\n`
                    + `- Outcomes: \n\t\t ${Object.entries(outcomes).map(([outcome, count]) => `${outcome}: ${count}`).join('\n\t\t ')}\n`
                    + `- Color Codes: \n\t\t Hex: ${color}`;

                dotString += `    "${currentStep}" -> "${nextStep}" [penwidth=${thickness}, color="${edgeColor}", tooltip="${tooltip}"];\n`;
            }
        }
    } else {
        console.log(totalSteps, steps)
        for (let rank = 0; rank < totalSteps; rank++) {
            const step = steps[rank];
            const color = calculateColor(rank, totalSteps);
            console.log(step, color)
            const node_tooltip = `Rank:\n\t\t ${rank + 1}\nColor:\n\t\t ${color}`;

            dotString += `    "${step}" [rank=${rank + 1}, style=filled, fillcolor="${color}", tooltip="${node_tooltip}"];\n`;
        }
        // Create edge definitions in the DOT string based on normalized thickness and thresholds
        for (const edge of Object.keys(normalizedThicknesses)) {
            if (normalizedThicknesses[edge] >= threshold) {
                const [currentStep, nextStep] = edge.split('->');
                const thickness = normalizedThicknesses[edge];
                const outcomes = edgeOutcomeCounts[edge] || {};
                const edgeCount = edgeCounts[edge] || 0;
                const totalCount = totalNodeEdges[currentStep] || 0;
                const color = calculateEdgeColors(outcomes);
                const outcomesStr = Object.entries(outcomes)
                    .map(([outcome, count]) => `${outcome}: ${count}`)
                    .join('\n\t\t ');

                if (edgeCount > min_visits) {
                    const tooltip = `${currentStep} to ${nextStep}\n`
                        + `- Edge Count: \n\t\t ${edgeCount}\n`
                        + `- Total Count for ${currentStep}: \n\t\t${totalCount}\n`
                        + `- Ratio: \n\t\t${((ratioEdges[edge] || 0) * 100).toFixed(2)}% of students at ${currentStep} go to ${nextStep}\n`
                        + `- Outcomes: \n\t\t ${outcomesStr}\n`
                        + `- Color Codes: \n\t\t Hex: ${color}\n\t\t RGB: ${[parseInt(color.substring(1, 3), 16), parseInt(color.substring(3, 5), 16), parseInt(color.substring(5, 7), 16)]}`;

                    dotString += `    "${currentStep}" -> "${nextStep}" [penwidth=${thickness}, color="${color}", tooltip="${tooltip}"];\n`;
                }
            }
        }
    }


    dotString += '}';
    return dotString;
}