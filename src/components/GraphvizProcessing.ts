import * as Papa from 'papaparse';
import {SequenceCount} from "@/Context";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface CSVRow {
    // One learning session (one sitting at the software). Splits a student's
    // repeated attempts at the same problem into separate paths — see pathKey.
    // Optional, and often carries the literal placeholder 'no_session_tracking'.
    'Session Id'?: string;
    'Time': string;
    'Step Name': string;
    'Outcome': string;
    'CF (Workspace Progress Status)': string;
    'Problem Name': string;
    'Anon Student Id': string;
    'CF (Is Autofilled)': string;
    // Kept for the export masthead/README, which name the workspace and problem
    // an exported graph belongs to. Not used by any graph computation.
    'Level (Workspace Id)'?: string;
    // Only read to identify a Done-button click, which is logged with no Step
    // Name (see resolveStepName). Optional: not every export carries them.
    'Selection'?: string;
    'Action'?: string;
}

interface EdgeCounts {
    edgeCounts: { [key: string]: number };
    totalNodeEdges: { [key: string]: number };
    ratioEdges: { [key: string]: number };
    edgeOutcomeCounts: { [key: string]: { [outcome: string]: number } };
}

/**
 * Helper type for pre-calculated student-path combinations to improve performance.
 * `pathKey` is the second-level sequence key (problem, session-qualified where
 * the data has sessions — see pathKey()).
 */
type StudentProblemCombination = {
    studentId: string;
    pathKey: string;
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
    // Unique students who hit an ERROR on each edge — drives the dashed red
    // error overlay rendered in Error Mode.
    edgeErrorUsers: Map<string, Set<string>>;
    // Error TRAVERSALS, parallel to edgeErrorUsers' error STUDENTS. Error Mode has
    // to compare like with like against whichever count the current mode shows.
    edgeErrorVisits: Map<string, number>;
};

// ============================================================================
// SECTION 1: DATA LOADING AND PREPROCESSING
// ============================================================================

/**
 * Separator inside a composed sequence key. NUL cannot occur in a problem name
 * or a session id, so two distinct (problem, session) pairs can never collide
 * into the same key.
 */
const PATH_KEY_SEP = '\u0000';

/**
 * Session id values that mean "this dataset does not track sessions". The
 * literal 'no_session_tracking' is what the Mathia exports carry (see
 * src/lib/types.ts); the rest are the usual ways a blank lands in a CSV.
 */
const NON_SESSION_VALUES = new Set([
    '', 'no_session_tracking', 'null', 'undefined', 'nan', 'na', 'n/a', '-'
]);

/**
 * Second-level sequence key: one *path* through the content.
 *
 * A path is one student's run at one problem in one session. Grouping by
 * (student, problem) alone concatenates every attempt a student ever made at a
 * problem — across days — into a single path, which invents a transition at each
 * attempt boundary (last step of attempt N -> first step of attempt N+1), lets
 * one student sit on several outgoing edges of the same node, and makes "avg
 * path length" a per-student-per-problem figure rather than a per-attempt one.
 *
 * Session is only added when the row actually has one: datasets that ship the
 * 'no_session_tracking' placeholder (or a blank) fall back to the old
 * problem-only key, which is the best available answer for them — never
 * collapsing every row into one bucket, never splitting each row into its own.
 * The check is per row, so a file with sessions on only some rows degrades
 * row-by-row instead of all-or-nothing.
 */
export const pathKey = (problemName: string, sessionId: string | undefined | null): string => {
    const session = (sessionId ?? '').trim();
    if (!session || NON_SESSION_VALUES.has(session.toLowerCase())) return problemName;
    return `${problemName}${PATH_KEY_SEP}${session}`;
};

/**
 * Node name for the Done-button click, which the tutor logs with no Step Name.
 * Kept as the historical spelling so datasets that already have explicit
 * 'DoneButton' rows land on the same node rather than splitting in two.
 */
const DONE_BUTTON_STEP = 'DoneButton';

/**
 * Node name for a row whose step genuinely cannot be identified. Labelled rather
 * than silently folded into DoneButton, and deliberately not dropped: dropping
 * the row would splice its neighbours together and invent a transition that
 * never happened.
 */
const UNIDENTIFIED_STEP = '(no step name)';

/**
 * The node a row belongs to.
 *
 * `row['Step Name'] || 'DoneButton'` used to turn EVERY blank step name into a
 * DoneButton node, merging unrelated rows into one busy hub and overstating a
 * real UI element that some of those rows had nothing to do with. A blank Step
 * Name means DoneButton only when the row says so — Selection "Done Button" or
 * Action "Done", which is how the tutor logs that click. Every other blank is
 * reported as unidentified.
 */
const resolveStepName = (row: CSVRow): string => {
    const stepName = (row['Step Name'] || '').trim();
    if (stepName) return stepName;

    const selection = (row['Selection'] || '').replace(/\s+/g, '').toLowerCase();
    const action = (row['Action'] || '').trim().toLowerCase();
    if (selection === 'donebutton' || action === 'done') return DONE_BUTTON_STEP;

    return UNIDENTIFIED_STEP;
};

/**
 * Parses CSV data, resolves the node each row belongs to (see resolveStepName),
 * and sorts by student, problem and time.
 *
 * Ordering only has to be correct *inside* each (student, problem, session)
 * bucket, since that bucket is one path and consecutive rows in it become its
 * transitions. It is NOT guaranteed: a row whose `Time` cannot be parsed keeps
 * its file position (see parseTimestamp), so a path containing such rows may be
 * mis-sequenced and its transitions invented. That case is counted and warned
 * about rather than hidden — it is a data-quality property of the export, not
 * something this function can establish.
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

    // Rows whose step could not be identified at all — surfaced as a count so a
    // malformed or mis-mapped export is visible instead of quietly growing a
    // synthetic node.
    let unidentifiedSteps = 0;
    const transformedData = filteredData.map(row => {
        const stepName = resolveStepName(row);
        if (stepName === UNIDENTIFIED_STEP) unidentifiedSteps++;
        return {
            'Session Id': row['Session Id'],
            'Time': row['Time'],
            'Step Name': stepName,
            // Normalize the "correct" outcome key to CORRECT so it matches the
            // Okabe-Ito outcome palette used for edge/node coloring. The raw CSV
            // uses 'OK'; every downstream consumer keys on 'CORRECT'.
            'Outcome': row['Outcome'] === 'OK' ? 'CORRECT' : row['Outcome'],
            'CF (Workspace Progress Status)': row['CF (Workspace Progress Status)'],
            'Problem Name': row['Problem Name'],
            'Anon Student Id': row['Anon Student Id'],
            'CF (Is Autofilled)': (row as any)['CF (Is Autofilled)'],
            'Level (Workspace Id)': row['Level (Workspace Id)'],
            'Selection': row['Selection'],
            'Action': row['Action']
        };
    });

    if (unidentifiedSteps > 0) {
        console.warn(
            `loadAndSortData: ${unidentifiedSteps} of ${filteredData.length} rows have no Step Name and no `
            + `Done-button marker; they are grouped under "${UNIDENTIFIED_STEP}" rather than merged into `
            + `"${DONE_BUTTON_STEP}".`
        );
    }

    // `Time` arrives in several shapes across exports: epoch milliseconds as a
    // string ("1668670217694"), epoch seconds, an actual number (src/lib/types.ts
    // types it that way for one of the Mathia shapes), or a parseable date
    // string. `new Date(s).getTime()` is NaN for every epoch-number form — on the
    // sample export that was ALL 21,813 distinct values — and a NaN comparator
    // result gives Array.prototype.sort no ordering at all, so rows silently kept
    // their CSV order. That happened to be right for that file and is right for
    // no file by construction: order within a path decides every transition, so a
    // mis-sorted group invents all of them.
    const EPOCH_SECONDS_CEILING = 1e11; // ~1973-03 in ms; anything smaller is seconds
    const timeCache = new Map<string, number>();
    const parseTimestamp = (raw: unknown): number => {
        if (typeof raw === 'number') return Number.isFinite(raw) ? raw : NaN;
        if (typeof raw !== 'string') return NaN;
        const key = raw.trim();
        if (key === '') return NaN;
        if (!timeCache.has(key)) {
            let parsed: number;
            if (/^-?\d+$/.test(key)) {
                const n = Number(key);
                // Distinguish seconds from milliseconds by magnitude rather than
                // by digit count, which breaks either side of the year 2286.
                parsed = !Number.isFinite(n) ? NaN
                    : Math.abs(n) < EPOCH_SECONDS_CEILING ? n * 1000
                    : n;
            } else {
                parsed = new Date(key).getTime();
            }
            timeCache.set(key, parsed);
        }
        return timeCache.get(key)!;
    };

    const sorted = transformedData.sort((a, b) => {
        if (a['Anon Student Id'] === b['Anon Student Id']) {
            if (a['Problem Name'] === b['Problem Name']) {
                const ta = parseTimestamp(a['Time']);
                const tb = parseTimestamp(b['Time']);
                // Array.prototype.sort is stable, so returning 0 for an
                // unparseable pair preserves their original file order — the same
                // fallback as before, but now deliberate and reported rather than
                // an accident of NaN arithmetic.
                if (Number.isNaN(ta) || Number.isNaN(tb)) return 0;
                return ta - tb;
            }
            return (a['Problem Name'] ?? '').localeCompare(b['Problem Name'] ?? '');
        }
        return (a['Anon Student Id'] ?? '').localeCompare(b['Anon Student Id'] ?? '');
    });

    const unparseableTimes = transformedData.reduce(
        (n, row) => (Number.isNaN(parseTimestamp(row['Time'])) ? n + 1 : n),
        0
    );
    if (unparseableTimes > 0) {
        console.warn(
            `loadAndSortData: ${unparseableTimes} of ${transformedData.length} rows have an unparseable `
            + `Time; those rows keep their original file order, so any path containing them may be `
            + `mis-sequenced and its transitions invented.`
        );
    }

    return sorted;
};

/**
 * One student's paths, as parallel step and outcome arrays.
 * Shape for both: studentId -> pathKey -> string[].
 */
export interface PathSequences {
    stepSequences: { [student: string]: { [pathKey: string]: string[] } };
    outcomeSequences: { [student: string]: { [pathKey: string]: string[] } };
}

/**
 * Builds the step and outcome sequences for every path in one pass.
 *
 * The two arrays are read POSITIONALLY everywhere downstream — processStudentPaths
 * pairs `steps[i] -> steps[i + 1]` with `outcomes[i + 1]`, and
 * computeNodeOutcomeTallies attributes `outcomes[k]` to `steps[k]`. So they must
 * drop exactly the same rows. Building them separately made that a hand-kept
 * invariant: two functions each took a `selfLoops` flag that callers had to pass
 * identically, and any drift silently mis-attributed every outcome after the
 * first dropped row — wrong edge colors, wrong tooltip percentages, wrong node
 * outcome bars, with nothing to show the reader anything was off.
 *
 * Here there is one flag, one skip decision, and both arrays are appended inside
 * the same branch, so an inconsistent pair cannot be constructed. Returning both
 * also means a caller cannot forget one.
 *
 * Excludes autofilled rows (already filtered out by loadAndSortData).
 *
 * Self-loop collapsing keeps the FIRST row of a run of repeats — its step and its
 * outcome — matching the "first attempt" reading of unique-student mode.
 *
 * The top level is keyed by student so every population count downstream
 * (totalStudents, the "N students" captions, per-edge unique-student counts)
 * keeps counting DISTINCT STUDENTS; only path identity is session-scoped, via
 * pathKey().
 *
 * @param sortedData - The sorted CSV rows.
 * @param selfLoops - Include consecutive repeats of the same step.
 * @returns Both sequence maps, keyed identically.
 */
export const createSequences = (sortedData: CSVRow[], selfLoops: boolean): PathSequences => {
    const stepSequences: PathSequences['stepSequences'] = {};
    const outcomeSequences: PathSequences['outcomeSequences'] = {};

    for (const row of sortedData) {
        const studentId = row['Anon Student Id'];
        const key = pathKey(row['Problem Name'], row['Session Id']);

        if (!stepSequences[studentId]) stepSequences[studentId] = {};
        if (!outcomeSequences[studentId]) outcomeSequences[studentId] = {};
        if (!stepSequences[studentId][key]) stepSequences[studentId][key] = [];
        if (!outcomeSequences[studentId][key]) outcomeSequences[studentId][key] = [];

        const steps = stepSequences[studentId][key];
        const stepName = row['Step Name'];
        const isRepeat = steps.length > 0 && steps[steps.length - 1] === stepName;

        if (selfLoops || !isRepeat) {
            steps.push(stepName);
            outcomeSequences[studentId][key].push(row['Outcome']);
        }
    }

    return { stepSequences, outcomeSequences };
};

// ============================================================================
// SECTION 2: SEQUENCE ANALYSIS
// ============================================================================

/**
 * Finds the top N most frequent step sequences. One vote per path (one
 * student's attempt at one problem in one session), so a student who repeats the
 * same route on three separate attempts contributes three votes to it — the
 * frequency of a route through the content, not of a student.
 * @param stepSequences - The step sequences, studentId -> pathKey -> steps[].
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
 * Pre-calculates all valid student-path combinations to avoid nested object lookups.
 * Only includes paths with at least 2 steps (required for edge creation).
 *
 * @param stepSequences - Student step sequences by studentId -> pathKey -> steps[]
 * @param outcomeSequences - Student outcome sequences by studentId -> pathKey -> outcomes[]
 * @returns Array of pre-calculated combinations for efficient processing
 */
const prepareStudentProblemCombinations = (
    stepSequences: { [key: string]: { [key: string]: string[] } },
    outcomeSequences: { [key: string]: { [key: string]: string[] } }
): StudentProblemCombination[] => {
    const combinations: StudentProblemCombination[] = [];

    for (const [studentId, innerStepSequences] of Object.entries(stepSequences)) {
        const innerOutcomeSequences = outcomeSequences[studentId] || {};

        for (const [key, steps] of Object.entries(innerStepSequences)) {
            if (steps.length >= 2) {
                combinations.push({
                    studentId,
                    pathKey: key,
                    steps,
                    outcomes: innerOutcomeSequences[key] || []
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
    firstAttemptOutcomes: new Map<string, Map<string, number>>(),
    edgeErrorUsers: new Map<string, Set<string>>(),
    edgeErrorVisits: new Map<string, number>()
});

/**
 * Initializes tracking data structures for a new edge if they don't exist.
 * This lazy initialization pattern avoids creating empty structures for unused edges.
 *
 * @param edgeKey - The edge identifier (format: "sourceNode->targetNode")
 * @param currentStep - The source node of the edge
 * @param nextStep - The target node of the edge
 * @param maps - The tracking data structures
 */
const initializeEdgeTracking = (
    edgeKey: string,
    currentStep: string,
    nextStep: string,
    maps: EdgeTrackingMaps
): void => {
    if (!maps.studentEdgeCounts.has(edgeKey)) {
        maps.studentEdgeCounts.set(edgeKey, new Set());
        maps.totalVisits.set(edgeKey, 0);
        maps.repeatVisits.set(edgeKey, new Map());
        maps.edgeOutcomeCounts.set(edgeKey, new Map());
        maps.edgeErrorUsers.set(edgeKey, new Set());
        maps.edgeErrorVisits.set(edgeKey, 0);
    }

    // Both endpoints: totalNodeEdges is "students who VISITED this node", which
    // has to include the node a path arrives at, not only the one it leaves.
    if (!maps.totalNodeEdges.has(currentStep)) {
        maps.totalNodeEdges.set(currentStep, new Set());
    }
    if (!maps.totalNodeEdges.has(nextStep)) {
        maps.totalNodeEdges.set(nextStep, new Set());
    }
};

/**
 * Updates all tracking metrics for a single edge traversal by a student.
 * This includes student counts, visit counts, repeat visits, outcomes, and first attempts.
 *
 * @param edgeKey - The edge identifier (format: "sourceNode->targetNode")
 * @param currentStep - The source node of the edge
 * @param nextStep - The target node of the edge
 * @param studentId - The student making the traversal
 * @param outcome - The outcome of this step attempt
 * @param maps - The tracking data structures
 * @returns The updated maximum edge count across all edges
 */
const updateEdgeMetrics = (
    edgeKey: string,
    currentStep: string,
    nextStep: string,
    studentId: string,
    outcome: string,
    maps: EdgeTrackingMaps,
    currentMaxEdgeCount: number
): number => {
    maps.studentEdgeCounts.get(edgeKey)!.add(studentId);
    // Credit the student to BOTH endpoints. Recording only the source counted a
    // student at every node they left and at none they merely arrived at, so
    // "Students at X" was 0 for a terminal node (nothing leaves it) and the
    // ratioEdges denominator for a node whose visitors mostly stopped there was
    // far too small — inflating every transition probability out of it.
    maps.totalNodeEdges.get(currentStep)!.add(studentId);
    maps.totalNodeEdges.get(nextStep)!.add(studentId);

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

    // Remember this student once if they errored on the edge (used to size the
    // dashed red error overlay). Uses the same outcome attribution as the edge
    // outcome counts above, so the overlay stays consistent with edge color.
    if (outcome === 'ERROR') {
        maps.edgeErrorUsers.get(edgeKey)!.add(studentId);
        maps.edgeErrorVisits.set(edgeKey, (maps.edgeErrorVisits.get(edgeKey) || 0) + 1);
    }

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

            initializeEdgeTracking(edgeKey, currentStep, nextStep, maps);

            maxEdgeCount = updateEdgeMetrics(
                edgeKey,
                currentStep,
                nextStep,
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

    const edgeErrorVisitCountsObj: { [key: string]: number } = {};
    maps.edgeErrorVisits.forEach((count, edge) => {
        edgeErrorVisitCountsObj[edge] = count;
    });

    const edgeErrorStudentCountsObj: { [key: string]: number } = {};
    maps.edgeErrorUsers.forEach((students, edge) => {
        edgeErrorStudentCountsObj[edge] = students.size;
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
        edgeErrorStudentCounts: edgeErrorStudentCountsObj,
        edgeErrorVisitCounts: edgeErrorVisitCountsObj,
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
 * @param stepSequences - Student learning paths: studentId -> pathKey -> step[]
 * @param outcomeSequences - Student outcomes: studentId -> pathKey -> outcome[]
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
    edgeErrorStudentCounts: { [key: string]: number };
    edgeErrorVisitCounts: { [key: string]: number };
    nodeOutcomeCounts: { [node: string]: { [outcome: string]: number } };
    nodeFirstAttemptOutcomes: { [node: string]: { [outcome: string]: number } };
} => {
    const combinations = prepareStudentProblemCombinations(stepSequences, outcomeSequences);
    const trackingMaps = initializeTrackingMaps();
    const topSequences = getTopSequences(stepSequences, 5);
    const maxEdgeCount = processStudentPaths(combinations, trackingMaps);
    creditNodeVisitors(stepSequences, trackingMaps);
    const result = convertMapsToObjects(trackingMaps, maxEdgeCount, topSequences);
    const { all, firstAttempt } = computeNodeOutcomeTallies(stepSequences, outcomeSequences);

    return { ...result, nodeOutcomeCounts: all, nodeFirstAttemptOutcomes: firstAttempt };
};

/**
 * Credits every student to every node they visited, from the step sequences
 * directly rather than from traversed edges.
 *
 * Edge traversal alone misses a path of a single step: processStudentPaths only
 * sees paths of 2+ steps (they are the only ones that can form an edge), so a
 * student whose whole attempt was one step was counted nowhere. That was rare
 * while a path meant "everything a student ever did at a problem"; now that a
 * path is one attempt, one-step attempts are ordinary, and they were quietly
 * shrinking the "Students at X" total — and the ratioEdges denominator — for
 * exactly the entry nodes where such attempts land.
 *
 * This is the direct statement of what totalNodeEdges means: unique students who
 * visited the node. Nodes that appear in no drawn edge may end up in the map;
 * nothing renders them, since drawing iterates edges.
 */
const creditNodeVisitors = (
    stepSequences: { [key: string]: { [key: string]: string[] } },
    maps: EdgeTrackingMaps
): void => {
    for (const [studentId, paths] of Object.entries(stepSequences)) {
        for (const steps of Object.values(paths)) {
            for (const node of steps) {
                if (!maps.totalNodeEdges.has(node)) maps.totalNodeEdges.set(node, new Set());
                maps.totalNodeEdges.get(node)!.add(studentId);
            }
        }
    }
};

/**
 * Per-node outcome tallies, attributing each step's OWN outcome to that step's
 * node across every step in a path (including the first and last) — a node's
 * outcome mix, not its successors'. `all` counts every visit; `firstAttempt`
 * counts only each student's first visit to a given node.
 *
 * Index basis matches the edge counting (a transition steps[i]->steps[i+1] is
 * attributed outcomes[i+1], the outcome at the target step), so the outcome at
 * steps[k] is outcomes[k]. Unlike aggregating outgoing edges, this colors
 * terminal nodes (no outgoing edge) and start nodes (no incoming edge) alike.
 */
function computeNodeOutcomeTallies(
    stepSequences: { [key: string]: { [key: string]: string[] } },
    outcomeSequences: { [key: string]: { [key: string]: string[] } }
): {
    all: { [node: string]: { [outcome: string]: number } };
    firstAttempt: { [node: string]: { [outcome: string]: number } };
} {
    const all: { [node: string]: { [outcome: string]: number } } = {};
    const firstAttempt: { [node: string]: { [outcome: string]: number } } = {};

    for (const studentId of Object.keys(stepSequences)) {
        const problems = stepSequences[studentId];
        const outcomesByPath = outcomeSequences[studentId] || {};
        const seenNodes = new Set<string>(); // first-visit tracking, per student
        for (const key of Object.keys(problems)) {
            const steps = problems[key];
            const outcomes = outcomesByPath[key] || [];
            for (let i = 0; i < steps.length && i < outcomes.length; i++) {
                const node = steps[i];
                const outcome = outcomes[i];
                const allBucket = all[node] || (all[node] = {});
                allBucket[outcome] = (allBucket[outcome] || 0) + 1;
                if (!seenNodes.has(node)) {
                    seenNodes.add(node);
                    const faBucket = firstAttempt[node] || (firstAttempt[node] = {});
                    faBucket[outcome] = (faBucket[outcome] || 0) + 1;
                }
            }
        }
    }
    return { all, firstAttempt };
}

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
    edgeErrorStudentCounts: { [key: string]: number };
    edgeErrorVisitCounts: { [key: string]: number };
} => {
    const trackingMaps = initializeTrackingMaps();
    let maxEdgeCount = 0;

    // Canonicalize the sequence the same way the paths it is matched against are
    // canonicalized. A collapsed path can never contain a run that itself holds a
    // consecutive repeat, so matching a raw sequence against collapsed paths would
    // fail outright. Collapsing both makes the sequence's identity independent of
    // which self-loop state it was picked in - which is the point: repeating a
    // step in place does not change which path a student took.
    selectedSequence = collapseConsecutive(selectedSequence);

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

            Object.entries(problems).forEach(([key, rawSteps]) => {
                // Collapse the path (and its outcomes, together) before matching:
                // the selected sequence was chosen in one self-loop state and may
                // be matched against paths built in the other, and a raw compare
                // then silently fails to find a contained run. Outcomes are read
                // positionally below, so they must collapse in lockstep.
                const { steps, outcomes } = collapseStepsAndOutcomes(
                    rawSteps,
                    innerOutcomeSequences[key] || []
                );

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

                                initializeEdgeTracking(edgeKey, currentStep, nextStep, trackingMaps);

                                maxEdgeCount = updateEdgeMetrics(
                                    edgeKey,
                                    currentStep,
                                    nextStep,
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

            Object.entries(problems).forEach(([key, steps]) => {
                const outcomes = innerOutcomeSequences[key] || [];

                // For each edge in the selected sequence
                for (let seqIndex = 0; seqIndex < selectedSequence.length - 1; seqIndex++) {
                    const currentStep = selectedSequence[seqIndex];
                    const nextStep = selectedSequence[seqIndex + 1];
                    const edgeKey = `${currentStep}->${nextStep}`;

                    // Find ANY occurrence of this transition in the student's path
                    for (let i = 0; i < steps.length - 1; i++) {
                        if (steps[i] === currentStep && steps[i + 1] === nextStep) {
                            const outcome = outcomes[i + 1];

                            initializeEdgeTracking(edgeKey, currentStep, nextStep, trackingMaps);

                            maxEdgeCount = updateEdgeMetrics(
                                edgeKey,
                                currentStep,
                                nextStep,
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
 * Drop immediately-repeated steps: [A, A, B, A] -> [A, B, A].
 *
 * Step sequences keep or collapse consecutive repeats depending on the self-loop
 * toggle, so any comparison between two step arrays must normalize first or it
 * compares representations rather than paths. Declared as a hoisted `function`
 * so the sequence functions above can call it.
 */
export function collapseConsecutive(steps: string[]): string[] {
    return steps.filter((step, i) => i === 0 || step !== steps[i - 1]);
}

/**
 * The same collapse, applied to a step array and its outcome array together so
 * they stay index-aligned.
 *
 * Both sequence functions that consume outcomes read them positionally against
 * steps (`outcomes[i + 1]` is the outcome at the edge's target). Collapsing only
 * the steps would shift every later outcome onto the wrong transition — exactly
 * the defect createSequences was restructured to make impossible at build time.
 * This is the comparison-time equivalent, needed because a sequence selected in
 * one toggle state gets matched against paths built in the other.
 */
export function collapseStepsAndOutcomes(
    steps: string[],
    outcomes: string[]
): { steps: string[]; outcomes: string[] } {
    const collapsedSteps: string[] = [];
    const collapsedOutcomes: string[] = [];
    steps.forEach((step, i) => {
        if (i === 0 || step !== steps[i - 1]) {
            collapsedSteps.push(step);
            collapsedOutcomes.push(outcomes[i]);
        }
    });
    return { steps: collapsedSteps, outcomes: collapsedOutcomes };
}

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

/**
 * Deepest contiguous prefix of `selectedSequence` that appears anywhere in a
 * single student's step list. Returns { deepest, start } where `deepest` is the
 * matched length (K means the student completed edges 0..K-2) and `start` is the
 * path index where that match began (used to align outcomes).
 */
function deepestSequencePrefix(steps: string[], selectedSequence: string[]): { deepest: number; start: number } {
    const seqLen = selectedSequence.length;
    const n = steps.length;
    let deepest = 0;
    let bestStart = 0;
    for (let start = 0; start < n; start++) {
        if (steps[start] !== selectedSequence[0]) continue;
        let length = 1;
        while (start + length < n && length < seqLen && steps[start + length] === selectedSequence[length]) {
            length++;
        }
        if (length > deepest) {
            deepest = length;
            bestStart = start;
            if (deepest === seqLen) break;
        }
    }
    return { deepest, start: bestStart };
}

/**
 * Funnel-style edge counts along `selectedSequence`: for each edge
 * selected[i]->selected[i+1], the number of unique students whose journey
 * contains the contiguous prefix selected[0..i+1]. Counts are monotonically
 * non-increasing along the path (a later edge requires every earlier one).
 * Each student is counted once (deepest match across their problem sequences).
 * Mirrors compute_sequence_funnel_counts in the Streamlit version.
 */
export function computeSequenceFunnelCounts(
    stepSequences: { [key: string]: { [key: string]: string[] } },
    selectedSequence: string[]
): { [key: string]: number } {
    if (!selectedSequence || selectedSequence.length < 2) return {};
    // See countEdgesForSelectedSequence: both sides must collapse or the match
    // silently depends on the self-loop toggle.
    selectedSequence = collapseConsecutive(selectedSequence);
    const seqLen = selectedSequence.length;
    const counts = new Array(seqLen - 1).fill(0);

    for (const problems of Object.values(stepSequences)) {
        let studentDeepest = 0;
        for (const rawSteps of Object.values(problems)) {
            if (!rawSteps || rawSteps.length < 2) continue;
            const steps = collapseConsecutive(rawSteps);
            const { deepest } = deepestSequencePrefix(steps, selectedSequence);
            if (deepest > studentDeepest) studentDeepest = deepest;
        }
        for (let i = 0; i < Math.min(studentDeepest, seqLen) - 1; i++) counts[i]++;
    }

    const result: { [key: string]: number } = {};
    for (let i = 0; i < seqLen - 1; i++) {
        result[`${selectedSequence[i]}->${selectedSequence[i + 1]}`] = counts[i];
    }
    return result;
}

/**
 * Path-scoped error counts along `selectedSequence`: for each edge
 * selected[i]->selected[i+1], the number of unique students who errored at that
 * transition *while traversing the selected sequence*. Uses the same deepest-
 * contiguous-prefix match as the funnel, and the same outcome attribution as the
 * dataset-wide edge-error tally (the outcome recorded at the target index), so
 * the overlay reflects only students actually on the path. Each student counted
 * once. Mirrors compute_sequence_error_counts in the Streamlit version.
 */
export function computeSequenceErrorCounts(
    stepSequences: { [key: string]: { [key: string]: string[] } },
    outcomeSequences: { [key: string]: { [key: string]: string[] } },
    selectedSequence: string[]
): { [key: string]: number } {
    if (!selectedSequence || selectedSequence.length < 2) return {};
    // See countEdgesForSelectedSequence: both sides must collapse or the match
    // silently depends on the self-loop toggle.
    selectedSequence = collapseConsecutive(selectedSequence);
    const seqLen = selectedSequence.length;
    const counts = new Array(seqLen - 1).fill(0);

    for (const [studentId, problems] of Object.entries(stepSequences)) {
        const outProblems = outcomeSequences[studentId] || {};
        // Find this student's deepest match and where it started, so edges align
        // with their own outcomes.
        let bestDeepest = 0;
        let bestStart = 0;
        let bestOutcomes: string[] = [];
        for (const [key, rawSteps] of Object.entries(problems)) {
            if (!rawSteps || rawSteps.length < 2) continue;
            // Collapse steps and outcomes together: `bestStart + i` indexes
            // bestOutcomes against step positions, so a steps-only collapse
            // would shift every outcome onto the wrong transition.
            const { steps, outcomes } = collapseStepsAndOutcomes(rawSteps, outProblems[key] || []);
            const { deepest, start } = deepestSequencePrefix(steps, selectedSequence);
            if (deepest > bestDeepest) {
                bestDeepest = deepest;
                bestStart = start;
                bestOutcomes = outcomes;
            }
        }
        for (let i = 0; i < Math.min(bestDeepest, seqLen) - 1; i++) {
            const pos = bestStart + i;
            // Edge outcome is attributed to the target index (pos + 1), matching
            // the dataset-wide edgeErrorStudentCounts tally.
            if (pos + 1 < bestOutcomes.length && bestOutcomes[pos + 1] === 'ERROR') counts[i]++;
        }
    }

    const result: { [key: string]: number } = {};
    for (let i = 0; i < seqLen - 1; i++) {
        result[`${selectedSequence[i]}->${selectedSequence[i + 1]}`] = counts[i];
    }
    return result;
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
 * Highest edge-count threshold at which the graph still forms a single
 * connected component, floored at 1. Used to cap a per-graph min-visits slider
 * so the user can't raise the threshold high enough to fragment the graph.
 *
 * Mirrors the `effective_max` computation in the Streamlit tool: thresholds are
 * tested high→low and only the nodes that still appear in a surviving edge must
 * remain reachable (an undirected BFS). This differs from
 * calculateMaxMinEdgeCount, which requires every original node to stay
 * connected and also pins the selected sequence — that is intentionally
 * stricter and would cap the slider much lower.
 */
export function calculateConnectivityCap(countsToUse: { [key: string]: number }): number {
    const positiveCounts = Object.values(countsToUse).filter(count => count > 0);
    if (positiveCounts.length === 0) return 1;

    const uniqueCounts = [...new Set(positiveCounts)].sort((a, b) => b - a);

    for (const threshold of uniqueCounts) {
        // Surviving subgraph at this threshold, as an undirected adjacency list.
        const nodes = new Set<string>();
        const adjacency = new Map<string, Set<string>>();

        Object.entries(countsToUse).forEach(([edge, count]) => {
            if (count < threshold) return;
            const [from, to] = edge.split('->');
            if (!from || !to) return;
            nodes.add(from);
            nodes.add(to);
            if (!adjacency.has(from)) adjacency.set(from, new Set());
            if (!adjacency.has(to)) adjacency.set(to, new Set());
            adjacency.get(from)!.add(to);
            adjacency.get(to)!.add(from);
        });

        if (nodes.size === 0) continue;

        // BFS from an arbitrary surviving node; the subgraph is connected iff we
        // reach every surviving node.
        const start = nodes.values().next().value as string;
        const visited = new Set<string>([start]);
        const queue = [start];
        while (queue.length > 0) {
            const node = queue.shift()!;
            adjacency.get(node)?.forEach(neighbor => {
                if (!visited.has(neighbor)) {
                    visited.add(neighbor);
                    queue.push(neighbor);
                }
            });
        }

        if (visited.size === nodes.size) {
            return Math.max(1, threshold);
        }
    }

    return 1;
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
    const minThickness = 1;

    // Linear scaling (count / maxEdgeCount * maxThickness), floored at 1 —
    // matches the Streamlit version so the two tools produce identical edge
    // weights. (Previously sqrt-scaled, which compressed high-traffic edges.)
    Object.keys(edgeCounts).forEach((edge) => {
        const count = edgeCounts[edge];
        let thickness = maxEdgeCount > 0 ? (count / maxEdgeCount) * maxThickness : minThickness;
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
// Fill for a node that is not part of the selected sequence.
export const NON_SEQUENCE_NODE_COLOR = '#CCCCCC';

export function calculateColor(rank: number, totalSteps: number): string {
    // Interpolation factor across the sequence: position 0 (start) = white,
    // last position = full blue. Spread over (length - 1) so both endpoints are
    // reached exactly (matches the Streamlit implementation).
    const ratio = totalSteps > 1 ? rank / (totalSteps - 1) : 1;

    const white = {r: 255, g: 255, b: 255};
    const lightBlue = {r: 28, g: 176, b: 255}; // #1cb0ff

    const r = Math.round(white.r * (1 - ratio) + lightBlue.r * ratio);
    const g = Math.round(white.g * (1 - ratio) + lightBlue.g * ratio);
    const b = Math.round(white.b * (1 - ratio) + lightBlue.b * ratio);

    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// ============================================================================
// EDGE COLORING — Okabe-Ito colorblind-safe palette (matches Streamlit version)
// ============================================================================

// Alpha suffix on the dominant-outcome edge color so overlapping/parallel edges
// stay legible where they cross. 0x99 ≈ 60% opacity.
const EDGE_FILL_ALPHA = '99';
// Neutral "flow only" edge color used when an edge has no recognized outcome,
// so an edge is never invisible. Carries its own alpha.
const FLOW_EDGE_COLOR = '#5f6368cc';

// Okabe-Ito outcome palette — single source of truth for edge coloring and the
// legend. CVD-distinguishable (WCAG 1.4.1).
export const OUTCOME_COLORS: { [outcome: string]: string } = {
    'CORRECT': '#009E73',            // bluish green
    'ERROR': '#D55E00',              // vermilion
    'INITIAL_HINT': '#56B4E9',       // sky blue
    'HINT_LEVEL_CHANGE': '#56B4E9',
    'JIT': '#E69F00',                // orange
    'FREEBIE_JIT': '#E69F00',
};

// Stable tie-break order when two outcomes are equally common. Also the
// left-to-right stripe order for node-outcome-mode 100%-bar fills.
const OUTCOME_STRIPE_ORDER = [
    'CORRECT', 'ERROR', 'INITIAL_HINT', 'HINT_LEVEL_CHANGE', 'JIT', 'FREEBIE_JIT'
];

// Node-outcome-mode palette/borders. Each node is a two-row box: the step name
// on a white row, with a 100%-bar of its outcome mix as a strip beneath.
// Outcomes outside the palette collapse into one neutral "other" segment; nodes
// with no outcomes get a neutral strip. Sequence membership is marked with a
// bold black border; off-sequence nodes get a thin light-gray border.
const OUTCOME_OTHER_COLOR = '#999999';
const NODE_NO_OUTCOME_COLOR = '#EEEEEE';
// Node-mode stripe fills use a lighter tint of the palette green. A node's
// 100%-bar is a large filled area, where the darker Okabe-Ito green reads much
// heavier than the same value drawn as a thin edge; the line palette keeps the
// darker value because an edge has to clear 3:1 against white (WCAG 1.4.11),
// and black node labels stay well above 4.5:1 on the lighter tint.
const NODE_FILL_CORRECT_COLOR = '#59C0A4';
export const NODE_FILL_COLORS: { [outcome: string]: string } = {
    ...OUTCOME_COLORS,
    'CORRECT': NODE_FILL_CORRECT_COLOR,
};
const NODE_BORDER_COLOR = '#bbbbbb';
const SEQ_BORDER_COLOR = '#000000';
const SEQ_BORDER_PENWIDTH = 2;

/**
 * Color for an edge: its single most common recognized outcome, as a discrete
 * palette color (plus alpha). An RGB blend of several outcomes produces muddy
 * hues that match no legend entry; picking the dominant outcome keeps every
 * edge on a validated palette anchor. Ties break by canonical stripe order.
 * Returns the neutral flow color when no recognized outcome is present.
 */
function dominantOutcomeColor(outcomes: { [outcome: string]: number }): string {
    const recognized = Object.entries(outcomes).filter(
        ([outcome, count]) => OUTCOME_COLORS[outcome] && count > 0
    );
    if (recognized.length === 0) return FLOW_EDGE_COLOR;

    const stripeRank = (name: string): number => {
        const i = OUTCOME_STRIPE_ORDER.indexOf(name);
        return i === -1 ? OUTCOME_STRIPE_ORDER.length : i;
    };

    let best = recognized[0];
    for (const cur of recognized) {
        if (cur[1] > best[1] || (cur[1] === best[1] && stripeRank(cur[0]) < stripeRank(best[0]))) {
            best = cur;
        }
    }
    return `${OUTCOME_COLORS[best[0]]}${EDGE_FILL_ALPHA}`;
}

/**
 * Strip the alpha byte off a `#RRGGBBAA` color, leaving other forms alone.
 *
 * Full opacity is how a selected-sequence edge is emphasized in the full graphs:
 * it keeps the edge's own hue (the outcome color, or the neutral flow gray) and —
 * unlike widening the line — leaves penwidth free to mean what it always means,
 * the number of students on that transition.
 */
function opaqueColor(color: string): string {
    return color.startsWith('#') && color.length === 9 ? color.slice(0, -2) : color;
}

// Legend rows as [label, outcome key]; a null key is the "other" bucket. Both
// legends below derive from these rows so a label can never pick up a color the
// graph doesn't actually draw — the two modes differ in both the green (node
// bars use the lighter tint) and the "other" color (an unrecognized outcome
// makes an edge neutral flow gray, but a node bar a plain gray segment).
const LEGEND_ROWS: Array<[string, string | null]> = [
    ['Correct', 'CORRECT'],
    ['Error', 'ERROR'],
    ['Hint (Initial / Level Change)', 'INITIAL_HINT'],
    ['JIT / Freebie JIT', 'JIT'],
    ['Other / no recognized outcome', null],
];
/** Legend swatches for edge coloring (the Okabe-Ito line palette). */
export const OUTCOME_LEGEND: Array<[string, string]> = LEGEND_ROWS.map(
    ([label, key]) => [label, key ? OUTCOME_COLORS[key] : opaqueColor(FLOW_EDGE_COLOR)]
);
/** Same rows, but with the colors node mode actually fills its bars with. */
export const NODE_FILL_LEGEND: Array<[string, string]> = LEGEND_ROWS.map(
    ([label, key]) => [label, key ? NODE_FILL_COLORS[key] : OUTCOME_OTHER_COLOR]
);

/**
 * Color for a solid edge.
 * - dashedError (the edge is itself a dashed red error arrow — a fully-error
 *   edge or an error self-loop): error red, so a dashed edge is never green.
 * - Error-arrow mode otherwise: the error share is carried by a separate dashed
 *   overlay, so the solid edge is colored by its dominant NON-error outcome.
 * - Plain mode: the dominant outcome.
 */
function solidEdgeColor(
    outcomes: { [outcome: string]: number },
    errorMode: boolean,
    dashedError: boolean
): string {
    if (dashedError) return OUTCOME_COLORS['ERROR'];
    const considered = errorMode
        ? Object.fromEntries(Object.entries(outcomes).filter(([k]) => k !== 'ERROR'))
        : outcomes;
    return dominantOutcomeColor(considered);
}

/**
 * Ordered, color-merged outcome segments for a node's 100%-bar. Outcomes that
 * share a hue collapse into one segment (INITIAL_HINT + HINT_LEVEL_CHANGE → one
 * blue; JIT + FREEBIE_JIT → one orange); anything off-palette becomes a single
 * neutral "other" segment. Map insertion order preserves the canonical stripe
 * order from OUTCOME_STRIPE_ORDER.
 */
function outcomeSegments(outcomes: { [outcome: string]: number }): Array<[string, number]> {
    const total = Object.values(outcomes).reduce((sum, n) => sum + n, 0);
    if (total <= 0) return [];
    const colorCounts = new Map<string, number>();
    let accounted = 0;
    for (const key of OUTCOME_STRIPE_ORDER) {
        const count = outcomes[key] || 0;
        if (count > 0) {
            const color = NODE_FILL_COLORS[key];
            colorCounts.set(color, (colorCounts.get(color) || 0) + count);
            accounted += count;
        }
    }
    const other = total - accounted;
    if (other > 0) colorCounts.set(OUTCOME_OTHER_COLOR, (colorCounts.get(OUTCOME_OTHER_COLOR) || 0) + other);
    return Array.from(colorCounts.entries());
}

/** Minimal HTML-entity escaping for text placed inside an HTML-like label. */
function escapeHtmlLabel(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Total width (points) of a node's outcome bar strip.
const NODE_BAR_WIDTH = 130;

/**
 * Two-row node for node-outcome mode, as a Graphviz HTML-like label: the step
 * name on its own (white) row, with the outcome 100%-bar as a strip of
 * proportional colored cells beneath it. Keeps the whole outcome mix visible
 * without a colored stripe crossing the (often long) node name. Returns the
 * full attribute fragment (shape/style/border/label); callers append a bold
 * border to mark sequence membership (later color/penwidth win in Graphviz).
 */
function nodeOutcomeBarAttrs(nodeName: string, outcomes: { [outcome: string]: number }): string {
    const name = escapeHtmlLabel(nodeName);
    const segments = outcomeSegments(outcomes);
    const total = segments.reduce((sum, [, count]) => sum + count, 0);

    let label: string;
    if (segments.length === 0 || total <= 0) {
        // No outcomes: name over a single neutral strip.
        label = `<<TABLE BORDER="0" CELLBORDER="0" CELLSPACING="0" CELLPADDING="3">`
            + `<TR><TD>${name}</TD></TR>`
            + `<TR><TD FIXEDSIZE="TRUE" WIDTH="${NODE_BAR_WIDTH}" HEIGHT="12" BGCOLOR="${NODE_NO_OUTCOME_COLOR}"></TD></TR>`
            + `</TABLE>>`;
    } else {
        // Proportional cell widths, each ≥2pt so small shares stay visible.
        const cells = segments.map(([color, count]) => {
            const w = Math.max(2, Math.round((count / total) * NODE_BAR_WIDTH));
            return `<TD FIXEDSIZE="TRUE" WIDTH="${w}" HEIGHT="12" BGCOLOR="${color}"></TD>`;
        }).join('');
        label = `<<TABLE BORDER="0" CELLBORDER="0" CELLSPACING="0" CELLPADDING="3">`
            + `<TR><TD COLSPAN="${segments.length}">${name}</TD></TR>`
            + `<TR>${cells}</TR>`
            + `</TABLE>>`;
    }

    return `shape=box, style=filled, fillcolor="white", color="${NODE_BORDER_COLOR}", label=${label}`;
}

/**
 * Emit a parallel dashed red overlay edge whose thickness encodes how many
 * unique students hit an error on this transition. Returns '' when there are no
 * error students or the edge is a self-loop (a parallel dashed self-loop would
 * stack a confusing second loop). The overlay is constrained (no constraint=false)
 * so it bundles tightly against its solid partner instead of wandering.
 */
function formatErrorOverlay(
    source: string,
    target: string,
    errorStudents: number,
    edgeStudents: number,
    maxEdgeCount: number
): string {
    if (errorStudents <= 0 || maxEdgeCount <= 0 || source === target) return '';
    const overlayThickness = Math.max(0.5, (errorStudents / maxEdgeCount) * 10);
    const errorRate = edgeStudents ? (errorStudents / edgeStudents) * 100 : 0;
    const tooltip = `${source} → ${target}\nError students: ${errorStudents.toLocaleString()}\n`
        + `Error rate: ${errorRate.toFixed(1)}%`;
    return `    "${source}" -> "${target}" [style=dashed, color="${OUTCOME_COLORS['ERROR']}cc", `
        + `penwidth=${overlayThickness.toFixed(1)}, tooltip="${tooltip}"];\n`;
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
    return `Rank:\n\t\t${rank + 1}\nColor:\n\t\t${color}\nTotal Students:\n\t\t${studentCount.toLocaleString()}`;
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
    // `totalCount` is a unique-student set size (totalNodeEdges) in both modes,
    // so it is always a student count — labelling it "visits" was simply wrong.
    const startLabel = `Students at ${currentStep}`;

    const pathCount = uniqueStudentMode ? edgeCount : visits;
    const totalAtStart = totalCount;
    const ratioPercentage = ((ratioEdges[edgeKey] || 0) * 100).toFixed(1);

    let tooltip = `${modeLabel} Flow:\n`
        + `    • ${pathLabel}: ${pathCount.toLocaleString()}\n`
        + `    • ${startLabel}: ${totalAtStart.toLocaleString()}\n`;

    // Only in unique-student mode do these two share a unit and so admit
    // subtraction. Edge students are a subset of the node's students, so the
    // remainder is "left this node but never by this edge" — NOT "took one
    // other edge instead". A student can sit on several outgoing edges of the
    // same node (a separate problem, or a revisit), which is also why the
    // outgoing counts from one node can sum past the node's own total and the
    // transition probabilities can sum past 100%.
    if (uniqueStudentMode) {
        const neverTookPath = Math.max(0, totalAtStart - pathCount);
        tooltip += `    • Students who never took this path: ${neverTookPath.toLocaleString()}\n`;
    }

    // NOT a transition probability, which is what this used to be called. A
    // probability implies the outgoing shares of one step partition its
    // students; they do not. The numerator is students who used this edge in ANY
    // path, the denominator students who visited this step in ANY path, so a
    // student who reaches this step in several paths — a different problem, a
    // different session, or a revisit within one path — is counted on every
    // successor they ever used and once in the denominator. Measured on the
    // sample export, one step's outgoing shares total ~430%. Each share is still
    // individually true, so state it as a share of the step's students rather
    // than as a probability, and say plainly that they need not sum to 100%.
    tooltip += `    • Used by ${ratioPercentage}% of students who reached ${currentStep}\n`;
    // ratioEdges is always students/students. In visits mode no unique-student
    // numerator survives this far (both `edgeCount` and `visits` arrive as
    // totalVisits), so spelling out the fraction would pair a visit count with
    // a student denominator. Show it only where it is truthful.
    if (uniqueStudentMode) {
        tooltip += `      (${pathCount.toLocaleString()} of ${totalAtStart.toLocaleString()} students)\n`;
    }
    tooltip += `      Shares out of one step can total over 100%: a student who\n`
        + `      reaches it more than once is counted on each route they took.\n`;
    tooltip += '\n';

    if (progressStats) {
        const graduatedPercentage = progressStats.total > 0 ? ((progressStats.graduated / progressStats.total) * 100).toFixed(1) : '0';
        const promotedPercentage = progressStats.total > 0 ? ((progressStats.promoted / progressStats.total) * 100).toFixed(1) : '0';
        const otherPercentage = progressStats.total > 0 ? ((progressStats.other / progressStats.total) * 100).toFixed(1) : '0.0';

        tooltip += `Student Progress Status:\n`
            + `    • Graduated: ${progressStats.graduated.toLocaleString()} (${graduatedPercentage}%)\n`
            + `    • Promoted: ${progressStats.promoted.toLocaleString()} (${promotedPercentage}%)\n`
            + `    • Other: ${progressStats.other.toLocaleString()} (${otherPercentage}%)\n`
            + `    • Total students tracked: ${progressStats.total.toLocaleString()}\n\n`;
    }

    const totalOutcomes = Object.values(outcomes).reduce((sum, count) => sum + count, 0);
    const allOutcomes = Object.entries(outcomes)
        .sort(([,a], [,b]) => b - a)
        .map(([outcome, count]) => {
            const percentage = totalOutcomes > 0 ? ((count / totalOutcomes) * 100).toFixed(1) : '0';
            return `${outcome}: ${count.toLocaleString()} (${percentage}%)`;
        })
        .join('\n      ');

    const totalFirstAttempts = Object.values(firstAttempts).reduce((sum, count) => sum + count, 0);
    const firstAttemptOutcomes = Object.entries(firstAttempts)
        .sort(([,a], [,b]) => b - a)
        .map(([outcome, count]) => {
            const percentage = totalFirstAttempts > 0 ? ((count / totalFirstAttempts) * 100).toFixed(1) : '0';
            return `${outcome}: ${count.toLocaleString()} (${percentage}%)`;
        })
        .join('\n      ');

    tooltip += `Transition Outcomes:\n`
        + `    • All Outcomes:\n`
        + `      ${allOutcomes || 'No outcome data'}\n\n`
        + `    • First Attempt Outcomes:\n`
        + `      ${firstAttemptOutcomes || 'No first attempt data'}\n\n`
        + `Visual Properties:\n`
        + `    • Edge Thickness: ${normalizedThickness.toFixed(1)} (normalized)\n`
        + `    • Path Frequency: ${pathCount.toLocaleString()} ${modeLabel.toLowerCase()}\n`
        + `    • Min ${modeLabel} Threshold: ${minVisits.toLocaleString()}`;

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
    _normalizedThicknesses: { [key: string]: number },
    edgeOutcomeCounts: { [key: string]: { [outcome: string]: number } },
    firstAttemptOutcomes: { [key: string]: { [outcome: string]: number } },
    edgeCounts: { [key: string]: number },
    totalVisits: { [key: string]: number },
    totalNodeEdges: { [key: string]: number },
    ratioEdges: { [key: string]: number },
    repeatVisits: { [key: string]: { [studentId: string]: number } },
    minVisits: number,
    errorMode: boolean,
    maxEdgeCount: number,
    edgeErrorStudentCounts: { [key: string]: number },
    uniqueStudentMode: boolean = false,
    colorNodesBySequence: boolean = true,
    sequenceFunnelCounts: { [key: string]: number } | null = null,
    sequenceErrorCounts: { [key: string]: number } | null = null,
    nodeOutcomeMode: boolean = false,
    nodeOutcomeCounts: { [node: string]: { [outcome: string]: number } } = {},
    showEdgeLabels: boolean = true
): string => {
    let dotContent = '';
    const totalSteps = selectedSequence.length;
    const funnelOn = sequenceFunnelCounts !== null;
    // In node-outcome mode the outcome signal lives on the nodes (striped
    // 100%-bars) and edges are neutral flow lines — so error overlays/coloring
    // are suppressed. nodeOutcomeCounts is a per-node outcome mix (each step's
    // own outcome), passed in so terminal nodes are colored too.
    const effErrorMode = errorMode && !nodeOutcomeMode;

    for (let rank = 0; rank < totalSteps; rank++) {
        const currentStep = selectedSequence[rank];
        const color = colorNodesBySequence ? calculateColor(rank, totalSteps) : '#ffffff';
        // With the funnel on, a node shows the funnel of the edge leaving it
        // (students still on the path here) so node counts line up with the edge
        // values rather than the dataset-wide unique-student total.
        let studentCount = totalNodeEdges[currentStep] || 0;
        if (funnelOn && totalSteps > 1) {
            const fk = rank < totalSteps - 1
                ? `${selectedSequence[rank]}->${selectedSequence[rank + 1]}`
                : `${selectedSequence[rank - 1]}->${selectedSequence[rank]}`;
            studentCount = sequenceFunnelCounts![fk] ?? (totalNodeEdges[currentStep] || 0);
        }
        if (nodeOutcomeMode) {
            // Two-row node: step name over its outcome 100%-bar. Every node here
            // is on the selected sequence, so all get the bold sequence border.
            const fillAttrs = nodeOutcomeBarAttrs(currentStep, nodeOutcomeCounts[currentStep] || {});
            const nodeTooltip = createNodeTooltip(rank, 'Outcome mix', studentCount);
            dotContent += `    "${currentStep}" [rank=${rank + 1}, ${fillAttrs}, color="${SEQ_BORDER_COLOR}", penwidth=${SEQ_BORDER_PENWIDTH}, tooltip="${nodeTooltip}"];\n`;
        } else {
            const nodeTooltip = createNodeTooltip(rank, color, studentCount);
            dotContent += `    "${currentStep}" [rank=${rank + 1}, style=filled, fillcolor="${color}", tooltip="${nodeTooltip}"];\n`;
        }

        if (rank < totalSteps - 1) {
            const nextStep = selectedSequence[rank + 1];
            const edgeKey = `${currentStep}->${nextStep}`;
            const outcomes = edgeOutcomeCounts[edgeKey] || {};
            const firstAttempts = firstAttemptOutcomes[edgeKey] || {};
            const rawEdgeCount = edgeCounts[edgeKey] || 0;
            const visits = totalVisits[edgeKey] || 0;
            const visitsForFiltering = uniqueStudentMode ? rawEdgeCount : visits;
            const totalCount = totalNodeEdges[currentStep] || 0;

            if (visitsForFiltering >= minVisits) {
                // Displayed count is the funnel value (monotonic along the path)
                // when supplied, else the unique-students-per-edge count.
                const displayCount = funnelOn
                    ? (sequenceFunnelCounts![edgeKey] ?? rawEdgeCount)
                    : rawEdgeCount;

                // Error-arrow rendering: a fully-error edge (or error self-loop)
                // becomes the dashed red arrow itself; a partial-error edge keeps
                // the neutral edge (sized by non-error count) plus a dashed
                // overlay for the error share. Error counts are path-scoped when
                // sequenceErrorCounts is supplied.
                const isSelfLoop = currentStep === nextStep;
                const err = effErrorMode
                    ? (sequenceErrorCounts ? (sequenceErrorCounts[edgeKey] || 0) : (edgeErrorStudentCounts[edgeKey] || 0))
                    : 0;
                // Path total on this edge is the error-rate denominator and the
                // fully-error test, so both stay path-scoped when the funnel is on.
                const edgeTotal = funnelOn ? (sequenceFunnelCounts![edgeKey] ?? rawEdgeCount) : rawEdgeCount;
                const fullError = err > 0 && err >= edgeTotal;
                const dashedError = err > 0 && (fullError || isSelfLoop);
                const solidCount = (err > 0 && err < edgeTotal && !dashedError) ? displayCount - err : displayCount;
                // Node mode: edges are neutral flow lines (outcome lives on nodes).
                const edgeColor = nodeOutcomeMode ? FLOW_EDGE_COLOR : solidEdgeColor(outcomes, effErrorMode, dashedError);

                // Width encodes students per transition and nothing else — this
                // view is entirely the selected sequence, so there is no
                // off-sequence edge here to emphasize against.
                const thickness = maxEdgeCount > 0 ? Math.max(1, (solidCount / maxEdgeCount) * 10) : 1;

                const tooltip = createEdgeTooltip(
                    currentStep, nextStep, edgeKey, displayCount, totalCount, visits,
                    ratioEdges, outcomes, firstAttempts, repeatVisits, edgeColor,
                    thickness, minVisits, uniqueStudentMode
                );

                const styleAttr = dashedError ? ', style=dashed' : '';
                // Leading spaces nudge the count off the vertical edge line.
                const labelAttr = showEdgeLabels ? `, label="   ${displayCount.toLocaleString()}"` : '';
                dotContent += `    "${currentStep}" -> "${nextStep}" [penwidth=${thickness.toFixed(1)}, color="${edgeColor}", tooltip="${tooltip}"${labelAttr}${styleAttr}];\n`;

                if (err > 0 && !fullError && !isSelfLoop) {
                    dotContent += formatErrorOverlay(currentStep, nextStep, err, edgeTotal, maxEdgeCount);
                }
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
 * @param showEdgeLabels - If true, label each node's busiest outgoing edge with
 *   its count. Unlike the Selected Sequence graph (which labels every edge on
 *   its single linear path), the full graphs label one edge per node to stay
 *   readable at network density.
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
    maxEdgeCount: number,
    edgeErrorStudentCounts: { [key: string]: number },
    uniqueStudentMode: boolean = false,
    colorNodesBySequence: boolean = true,
    nodeOutcomeMode: boolean = false,
    nodeOutcomeCounts: { [node: string]: { [outcome: string]: number } } = {},
    showEdgeLabels: boolean = true
): string => {
    let dotContent = '';
    const totalSteps = selectedSequence.length;
    // Node-outcome mode: outcome signal on nodes (per-node striped 100%-bars),
    // edges neutral, error overlays/coloring suppressed.
    const effErrorMode = errorMode && !nodeOutcomeMode;

    // Edges that belong to the selected sequence — emphasized (thicker) when
    // highlighting is enabled.
    const seqEdges = new Set<string>();
    if (selectedSequence.length > 1) {
        for (let i = 0; i < selectedSequence.length - 1; i++) {
            seqEdges.add(`${selectedSequence[i]}->${selectedSequence[i + 1]}`);
        }
    }

    const allNodesInEdges = new Set<string>();
    // The busiest outgoing edge per source node — the only edges that carry a
    // count label on the full graphs. Labelling every edge here is unreadable
    // (unlike the Selected Sequence graph, which is a single linear path), so
    // one label per node answers "what did most students do next from here"
    // while keeping the labels spread out instead of clustered in hot regions.
    const busiestOutgoing: { [source: string]: { key: string; target: string; count: number } } = {};

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

                    // Ranked over edges that pass both gates, so raising
                    // min-visits promotes the next-heaviest survivor rather than
                    // leaving the node unlabelled. Ties break on target name to
                    // keep the choice stable across renders (Object.keys order
                    // is insertion order, which shifts with the data).
                    const best = busiestOutgoing[currentStep];
                    if (!best
                        || visitsForFiltering > best.count
                        || (visitsForFiltering === best.count && nextStep < best.target)) {
                        busiestOutgoing[currentStep] = {
                            key: edgeKey,
                            target: nextStep,
                            count: visitsForFiltering
                        };
                    }
                }
            }
        }
    }

    const labelledEdges = new Set(Object.values(busiestOutgoing).map(best => best.key));

    for (const nodeName of allNodesInEdges) {
        const sequenceRank = selectedSequence.indexOf(nodeName);
        // Nodes on the selected sequence get the white→blue gradient (when
        // highlighting is on); everything else is neutral gray.
        const color = (colorNodesBySequence && sequenceRank >= 0)
            ? calculateColor(sequenceRank, totalSteps)
            : NON_SEQUENCE_NODE_COLOR;
        const rank = sequenceRank >= 0 ? sequenceRank + 1 : 0;
        const studentCount = totalNodeEdges[nodeName] || 0;

        if (nodeOutcomeMode) {
            // Two-row node: step name over its outcome 100%-bar. Sequence members
            // (when highlighting is on) get the bold border, else thin gray.
            const fillAttrs = nodeOutcomeBarAttrs(nodeName, nodeOutcomeCounts[nodeName] || {});
            const onSeq = colorNodesBySequence && sequenceRank >= 0;
            const border = onSeq ? `, color="${SEQ_BORDER_COLOR}", penwidth=${SEQ_BORDER_PENWIDTH}` : '';
            const nodeTooltip = createNodeTooltip(sequenceRank, 'Outcome mix', studentCount);
            dotContent += `    "${nodeName}" [rank=${rank}, ${fillAttrs}${border}, tooltip="${nodeTooltip}"];\n`;
        } else {
            const nodeTooltip = createNodeTooltip(sequenceRank, color, studentCount);
            dotContent += `    "${nodeName}" [rank=${rank}, style=filled, fillcolor="${color}", tooltip="${nodeTooltip}"];\n`;
        }
    }

    for (const edgeKey of Object.keys(normalizedThicknesses)) {
        const gateThickness = normalizedThicknesses[edgeKey];

        if (gateThickness >= threshold) {
            const [currentStep, nextStep] = edgeKey.split('->');
            const outcomes = edgeOutcomeCounts[edgeKey] || {};
            const firstAttempts = firstAttemptOutcomes[edgeKey] || {};
            const edgeCount = edgeCounts[edgeKey] || 0;
            const visits = totalVisits[edgeKey] || 0;
            const visitsForFiltering = uniqueStudentMode ? edgeCount : visits;
            const totalCount = totalNodeEdges[currentStep] || 0;

            if (visitsForFiltering >= minVisits) {
                // Error-arrow rendering: fully-error edge (or error self-loop)
                // becomes the dashed red arrow; a partial-error edge keeps the
                // neutral edge (sized by non-error count) + a dashed overlay.
                const isSelfLoop = currentStep === nextStep;
                const err = effErrorMode ? (edgeErrorStudentCounts[edgeKey] || 0) : 0;
                const fullError = err > 0 && err >= edgeCount;
                const dashedError = err > 0 && (fullError || isSelfLoop);
                const solidCount = (err > 0 && err < edgeCount && !dashedError) ? edgeCount - err : edgeCount;
                // Node mode: edges are neutral flow lines (outcome lives on nodes).
                let edgeColor = nodeOutcomeMode ? FLOW_EDGE_COLOR : solidEdgeColor(outcomes, effErrorMode, dashedError);

                const thickness = maxEdgeCount > 0 ? Math.max(1, (solidCount / maxEdgeCount) * 10) : 1;
                // Emphasize selected-sequence edges by drawing them at full
                // opacity. Width is left alone deliberately: it encodes students
                // per transition, so nudging it for emphasis would make a marked
                // edge look busier than an off-sequence edge carrying more
                // students.
                if (seqEdges.has(edgeKey) && colorNodesBySequence) edgeColor = opaqueColor(edgeColor);

                const tooltip = createEdgeTooltip(
                    currentStep, nextStep, edgeKey, edgeCount, totalCount, visits,
                    ratioEdges, outcomes, firstAttempts, repeatVisits, edgeColor,
                    thickness, minVisits, uniqueStudentMode
                );

                const styleAttr = dashedError ? ', style=dashed' : '';
                // Only the heaviest edge leaving this node is labelled; the
                // dashed error overlays stay bare so a partial-error edge does
                // not end up with two competing numbers on it.
                // Leading spaces nudge the count off the edge line.
                const labelAttr = (showEdgeLabels && labelledEdges.has(edgeKey))
                    ? `, label="   ${visitsForFiltering.toLocaleString()}"`
                    : '';
                dotContent += `    "${currentStep}" -> "${nextStep}" [penwidth=${thickness.toFixed(1)}, color="${edgeColor}", tooltip="${tooltip}"${labelAttr}${styleAttr}];\n`;

                if (err > 0 && !fullError && !isSelfLoop) {
                    dotContent += formatErrorOverlay(currentStep, nextStep, err, edgeCount, maxEdgeCount);
                }
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
    uniqueStudentMode: boolean = false,
    colorNodesBySequence: boolean = true,
    maxEdgeCount: number = 0,
    edgeErrorStudentCounts: { [key: string]: number } = {},
    sequenceFunnelCounts: { [key: string]: number } | null = null,
    sequenceErrorCounts: { [key: string]: number } | null = null,
    nodeOutcomeMode: boolean = false,
    nodeOutcomeCounts: { [node: string]: { [outcome: string]: number } } = {},
    showEdgeLabels: boolean = true,
    edgeErrorVisitCounts: { [key: string]: number } = {}
): string {
    // Only the Selected Sequence graph actually needs a sequence — it IS the
    // sequence. The full graphs use it for optional path emphasis alone, so they
    // must still draw the whole network without one. Both "no sequence" states
    // are therefore equivalent here: [] means the user picked "None", and
    // undefined means nothing was auto-selected — reachable whenever no path
    // clears getTopSequences' 5-step floor, which per-session paths hit far more
    // often than per-problem ones did. Treating undefined as "no data at all"
    // blacked out every graph for datasets that had plenty to show.
    const sequence = selectedSequence ?? [];
    if (justTopSequence && sequence.length === 0) {
        return 'digraph G {\n"Error" [label="No sequence selected."];\n}';
    }

    // Error Mode has to compare like with like. edgeErrorStudentCounts is always
    // unique students, but every count the renderers gate, size and label on is
    // totalVisits in visits mode - so `err >= edgeCount`, `edgeCount - err` and
    // the overlay's error rate were all students-over-visits hybrids. Choose the
    // matching unit once, here, and the whole downstream path stays coherent.
    const errorsToUse = uniqueStudentMode ? edgeErrorStudentCounts : edgeErrorVisitCounts;
    const visitsToUse = uniqueStudentMode ? edgeCounts : totalVisits;
    const outcomesToUse = uniqueStudentMode ? firstAttemptOutcomes : edgeOutcomeCounts;

    console.log("generateDotString: Using unique student mode:", uniqueStudentMode);
    console.log("generateDotString: Min visits threshold:", minVisits);
    console.log("generateDotString: Thickness threshold:", threshold);

    // Node-outcome mode matches the Streamlit renderer: natural layout (no
    // forced `size`, which squishes the fixed-width striped nodes and makes the
    // label collide with its 100%-bar), Helvetica, and a label `margin` so the
    // step name sits legibly over the fill.
    let dotString: string;
    if (nodeOutcomeMode) {
        dotString = 'digraph G {\n'
            + '  graph [rankdir=TB, fontname="Helvetica", nodesep=0.4, ranksep=0.55, dpi=150];\n'
            + '  node [shape=box, style="rounded,filled", fontsize=11, fontname="Helvetica", margin="0.14,0.07"];\n'
            + '  edge [fontsize=8, fontname="Helvetica", arrowsize=0.7];\n';
    } else {
        // Edge mode keeps its own layout (the forced `size` fits the wider
        // network into the panel) but shares node mode's sans-serif typeface and
        // arrowhead size, so the two modes read as the same graph drawn two ways.
        dotString = 'digraph G {\n'
            + '  graph [size="8,6!", dpi=150, fontname="Helvetica"];\n'
            + '  node [fontname="Helvetica"];\n'
            + '  edge [fontname="Helvetica", arrowsize=0.7];\n';
    }

    const edgeCountsToUse = uniqueStudentMode ? edgeCounts : totalVisits;

    if (justTopSequence) {
        dotString += generateTopSequenceVisualization(
            sequence,
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
            maxEdgeCount,
            errorsToUse,
            uniqueStudentMode,
            colorNodesBySequence,
            sequenceFunnelCounts,
            sequenceErrorCounts,
            nodeOutcomeMode,
            nodeOutcomeCounts,
            showEdgeLabels
        );
    } else {
        dotString += generateFullGraphVisualization(
            sequence,
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
            maxEdgeCount,
            errorsToUse,
            uniqueStudentMode,
            colorNodesBySequence,
            nodeOutcomeMode,
            nodeOutcomeCounts,
            showEdgeLabels
        );
    }

    dotString += '}';
    return dotString;
}