// React component code
import React, {useContext, useEffect, useRef, useState} from 'react';
import {graphviz} from 'd3-graphviz';
import {
    generateDotString,
    normalizeThicknesses,
    countEdges,
    createStepSequences,
    createOutcomeSequences,
    sortData
} from './GraphvizProcessing';
import ErrorBoundary from "@/components/errorBoundary.tsx";
import '../GraphvizContainer.css';
import {Context} from "@/Context.tsx";
import {Button} from './ui/button';
import Graphviz from "graphviz-react";

interface GraphvizParentProps {
    csvData: string;
    filter: string | null;
    selfLoops: boolean;
    minVisits: number;
}

const GraphvizParent: React.FC<GraphvizParentProps> = ({
                                                           csvData,
                                                           filter,
                                                           selfLoops,
                                                           minVisits,
                                                       }) => {
    const [dotString, setDotString] = useState<string | null>(null);
    const [filteredDotString, setFilteredDotString] = useState<string | null>(null);
    const [topDotString, setTopDotString] = useState<string | null>(null);
    const [first3DotString, setFirst3DotString] = useState<string | null>(null)

    const [last3DotString, setLast3DotString] = useState<string | null>(null)


    const {selectedSequence, setSelectedSequence, top5Sequences, setTop5Sequences, f3L3, setF3L3} = useContext(Context);

    // Refs for rendering the Graphviz graphs
    const graphRefMain = useRef<HTMLDivElement>(null);
    const graphRefFiltered = useRef<HTMLDivElement>(null);
    const graphRefTop = useRef<HTMLDivElement>(null);
    const graphRefF3 = useRef<HTMLDivElement>(null);
    const graphRefL3 = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (csvData) {
            const sortedData = sortData(csvData, setF3L3, f3L3);
            if (!f3L3) {
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

                if (JSON.stringify(top5Sequences) !== JSON.stringify(topSequences) || top5Sequences === null) {
                    setTop5Sequences(topSequences);
                    if (topSequences && selectedSequence === undefined) {
                        setSelectedSequence(topSequences![0].sequence);
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
                        selectedSequence,
                        false
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
                        selectedSequence,
                        true
                    )
                );
            } else {
                for (const x of ['first', 'last']) {
                    console.log("x", x)
                    const data = sortedData.filter(row => row['first or last'] === x)
                    console.log("UseEffect Data", data)
                    // Generate step and outcome sequences from the sorted data
                    const stepSequences = createStepSequences(data, selfLoops);
                    const outcomeSequences = createOutcomeSequences(data);
                    console.log("outcome counts", outcomeSequences)

                    // Count edges and sequences, including top 5 sequences
                    const {
                        edgeCounts,
                        totalNodeEdges,
                        ratioEdges,
                        edgeOutcomeCounts,
                        maxEdgeCount,
                        topSequences,
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
                    console.log(generatedDotStr)

                    // Update the state with the generated DOT string
                    if (x == 'first') {
                        setFirst3DotString(generatedDotStr)
                    } else {
                        setLast3DotString(generatedDotStr)
                    }
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
                }
            }
        }
    }, [csvData, selfLoops, minVisits, selectedSequence, setTop5Sequences, top5Sequences, f3L3]);

    useEffect(() => {
        if (filter) {
            const sortedData = sortData(csvData, setF3L3, f3L3);
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
                    false
                )
            );
        } else {
            setFilteredDotString(null);
        }
    }, [csvData, filter, selfLoops, minVisits, selectedSequence]);

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

    const numberOfGraphs = [topDotString, dotString, filteredDotString, first3DotString, last3DotString].filter(Boolean).length;

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
        if (filteredDotString && graphRefFiltered.current) {
            renderGraph(filteredDotString, graphRefFiltered, 'filtered_graph', numberOfGraphs);
        }
    }, [filteredDotString, numberOfGraphs]);

    useEffect(() => {
        if (f3L3 && graphRefF3.current) {
            renderGraph(first3DotString, graphRefF3, 'first3_graph', numberOfGraphs);
        }
    }, [first3DotString, numberOfGraphs]);

    useEffect(() => {
        if (f3L3 && graphRefL3.current) {
            renderGraph(last3DotString, graphRefL3, 'last3_graph', numberOfGraphs);
        }
    }, [first3DotString, numberOfGraphs]);

    return (
        <div className="graphviz-container flex-col w-[500px] items-center">
            <ErrorBoundary>
                <div className="graphs flex justify-center w-[500px] h-[650px]"> {/*Not sure what this does*/}
                    {first3DotString && (
                        <div
                            className={`graph-item flex flex-col items-center ${topDotString && dotString && filteredDotString ? 'w-[400px]' : 'w-[500px]'} border-2 border-gray-700 rounded-lg p-4 bg-gray-100`}>
                            <h2 className="text-lg font-semibold text-center mb-2">First 3 Problems</h2>
                            <div ref={graphRefF3}
                                 className="w-full h-[575px] border-2 border-gray-700 rounded-lg p-4 bg-white items-center"></div>
                            <ExportButton onClick={() => exportGraphAsPNG(graphRefF3, 'first3_sequence')}/>
                        </div>
                    )}
                    {last3DotString && (
                        <div
                            className={`graph-item flex flex-col items-center ${topDotString && dotString && filteredDotString ? 'w-[400px]' : 'w-[500px]'} border-2 border-gray-700 rounded-lg p-4 bg-gray-100`}>
                            <h2 className="text-lg font-semibold text-center mb-2">Last 3 Problems</h2>
                            <div ref={graphRefL3}
                                 className="w-full h-[575px] border-2 border-gray-700 rounded-lg p-4 bg-white items-center"></div>
                            <ExportButton onClick={() => exportGraphAsPNG(graphRefL3, 'last3_sequence')}/>
                        </div>
                    )}
                    {topDotString && (
                        <div
                            className={`graph-item flex flex-col items-center ${topDotString && dotString && filteredDotString ? 'w-[400px]' : 'w-[500px]'} border-2 border-gray-700 rounded-lg p-4 bg-gray-100`}>
                            <h2 className="text-lg font-semibold text-center mb-2">Selected Sequence</h2>
                            <div ref={graphRefTop}
                                 className="w-full h-[575px] border-2 border-gray-700 rounded-lg p-4 bg-white items-center"></div>
                            <ExportButton onClick={() => exportGraphAsPNG(graphRefTop, 'selected_sequence')}/>
                        </div>
                    )}
                    {dotString && (
                        <div
                            className={`graph-item flex flex-col items-center ${topDotString && dotString && filteredDotString ? 'w-[400px]' : 'w-[500px]'} border-2 border-gray-700 rounded-lg p-4 bg-gray-100`}>
                            <h2 className="text-lg font-semibold text-center mb-2">All Students, All Paths</h2>
                            <div ref={graphRefMain}
                                 className="w-full h-[575px] border-2 border-gray-700 rounded-lg p-4 bg-white"></div>
                            <ExportButton onClick={() => exportGraphAsPNG(graphRefMain, 'all_students')}/></div>
                    )}
                    {filteredDotString && (
                        <div
                            className={`graph-item flex flex-col items-center ${topDotString && dotString && filteredDotString ? 'w-[400px]' : 'w-[500px]'} border-2 border-gray-700 rounded-lg p-4 bg-gray-100`}>
                            <h2 className="text-lg font-semibold text-center mb-4">Filtered Graph</h2>
                            <div ref={graphRefFiltered}
                                 className="w-full h-[575px] border-2 border-gray-700 rounded-lg p-4 bg-white"></div>
                            <ExportButton onClick={() => exportGraphAsPNG(graphRefFiltered, 'filtered_graph')}/>
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

function ExportButton({onClick, label = "Export Image"}: ExportButtonProps) {
    return (
        <Button
            variant={'secondary'}
            onClick={onClick}
        >
            {label}
        </Button>
    );
}