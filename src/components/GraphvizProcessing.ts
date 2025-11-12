import * as Papa from 'papaparse';
import {SequenceCount} from "@/Context";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface CSVRow {
    'Session Id'?: string;
    'Time': string;
    'Step Name': string;
    'Outcome': string;
    'CF (Workspace Progress Status)': string;
    'Problem Name': string;
    'Anon Student Id': string;
    'CF (Is Autofilled)': string;
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

// ============================================================================
// SECTION 1: DATA LOADING AND PREPROCESSING
// ============================================================================

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

    // Debug: Log the first row to see what columns exist
    if (parsedData.length > 0) {
        console.log("loadAndSortData: First row columns:", Object.keys(parsedData[0]));
        console.log("loadAndSortData: Sample CF_Autofill values:",
            parsedData.slice(0, 5).map((row: any) => row['CF_Autofill'] || row['CF (Autofill)'] || row['CF (Is Autofilled)'] || 'MISSING')
        );
    }

    // Filter out autofilled rows FIRST, before any other processing
    // The actual column name is 'CF (Is Autofilled)'
    const filteredData = parsedData.filter(row => {
        const autofillValue = (row as any)['CF (Is Autofilled)'];
        // Check for various ways "true" might be represented
        const isAutofill = autofillValue === 'True' ||
                          autofillValue === 'true' ||
                          autofillValue === 'TRUE' ||
                          autofillValue === '1' ||
                          autofillValue === 1 ||
                          autofillValue === true;
        return !isAutofill;
    });

    console.log(`loadAndSortData: Filtered out ${parsedData.length - filteredData.length} autofilled rows (${parsedData.length} -> ${filteredData.length})`);
    console.log(`loadAndSortData: Percentage filtered: ${((parsedData.length - filteredData.length) / parsedData.length * 100).toFixed(1)}%`);

    const transformedData = filteredData.map(row => ({
        'Session Id': row['Session Id'],
        'Time': row['Time'],
        'Step Name': row['Step Name'] || 'DoneButton',
        'Outcome': row['Outcome'],
        'CF (Workspace Progress Status)': row['CF (Workspace Progress Status)'],
        'Problem Name': row['Problem Name'],
        'Anon Student Id': row['Anon Student Id'],
        'CF (Is Autofilled)': (row as any)['CF (Is Autofilled)']
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
 * Excludes steps where CF_Autofill is "True".
 * @param sortedData - The sorted CSV rows.
 * @param selfLoops - A boolean to include self-loops.
 * @returns A dictionary mapping session IDs to sequences of step names.
 */
export const createStepSequences = (sortedData: CSVRow[], selfLoops: boolean): { [key: string]: { [key: string]: string[] } } => {
    return sortedData.reduce((acc, row) => {
        // Note: Autofilled rows are already filtered out in loadAndSortData
        const studentId: string = row['Anon Student Id'];
        const problemName: string = row['Problem Name'];

        if (!acc[studentId]) acc[studentId] = {};
        if (!acc[studentId][problemName]) acc[studentId][problemName] = [];

        const stepName = row['Step Name'];
        if (selfLoops || acc[studentId][problemName].length === 0 || acc[studentId][problemName][acc[studentId][problemName].length - 1] !== stepName) {
            acc[studentId][problemName].push(stepName);
        }

        return acc;
    }, {} as { [key: string]: { [key: string]: string[] } });
};

/**
 * Creates outcome sequences from sorted data.
 * Excludes outcomes where CF_Autofill is "True".
 * @param sortedData - The sorted CSV rows.
 * @returns A dictionary mapping session IDs to sequences of outcomes.
 */
export const createOutcomeSequences = (sortedData: CSVRow[]): { [key: string]: { [key: string]: string[] } } => {
    return sortedData.reduce((acc, row) => {
        // Note: Autofilled rows are already filtered out in loadAndSortData
        const studentId = row['Anon Student Id'];
        const problemName = row['Problem Name'];

        if (!acc[studentId]) acc[studentId] = {};
        if (!acc[studentId][problemName]) acc[studentId][problemName] = [];

        acc[studentId][problemName].push(row['Outcome']);

        return acc;
    }, {} as { [key: string]: { [key: string]: string[] } });
};

// ============================================================================
// SECTION 2: SEQUENCE ANALYSIS
// ============================================================================

/**
 * Finds the top N most frequent step sequences.
 * @param stepSequences - The step sequences for all sessions.
 * @param topN - The number of top sequences to return (default is 5).
 * @returns An array of the top sequences and their counts.
 */
export function getTopSequences(stepSequences: { [key: string]: { [key: string]: string[] } }, topN: number = 5) {
    const sequenceCounts: { [sequence: string]: number } = {};

    Object.values(stepSequences).forEach((nestedObj) => {
        Object.values(nestedObj).forEach((sequence) => {
            const sequenceKey = JSON.stringify(sequence);
            sequenceCounts[sequenceKey] = (sequenceCounts[sequenceKey] || 0) + 1;
        });
    });

    const sortedSequences = Object.entries(sequenceCounts)
        .filter(([sequence]) => JSON.parse(sequence).length >= 5)
        .sort(([, countA], [, countB]) => countB - countA)
        .slice(0, topN);

    const topSequences = sortedSequences.map(([sequenceKey, count]) => ({
        sequence: JSON.parse(sequenceKey),
        count,
    }));

    console.log("Processing topSequences: ", topSequences);
    return topSequences;
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

            for (let i = 0; i < steps.length; i++) {
                if (steps[i].toLowerCase().includes('equationanswer')) {
                    const equationOutcome = outcomes[i];
                    equationAnswerOutcomes[equationOutcome] = (equationAnswerOutcomes[equationOutcome] || 0) + 1;

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

// ============================================================================
// SECTION 3: EDGE AND NODE COUNTING (Core Analytics)
// ============================================================================

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
    if (!maps.studentEdgeCounts.has(edgeKey)) {
        maps.studentEdgeCounts.set(edgeKey, new Set());
        maps.totalVisits.set(edgeKey, 0);
        maps.repeatVisits.set(edgeKey, new Map());
        maps.edgeOutcomeCounts.set(edgeKey, new Map());
    }

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
    maps.studentEdgeCounts.get(edgeKey)!.add(studentId);
    maps.totalNodeEdges.get(currentStep)!.add(studentId);

    maps.totalVisits.set(edgeKey, maps.totalVisits.get(edgeKey)! + 1);

    const edgeRepeatVisits = maps.repeatVisits.get(edgeKey)!;
    const currentRepeatCount = (edgeRepeatVisits.get(studentId) || 0) + 1;
    edgeRepeatVisits.set(studentId, currentRepeatCount);

    if (currentRepeatCount === 1) {
        if (!maps.firstAttemptOutcomes.has(edgeKey)) {
            maps.firstAttemptOutcomes.set(edgeKey, new Map());
        }
        const firstAttemptMap = maps.firstAttemptOutcomes.get(edgeKey)!;
        firstAttemptMap.set(outcome, (firstAttemptMap.get(outcome) || 0) + 1);
    }

    const currentEdgeCount = maps.studentEdgeCounts.get(edgeKey)!.size;
    maps.edgeCounts.set(edgeKey, currentEdgeCount);
    const newMaxEdgeCount = Math.max(currentMaxEdgeCount, currentEdgeCount);

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

    for (const { studentId, steps, outcomes } of combinations) {
        for (let i = 0; i < steps.length - 1; i++) {
            const currentStep = steps[i];
            const nextStep = steps[i + 1];
            const outcome = outcomes[i + 1];
            const edgeKey = `${currentStep}->${nextStep}`;

            initializeEdgeTracking(edgeKey, currentStep, maps);

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
    const totalNodeEdgesCounts: { [key: string]: number } = {};
    maps.totalNodeEdges.forEach((students, node) => {
        totalNodeEdgesCounts[node] = students.size;
    });

    const edgeCountsObj: { [key: string]: number } = {};
    const ratioEdgesObj: { [key: string]: number } = {};
    maps.edgeCounts.forEach((count, edge) => {
        edgeCountsObj[edge] = count;
        const [sourceNode] = edge.split('->');
        ratioEdgesObj[edge] = count / (totalNodeEdgesCounts[sourceNode] || 1);
    });

    const totalVisitsObj: { [key: string]: number } = {};
    maps.totalVisits.forEach((count, edge) => {
        totalVisitsObj[edge] = count;
    });

    const repeatVisitsObj: { [key: string]: { [studentId: string]: number } } = {};
    maps.repeatVisits.forEach((studentMap, edge) => {
        repeatVisitsObj[edge] = {};
        studentMap.forEach((count, studentId) => {
            repeatVisitsObj[edge][studentId] = count;
        });
    });

    const edgeOutcomeCountsObj: { [key: string]: { [outcome: string]: number } } = {};
    maps.edgeOutcomeCounts.forEach((outcomeMap, edge) => {
        edgeOutcomeCountsObj[edge] = {};
        outcomeMap.forEach((count, outcome) => {
            edgeOutcomeCountsObj[edge][outcome] = count;
        });
    });

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
        firstAttemptOutcomes: firstAttemptOutcomesObj,
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
    outcomeSequences: { [key: string]: { [key: string]: string[] } },
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
    const combinations = prepareStudentProblemCombinations(stepSequences, outcomeSequences);
    const trackingMaps = initializeTrackingMaps();
    const topSequences = getTopSequences(stepSequences, 5);
    const maxEdgeCount = processStudentPaths(combinations, trackingMaps);
    const result = convertMapsToObjects(trackingMaps, maxEdgeCount, topSequences);

    return result;
};

/**
 * Counts edges for a specific selected sequence with two modes:
 *
 * Mode 1 (onlyStudentsOnSequence = true): Progressive filtering
 * - Each edge shows progressively fewer students as we move through the sequence
 * - Only students who used THIS exact path from the beginning up to each edge are counted
 * - Example for [A, B, C, D]:
 *   - Edge A->B: Shows all students who went A->B (starting the path)
 *   - Edge B->C: Shows only students who went A->B->C (continued from A)
 *   - Edge C->D: Shows only students who went A->B->C->D (completed the full path)
 *
 * Mode 2 (onlyStudentsOnSequence = false): All students
 * - Shows ALL students who made each transition between nodes in the sequence
 * - No filtering based on whether they followed the selected path
 * - Example for [A, B, C, D]:
 *   - Edge A->B: Shows ALL students who went A->B at any point
 *   - Edge B->C: Shows ALL students who went B->C at any point
 *   - Edge C->D: Shows ALL students who went C->D at any point
 *
 * @param stepSequences - All student step sequences
 * @param outcomeSequences - All student outcome sequences
 * @param selectedSequence - The specific sequence to analyze
 * @param onlyStudentsOnSequence - If true, use progressive filtering; if false, show all students
 * @returns Edge counts for the selected sequence
 */
export const countEdgesForSelectedSequence = (
    stepSequences: { [key: string]: { [key: string]: string[] } },
    outcomeSequences: { [key: string]: { [key: string]: string[] } },
    selectedSequence: string[],
    onlyStudentsOnSequence: boolean = true
): {
    totalNodeEdges: { [p: string]: number };
    edgeOutcomeCounts: { [p: string]: { [p: string]: number } };
    maxEdgeCount: number;
    ratioEdges: { [key: string]: number };
    edgeCounts: { [key: string]: number };
    totalVisits: { [key: string]: number };
    repeatVisits: { [key: string]: { [studentId: string]: number } };
    firstAttemptOutcomes: { [key: string]: { [outcome: string]: number } };
} => {
    const trackingMaps = initializeTrackingMaps();
    let maxEdgeCount = 0;

    if (onlyStudentsOnSequence) {
        // MODE 1: Progressive filtering - only students who followed the sequence
        console.log(`countEdgesForSelectedSequence: Progressive filtering mode (students on sequence)`);

        // Track students at each position in the sequence for proper ratio calculation
        const studentsAtSequencePosition = new Map<number, Set<string>>();
        for (let i = 0; i < selectedSequence.length; i++) {
            studentsAtSequencePosition.set(i, new Set<string>());
        }

        Object.entries(stepSequences).forEach(([studentId, problems]) => {
            const innerOutcomeSequences = outcomeSequences[studentId] || {};

            Object.entries(problems).forEach(([problemName, steps]) => {
                const outcomes = innerOutcomeSequences[problemName] || [];

                // Check if this student completed the full sequence
                const fullSequenceMatch = containsSequence(steps, selectedSequence);
                if (fullSequenceMatch) {
                    // Mark that this student reached every position in the sequence
                    for (let pos = 0; pos < selectedSequence.length; pos++) {
                        studentsAtSequencePosition.get(pos)!.add(studentId);
                    }
                } else {
                    // Check which partial sequences this student completed
                    for (let pos = 0; pos < selectedSequence.length; pos++) {
                        const partialSequence = selectedSequence.slice(0, pos + 1);
                        if (containsSequence(steps, partialSequence)) {
                            studentsAtSequencePosition.get(pos)!.add(studentId);
                        }
                    }
                }

                // For each edge in the selected sequence
                for (let seqIndex = 0; seqIndex < selectedSequence.length - 1; seqIndex++) {
                    const currentStep = selectedSequence[seqIndex];
                    const nextStep = selectedSequence[seqIndex + 1];
                    const edgeKey = `${currentStep}->${nextStep}`;

                    // Build the partial sequence up to and including this edge
                    const partialSequence = selectedSequence.slice(0, seqIndex + 2);

                    // Check if this student's path contains this partial sequence
                    if (containsSequence(steps, partialSequence)) {
                        // Find the position of this edge in the student's actual path
                        for (let i = 0; i < steps.length - 1; i++) {
                            if (steps[i] === currentStep && steps[i + 1] === nextStep) {
                                const outcome = outcomes[i + 1];

                                initializeEdgeTracking(edgeKey, currentStep, trackingMaps);

                                maxEdgeCount = updateEdgeMetrics(
                                    edgeKey,
                                    currentStep,
                                    studentId,
                                    outcome,
                                    trackingMaps,
                                    maxEdgeCount
                                );
                                break; // Only count the first occurrence of this edge for this student
                            }
                        }
                    }
                }
            });
        });

        // Override totalNodeEdges with progressive sequence counts
        trackingMaps.totalNodeEdges.clear();
        for (let i = 0; i < selectedSequence.length; i++) {
            const nodeName = selectedSequence[i];
            const studentsAtPosition = studentsAtSequencePosition.get(i)!;
            trackingMaps.totalNodeEdges.set(nodeName, studentsAtPosition);
        }
    } else {
        // MODE 2: All students - anyone who made each transition, regardless of path
        console.log(`countEdgesForSelectedSequence: All students mode (any transition)`);

        Object.entries(stepSequences).forEach(([studentId, problems]) => {
            const innerOutcomeSequences = outcomeSequences[studentId] || {};

            Object.entries(problems).forEach(([problemName, steps]) => {
                const outcomes = innerOutcomeSequences[problemName] || [];

                // For each edge in the selected sequence
                for (let seqIndex = 0; seqIndex < selectedSequence.length - 1; seqIndex++) {
                    const currentStep = selectedSequence[seqIndex];
                    const nextStep = selectedSequence[seqIndex + 1];
                    const edgeKey = `${currentStep}->${nextStep}`;

                    // Find ANY occurrence of this transition in the student's path
                    for (let i = 0; i < steps.length - 1; i++) {
                        if (steps[i] === currentStep && steps[i + 1] === nextStep) {
                            const outcome = outcomes[i + 1];

                            initializeEdgeTracking(edgeKey, currentStep, trackingMaps);

                            maxEdgeCount = updateEdgeMetrics(
                                edgeKey,
                                currentStep,
                                studentId,
                                outcome,
                                trackingMaps,
                                maxEdgeCount
                            );
                            break; // Only count the first occurrence of this edge for this student
                        }
                    }
                }
            });
        });
    }

    const result = convertMapsToObjects(trackingMaps, maxEdgeCount, []);

    return result;
};

/**
 * Helper function to check if a sequence contains a subsequence
 * @param sequence - The full sequence to search in
 * @param subsequence - The subsequence to search for
 * @returns True if subsequence is found in sequence
 */
function containsSequence(sequence: string[], subsequence: string[]): boolean {
    if (subsequence.length === 0) return true;
    if (sequence.length < subsequence.length) return false;

    for (let i = 0; i <= sequence.length - subsequence.length; i++) {
        let found = true;
        for (let j = 0; j < subsequence.length; j++) {
            if (sequence[i + j] !== subsequence[j]) {
                found = false;
                break;
            }
        }
        if (found) return true;
    }

    return false;
}

// ============================================================================
// SECTION 4: GRAPH CONNECTIVITY ANALYSIS
// ============================================================================

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

    const allNodes = new Set<string>();
    Object.keys(countsToUse).forEach(edgeKey => {
        const [fromNode, toNode] = edgeKey.split('->');
        if (fromNode && toNode) {
            allNodes.add(fromNode);
            allNodes.add(toNode);
        }
    });

    selectedSequence.forEach(node => allNodes.add(node));

    console.log("All nodes in graph:", Array.from(allNodes));
    console.log("Total nodes:", allNodes.size);
    console.log("Selected sequence nodes:", selectedSequence);

    if (allNodes.size === 0) {
        console.log("No nodes found in graph, returning 0");
        return 0;
    }

    const edgeCounts_values = Object.values(countsToUse).filter(count => count > 0);
    const uniqueCounts = [...new Set(edgeCounts_values)].sort((a, b) => b - a);

    console.log("Unique edge counts (descending):", uniqueCounts);

    let maxValidThreshold = 0;

    for (const threshold of uniqueCounts) {
        const validEdges = Object.entries(countsToUse)
            .filter(([_, count]) => count >= threshold)
            .map(([edge, count]) => ({ edge, count }));

        console.log(`Testing threshold ${threshold}: ${validEdges.length} edges qualify`);

        const isGraphConnected = checkGraphConnectivity(validEdges, allNodes);
        const isSequenceConnected = checkSequenceConnectivity(validEdges, selectedSequence);
        const hasValidPredecessors = checkNodePredecessors(validEdges, allNodes, selectedSequence);

        if (isGraphConnected && isSequenceConnected && hasValidPredecessors) {
            maxValidThreshold = threshold;
            console.log(`✓ Threshold ${threshold} keeps all nodes and sequence connected`);
            break;
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

    for (let i = 0; i < selectedSequence.length - 1; i++) {
        const currentNode = selectedSequence[i];
        const nextNode = selectedSequence[i + 1];

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
 * @param _selectedSequence
 * @returns True if all non-first nodes have at least one incoming edge
 */
function checkNodePredecessors(
    edges: Array<{edge: string, count: number}>,
    allNodes: Set<string>,
    _selectedSequence: string[]
): boolean {
    const incomingEdges = new Map<string, Set<string>>();

    allNodes.forEach(node => {
        incomingEdges.set(node, new Set());
    });

    edges.forEach(({ edge }) => {
        const [fromNode, toNode] = edge.split('->');
        if (fromNode && toNode && fromNode !== toNode) {
            incomingEdges.get(toNode)?.add(fromNode);
        }
    });

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

    const totalNodes = allNodes.size;
    const isolatedNodes = nodesWithoutPredecessors.size;

    if (totalNodes > 1 && isolatedNodes === totalNodes) {
        console.log("All nodes have no predecessors - threshold may be too high");
        return false;
    }

    if (totalNodes > 2 && isolatedNodes > totalNodes / 2) {
        console.log(`Too many isolated nodes: ${isolatedNodes}/${totalNodes}`);
        return false;
    }

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

    const adjacencyList = new Map<string, Set<string>>();

    allNodes.forEach(node => {
        adjacencyList.set(node, new Set());
    });

    edges.forEach(({ edge }) => {
        const [fromNode, toNode] = edge.split('->');
        if (fromNode && toNode && fromNode !== toNode) {
            adjacencyList.get(fromNode)?.add(toNode);
            adjacencyList.get(toNode)?.add(fromNode);
        }
    });

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

    const isConnected = visited.size === allNodes.size;

    if (!isConnected) {
        const disconnectedNodes = Array.from(allNodes).filter(node => !visited.has(node));
        console.log("Disconnected nodes:", disconnectedNodes);
    } else {
        console.log("All graph nodes remain connected");
    }

    return isConnected;
}

// ============================================================================
// SECTION 5: VISUALIZATION HELPERS
// ============================================================================

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
    const minThickness = 0.5;

    const maxSqrt = Math.sqrt(maxEdgeCount);

    Object.keys(edgeCounts).forEach((edge) => {
        const count = edgeCounts[edge];
        const sqrtCount = Math.sqrt(count);
        let thickness = (sqrtCount / maxSqrt) * maxThickness;

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
        'ERROR': '#ff0000',
        'INITIAL_HINT': '#0000ff',
        'HINT_LEVEL_CHANGE': '#0000ff',
        'JIT': '#ffff00',
        'FREEBIE_JIT': '#ffff00'
    } : {
        'ERROR': '#ff0000',
        'OK': '#00ff00',
        'INITIAL_HINT': '#0000ff',
        'HINT_LEVEL_CHANGE': '#0000ff',
        'JIT': '#ffff00',
        'FREEBIE_JIT': '#ffff00'
    };

    if (Object.keys(outcomes).length === 0) {
        return '#00000000';
    }

    let weightedR = 0, weightedG = 0, weightedB = 0;
    let totalCount = 0;
    let contributingOutcomes = 0;

    Object.entries(outcomes).forEach(([outcome, count]) => {
        if (errorMode && outcome === 'OK') return;

        const color = colorMap[outcome];
        if (!color) return;

        const [r, g, b] = [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16));
        weightedR += r * count;
        weightedG += g * count;
        weightedB += b * count;
        totalCount += count;
        contributingOutcomes++;
    });

    if (contributingOutcomes === 0 && errorMode && outcomes['OK']) {
        return '#00000090';
    }

    if (totalCount === 0) {
        return '#00000000';
    }

    const rHex = Math.round(weightedR / totalCount).toString(16).padStart(2, '0');
    const gHex = Math.round(weightedG / totalCount).toString(16).padStart(2, '0');
    const bHex = Math.round(weightedB / totalCount).toString(16).padStart(2, '0');

    return `#${rHex}${gHex}${bHex}90`;
}

// ============================================================================
// SECTION 6: TOOLTIP GENERATION
// ============================================================================

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
 * @param normalizedThickness - The visual thickness of the edge
 * @param minVisits - The minimum visits threshold setting
 * @param uniqueStudentMode - Whether in unique student mode
 * @param progressStats - Progress status statistics for students on this edge
 * @returns Formatted tooltip string for display on hover
 */
const createEdgeTooltip = (
    currentStep: string,
    _nextStep: string,
    edgeKey: string,
    edgeCount: number,
    totalCount: number,
    visits: number,
    ratioEdges: { [key: string]: number },
    outcomes: { [outcome: string]: number },
    firstAttempts: { [outcome: string]: number },
    _repeatVisits: { [key: string]: { [studentId: string]: number } },
    _edgeColor: string,
    normalizedThickness: number,
    minVisits: number,
    uniqueStudentMode: boolean = false,
    progressStats?: { graduated: number; promoted: number; other: number; total: number }
): string => {
    const modeLabel = uniqueStudentMode ? 'Students' : 'Visits';
    const pathLabel = uniqueStudentMode ? 'Students taking this path' : 'Total visits on this path';
    const startLabel = uniqueStudentMode ? `Students at ${currentStep}` : `Total visits to ${currentStep}`;
    const notTakingLabel = uniqueStudentMode ? 'Students NOT taking this path' : 'Visits to other paths from this node';

    const pathCount = uniqueStudentMode ? edgeCount : visits;
    const totalAtStart = totalCount;
    const notTakingPath = Math.max(0, totalAtStart - pathCount);
    const ratioPercentage = ((ratioEdges[edgeKey] || 0) * 100).toFixed(1);

    let tooltip = `${modeLabel} Flow:\n`
        + `    • ${pathLabel}: ${pathCount}\n`
        + `    • ${startLabel}: ${totalAtStart}\n`
        + `    • ${notTakingLabel}: ${notTakingPath}\n`
        + `    • Transition Probability: ${ratioPercentage}%\n`
        + `      (${pathCount} of ${totalAtStart} ${modeLabel.toLowerCase()})\n\n`;

    if (progressStats) {
        const graduatedPercentage = progressStats.total > 0 ? ((progressStats.graduated / progressStats.total) * 100).toFixed(1) : '0';
        const promotedPercentage = progressStats.total > 0 ? ((progressStats.promoted / progressStats.total) * 100).toFixed(1) : '0';
        const otherPercentage = progressStats.total > 0 ? ((progressStats.other / progressStats.total) * 100).toFixed(1) : '0.0';

        tooltip += `Student Progress Status:\n`
            + `    • Graduated: ${progressStats.graduated} (${graduatedPercentage}%)\n`
            + `    • Promoted: ${progressStats.promoted} (${promotedPercentage}%)\n`
            + `    • Other: ${progressStats.other} (${otherPercentage}%)\n`
            + `    • Total students tracked: ${progressStats.total}\n\n`;
    }

    const totalOutcomes = Object.values(outcomes).reduce((sum, count) => sum + count, 0);
    const allOutcomes = Object.entries(outcomes)
        .sort(([,a], [,b]) => b - a)
        .map(([outcome, count]) => {
            const percentage = totalOutcomes > 0 ? ((count / totalOutcomes) * 100).toFixed(1) : '0';
            return `${outcome}: ${count} (${percentage}%)`;
        })
        .join('\n      ');

    const totalFirstAttempts = Object.values(firstAttempts).reduce((sum, count) => sum + count, 0);
    const firstAttemptOutcomes = Object.entries(firstAttempts)
        .sort(([,a], [,b]) => b - a)
        .map(([outcome, count]) => {
            const percentage = totalFirstAttempts > 0 ? ((count / totalFirstAttempts) * 100).toFixed(1) : '0';
            return `${outcome}: ${count} (${percentage}%)`;
        })
        .join('\n      ');

    tooltip += `Transition Outcomes:\n`
        + `    • All Outcomes:\n`
        + `      ${allOutcomes || 'No outcome data'}\n\n`
        + `    • First Attempt Outcomes:\n`
        + `      ${firstAttemptOutcomes || 'No first attempt data'}\n\n`
        + `Visual Properties:\n`
        + `    • Edge Thickness: ${normalizedThickness.toFixed(1)} (normalized)\n`
        + `    • Path Frequency: ${pathCount} ${modeLabel.toLowerCase()}\n`
        + `    • Min ${modeLabel} Threshold: ${minVisits}`;

    return tooltip;
};

// ============================================================================
// SECTION 7: DOT STRING GENERATION
// ============================================================================

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
 * @param uniqueStudentMode - Whether in unique student mode
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

    for (let rank = 0; rank < totalSteps; rank++) {
        const currentStep = selectedSequence[rank];
        const color = calculateColor(rank, totalSteps);
        const studentCount = totalNodeEdges[currentStep] || 0;
        const nodeTooltip = createNodeTooltip(rank, color, studentCount);

        dotContent += `    "${currentStep}" [rank=${rank + 1}, style=filled, fillcolor="${color}", tooltip="${nodeTooltip}"];\n`;

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

            if (visitsForFiltering >= minVisits) {
                const tooltip = createEdgeTooltip(
                    currentStep, nextStep, edgeKey, edgeCount, totalCount, visits,
                    ratioEdges, outcomes, firstAttempts, repeatVisits, edgeColor,
                    thickness, minVisits, uniqueStudentMode
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
 * @param uniqueStudentMode - Whether in unique student mode
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

    for (const nodeName of allNodesInEdges) {
        const sequenceRank = selectedSequence.indexOf(nodeName);
        const color = sequenceRank >= 0 ? calculateColor(sequenceRank, totalSteps) : '#ffffff';
        const rank = sequenceRank >= 0 ? sequenceRank + 1 : 0;
        const studentCount = totalNodeEdges[nodeName] || 0;
        const nodeTooltip = createNodeTooltip(sequenceRank, color, studentCount);

        dotContent += `    "${nodeName}" [rank=${rank}, style=filled, fillcolor="${color}", tooltip="${nodeTooltip}"];\n`;
    }

    for (const edgeKey of Object.keys(normalizedThicknesses)) {
        const thickness = normalizedThicknesses[edgeKey];

        if (thickness >= threshold) {
            const [currentStep, nextStep] = edgeKey.split('->');
            const outcomes = edgeOutcomeCounts[edgeKey] || {};
            const firstAttempts = firstAttemptOutcomes[edgeKey] || {};
            const edgeCount = edgeCounts[edgeKey] || 0;
            const visits = totalVisits[edgeKey] || 0;
            const visitsForFiltering = uniqueStudentMode ? edgeCount : visits;
            const totalCount = totalNodeEdges[currentStep] || 0;
            const edgeColor = calculateEdgeColors(outcomes, errorMode);

            if (visitsForFiltering >= minVisits) {
                const tooltip = createEdgeTooltip(
                    currentStep, nextStep, edgeKey, edgeCount, totalCount, visits,
                    ratioEdges, outcomes, firstAttempts, repeatVisits, edgeColor,
                    thickness, minVisits, uniqueStudentMode
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
 * @param uniqueStudentMode - Whether in unique student mode (first attempts only)
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
    if (!selectedSequence || selectedSequence.length === 0) {
        return 'digraph G {\n"Error" [label="No valid sequences found to display."];\n}';
    }

    const visitsToUse = uniqueStudentMode ? edgeCounts : totalVisits;
    const outcomesToUse = uniqueStudentMode ? firstAttemptOutcomes : edgeOutcomeCounts;

    console.log("generateDotString: Using unique student mode:", uniqueStudentMode);
    console.log("generateDotString: Min visits threshold:", minVisits);
    console.log("generateDotString: Thickness threshold:", threshold);

    let dotString = 'digraph G {\ngraph [size="8,6!", dpi=150];\n';

    const edgeCountsToUse = uniqueStudentMode ? edgeCounts : totalVisits;

    if (justTopSequence) {
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

    dotString += '}';
    return dotString;
}