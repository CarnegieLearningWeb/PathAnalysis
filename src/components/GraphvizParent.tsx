import React, {useContext, useEffect, useState} from 'react';
import {
    generateDotString,
    normalizeThicknesses,
    countEdges,
    createStepSequences,
    createOutcomeSequences,
    sortData, loadData
} from './GraphvizProcessing';
import Graphviz from "graphviz-react";
import ErrorBoundary from "@/components/errorBoundary.tsx";
import '../GraphvizContainer.css';
import {Context} from "@/Context.tsx";

/**
 * Props interface for the GraphvizParent component.
 * @interface GraphvizParentProps
 * @property {string} csvData - The raw CSV data used to generate the graph.
 * @property {string | null} filter - Optional filter string to filter the graph data.
 * @property {boolean} selfLoops - Whether self-loops (transitions back to the same node) should be included.
 * @property {number} minVisits - The minimum number of visits a step sequence must have to be displayed in the graph.
 */
interface GraphvizParentProps {
    csvData: string;
    filter: string | null;
    selfLoops: boolean;
    minVisits: number;
}

/**
 * GraphvizParent component handles the processing and visualization of CSV data
 * as a directed graph using the Graphviz library.
 *
 * @param {GraphvizParentProps} props - The properties required by the component.
 * @returns JSX.Element
 */
const GraphvizParent: React.FC<GraphvizParentProps> = ({
                                                           csvData,
                                                           filter,
                                                           selfLoops,
                                                           minVisits,
                                                       }) => {
    // State to hold the main DOT string generated for the Graphviz graph
    const [dotString, setDotString] = useState<string | null>(null);
    // State to hold the filtered DOT string based on the filter criteria
    const [filteredDotString, setFilteredDotString] = useState<string | null>(null);
    const [topDotString, setTopDotString] = useState<string | null>(null)
    // Access the selected sequence and top 5 sequences from the context
    const [first3DotString, setFirst3DotString] = useState<string | null>(null)
    const [last3DotString, setLast3DotString] = useState<string | null>(null)

    const {
        selectedSequence, setSelectedSequence, top5Sequences, setTop5Sequences,
        f3L3, setF3L3
    } = useContext(Context);

    /**
     * useEffect hook to generate and update the graph's DOT string whenever
     * csvData, selfLoops, minVisits, or selectedSequence changes.
     */
    useEffect(() => {
        if (csvData) {
            // const loadedData = loadData(csvData, setF3L3)
            // Load and sort the CSV data
            const sortedData = sortData(csvData, setF3L3, f3L3);
            if (!f3L3){


            // Generate step and outcome sequences from the sorted data
            const stepSequences = createStepSequences(sortedData, selfLoops);
            const outcomeSequences = createOutcomeSequences(sortedData);

            // Count edges and sequences, including top 5 sequences
            const {
                edgeCounts,
                totalNodeEdges,
                ratioEdges,
                edgeOutcomeCounts,
                maxEdgeCount,
                topSequences
            } = countEdges(stepSequences, outcomeSequences);

            // If the top 5 sequences differ, update the context with the new sequences
            if (JSON.stringify(top5Sequences) !== JSON.stringify(topSequences) || top5Sequences === null) {
                setTop5Sequences(topSequences);
                // If no sequence is selected, select the first sequence
                if (topSequences && selectedSequence === undefined) {
                    setSelectedSequence(topSequences![0].sequence);
                }
            }

            // Normalize the edge thicknesses based on the edge counts
            const normalizedThicknesses = normalizeThicknesses(edgeCounts, maxEdgeCount, 10);
            // Generate the Graphviz DOT string using the processed data
            const generatedDotStr = generateDotString(
                normalizedThicknesses,
                ratioEdges,
                edgeOutcomeCounts,
                edgeCounts,
                totalNodeEdges,
                1,
                minVisits,
                selectedSequence,
                false,

            );
            // Update the state with the generated DOT string
            setDotString(generatedDotStr);
            console.log(dotString)
            const generatedTopDotStr = generateDotString(
                normalizedThicknesses,
                ratioEdges,
                edgeOutcomeCounts,
                edgeCounts,
                totalNodeEdges,
                1,
                minVisits,
                selectedSequence,
                true,

            );
            setTopDotString(generatedTopDotStr)

        }}
        else {

        }
    }, [csvData, selfLoops, minVisits, selectedSequence, setDotString, dotString, setTop5Sequences, top5Sequences]);

    /**
     * useEffect hook to update the filtered graph's DOT string whenever
     * the filter, csvData, selfLoops, or minVisits changes.
     */
    useEffect(() => {
        if (filter) {
            // Load and sort the CSV data
            const sortedData = sortData(csvData, setF3L3, f3L3);
            // Filter the data based on the filter condition
            const filteredData = sortedData.filter(row => row['CF (Workspace Progress Status)'] === filter);
            // Generate step and outcome sequences from the filtered data
            const filteredStepSequences = createStepSequences(filteredData, selfLoops);
            const filteredOutcomeSequences = createOutcomeSequences(filteredData);

            // Count edges in the filtered data
            const {
                edgeCounts: filteredEdgeCounts,
                totalNodeEdges: filteredTotalNodeEdges,
                ratioEdges: filteredRatioEdges,
                edgeOutcomeCounts: filteredEdgeOutcomeCounts,
                maxEdgeCount: filteredMaxEdgeCount,
            } = countEdges(filteredStepSequences, filteredOutcomeSequences);

            // Normalize the edge thicknesses for the filtered data
            const filteredNormalizedThicknesses = normalizeThicknesses(filteredEdgeCounts, filteredMaxEdgeCount, 10);
            // Generate the Graphviz DOT string for the filtered data
            const filteredDotStr = generateDotString(
                filteredNormalizedThicknesses,
                filteredRatioEdges,
                filteredEdgeOutcomeCounts,
                filteredEdgeCounts,
                filteredTotalNodeEdges,
                1,
                minVisits,
                selectedSequence,
                false,

            );

            // Update the state with the filtered DOT string
            setFilteredDotString(filteredDotStr);
        } else {
            setFilteredDotString(null);  // Reset filtered graph if no filter is applied
        }
    }, [csvData, filter, selfLoops, minVisits, selectedSequence, top5Sequences]);

    // Render the Graphviz graphs within an error boundary
    return (
        <div className="graphviz-container">
            <ErrorBoundary>
                <div className="graphs">
                    <caption className="graph-caption">Chosen Top Sequence</caption>
                    {topDotString && (
                        <Graphviz
                            dot={topDotString}
                            options={{useWorker: false, height: 800, width: 600}}
                        />
                    )}
                    <caption className="graph-caption">All Students</caption>
                    {dotString && (
                        <Graphviz
                            dot={dotString}
                            options={{useWorker: false, height: 800, width: 600}}
                        />
                    )}
                    <caption className="graph-caption">{filter}</caption>
                    {filteredDotString && selectedSequence && (
                        <Graphviz
                            dot={filteredDotString}
                            options={{useWorker: false, height: 800, width: 600}}
                        />
                    )}
                </div>
            </ErrorBoundary>
        </div>
    );
};

export default GraphvizParent;


// import React, {useContext, useEffect, useState} from 'react';
// import {Graphviz} from 'graphviz-react';
// import ErrorBoundary from "@/components/errorBoundary.tsx";
// import {
//     sortData,
//     createStepSequences,
//     createOutcomeSequences,
//     countEdges,
//     normalizeThicknesses,
//     generateDotString
// } from './GraphvizProcessing';
// import {Context} from "@/Context.tsx";
//
// interface GraphvizParentProps {
//     csvData: any;
//     filter?: string;
//     selfLoops: boolean;
//     minVisits: number;
//     selectedSequence?: string[];
//     top5Sequences?: any[];
//     f3l3: boolean;
// }
//
// const GraphvizParent: React.FC<GraphvizParentProps> = ({
//                                                            csvData,
//                                                            filter,
//                                                            selfLoops,
//                                                            minVisits,
//                                                            selectedSequence,
//                                                            top5Sequences,
//                                                            // f3l3
//                                                        }) => {
//     const [dotString, setDotString] = useState<string | null>(null);
//     const [filteredDotString, setFilteredDotString] = useState<string | null>(null);
//     const [topDotstring, setTopDotstring] = useState<string | null>(null);
//     const [first3DotString, setFirst3DotString] = useState<string | null>(null);
//     const [last3DotString, setLast3DotString] = useState<string | null>(null);
//     const [f3l3, setF3L3] = useContext(Context)
//     // UseEffect to generate the main Graphviz graph(s)
//     useEffect(() => {
//         if (csvData) {
//             const sortedData = sortData(csvData, setFirst3DotString, f3l3);
//             const stepSequences = createStepSequences(sortedData, selfLoops);
//             const outcomeSequences = createOutcomeSequences(sortedData);
//
//             const {
//                 edgeCounts,
//                 totalNodeEdges,
//                 ratioEdges,
//                 edgeOutcomeCounts,
//                 maxEdgeCount,
//                 topSequences
//             } = countEdges(stepSequences, outcomeSequences);
//
//             // Set top 5 sequences if updated
//             if (JSON.stringify(top5Sequences) !== JSON.stringify(topSequences)) {
//                 setTopDotstring(generateDotString(
//                     edgeCounts, totalNodeEdges, ratioEdges, edgeOutcomeCounts,
//                     maxEdgeCount, minVisits, selectedSequence, true
//                 ));
//             }
//
//             // Generate normal graph (not top 5)
//             setDotString(generateDotString(
//                 edgeCounts, totalNodeEdges, ratioEdges, edgeOutcomeCounts,
//                 maxEdgeCount, minVisits, selectedSequence, false
//             ));
//
//             // Handle first 3 and last 3 if f3l3 === true
//             if (f3l3) {
//                 // Generate graph for first 3 problems
//                 const first3Sequences = createStepSequences(sortedData.filter(row => row['first or last'] === 'first'), selfLoops);
//                 const first3EdgeCounts = countEdges(first3Sequences, outcomeSequences);
//                 setFirst3DotString(generateDotString(
//                     first3EdgeCounts.edgeCounts,
//                     first3EdgeCounts.totalNodeEdges,
//                     first3EdgeCounts.ratioEdges,
//                     first3EdgeCounts.edgeOutcomeCounts,
//                     first3EdgeCounts.maxEdgeCount,
//                     minVisits, selectedSequence, false
//                 ));
//
//                 // Generate graph for last 3 problems
//                 const last3Sequences = createStepSequences(sortedData.filter(row => row['first or last'] === 'last'), selfLoops);
//                 const last3EdgeCounts = countEdges(last3Sequences, outcomeSequences);
//                 setLast3DotString(generateDotString(
//                     last3EdgeCounts.edgeCounts,
//                     last3EdgeCounts.totalNodeEdges,
//                     last3EdgeCounts.ratioEdges,
//                     last3EdgeCounts.edgeOutcomeCounts,
//                     last3EdgeCounts.maxEdgeCount,
//                     minVisits, selectedSequence, false
//                 ));
//             }
//         }
//     }, [csvData, selfLoops, minVisits, selectedSequence, top5Sequences, f3l3]);
//
//     // UseEffect to generate the filtered graph if a filter is applied
//     useEffect(() => {
//         if (filter) {
//             const sortedData = sortData(csvData, setF3L3, f3l3);
//             const filteredData = sortedData.filter(row => row['CF (Workspace Progress Status)'] === filter);
//             const filteredStepSequences = createStepSequences(filteredData, selfLoops);
//             const filteredOutcomeSequences = createOutcomeSequences(filteredData);
//
//             const {
//                 edgeCounts: filteredEdgeCounts,
//                 totalNodeEdges: filteredTotalNodeEdges,
//                 ratioEdges: filteredRatioEdges,
//                 edgeOutcomeCounts: filteredEdgeOutcomeCounts,
//                 maxEdgeCount: filteredMaxEdgeCount,
//             } = countEdges(filteredStepSequences, filteredOutcomeSequences);
//
//             setFilteredDotString(generateDotString(
//                 filteredEdgeCounts,
//                 filteredTotalNodeEdges,
//                 filteredRatioEdges,
//                 filteredEdgeOutcomeCounts,
//                 filteredMaxEdgeCount,
//                 minVisits, selectedSequence, false
//             ));
//         } else {
//             setFilteredDotString(null);
//         }
//     }, [csvData, filter, selfLoops, minVisits, selectedSequence, top5Sequences]);
//
//     return (
//         <div className="graphviz-container">
//             <ErrorBoundary>
//                 <div className="graphs">
//                     {f3l3 ? (
//                         <>
//                             <caption className="graph-caption">First 3 Problems</caption>
//                             {first3DotString && (
//                                 <Graphviz
//                                     dot={first3DotString}
//                                     options={{useWorker: false, height: 800, width: 600}}
//                                 />
//                             )}
//                             <caption className="graph-caption">Last 3 Problems</caption>
//                             {last3DotString && (
//                                 <Graphviz
//                                     dot={last3DotString}
//                                     options={{useWorker: false, height: 800, width: 600}}
//                                 />
//                             )}
//                         </>
//                     ) : (
//
//                         <div className="graphs">
//                             <caption className="graph-caption">Chosen Top Sequence</caption>
//                             {topDotstring && (
//                                 <Graphviz
//                                     dot={topDotstring}
//                                     options={{useWorker: false, height: 800, width: 600}}
//                                 />
//                             )}
//                             <caption className="graph-caption">All Students</caption>
//                             {dotString && (
//                                 <Graphviz
//                                     dot={dotString}
//                                     options={{useWorker: false, height: 800, width: 600}}
//                                 />
//                             )}
//                             <caption className="graph-caption">{filter}</caption>
//                             {filteredDotString && selectedSequence && (
//                                 <Graphviz
//                                     dot={filteredDotString}
//                                     options={{useWorker: false, height: 800, width: 600}}
//                                 />
//                             )}
//                         </div>)}
//                 </div>
//             </ErrorBoundary>
//         </div>);
// };
// )
// };
// ;
//
// export default GraphvizParent;
