// React component code
import React, { useContext, useEffect, useRef, useState } from 'react';
import { graphviz } from 'd3-graphviz';
import {
    generateDotString,
    normalizeThicknesses,
    countEdges,
    createStepSequences,
    createOutcomeSequences,
    loadAndSortData,
    calculateMaxMinEdgeCount
} from './GraphvizProcessing';
import ErrorBoundary from "@/components/errorBoundary.tsx";
import '../GraphvizContainer.css';
import { Context } from "@/Context.tsx";
import { Button } from './ui/button';

const titleCase = (str: string | null) => str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : '';

interface GraphvizParentProps {
    csvData: string;
    filter: string | null;
    selfLoops: boolean;
    minVisits: number;
    onMaxEdgeCountChange: (count: number) => void;
    onMaxMinEdgeCountChange: (count: number) => void;
    errorMode: boolean;
}

const GraphvizParent: React.FC<GraphvizParentProps> = ({
    csvData,
    filter,
    selfLoops,
    minVisits,
    onMaxEdgeCountChange,
    onMaxMinEdgeCountChange,
    errorMode
}) => {
    const [dotString, setDotString] = useState<string | null>(null);
    const [filteredDotString, setFilteredDotString] = useState<string | null>(null);
    const [topDotString, setTopDotString] = useState<string | null>(null);
    const { selectedSequence, setSelectedSequence, top5Sequences, setTop5Sequences } = useContext(Context);

    // Refs for rendering the Graphviz graphs
    const graphRefMain = useRef<HTMLDivElement>(null);
    const graphRefFiltered = useRef<HTMLDivElement>(null);
    const graphRefTop = useRef<HTMLDivElement>(null);

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
                totalVisits,
                repeatVisits,
                topSequences
            } = countEdges(stepSequences, outcomeSequences);

            // Update the maxEdgeCount in the parent component
            onMaxEdgeCountChange(maxEdgeCount);

            // Calculate and update the maximum minimum-edge count
            const sequenceToUse = selectedSequence || topSequences[0]?.sequence;
            if (sequenceToUse) {
                const maxMinEdgeCount = calculateMaxMinEdgeCount(edgeCounts, sequenceToUse);

                // If filter is active and not 'ALL', compare with filtered graph's minimum edge count
                if (filter && filter !== 'ALL') {
                    const filteredData = sortedData.filter(row => row['CF (Workspace Progress Status)'] === filter);
                    const filteredStepSequences = createStepSequences(filteredData, selfLoops);
                    const filteredOutcomeSequences = createOutcomeSequences(filteredData);
                    const { edgeCounts: filteredEdgeCounts } = countEdges(filteredStepSequences, filteredOutcomeSequences);
                    const filteredMinEdgeCount = calculateMaxMinEdgeCount(filteredEdgeCounts, sequenceToUse);
                    onMaxMinEdgeCountChange(Math.min(maxMinEdgeCount, filteredMinEdgeCount));
                } else {
                    onMaxMinEdgeCountChange(maxMinEdgeCount);
                }
            }

            if (JSON.stringify(top5Sequences) !== JSON.stringify(topSequences) || top5Sequences === null) {
                setTop5Sequences(topSequences);
                if (topSequences && selectedSequence === undefined) {
                    setSelectedSequence(topSequences[0].sequence);
                }
            }

            const normalizedThicknesses = normalizeThicknesses(edgeCounts, maxEdgeCount, 10);

            setDotString(
                generateDotString(
                    normalizedThicknesses,
                    ratioEdges,
                    edgeOutcomeCounts,
                    edgeCounts,
                    totalNodeEdges,
                    1,
                    minVisits,
                    selectedSequence || topSequences[0].sequence,
                    false,
                    totalVisits,
                    repeatVisits,
                    errorMode
                )
            );

            setTopDotString(
                generateDotString(
                    normalizedThicknesses,
                    ratioEdges,
                    edgeOutcomeCounts,
                    edgeCounts,
                    totalNodeEdges,
                    1,
                    minVisits,
                    selectedSequence || topSequences[0].sequence,
                    true,
                    totalVisits,
                    repeatVisits,
                    errorMode
                )
            );
        }
    }, [csvData, selfLoops, minVisits, selectedSequence, setTop5Sequences, top5Sequences, onMaxEdgeCountChange, onMaxMinEdgeCountChange, filter, errorMode]);

    // Add back the useEffect for filtered graph display
    useEffect(() => {
        if (filter && filter !== 'ALL') {
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
                totalVisits: filteredTotalVisits,
                repeatVisits: filteredRepeatVisits,
            } = countEdges(filteredStepSequences, filteredOutcomeSequences);

            const filteredNormalizedThicknesses = normalizeThicknesses(filteredEdgeCounts, filteredMaxEdgeCount, 10);

            setFilteredDotString(
                generateDotString(
                    filteredNormalizedThicknesses,
                    filteredRatioEdges,
                    filteredEdgeOutcomeCounts,
                    filteredEdgeCounts,
                    filteredTotalNodeEdges,
                    1,
                    minVisits,
                    selectedSequence,
                    false,
                    filteredTotalVisits,
                    filteredRepeatVisits,
                    errorMode
                )
            );
        } else {
            setFilteredDotString(null);
        }
    }, [csvData, filter, selfLoops, minVisits, selectedSequence, errorMode]);

    // Export a graph as high-quality PNG
    const exportGraphAsPNG = (graphRef: React.RefObject<HTMLDivElement>, filename: string) => {
        if (!graphRef.current) return;

        const svgElement = graphRef.current.querySelector('svg');
        if (!svgElement) return;

        // Get SVG dimensions
        const width = svgElement.viewBox.baseVal.width || 425;
        const height = svgElement.viewBox.baseVal.height || 600;

        // Clone the SVG to avoid style inheritance issues
        const clonedSvg = svgElement.cloneNode(true);

        // Create a high-resolution canvas
        const scaleFactor = 5; // Adjust for higher quality (e.g., 2x or 3x)
        const canvas = document.createElement('canvas');
        canvas.width = (width * scaleFactor) * 1.25;
        canvas.height = (height * scaleFactor) * 1.5;
        const ctx = canvas.getContext('2d');

        if (!ctx) return;

        // Serialize the SVG
        const svgData = new XMLSerializer().serializeToString(clonedSvg);

        // Convert SVG to an image
        const img = new Image();
        img.onload = () => {
            // Scale the canvas content for higher resolution
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.scale(scaleFactor, scaleFactor);

            ctx.drawImage(img, 0, 0);

            // Export as PNG
            const link = document.createElement('a');
            link.download = `${filename}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        };

        img.onerror = (err) => {
            console.error('Failed to load SVG for export:', err);
        };

        img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgData)}`;
    };

    const numberOfGraphs = [topDotString, dotString, filteredDotString].filter(Boolean).length;

    // Render Graphviz graphs using d3-graphviz
    const renderGraph = (
        dot: string | null,
        ref: React.RefObject<HTMLDivElement>,
        filename: string,
        numberOfGraphs: number
    ) => {
        // TODO: remove filename from props
        console.log("Filename: ", filename);
        if (dot && ref.current) {
            // Dynamically adjust width based on the number of graphs
            const width = numberOfGraphs === 3 ? 325 : 425;
            const height = 530;

            try {
                graphviz(ref.current)
                    .width(width)
                    .height(height)
                    .renderDot(dot)
            } catch (error) {
                console.error("Error rendering graph:", error);
            }
        }
    };


    useEffect(() => {
        if (topDotString && graphRefTop.current) {
            renderGraph(topDotString, graphRefTop, 'selected_sequence', numberOfGraphs);
        }
    }, [topDotString, numberOfGraphs]);

    useEffect(() => {
        if (dotString && graphRefMain.current) {
            renderGraph(dotString, graphRefMain, 'all_students', numberOfGraphs);
        }
    }, [dotString, numberOfGraphs]);

    useEffect(() => {
        if (filter && filter !== 'ALL' && filteredDotString && graphRefFiltered.current) {
            renderGraph(filteredDotString, graphRefFiltered, 'filtered_graph', numberOfGraphs);
        } else if (filter === 'ALL' || !filter) {
            setFilteredDotString(null);
        }
    }, [filteredDotString, numberOfGraphs, filter]);


    return (
        <div className="graphviz-container flex-col w-[500px] items-center">
            <ErrorBoundary>
                <div className="graphs flex justify-center w-[500px] h-[650px]"> {/*Not sure what this does*/}
                    {topDotString && (
                        <div
                            className={`graph-item flex flex-col items-center ${topDotString && dotString && filteredDotString ? 'w-[400px]' : 'w-[500px]'} border-2 border-gray-700 rounded-lg p-4 bg-gray-100`}>
                            <h2 className="text-lg font-semibold text-center mb-2">Selected Sequence</h2>
                            <div ref={graphRefTop}
                                className="w-full h-[575px] border-2 border-gray-700 rounded-lg p-4 bg-white items-center"></div>
                            <ExportButton onClick={() => exportGraphAsPNG(graphRefTop, 'selected_sequence')} />
                        </div>
                    )}
                    {dotString && (
                        <div
                            className={`graph-item flex flex-col items-center ${topDotString && dotString && filteredDotString ? 'w-[400px]' : 'w-[500px]'} border-2 border-gray-700 rounded-lg p-4 bg-gray-100`}>
                            <h2 className="text-lg font-semibold text-center mb-2">All Students, All Paths</h2>
                            <div ref={graphRefMain}
                                className="w-full h-[575px] border-2 border-gray-700 rounded-lg p-4 bg-white"></div>
                            <ExportButton onClick={() => exportGraphAsPNG(graphRefMain, 'all_students')} /></div>
                    )}
                    {filter && filter !== 'ALL' && filteredDotString && (
                        <div
                            className={`graph-item flex flex-col items-center ${topDotString && dotString && filteredDotString ? 'w-[400px]' : 'w-[500px]'} border-2 border-gray-700 rounded-lg p-4 bg-gray-100`}>
                            <h2 className="text-lg font-semibold text-center mb-4">Filtered Graph: {titleCase(filter)}</h2>
                            <div ref={graphRefFiltered}
                                className="w-full h-[575px] border-2 border-gray-700 rounded-lg p-4 bg-white"></div>
                            <ExportButton onClick={() => exportGraphAsPNG(graphRefFiltered, 'filtered_graph')} />
                        </div>
                    )}
                </div>
            </ErrorBoundary>
        </div>
    );
}

export default GraphvizParent;


interface ExportButtonProps {
    onClick: () => void;
    label?: string;
}

function ExportButton({ onClick, label = "Export Image" }: ExportButtonProps) {
    return (
        <Button
            variant={'secondary'}
            onClick={onClick}
        >
            {label}
        </Button>
    );
}