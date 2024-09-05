import React, {useContext, useEffect, useState} from 'react';
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
import '../GraphvizContainer.css';
import {Context} from "@/Context.tsx";

interface GraphvizParentProps {
    csvData: string;
    filter: string | null;
    selfLoops: boolean;
    minVisits: number;
    // selectedSequence: string[] | undefined;

}

const GraphvizParent: React.FC<GraphvizParentProps> = ({
                                                           csvData,
                                                           filter,
                                                           selfLoops,
                                                           minVisits,
                                                       }) => {
    const [dotString, setDotString] = useState<string | null>(null);
    const [filteredDotString, setFilteredDotString] = useState<string | null>(null);
    const {selectedSequence, setSelectedSequence, top5Sequences, setTop5Sequences} = useContext(Context)


    useEffect(() => {
        if (csvData) {
            const sortedData = loadAndSortData(csvData);
            const stepSequences = createStepSequences(sortedData, selfLoops);
            const outcomeSequences = createOutcomeSequences(sortedData);

            const {
                edgeCounts,
                totalNodeEdges,
                ratioEdges,
                edgeOutcomeCounts,
                maxEdgeCount,
                topSequences
            } = countEdges(stepSequences, outcomeSequences);
            console.log("No 5: " + topSequences)
            if (JSON.stringify(top5Sequences) !== JSON.stringify(topSequences) || top5Sequences === null) {
                // console.log(true)
                console.log("BF: " + topSequences![0].sequence)
                setTop5Sequences(topSequences);
                console.log(top5Sequences, selectedSequence)
                if (topSequences && selectedSequence === undefined) {
                    console.log("AR: " + topSequences![0].sequence)
                    setSelectedSequence(topSequences![0].sequence);
                    console.log("selectedSequence Here", selectedSequence)
                }
            }

            const normalizedThicknesses = normalizeThicknesses(edgeCounts, maxEdgeCount, 10);
            const generatedDotStr = generateDotString(
                normalizedThicknesses,
                ratioEdges,
                edgeOutcomeCounts,
                edgeCounts,
                totalNodeEdges,
                1,
                minVisits,
                selectedSequence
            );
            console.log("NOW")
            setDotString(generatedDotStr);
            console.log(dotString)
        }
    }, [csvData, selfLoops, minVisits, selectedSequence, setDotString, dotString, setTop5Sequences, top5Sequences]);

    // useEffect(() => {
    //     if (csvData && selectedSequence) {
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
    //         } = countEdges(stepSequences, outcomeSequences);
    //
    //         const normalizedThicknesses = normalizeThicknesses(edgeCounts, maxEdgeCount, 10);
    //         const updatedDotStr = generateDotString(
    //             normalizedThicknesses,
    //             ratioEdges,
    //             edgeOutcomeCounts,
    //             edgeCounts,
    //             totalNodeEdges,
    //             1,
    //             minVisits,
    //             selectedSequence
    //         );
    //
    //         setDotString(updatedDotStr);
    //         console.log(dotString)
    //     }
    // }, [selectedSequence, csvData]);


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
            } = countEdges(filteredStepSequences, filteredOutcomeSequences);

            const filteredNormalizedThicknesses = normalizeThicknesses(filteredEdgeCounts, filteredMaxEdgeCount, 10);
            const filteredDotStr = generateDotString(
                filteredNormalizedThicknesses,
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
            setFilteredDotString(null);
        }
    }, [csvData, filter, selfLoops, minVisits, selectedSequence, top5Sequences]);


    return (
        <div className="graphviz-container">
            <ErrorBoundary>
                <div className="graphs">
                    {dotString && (
                        <Graphviz
                            dot={dotString}
                            options={{useWorker: false, height: 800, width: 600}}
                        />
                    )}
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
