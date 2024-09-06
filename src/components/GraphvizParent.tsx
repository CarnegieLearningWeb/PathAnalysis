import React, { useContext, useEffect, useState } from 'react';
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
import { Context } from "@/Context.tsx";

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

    // Access the selected sequence and top 5 sequences from the context
    const { selectedSequence, setSelectedSequence, top5Sequences, setTop5Sequences } = useContext(Context);

    /**
     * useEffect hook to generate and update the graph's DOT string whenever
     * csvData, selfLoops, minVisits, or selectedSequence changes.
     */
    useEffect(() => {
        if (csvData) {
            // Load and sort the CSV data
            const sortedData = loadAndSortData(csvData);
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
                selectedSequence
            );

            // Update the state with the generated DOT string
            setDotString(generatedDotStr);
        }
    }, [csvData, selfLoops, minVisits, selectedSequence, setDotString, dotString, setTop5Sequences, top5Sequences]);

    /**
     * useEffect hook to update the filtered graph's DOT string whenever
     * the filter, csvData, selfLoops, or minVisits changes.
     */
    useEffect(() => {
        if (filter) {
            // Load and sort the CSV data
            const sortedData = loadAndSortData(csvData);
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
                selectedSequence
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
                    {dotString && (
                        <Graphviz
                            dot={dotString}
                            options={{ useWorker: false, height: 800, width: 600 }}
                        />
                    )}
                    {filteredDotString && selectedSequence && (
                        <Graphviz
                            dot={filteredDotString}
                            options={{ useWorker: false, height: 800, width: 600 }}
                        />
                    )}
                </div>
            </ErrorBoundary>
        </div>
    );
};

export default GraphvizParent;
