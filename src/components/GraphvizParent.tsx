// import {useEffect, useState} from "react";
// import ErrorBoundary from "@/components/errorBoundary.tsx";
// import Graphviz from 'graphviz-react';
// import {
//     loadAndSortData,
//     createStepSequences,
//     createOutcomeSequences,
//     countEdges,
//     normalizeThicknesses,
//     generateDotString, calculateColor
// } from './GraphvizProcessing';
// import '../GraphvizContainer.css';
//
// // import SequenceSelector from './SequenceSelector';
//
// interface GraphvizParentProps {
//     csvData: string;
//     filter: string;
//     selfLoops: boolean;
//     minVisits: number;
//     onTopSequencesUpdate: (sequences: string[]) => void;
//     // selectedSequence: string;
// }
//
// const GraphvizParent: React.FC<GraphvizParentProps> = ({
//                                                            csvData,
//                                                            filter,
//                                                            selfLoops,
//                                                            minVisits,
//                                                            onTopSequencesUpdate,
//                                                            // selectedSequence,
//                                                        }) => {
//     const [dotString, setDotString] = useState<string>('');
//     const [filteredDotString, setFilteredDotString] = useState<string | null>('');
//     const [topSequences, setTopSequences] = useState<string[]>([]);
//     const [selectedSequence, setSelectedSequence] = useState<string[]>([]);
//
//     // Function to update the node colors based on the selected sequence
//
//     const applySequenceColors = (dotStr: string, sequence: string[]) => {
//         return dotStr.replace(/(\w+ \[)(.*?\])/g, (match, p1, p2) => {
//             const nodeName = match.match(/(\w+) \[/)?.[1];
//
//             // Find the rank of the node in the selected sequence
//             const rank = sequence.indexOf(nodeName!) + 1;  // +1 because index is 0-based
//             const totalSteps = sequence.length;
//
//             // Only calculate color if the node exists in the sequence
//             if (rank > 0) {
//                 const color = calculateColor(rank, totalSteps);
//                 return `${p1}style=filled, fillcolor="${color}", ${p2}`;
//             } else {
//                 return match; // return the original string if node is not in sequence
//             }
//         });
//     };
//
//
//     useEffect(() => {
//         if (!csvData) return; // Skip processing if no CSV data is available
//
//         // Step 1: Load and sort the data
//         const sortedData = loadAndSortData(csvData);
//
//         // Step 2: Generate the sequences for steps and outcomes
//         const stepSequences = createStepSequences(sortedData, selfLoops);
//         const outcomeSequences = createOutcomeSequences(sortedData);
//
//         // Step 3: Count edges and normalize thicknesses
//         const {
//             edgeCounts,
//             totalNodeEdges,
//             ratioEdges,
//             edgeOutcomeCounts,
//             maxEdgeCount,
//             top5Sequences
//         } = countEdges(stepSequences, outcomeSequences);
//         setTopSequences(top5Sequences)
//         console.log('TEST: ' + top5Sequences)
//         setSelectedSequence(top5Sequences[0])
//         const normalizedThicknesses = normalizeThicknesses(edgeCounts, maxEdgeCount, 10);
//
//         // Step 4: Find the most common sequences
//         // const mostCommonSequenceKey = Object.keys(stepSequences)
//         //     .reduce((a, b) => stepSequences[a].length > stepSequences[b].length ? a : b);
//         // const mostCommonSequence = stepSequences[mostCommonSequenceKey];
//         // const topSequences = Object.keys(stepSequences)
//         //     .sort((a, b) => stepSequences[b].length - stepSequences[a].length)
//         //     .slice(0, 5);
//         // console.log(stepSequences)
//         // const top5Sequences = getTopSequences(stepSequences,5)
//         onTopSequencesUpdate(top5Sequences);
//
//         setTopSequences(top5Sequences)
//         console.log("GVP67:" + topSequences)
//         // Call the update function to pass top sequences to App component
//         // Step 5: Generate the DOT string for the unfiltered graph
//         let dotStr = generateDotString(
//             normalizedThicknesses,
//             // mostCommonSequence,
//             ratioEdges,
//             edgeOutcomeCounts,
//             edgeCounts,
//             totalNodeEdges,
//             1,
//             minVisits,
//             selectedSequence
//         );
//         // Step 5: Apply initial color based on the selected sequence
//
//         if (selectedSequence) {
//
//             dotStr = applySequenceColors(dotStr, selectedSequence);
//
//         }
//
//         setDotString(dotStr);
//
//         // Step 6: Generate the filtered graph if a filter is provided
//         if (filter) {
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
//                 top5Sequences,
//             } = countEdges(filteredStepSequences, filteredOutcomeSequences);
//
//             const filteredNormalizedThicknesses = normalizeThicknesses(filteredEdgeCounts, filteredMaxEdgeCount, 10);
//             // const filteredMostCommonSequenceKey = Object.keys(filteredStepSequences)
//             //     .reduce((a, b) => filteredStepSequences[a].length > filteredStepSequences[b].length ? a : b);
//             // const filteredMostCommonSequence = filteredStepSequences[filteredMostCommonSequenceKey];
//
//             // Generate the DOT string for the filtered graph
//             let filteredDotStr = generateDotString(
//                 filteredNormalizedThicknesses,
//                 // filteredMostCommonSequence,
//                 filteredRatioEdges,
//                 filteredEdgeOutcomeCounts,
//                 filteredEdgeCounts,
//                 filteredTotalNodeEdges,
//                 1,
//                 minVisits,
//                 selectedSequence
//             );
//             if (selectedSequence != top5Sequences[0]) {
//                 filteredDotStr = applySequenceColors(dotStr, selectedSequence);
//             }
//             setFilteredDotString(filteredDotStr);
//         } else {
//             setFilteredDotString(null); // Clear filtered graph if no filter is set
//         }
//
//     }, [csvData, filter, selfLoops, minVisits, selectedSequence]);
//
//     const handleSequenceSelect = (sequence: string) => {
//         setSelectedSequence(sequence);
//     };
//
//     return (
//         <div className="graphviz-container">
//             {/*<SequenceSelector*/}
//             {/*            sequences={topSequences}*/}
//             {/*            selectedSequence={selectedSequence}*/}
//             {/*            onSequenceSelect={handleSequenceSelect}*/}
//             {/*        />*/}
//             <ErrorBoundary>
//                 <div>
//
//                     <div className="graphs">
//                         {dotString && (
//                             <Graphviz
//                                 dot={dotString}
//                                 options={{useWorker: false, height: 600, width: 600}}
//                             />
//                         )}
//                         {filteredDotString && (
//                             <Graphviz
//                                 dot={filteredDotString}
//                                 options={{useWorker: false, height: 600, width: 600}}
//                             />
//                         )}
//                     </div>
//                 </div>
//             </ErrorBoundary>
//         </div>
//     );
// }
//
// export default GraphvizParent;


// import {useEffect, useState} from "react";
// import ErrorBoundary from "@/components/errorBoundary.tsx";
// import Graphviz from 'graphviz-react';
// import {
//     loadAndSortData,
//     createStepSequences,
//     createOutcomeSequences,
//     countEdges,
//     normalizeThicknesses,
//     generateDotString, calculateColor
// } from './GraphvizProcessing';
// import '../GraphvizContainer.css';
//
// interface GraphvizParentProps {
//     csvData: string;
//     filter: string;
//     selfLoops: boolean;
//     minVisits: number;
//     onTopSequencesUpdate: (sequences: string[]) => void;
// }
//
// const GraphvizParent: React.FC<GraphvizParentProps> = ({
//     csvData,
//     filter,
//     selfLoops,
//     minVisits,
//     onTopSequencesUpdate,
// }) => {
//     const [dotString, setDotString] = useState<string>('');
//     const [filteredDotString, setFilteredDotString] = useState<string | null>(null);
//     const [topSequences, setTopSequences] = useState<string[][]>([]);
//     const [selectedSequence, setSelectedSequence] = useState<string[]>([]);
//
//     const applySequenceColors = (dotStr: string, sequence: string[]) => {
//         return dotStr.replace(/(\w+ \[)(.*?\])/g, (match, p1, p2) => {
//             const nodeName = match.match(/(\w+) \[/)?.[1];
//             const rank = sequence.indexOf(nodeName!) + 1;
//             const totalSteps = sequence.length;
//
//             if (rank > 0) {
//                 const color = calculateColor(rank, totalSteps);
//                 return `${p1}style=filled, fillcolor="${color}", ${p2}`;
//             } else {
//                 return match;
//             }
//         });
//     };
//
//     useEffect(() => {
//         if (!csvData) return;
//
//         const sortedData = loadAndSortData(csvData);
//         const stepSequences = createStepSequences(sortedData, selfLoops);
//         const outcomeSequences = createOutcomeSequences(sortedData);
//
//         const {
//             edgeCounts,
//             totalNodeEdges,
//             ratioEdges,
//             edgeOutcomeCounts,
//             maxEdgeCount,
//             top5Sequences,
//         } = countEdges(stepSequences, outcomeSequences);
//
//         setTopSequences(top5Sequences);
//         setSelectedSequence(top5Sequences[0][0]);
//
//         const normalizedThicknesses = normalizeThicknesses(edgeCounts, maxEdgeCount, 10);
//
//         let dotStr = generateDotString(
//             normalizedThicknesses,
//             ratioEdges,
//             edgeOutcomeCounts,
//             edgeCounts,
//             totalNodeEdges,
//             1,
//             minVisits,
//             top5Sequences[0] // Use the first sequence directly here
//         );
//
//         dotStr = applySequenceColors(dotStr, top5Sequences[0]);
//         setDotString(dotStr);
//
//         if (filter) {
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
//                 top5Sequences: filteredTop5Sequences,
//             } = countEdges(filteredStepSequences, filteredOutcomeSequences);
//
//             const filteredNormalizedThicknesses = normalizeThicknesses(filteredEdgeCounts, filteredMaxEdgeCount, 10);
//
//             let filteredDotStr = generateDotString(
//                 filteredNormalizedThicknesses,
//                 filteredRatioEdges,
//                 filteredEdgeOutcomeCounts,
//                 filteredEdgeCounts,
//                 filteredTotalNodeEdges,
//                 1,
//                 minVisits,
//                 selectedSequence // Apply selected sequence here
//             );
//
//             filteredDotStr = applySequenceColors(filteredDotStr, selectedSequence);
//             setFilteredDotString(filteredDotStr);
//         } else {
//             setFilteredDotString(null);
//         }
//
//     }, [csvData, filter, selfLoops, minVisits]);
//
//     return (
//         <div className="graphviz-container">
//             <ErrorBoundary>
//                 <div className="graphs">
//                     {dotString && (
//                         <Graphviz
//                             dot={dotString}
//                             options={{ useWorker: false, height: 600, width: 600 }}
//                         />
//                     )}
//                     {filteredDotString && (
//                         <Graphviz
//                             dot={filteredDotString}
//                             options={{ useWorker: false, height: 600, width: 600 }}
//                         />
//                     )}
//                 </div>
//             </ErrorBoundary>
//         </div>
//     );
// }
//
// export default GraphvizParent;

// import React, {useEffect, useState} from 'react';
// import {
//     loadAndSortData,
//     createStepSequences,
//     createOutcomeSequences,
//     countEdges,
//     normalizeThicknesses,
//     generateDotString,
//     calculateColor
// } from './GraphvizProcessing';
// import ErrorBoundary from "@/components/errorBoundary.tsx";
// import Graphviz from "graphviz-react";
//
//
// const GraphvizParent: React.FC = () => {
//     const [selectedSequence, setSelectedSequence] = useState<string[]>([]);
//     const [dotString, setDotString] = useState<string>('');
//     const [filteredDotString, setFilteredDotString] = useState<string | null>(null); // Use null for no filter
//     const [edgeCounts, setEdgeCounts] = useState<any>({});
//     const [maxEdgeCount, setMaxEdgeCount] = useState<number>(0);
//     const [ratioEdges, setRatioEdges] = useState<any>({});
//     const [edgeOutcomeCounts, setEdgeOutcomeCounts] = useState<any>({});
//     const [totalNodeEdges, setTotalNodeEdges] = useState< {[p: string]: number; }>({});
//     const [filterCriteria, setFilterCriteria] = useState<string | null>(null); // Track filter criteria
//     const [csvData, setCsvData] = useState<string>(''); // State for CSV data
//     const [selfLoops, setSelfLoops] = useState<boolean>(false); // State for self-loops
//     const [minVisits, setMinVisits] = useState<number>(0); // State for minimum visits
//
//     const applySequenceColors = (dotStr: string, sequence: string[]) => {
//         return dotStr.replace(/(\w+ \[)(.*?\])/g, (match, p1, p2) => {
//             const nodeName = match.match(/(\w+) \[/)?.[1];
//             const rank = sequence.indexOf(nodeName!) + 1;
//             const totalSteps = sequence.length;
//
//             if (rank > 0) {
//                 const color = calculateColor(rank, totalSteps);
//                 return `${p1}style=filled, fillcolor="${color}", ${p2}`;
//             } else {
//                 return match;
//             }
//         });
//     };
//     useEffect(() => {
//         const fetchData = async () => {
//             if (!csvData) return;
//             else setCsvData(csvData);
//             const sortedData = loadAndSortData(csvData);
//             const stepSequences = createStepSequences(sortedData, selfLoops);
//             const outcomeSequences = createOutcomeSequences(sortedData);
//
//             const { edgeCounts, totalNodeEdges, ratioEdges, edgeOutcomeCounts, maxEdgeCount, top5Sequences } = countEdges(stepSequences, outcomeSequences);
//
//             setEdgeCounts(edgeCounts);
//             setTotalNodeEdges(totalNodeEdges);
//             setRatioEdges(ratioEdges);
//             setEdgeOutcomeCounts(edgeOutcomeCounts);
//             setMaxEdgeCount(maxEdgeCount);
//
//             // Set the initial selected sequence
//             const initialSequence = top5Sequences[0][0]; // Adjust based on your top sequences structure
//             setSelectedSequence(initialSequence);
//
//             // Generate the initial DOT string
//             const normalizedThicknesses = normalizeThicknesses(edgeCounts, maxEdgeCount, 10);
//             let newDotString = generateDotString(normalizedThicknesses, ratioEdges, edgeOutcomeCounts, edgeCounts, totalNodeEdges, 0, minVisits, initialSequence);
//             newDotString = applySequenceColors(newDotString, initialSequence);
//             setDotString(newDotString);
//         };
//
//         fetchData();
//     }, []);
//
//     // Effect to regenerate the non-filtered DOT string when dependencies change
//     useEffect(() => {
//         const normalizedThicknesses = normalizeThicknesses(edgeCounts, maxEdgeCount, 10);
//         let newDotString = generateDotString(normalizedThicknesses, ratioEdges, edgeOutcomeCounts, edgeCounts, totalNodeEdges, 0, minVisits, selectedSequence);
//         newDotString = applySequenceColors(newDotString, selectedSequence);
//         setDotString(newDotString);
//     }, [selectedSequence, edgeCounts, maxEdgeCount, ratioEdges, edgeOutcomeCounts, totalNodeEdges, minVisits, selfLoops]);
//
//     // Effect to regenerate filtered DOT string when filterCriteria or selfLoops change
//     useEffect(() => {
//         if (filterCriteria) {
//             const filteredData = csvData.filter(row => row['CF (Workspace Progress Status)'] === filterCriteria);
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
//             const filteredNormalizedThicknesses = normalizeThicknesses(filteredEdgeCounts, filteredMaxEdgeCount, 10);
//
//             let filteredDotStr = generateDotString(
//                 filteredNormalizedThicknesses,
//                 filteredRatioEdges,
//                 filteredEdgeOutcomeCounts,
//                 filteredEdgeCounts,
//                 filteredTotalNodeEdges,
//                 1,
//                 minVisits,
//                 selectedSequence // Apply selected sequence here
//             );
//
//             filteredDotStr = applySequenceColors(filteredDotStr, selectedSequence);
//             setFilteredDotString(filteredDotStr);
//         } else {
//             setFilteredDotString(null); // Set to null if no filter is applied
//         }
//     }, [csvData, filterCriteria, selfLoops, minVisits, selectedSequence]);
//
//
//     return (
//         <div className="graphviz-container">
//             <ErrorBoundary>
//                 <div className="graphs">
//                     {dotString && (
//                         <Graphviz
//                             dot={dotString}
//                             options={{useWorker: false, height: 600, width: 600}}
//                         />
//                     )}
//                     {filteredDotString && (
//                         <Graphviz
//                             dot={filteredDotString}
//                             options={{useWorker: false, height: 600, width: 600}}
//                         />
//                     )}
//                 </div>
//             </ErrorBoundary>
//         </div>
//     );
// }
//
// export default GraphvizParent;

import React, {useEffect, useState} from 'react';
import {
    generateDotString,
    normalizeThicknesses,
    countEdges,
    createStepSequences,
    createOutcomeSequences,
    loadAndSortData
} from './GraphvizProcessing';
import Graphviz from "graphviz-react";
import ErrorBoundary from "@/components/errorBoundary.tsx";

interface GraphvizParentProps {
    csvData: string;
    filter: string | null;
    selfLoops: boolean;
    minVisits: number;
    selectedSequence: string[];
}

export interface SequenceCount {
    sequence: string[]; // or whatever type your steps are (e.g., number[])
    count: number;
}

const GraphvizParent: React.FC<GraphvizParentProps> = ({
                                                           csvData,
                                                           filter,
                                                           selfLoops,
                                                           minVisits,

                                                       }) => {
    const [dotString, setDotString] = useState<string | null>(null);
    const [filteredDotString, setFilteredDotString] = useState<string | null>(null);
    const [top5Sequences, setTop5Sequences] = useState<SequenceCount[] | string>('')
    const [selectedSequence, setSelectedSequence] = useState<string[]>([])
    const [selectedSequenceIndex, setSelectedSequenceIndex] = useState<number>(0);

    useEffect(() => {
        const sortedData = loadAndSortData(csvData);
        const stepSequences = createStepSequences(sortedData, selfLoops);
        const outcomeSequences = createOutcomeSequences(sortedData);

        const {
            edgeCounts,
            totalNodeEdges,
            ratioEdges,
            edgeOutcomeCounts,
            maxEdgeCount,
            top5Sequences
        } = countEdges(stepSequences, outcomeSequences);

        const formattedTop5Sequences = top5Sequences.map(([sequenceKey, count]) => ({
            sequence: JSON.parse(sequenceKey),
            count,
        }));
        setTop5Sequences(formattedTop5Sequences);

        const normalizedThicknesses = normalizeThicknesses(edgeCounts, maxEdgeCount, 10);

        let generatedDotStr = generateDotString(
            normalizedThicknesses,
            ratioEdges,
            edgeOutcomeCounts,
            edgeCounts,
            totalNodeEdges,
            1,
            minVisits,
            formattedTop5Sequences[selectedSequenceIndex]?.sequence || []
        );

        setDotString(generatedDotStr);
    }, [csvData, selfLoops, minVisits, selectedSequence]);

    useEffect(() => {
        if (filter) {
            const sortedData = loadAndSortData(csvData);
            const filteredData = sortedData.filter(row => row['CF (Workspace Progress Status)'] === filter);
            const filteredStepSequences = createStepSequences(filteredData, selfLoops);
            const filteredOutcomeSequences = createOutcomeSequences(filteredData);

            const {
                edgeCounts: filteredEdgeCounts,
                totalNodeEdges: filteredTotalNodeEdges,
                ratioEdges: filteredRatioEdges,
                edgeOutcomeCounts: filteredEdgeOutcomeCounts,
                maxEdgeCount: filteredMaxEdgeCount,
                top5Sequences
            } = countEdges(filteredStepSequences, filteredOutcomeSequences);
            const formattedTop5Sequences = top5Sequences.map(([sequenceKey, count]) => ({
                sequence: JSON.parse(sequenceKey),
                count,
            }));
            const filteredNormalizedThicknesses = normalizeThicknesses(filteredEdgeCounts, filteredMaxEdgeCount, 10);

            let filteredDotStr = generateDotString(
                filteredNormalizedThicknesses,
                filteredRatioEdges,
                filteredEdgeOutcomeCounts,
                filteredEdgeCounts,
                filteredTotalNodeEdges,
                1,
                minVisits,
                formattedTop5Sequences[selectedSequenceIndex]?.sequence || []
            );

            setFilteredDotString(filteredDotStr);
        } else {
            setFilteredDotString(null);
        }
    }, [csvData, filter, selfLoops, minVisits, selectedSequence]);
    // const handleSequenceChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    //     const selectedIndex = parseInt(event.target.value);
    //     setSelectedSequence(top5Sequences[selectedSequence] || []);
    // };

    return (
        <div className="graphviz-container">
            <ErrorBoundary>
                <select onChange={(e) => setSelectedSequenceIndex(Number(e.target.value))}
                        value={selectedSequenceIndex}>
                    {top5Sequences.map((seq, index) => (
                        <option key={index} value={index}>
                            Count {index + 1}
                        </option>
                    ))}
                </select>
    <div className="graphs">
        {dotString && (
            <Graphviz
                dot={dotString}
                options={{useWorker: false, height: 600, width: 600}}
            />
        )}
        {filteredDotString && (
            <Graphviz
                dot={filteredDotString}
                options={{useWorker: false, height: 600, width: 600}}
            />
        )}
    </div>
</ErrorBoundary>
</div>
)}
    ;
//     return (
//         <div className="graphviz-container">
//             <ErrorBoundary>
//                 <div className="graphs">
//                     {dotString && (
//                         <Graphviz
//                             dot={dotString}
//                             options={{useWorker: false, height: 600, width: 600}}
//                         />
//                     )}
//                     {filteredDotString && (
//                         <Graphviz
//                             dot={filteredDotString}
//                             options={{useWorker: false, height: 600, width: 600}}
//                         />
//                     )}
//                 </div>
//             </ErrorBoundary>
//         </div>
//     );
// }


    export default GraphvizParent;