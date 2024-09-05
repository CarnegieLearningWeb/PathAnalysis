import Papa from 'papaparse';
import {SequenceCount} from "@/Context";

interface CSVRow {
    'Session Id': string;
    'Time': string;
    'Step Name': string;
    'Outcome': string;
    'CF (Workspace Progress Status)': string;
}

// Function to load and sort data
export const loadAndSortData = (csvData: string): CSVRow[] => {
    // Step 1: Parse the CSV data using PapaParse
    const parsedData = Papa.parse<CSVRow>(csvData, {
        header: true,
        skipEmptyLines: true
    }).data;

    // Step 2: Transform data to replace missing Step Names with a default value
    const transformedData = parsedData.map(row => {
        return {
            'Session Id': row['Session Id'],
            'Time': row['Time'],
            'Step Name': row['Step Name'] || 'DoneButton', // Default value for missing Step Names
            'Outcome': row['Outcome'],
            'CF (Workspace Progress Status)': row['CF (Workspace Progress Status)'],
        };
    });

    // Step 3: Sort the transformed data by Session Id and Time
    return transformedData.sort((a, b) => {
        if (a['Session Id'] === b['Session Id']) {
            return new Date(a['Time']).getTime() - new Date(b['Time']).getTime();
        }
        return a['Session Id'].localeCompare(b['Session Id']);
    });
};

// Function to create step sequences from sorted data
export const createStepSequences = (sortedData: CSVRow[], selfLoops: boolean): { [key: string]: string[] } => {
    // Iterate over sorted data to build step sequences
    return sortedData.reduce((acc, row) => {
        const sessionId = row['Session Id'];
        if (!acc[sessionId]) {
            acc[sessionId] = [];
        }
        const stepName = row['Step Name'];

        // Add step to sequence based on whether self-loops are allowed
        if (selfLoops || acc[sessionId].length === 0 || acc[sessionId][acc[sessionId].length - 1] !== stepName) {
            acc[sessionId].push(stepName);
        }

        return acc;
    }, {} as { [key: string]: string[] });
};

// Function to create outcome sequences from sorted data
export const createOutcomeSequences = (sortedData: CSVRow[]): { [key: string]: string[] } => {
    // Iterate over sorted data to build outcome sequences
    return sortedData.reduce((acc, row) => {
        const sessionId = row['Session Id'];
        if (!acc[sessionId]) {
            acc[sessionId] = [];
        }
        acc[sessionId].push(row['Outcome']);
        return acc;
    }, {} as { [key: string]: string[] });
};

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

    // Sort the sequences based on their counts in descending order and take the top N
    const sortedSequences = Object.entries(sequenceCounts)
        .sort(([, countA], [, countB]) => countB - countA)
        .slice(0, topN);

    // Convert to the desired format: { sequence: [step1, step2, step3], count }
    const topSequences = sortedSequences.map(([sequenceKey, count]) => ({
        sequence: JSON.parse(sequenceKey), // Convert the string back to an array
        count,
    }));

    console.log("Processing topSequences: " + topSequences); // Log the top sequences for debugging
    return topSequences; // Return the array of top sequences
}


interface EdgeCounts {
    edgeCounts: { [key: string]: number };
    totalNodeEdges: { [key: string]: number };
    ratioEdges: { [key: string]: number };
    edgeOutcomeCounts: { [key: string]: { [outcome: string]: number } };
}

// Function to count edges between steps
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

    const top5Sequences = getTopSequences(stepSequences, 5)

    // Process edges for all sequences
    Object.keys(stepSequences).forEach((sessionId) => {
        const steps = stepSequences[sessionId];
        // console.log(steps)
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

            // Track the maximum edge count
            if (edgeCounts[edgeKey] > maxEdgeCount) {
                maxEdgeCount = edgeCounts[edgeKey];
            }
        }
    });

    Object.keys(edgeCounts).forEach((edge) => {
        const [start] = edge.split('->');
        ratioEdges[edge] = edgeCounts[edge] / (totalNodeEdges[start] || 0);
    });

    return {edgeCounts, totalNodeEdges, ratioEdges, edgeOutcomeCounts, maxEdgeCount, topSequences: top5Sequences};
};

// export function getInitialSelection(top5Sequences:SequenceCount[]){
//     return top5Sequences[0].sequence
// }
// Function to normalize edge thicknesses based on their ratio
export function normalizeThicknessesRatios(
    ratioEdges: { [key: string]: number },
    maxThickness: number
): { [key: string]: number } {
    const normalized: { [key: string]: number } = {};
    const maxRatio = Math.max(...Object.values(ratioEdges), 1); // Avoid division by zero

    // Scale edge thicknesses to a maximum value
    Object.keys(ratioEdges).forEach((edge) => {
        const ratio = ratioEdges[edge];
        normalized[edge] = (ratio / maxRatio) * maxThickness;
    });

    return normalized;
}

// // Function to normalize edge thicknesses based the full graph
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


// Function to calculate the color of a node based on its rank in the most common sequence
export function calculateColor(rank: number, totalSteps: number): string {
    const ratio = rank / totalSteps;

    const white = {r: 255, g: 255, b: 255};
    const lightBlue = {r: 0, g: 166, b: 255};

    const r = Math.round(white.r * (1 - ratio) + lightBlue.r * ratio);
    const g = Math.round(white.g * (1 - ratio) + lightBlue.g * ratio);
    const b = Math.round(white.b * (1 - ratio) + lightBlue.b * ratio);

    const toHex = (value: number) => value.toString(16).padStart(2, '0');
    const color = `#${toHex(r)}${toHex(g)}${toHex(b)}`;

    return color;
}

// Function to calculate the color of an edge based on its outcome distribution
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

// Function to generate a Graphviz DOT string for visualization
export function generateDotString(
    normalizedThicknesses: { [key: string]: number },
    // mostCommonSequence: string[],
    ratioEdges: { [key: string]: number },
    edgeOutcomeCounts: EdgeCounts['edgeOutcomeCounts'],
    edgeCounts: EdgeCounts['edgeCounts'],
    totalNodeEdges: EdgeCounts['totalNodeEdges'],
    threshold: number,
    min_visits: number,
    selectedSequence: SequenceCount["sequence"]
): string {
    if (!selectedSequence || selectedSequence.length === 0) {
        console.log(selectedSequence)
        return 'digraph G {\n"Error" [label="No valid sequences found to display."];\n}';
    }
    console.log("TOTAL STEP NUMBER: " + selectedSequence.length)
    // const stepsInSelectedSequence = selectedSequence//.split('->');
    // console.log(mostCommonSequence)
    // console.log("selectedSequenceR" + stepsInSelectedSequence)
    // console.log(selectedSequence[stepsInSelectedSequence])
    // Create node definitions in the DOT string
    let dotString = 'digraph G {\n';
    console.log()
    let totalSteps = selectedSequence[0].split(",").length//stepsInSelectedSequence.length;
    console.log("totalSteps" + totalSteps)
    for (let rank = 0; rank < totalSteps; rank++) {
        const step = selectedSequence[0].split(",")[rank];
        const color = calculateColor(rank, totalSteps);
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

    dotString += '}';
    return dotString;
}