// React component code
import React, { useContext, useEffect, useRef, useState, useMemo } from 'react';
import { graphviz } from 'd3-graphviz';
import {
    generateDotString,
    normalizeThicknesses,
    countEdges,
    createStepSequences,
    createOutcomeSequences,
    loadAndSortData,
    calculateMaxMinEdgeCount,
    analyzeEquationAnswerTransitions,
    formatEquationAnswerStats
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

    // Memoized data processing for main graph
    const mainGraphData = useMemo(() => {
        if (!csvData) return null;
        
        const sortedData = loadAndSortData(csvData);
        const stepSequences = createStepSequences(sortedData, selfLoops);
        const outcomeSequences = createOutcomeSequences(sortedData);
        
        // Add equation answer analysis
        const equationStats = analyzeEquationAnswerTransitions(stepSequences, outcomeSequences);
        console.log(formatEquationAnswerStats(equationStats));
        
        const results = countEdges(stepSequences, outcomeSequences);
        
        return {
            sortedData,
            stepSequences,
            outcomeSequences,
            ...results
        };
    }, [csvData, selfLoops]);
    
    // Main graph calculation - removed filter from dependencies
    useEffect(() => {
        if (mainGraphData) {
            const {
                edgeCounts: newEdgeCounts,
                totalNodeEdges,
                ratioEdges,
                edgeOutcomeCounts,
                maxEdgeCount,
                totalVisits,
                repeatVisits,
                topSequences
            } = mainGraphData;

            // Note: edgeCounts are now used directly from mainGraphData

            // Update the maxEdgeCount in the parent component
            onMaxEdgeCountChange(maxEdgeCount);

            // Calculate and update the maximum minimum-edge count
            const sequenceToUse = selectedSequence || topSequences[0]?.sequence;
            if (sequenceToUse) {
                const maxMinEdgeCount = calculateMaxMinEdgeCount(newEdgeCounts, sequenceToUse);
                onMaxMinEdgeCountChange(maxMinEdgeCount);
            }

            if (JSON.stringify(top5Sequences) !== JSON.stringify(topSequences) || top5Sequences === null) {
                setTop5Sequences(topSequences);
                if (topSequences && selectedSequence === undefined) {
                    setSelectedSequence(topSequences[0].sequence);
                }
            }

            const normalizedThicknesses = normalizeThicknesses(newEdgeCounts, maxEdgeCount, 10);

            const dotString = generateDotString(
                normalizedThicknesses,
                ratioEdges,
                edgeOutcomeCounts,
                newEdgeCounts,
                totalNodeEdges,
                1,
                minVisits,
                sequenceToUse,
                false,
                totalVisits,
                repeatVisits,
                errorMode,
                mainGraphData.firstAttemptOutcomes
            );

            setDotString(dotString);

            setTopDotString(
                generateDotString(
                    normalizedThicknesses,
                    ratioEdges,
                    edgeOutcomeCounts,
                    newEdgeCounts,
                    totalNodeEdges,
                    1,
                    minVisits,
                    selectedSequence || topSequences[0].sequence,
                    true,
                    totalVisits,
                    repeatVisits,
                    errorMode,
                    mainGraphData.firstAttemptOutcomes
                )
            );
        }
    }, [mainGraphData, minVisits, selectedSequence, setTop5Sequences, top5Sequences, onMaxEdgeCountChange, onMaxMinEdgeCountChange, errorMode]);

    // Memoized filtered graph data
    const filteredGraphData = useMemo(() => {
        if (!filter || filter === 'ALL' || !mainGraphData) return null;
        
        const filteredData = mainGraphData.sortedData.filter(row => row['CF (Workspace Progress Status)'] === filter);
        const filteredStepSequences = createStepSequences(filteredData, selfLoops);
        const filteredOutcomeSequences = createOutcomeSequences(filteredData);
        
        const results = countEdges(filteredStepSequences, filteredOutcomeSequences);
        
        return {
            filteredData,
            filteredStepSequences,
            filteredOutcomeSequences,
            edgeCounts: results.edgeCounts,
            totalNodeEdges: results.totalNodeEdges,
            ratioEdges: results.ratioEdges,
            edgeOutcomeCounts: results.edgeOutcomeCounts,
            maxEdgeCount: results.maxEdgeCount,
            totalVisits: results.totalVisits,
            repeatVisits: results.repeatVisits,
            firstAttemptOutcomes: results.firstAttemptOutcomes
        };
    }, [filter, mainGraphData, selfLoops]);

    // Filtered graph calculation - only runs when filter changes
    useEffect(() => {
        if (filteredGraphData) {
            const {
                edgeCounts: filteredEdgeCounts,
                totalNodeEdges: filteredTotalNodeEdges,
                ratioEdges: filteredRatioEdges,
                edgeOutcomeCounts: filteredEdgeOutcomeCounts,
                maxEdgeCount: filteredMaxEdgeCount,
                totalVisits: filteredTotalVisits,
                repeatVisits: filteredRepeatVisits
            } = filteredGraphData;

            // Calculate max min edge count for filtered data
            const sequenceToUse = selectedSequence || top5Sequences?.[0]?.sequence;
            if (sequenceToUse) {
                const filteredMinEdgeCount = calculateMaxMinEdgeCount(filteredEdgeCounts, sequenceToUse);
                onMaxMinEdgeCountChange(filteredMinEdgeCount);
            }

            const normalizedThicknesses = normalizeThicknesses(filteredEdgeCounts, filteredMaxEdgeCount, 10);

            const filteredDotString = generateDotString(
                normalizedThicknesses,
                filteredRatioEdges,
                filteredEdgeOutcomeCounts,
                filteredEdgeCounts,
                filteredTotalNodeEdges,
                1,
                minVisits,
                sequenceToUse,
                false,
                filteredTotalVisits,
                filteredRepeatVisits,
                errorMode,
                filteredGraphData.firstAttemptOutcomes
            );

            setFilteredDotString(filteredDotString);
        } else {
            setFilteredDotString(null);
            // Reset max min edge count to the main graph's value
            if (mainGraphData) {
                const sequenceToUse = selectedSequence || top5Sequences?.[0]?.sequence;
                if (sequenceToUse) {
                    const maxMinEdgeCount = calculateMaxMinEdgeCount(mainGraphData.edgeCounts, sequenceToUse);
                    onMaxMinEdgeCountChange(maxMinEdgeCount);
                }
            }
        }
    }, [filteredGraphData, minVisits, selectedSequence, top5Sequences, errorMode, mainGraphData, onMaxMinEdgeCountChange]);

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