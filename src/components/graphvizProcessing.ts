import Papa from 'papaparse';

interface CSVRow {
    'Session Id': string;
    'Time': string;
    'Step Name': string;
    'Outcome': string;
    'CF (Workspace Progress Status)': string;

}

// Function to load and sort data
export const loadAndSortData = (csvData: string): CSVRow[] => {
        const parsedData = Papa.parse<CSVRow>(csvData, {
        header: true,
        skipEmptyLines: true
    }).data;

    // Step 2: Transform data to replace NaN values
    const transformedData = parsedData.map(row => {
        return {
            'Session Id': row['Session Id'],
            'Time': row['Time'],
            'Step Name': row['Step Name'] || 'DoneButton', //TODO: Nan only shows up on selection "Done Button"
            'Outcome': row['Outcome'],
            'CF (Workspace Progress Status)': row['CF (Workspace Progress Status)'],
        };
    });


    return transformedData.sort((a, b) => {
        if (a['Session Id'] === b['Session Id']) {
            return new Date(a['Time']).getTime() - new Date(b['Time']).getTime();
        }
        return a['Session Id'].localeCompare(b['Session Id']);
    });
};


export const createStepSequences = (sortedData: CSVRow[], selfLoops:boolean): { [key: string]: string[] } => {
    return sortedData.reduce((acc, row) => {
        const sessionId = row['Session Id'];
        if (!acc[sessionId]) {
            acc[sessionId] = [];
        }
        const stepName = row['Step Name'];

        if (!selfLoops) {
            if (!acc[sessionId].includes(stepName)) {
                acc[sessionId].push(stepName);
            }
        } else {
            acc[sessionId].push(stepName);
        }

        // console.log(sessionId, acc[sessionId])
        return acc;
    }, {} as { [key: string]: string[] });
};

// Function to create outcome sequences
export const createOutcomeSequences = (sortedData: CSVRow[]): { [key: string]: string[] } => {
    // console.log(sortedData)
    return sortedData.reduce((acc, row) => {
        const sessionId = row['Session Id'];
        if (!acc[sessionId]) {
            acc[sessionId] = [];
        }
        acc[sessionId].push(row['Outcome']);
        return acc;
    }, {} as { [key: string]: string[] });
};

interface EdgeCounts {
    edgeCounts: { [key: string]: number };
    totalNodeEdges: { [key: string]: number };
    ratioEdges: { [key: string]: number };
    edgeOutcomeCounts: { [key: string]: { [outcome: string]: number } };
}

// Function to count edges
export const countEdges = (
    stepSequences: { [key: string]: string[] },
    outcomeSequences: { [key: string]: string[] }
): EdgeCounts => {
    const edgeCounts: { [key: string]: number } = {};
    const totalNodeEdges: { [key: string]: number } = {};
    const ratioEdges: { [key: string]: number } = {};
    const edgeOutcomeCounts: { [key: string]: { [outcome: string]: number } } = {};

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
        }
    });

    Object.keys(edgeCounts).forEach((edge) => {
        const [start] = edge.split('->');
        ratioEdges[edge] = edgeCounts[edge] / (totalNodeEdges[start] || 0);
    });
    // console.log("edgeOutcomeCounts: ", edgeOutcomeCounts, "\nratioEdges: ", ratioEdges )
    return { edgeCounts, totalNodeEdges, ratioEdges, edgeOutcomeCounts };
};

export function normalizeThicknesses(
    ratioEdges: { [key: string]: number },
    maxThickness: number
): { [key: string]: number } {
    const normalized: { [key: string]: number } = {};
    const maxRatio = Math.max(...Object.values(ratioEdges), 1); // Avoid division by zero

    Object.keys(ratioEdges).forEach((edge) => {
        const ratio = ratioEdges[edge];


        normalized[edge] = (ratio / maxRatio) * maxThickness;
    });

    return normalized;
}

function calculateColor(rank: number, totalSteps: number): string {
    // Calculate the ratio between 0 and 1
    const ratio = rank / totalSteps;

    const white = { r: 255, g: 255, b: 255 }; // White color
    const lightBlue = { r: 0, g: 166, b: 255 }; // Light Blue color

    // Interpolate between white and light blue
    const r = Math.round(white.r * (1 - ratio) + lightBlue.r * ratio);
    const g = Math.round(white.g * (1 - ratio) + lightBlue.g * ratio);
    const b = Math.round(white.b * (1 - ratio) + lightBlue.b * ratio);

    // Convert RGB to hexadecimal
    const toHex = (value: number) => value.toString(16).padStart(2, '0');
    const color = `#${toHex(r)}${toHex(g)}${toHex(b)}`;


    // console.log("Color: ", r, g, b, toHex(r), toHex(g), toHex(b), color);

    return color;
}

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

export function generateDotString(
    normalizedThicknesses: { [key: string]: number },
    mostCommonSequence: string[],
    ratioEdges: { [key: string]: number },
    edgeOutcomeCounts: EdgeCounts['edgeOutcomeCounts'],
    edgeCounts: EdgeCounts['edgeCounts'],
    totalNodeEdges: EdgeCounts['totalNodeEdges'],
    threshold: number,
    min_visits: number,
): string {
    let dotString = 'digraph G {\n';
    const totalSteps = mostCommonSequence.length;
    // console.log(mostCommonSequence, totalSteps)
    for (let rank = 0; rank < totalSteps; rank++) {
        const step = mostCommonSequence[rank];
        const color = calculateColor(rank + 1, totalSteps);
        const node_tooltip = `Rank:\n\t\t ${rank + 1}\nColor:\n\t\t ${color}`;

        dotString += `    "${step}" [rank=${rank + 1}, style=filled, fillcolor="${color}", tooltip="${node_tooltip}"];\n`;
    }

    for (const edge of Object.keys(normalizedThicknesses)) {
        if (normalizedThicknesses[edge] >= threshold) {
            const [currentStep, nextStep] = edge.split('->');// as EdgeKey;
            const thickness = normalizedThicknesses[edge];
            const outcomes = edgeOutcomeCounts[edge] || {};
            const edgeCount = edgeCounts[edge] || 0;
            const totalCount = totalNodeEdges[currentStep] || 0;
            const color = calculateEdgeColors(outcomes);
            const outcomesStr = Object.entries(outcomes)
                .map(([outcome, count]) => `${outcome}: ${count}`)
                .join('\n\t\t ');
            if (edgeCount > min_visits){
                const tooltip = `${currentStep} to ${nextStep}\n`
                + `- Edge Count: \n\t\t ${edgeCount}\n`
                + `- Total Count for ${currentStep}: \n\t\t${totalCount}\n`
                + `- Ratio: \n\t\t${((ratioEdges[edge] || 0) * 100).toFixed(2)}% of students at ${currentStep} go to ${nextStep}\n`
                + `- Outcomes: \n\t\t ${outcomesStr}\n`
                + `- Color Codes: \n\t\t Hex: ${color}\n\t\t RGB: ${[parseInt(color.substring(1, 3), 16), parseInt(color.substring(3, 5), 16), parseInt(color.substring(5, 7), 16)]}`;

                dotString += `    "${currentStep}" -> "${nextStep}" [penwidth=${thickness}, color="${color}", tooltip="${tooltip}"];\n`;
        }}
    }

    dotString += '}';
    return dotString;
}
