import {useEffect, useState} from "react";
import ErrorBoundary from "@/components/errorBoundary.tsx";
import Graphviz from 'graphviz-react';
import {
    loadAndSortData,
    createStepSequences,
    createOutcomeSequences,
    countEdges,
    normalizeThicknesses,
    generateDotString, getTopSequences,
} from './GraphvizProcessing';
import '../GraphvizContainer.css';
import SequenceSelector from './SequenceSelector';

interface GraphvizParentProps {
    csvData: string;
    filter: string;
    selfLoops: boolean;
    minVisits: number;
    onTopSequencesUpdate: (sequences: string[]) => void;
    // selectedSequence: string;
}

const GraphvizParent: React.FC<GraphvizParentProps> = ({
                                                           csvData,
                                                           filter,
                                                           selfLoops,
                                                           minVisits,
                                                           onTopSequencesUpdate,
                                                           // selectedSequence,
                                                       }) => {
    const [dotString, setDotString] = useState<string>('');
    const [filteredDotString, setFilteredDotString] = useState<string | null>('');
    const [topSequences, setTopSequences] = useState<string[]>([]);
    const [selectedSequence, setSelectedSequence] = useState<string>('');

    useEffect(() => {
        if (!csvData) return; // Skip processing if no CSV data is available

        // Step 1: Load and sort the data
        const sortedData = loadAndSortData(csvData);

        // Step 2: Generate the sequences for steps and outcomes
        const stepSequences = createStepSequences(sortedData, selfLoops);
        const outcomeSequences = createOutcomeSequences(sortedData);

        // Step 3: Count edges and normalize thicknesses
        const {
            edgeCounts,
            totalNodeEdges,
            ratioEdges,
            edgeOutcomeCounts,
            maxEdgeCount,
            top5Sequences
        } = countEdges(stepSequences, outcomeSequences);
        setTopSequences(top5Sequences)
        setSelectedSequence(top5Sequences[0])
        const normalizedThicknesses = normalizeThicknesses(edgeCounts, maxEdgeCount, 10);

        // Step 4: Find the most common sequences
        // const mostCommonSequenceKey = Object.keys(stepSequences)
        //     .reduce((a, b) => stepSequences[a].length > stepSequences[b].length ? a : b);
        // const mostCommonSequence = stepSequences[mostCommonSequenceKey];
        // const topSequences = Object.keys(stepSequences)
        //     .sort((a, b) => stepSequences[b].length - stepSequences[a].length)
        //     .slice(0, 5);
        // console.log(stepSequences)
        // const top5Sequences = getTopSequences(stepSequences,5)
        onTopSequencesUpdate(top5Sequences);

        setTopSequences(top5Sequences)
        console.log("GVP67:" + topSequences)
        // Call the update function to pass top sequences to App component
        // Step 5: Generate the DOT string for the unfiltered graph
        const dotStr = generateDotString(
            normalizedThicknesses,
            // mostCommonSequence,
            ratioEdges,
            edgeOutcomeCounts,
            edgeCounts,
            totalNodeEdges,
            1,
            minVisits,
            selectedSequence
        );
        setDotString(dotStr);

        // Step 6: Generate the filtered graph if a filter is provided
        if (filter) {
            const filteredData = sortedData.filter(row => row['CF (Workspace Progress Status)'] === filter);
            const filteredStepSequences = createStepSequences(filteredData, selfLoops);
            const filteredOutcomeSequences = createOutcomeSequences(filteredData);

            const {
                edgeCounts: filteredEdgeCounts,
                totalNodeEdges: filteredTotalNodeEdges,
                ratioEdges: filteredRatioEdges,
                edgeOutcomeCounts: filteredEdgeOutcomeCounts,
                maxEdgeCount: filteredMaxEdgeCount,
                top5Sequences,
            } = countEdges(filteredStepSequences, filteredOutcomeSequences);

            const filteredNormalizedThicknesses = normalizeThicknesses(filteredEdgeCounts, filteredMaxEdgeCount, 10);
            // const filteredMostCommonSequenceKey = Object.keys(filteredStepSequences)
            //     .reduce((a, b) => filteredStepSequences[a].length > filteredStepSequences[b].length ? a : b);
            // const filteredMostCommonSequence = filteredStepSequences[filteredMostCommonSequenceKey];

            // Generate the DOT string for the filtered graph
            const filteredDotStr = generateDotString(
                filteredNormalizedThicknesses,
                // filteredMostCommonSequence,
                filteredRatioEdges,
                filteredEdgeOutcomeCounts,
                filteredEdgeCounts,
                filteredTotalNodeEdges,
                1,
                minVisits,
                selectedSequence
            );

            setFilteredDotString(filteredDotStr);
        } else {
            setFilteredDotString(null); // Clear filtered graph if no filter is set
        }

    }, [csvData, filter, selfLoops, minVisits, selectedSequence]);

    const handleSequenceSelect = (sequence: string) => {
        setSelectedSequence(sequence);
    };

    return (
        <div className="graphviz-container">
            {/*<SequenceSelector*/}
            {/*            sequences={topSequences}*/}
            {/*            selectedSequence={selectedSequence}*/}
            {/*            onSequenceSelect={handleSequenceSelect}*/}
            {/*        />*/}
            <ErrorBoundary>
                <div>

                    <div className="graphs">
                        {dotString && (
                            <Graphviz
                                dot={dotString}
                                options={{useWorker: false, height: 800, width: 600}}
                            />
                        )}
                        {filteredDotString && (
                            <Graphviz
                                dot={filteredDotString}
                                options={{useWorker: false, height: 800, width: 600}}
                            />
                        )}
                    </div>
                </div>
            </ErrorBoundary>
        </div>
    );
}

export default GraphvizParent;
