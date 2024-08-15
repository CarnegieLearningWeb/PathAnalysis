import {useEffect, useState} from "react";
import ErrorBoundary from "@/components/errorBoundary.tsx";
import Graphviz from 'graphviz-react';
import {
    loadAndSortData,
    createStepSequences,
    createOutcomeSequences,
    countEdges,
    normalizeThicknesses,
    generateDotString
} from './graphvizProcessing';

interface GraphvizParentProps {
    csvData: string;
    filter: string;
    selfLoops: boolean;
    minVisits: number;
}

const GraphvizParent: React.FC<GraphvizParentProps> = ({ csvData, filter, selfLoops, minVisits }) => {
    const [dotString, setDotString] = useState<string>('');
    const [filteredDotString, setFilteredDotString] = useState<string | null>('');


    // Process the CSV data initially and when filter changes
    useEffect(() => {
        if (!csvData) return; // Skip if no CSV data is available

        const sortedData = loadAndSortData(csvData);

        // Generate the unfiltered graph
        const stepSequences = createStepSequences(sortedData, selfLoops);
        console.log(stepSequences)
        const outcomeSequences = createOutcomeSequences(sortedData);

        const {edgeCounts, totalNodeEdges, ratioEdges, edgeOutcomeCounts} = countEdges(stepSequences, outcomeSequences);

        const normalizedThicknesses = normalizeThicknesses(ratioEdges, 10);

        const mostCommonSequenceKey = Object.keys(stepSequences)
            .reduce((a, b) => stepSequences[a].length > stepSequences[b].length ? a : b);

        const mostCommonSequence = stepSequences[mostCommonSequenceKey];
        const dotStr = generateDotString(
            normalizedThicknesses,
            mostCommonSequence,
            ratioEdges,
            edgeOutcomeCounts,
            edgeCounts,
            totalNodeEdges,
            1,
            minVisits
        );
        setDotString(dotStr);
        console.log(dotString)
        // Generate the filtered graph if a filter is set
        if (filter) {
            //TODO: Add qualifier to show difference between two graphs (maybe border color to show if
            // something increased or decreased)
            //TODO: Make order/ranking same in both graphs
            const filteredData = sortedData.filter(row => row['CF (Workspace Progress Status)'] === filter);
            console.log(filteredData);

            const filteredStepSequences = createStepSequences(filteredData, selfLoops);
            console.log(filteredStepSequences)
            const filteredOutcomeSequences = createOutcomeSequences(filteredData);

            const {
                edgeCounts: filteredEdgeCounts, totalNodeEdges: filteredTotalNodeEdges,
                ratioEdges: filteredRatioEdges, edgeOutcomeCounts: filteredEdgeOutcomeCounts
            }
                = countEdges(filteredStepSequences, filteredOutcomeSequences);

            const filteredNormalizedThicknesses = normalizeThicknesses(filteredRatioEdges, 10);

            const filteredMostCommonSequenceKey = Object.keys(filteredStepSequences)
                .reduce((a, b) => filteredStepSequences[a].length > filteredStepSequences[b].length ? a : b);

            const filteredMostCommonSequence = filteredStepSequences[filteredMostCommonSequenceKey];
            const filteredDotStr = generateDotString(
                filteredNormalizedThicknesses,
                filteredMostCommonSequence,
                filteredRatioEdges,
                filteredEdgeOutcomeCounts,
                filteredEdgeCounts,
                filteredTotalNodeEdges,
                1,
                minVisits
            );
            let edge: string;
            for (edge in edgeCounts) {
                if (edgeCounts[edge] != filteredEdgeCounts[edge]) {
                    console.log(edge, filteredEdgeCounts[edge] - edgeCounts[edge])
                    if (isNaN(filteredEdgeCounts[edge] - edgeCounts[edge])) {
                        console.log("NaN: " + edge, filteredEdgeCounts[edge], edgeCounts[edge])
                    }
                }
            }
            // console.log(filteredDotStr)
            setFilteredDotString(filteredDotStr);
            console.log(filteredDotString)
        } else {
            setFilteredDotString(null); // Clear filtered graph if no filter is set
        }

    }, [csvData, filter, selfLoops, minVisits]);



    return (
        <div>
            <ErrorBoundary>
                <div className={"container"}>
                    {dotString && <Graphviz dot={dotString} options={{useWorker: false, height: 600, width: 600}}/>}
                    <label>{filter}</label>
                    {filteredDotString &&
                        <Graphviz dot={filteredDotString} options={{useWorker: false, height: 600, width: 600}}/>}
                </div>
            </ErrorBoundary>
        </div>
    )
}
export default GraphvizParent