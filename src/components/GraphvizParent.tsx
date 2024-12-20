// React component code
import React, { useContext, useEffect, useRef, useState } from 'react';
import { graphviz } from 'd3-graphviz';
import {
    generateDotString,
    normalizeThicknesses,
    countEdges,
    createStepSequences,
    createOutcomeSequences,
    loadAndSortData
} from './GraphvizProcessing';
import ErrorBoundary from "@/components/errorBoundary.tsx";
import '../GraphvizContainer.css';
import { Context } from "@/Context.tsx";
import { Button } from './ui/button';

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
        }
    }, [csvData, selfLoops, minVisits, selectedSequence, setTop5Sequences, top5Sequences]);

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

    // Render Graphviz graphs using d3-graphviz
    const renderGraph = (dot: string | null, ref: React.RefObject<HTMLDivElement>) => {
        if (dot && ref.current) {
            graphviz(ref.current)
                .width(800)
                .height(600)
                .renderDot(dot);
        }
    };

    // Export a graph as high-quality PNG
    const exportGraphAsPNG = (
        ref: React.RefObject<HTMLDivElement>,
        fileName: string,
        scale: number = 2, // Scale for higher quality
        margin: number = 20 // Smaller margin in pixels
    ) => {
        if (ref.current) {
            const svgElement = ref.current.querySelector('svg');
            if (svgElement) {
                const svgData = new XMLSerializer().serializeToString(svgElement);

                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                const img = new Image();

                img.onload = () => {
                    const graphWidth = img.width * scale;
                    const graphHeight = img.height * scale;

                    // Set canvas size with smaller margins
                    canvas.width = graphWidth + margin * 2;
                    canvas.height = graphHeight + margin * 2;

                    // Fill background (optional)
                    context!.fillStyle = 'white';
                    context!.fillRect(0, 0, canvas.width, canvas.height);

                    // Draw the graph centered within the canvas
                    const xOffset = (canvas.width - graphWidth) / 2;
                    const yOffset = (canvas.height - graphHeight) / 2;
                    context!.drawImage(img, xOffset, yOffset, graphWidth, graphHeight);

                    // Export to PNG
                    const pngData = canvas.toDataURL('image/png');
                    const link = document.createElement('a');
                    link.href = pngData;
                    link.download = `${fileName}.png`;
                    link.click();
                };

                img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
            }
        }
    };

    useEffect(() => renderGraph(dotString, graphRefMain), [dotString]);
    useEffect(() => renderGraph(filteredDotString, graphRefFiltered), [filteredDotString]);
    useEffect(() => renderGraph(topDotString, graphRefTop), [topDotString]);

    return (
        <div className="graphviz-container flex flex-col gap-8 w-full items-center">
            <ErrorBoundary>
                <div className="graphs flex justify-center gap-8 w-full">
                    {topDotString && (
                        <div className="graph-item flex flex-col items-center">
                            <h2 className="text-lg font-semibold text-center mb-2">Selected Sequence</h2>
                            <div ref={graphRefTop} className="w-auto h-auto"></div>
                            <ExportButton onClick={() => exportGraphAsPNG(graphRefTop, 'selected_sequence')} />
                        </div>
                    )}
                    {dotString && (
                        <div className="graph-item flex flex-col items-center">
                            <h2 className="text-lg font-semibold text-center mb-2">All Students, All Paths</h2>
                            <div ref={graphRefMain} className="w-auto h-auto"></div>
                            <ExportButton onClick={() => exportGraphAsPNG(graphRefMain, 'all_students')} />
                        </div>
                    )}
                    {filteredDotString && (
                        <div className="graph-item flex flex-col items-center">
                            <h2 className="text-lg font-semibold text-center mb-4">Filtered Graph</h2>
                            <div ref={graphRefFiltered} className="w-auto h-auto"></div>
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
};