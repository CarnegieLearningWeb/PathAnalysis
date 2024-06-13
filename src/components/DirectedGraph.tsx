import { useEffect, useRef, useState } from "react"
import { ForceGraph2D } from 'react-force-graph';
import { GraphData, ToolTip, Node, Link, ContextMenuControls, LinkObject } from "@/lib/types";
import * as d3 from "d3";
import html2canvas from 'html2canvas';

import toast from "react-hot-toast";
import { Cross2Icon } from "@radix-ui/react-icons";
import { Slider } from "@/components/ui/slider"
import { addUnusedNodes, changeLinkThreshold, removeUnusedNodes } from "@/lib/dataProcessingUtils";
import ToggleTool from "@/components/ToggleTool";

// TODO make sure the node info is changed

interface DirectedGraphProps {
    graphData: GraphData;
}

export default function DirectedGraph({ graphData }: DirectedGraphProps) {

    const initialTooltip: ToolTip = { display: false, text: '', x: 0, y: 0, fx: undefined, fy: undefined };
    const [tooltip, setTooltip] = useState<ToolTip>(initialTooltip);
    const [currentGraphData, setCurrentGraphData] = useState<GraphData>(graphData);
    const forceGraphRef = useRef<any>(null); // must be `any` because no typing is available for react-force-graph
    const [orderByTime,] = useState(true);
    const [pinnable,] = useState(false);
    const [edgesThreshold, setEdgesThreshold] = useState<number>((graphData.maxEdgeCount ?? 100) * 0.1);
    const [previousEdgesThreshold, setPreviousEdgesThreshold] = useState<number>(((graphData.maxEdgeCount ?? 100) * 0.1));
    const initialContextMenuControls: ContextMenuControls = { visible: false, x: 0, y: 0, node: null };

    const [contextMenu, setContextMenu] = useState<ContextMenuControls>(initialContextMenuControls);

    const [, setRemovedNodeStorage] = useState<Node[]>([]);
    const [windowWidth, setWindowWidth] = useState(window.innerWidth);

    // save to photo
    const captureScreenshot = () => {
        const input = document.getElementById('graph') as HTMLElement;
        if (input) {
            toast.success("Capturing screenshot")
            html2canvas(input).then((canvas) => {
                const imgData = canvas.toDataURL();
                const link = document.createElement('a');
                link.href = imgData;
                link.download = 'graph-screenshot.png';
                link.click();
            });
        }
        else {
            toast.error("Could not capture screenshot", {
                position: "top-center",
            })
        }

    }


    useEffect(() => {
        // resizing of window
        const handleResize = () => {
            setWindowWidth(window.innerWidth);
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }, []);


    useEffect(() => {
        // Ensure the forceGraphRef is current and the graph has been initialized
        if (forceGraphRef.current) {
            // Set the default zoom level, for example, to 1.5
            forceGraphRef.current.zoom(0.4, 500); // The second parameter (500)  represents the duration of the zoom transition in milliseconds
        }
    }, []);

    // NODE PHYSICS
    useEffect(() => {
        if (forceGraphRef.current !== null) {
            forceGraphRef.current.d3Force('collision', d3.forceCollide(() => (100)).strength(0.75));
            // ordering
            if (orderByTime) {
                forceGraphRef.current.d3Force('rank', d3.forceY((node: Node) => (node.rank ?? 0) * 100).strength(0.5));
                forceGraphRef.current.d3Force('x', d3.forceX(windowWidth / 2).strength(0.5));
            }
            else {
                forceGraphRef.current.d3Force('rank', null);
            }
        }
    }, [currentGraphData, orderByTime, windowWidth]);


    useEffect(() => {
        const updateMousePosition = (event: { clientX: number; clientY: number; }) => {
            if (tooltip.display) {
                setTooltip({ ...tooltip, x: event.clientX, y: event.clientY });
            }
        };
        window.addEventListener("mousemove", updateMousePosition);

        return () => {
            window.removeEventListener("mousemove", updateMousePosition);
        };
    }, [tooltip]);

    const handleNodeHover = (node: Node | null) => {
        if (node) {
            // setTooltip({ display: true, text: `${node.id}`, x: tooltip.x, y: tooltip.y, fx: node.fx, fy: node.fy });
        } else {
            setTooltip((prev) => ({ ...prev, display: false }));
        }
    };

    const handleLinkHover = (link: Link | null) => {
        if (link) {
            setTooltip({ display: true, text: `${link.numOfTransitions + " paths" ?? "no paths"}`, x: tooltip.x, y: tooltip.y, fx: undefined, fy: undefined });
        }
        else {
            setTooltip((prev) => ({ ...prev, display: false }));
        }

    }

    const handleThresholdChangeRemove = () => {
        const newLinks: LinkObject[] = changeLinkThreshold(graphData.links as LinkObject[], edgesThreshold);
        const { newNodes, removedNodes } = removeUnusedNodes(currentGraphData.nodes, newLinks);
        setRemovedNodeStorage(removedNodes);
        setCurrentGraphData({ nodes: newNodes, links: newLinks });
    }

    const handleThresholdChangeAdd = () => {
        const newLinks: LinkObject[] = changeLinkThreshold(graphData.links as LinkObject[], edgesThreshold);
        const newNodes: Node[] = addUnusedNodes(currentGraphData.nodes, newLinks);
        setCurrentGraphData({ nodes: newNodes, links: newLinks });
    }

    const handleThresholdChange = (chosenNum: number, previousValue: number) => {
        if (chosenNum > previousValue) {
            handleThresholdChangeRemove()
        }
        else {
            handleThresholdChangeAdd()
        }
    }

    useEffect(() => {
        // threshold logic
        if ((edgesThreshold !== previousEdgesThreshold && forceGraphRef.current !== null) && edgesThreshold >= 0) {
            if (edgesThreshold !== previousEdgesThreshold && forceGraphRef.current !== null) {
                // forceGraphRef.current.pauseAnimation();
                handleThresholdChange(edgesThreshold, previousEdgesThreshold);
                // forceGraphRef.current.resumeAnimation();
            }
        }
    }, [edgesThreshold])

    useEffect(() => {
        const timer = setTimeout(() => {
            if (graphData && graphData.nodes.length > 0) {
                const initialThreshold = (graphData.maxEdgeCount ?? 100) * 0.1;
                setEdgesThreshold(initialThreshold); // Ensure the initial threshold is set correctly.
                // Assuming handleThresholdChange is correctly implemented to handle the initial state
                handleThresholdChange(initialThreshold, previousEdgesThreshold);
            }
        }, 200); // Delay execution by 500ms to ensure graphData is loaded before applying logic.

        // Cleanup function to clear the timeout if the component unmounts
        return () => clearTimeout(timer);
    }, [graphData]); // Depend on graphData to ensure it's loaded before applying logic.

    return (
        <>



            {
                contextMenu.visible && (
                    <div
                        style={{
                            position: 'absolute',
                            top: contextMenu.y,
                            left: contextMenu.x - 150,
                            // backgroundColor: 'white',
                            // border: '1px solid black',
                            borderRadius: '5px',
                            // padding: '10px',
                            zIndex: 1000,
                        }}
                        className={"bg-slate-100 p-2 border-2 border-black rounded-md shadow-lg"}
                        onContextMenu={(e) => {
                            // Prevent the browser context menu from appearing
                            e.preventDefault();
                        }}
                    >
                        <div className="flex justify-between items-center">
                            <span />
                            <div className="text-center underline font-bold">
                                Node Info
                            </div>
                            <button
                                className="p-0.5 bg-red-500 text-white rounded-md hover:bg-red-600"
                                onClick={() => setContextMenu({ visible: false, x: 0, y: 0, node: null })}
                            >
                                <Cross2Icon />
                            </button>
                        </div>
                        <div className="">
                            <span className="font-bold">Node ID: </span>
                            {contextMenu.node?.id ?? "No ID"}
                        </div>
                        {contextMenu.node?.problemId && (
                            <div className="">
                                <span className="font-bold"> Problem ID:</span> {contextMenu.node.problemId}
                            </div>

                        )}
                        {contextMenu.node?.selfLoops && (
                            <div className="">
                                <span className="font-bold">Self Loops:</span> {contextMenu.node.selfLoops}
                            </div>
                        )}
                        {contextMenu.node?.cumulativeSelfLoops && (
                            <div className="">
                                <span className="font-bold">Cumulative Self Loops:</span> {contextMenu.node.cumulativeSelfLoops}
                            </div>
                        )}
                        {contextMenu.node?.edgesIn && (
                            <div className="">
                                <span className="font-bold">Edges In:</span> {contextMenu.node.edgesIn}
                            </div>
                        )}
                        {contextMenu.node?.edgesOut && (
                            <div className="">
                                <span className="font-bold">Edges Out:</span> {contextMenu.node.edgesOut}
                            </div>
                        )}

                        {contextMenu.node?.cumulativeEdgesOut && (
                            <div className="">
                                <span className="font-bold">Students leaving:</span> {contextMenu.node.cumulativeEdgesOut}
                            </div>
                        )}
                        {contextMenu.node?.cumulativeEdgesIn && (
                            <div className="">
                                <span className="font-bold">Students entering:</span> {contextMenu.node.cumulativeEdgesIn}
                            </div>
                        )}
                        {contextMenu.node?.rank && (
                            <div className="">
                                <span className="font-bold">Average Step Rank:</span> {contextMenu.node.rank.toFixed(1)}
                            </div>
                        )}
                        {contextMenu.node?.times_errored && (
                            <div className="">
                                <span className="font-bold">Times Errored:</span> {contextMenu.node.times_errored}
                            </div>
                        )}
                        {contextMenu.node?.rank && (
                            <div className="">
                                <span className="font-bold">Rank:</span> {contextMenu.node.rank ?? ""}
                            </div>
                        )}




                    </div>
                )
            }

            {tooltip.display && (
                <div
                    className="bg-slate-100"
                    style={{
                        position: "absolute",
                        top: tooltip.y,
                        left: tooltip.x - 200,
                        padding: "5px",
                        border: "1px solid #ddd",
                        borderRadius: "4px",
                        pointerEvents: "none",
                        zIndex: 1000,
                    }}
                >
                    {tooltip.text ?? ""}
                </div>
            )}

            <div className="flex flex-col">
                <div className=" flex gap-5 p-2 ">
                    <ToggleTool
                        toolName="Photo"
                        description="Capture a screenshot of the graph."
                        initialState={false}
                        onStateChange={captureScreenshot}
                        icon="camera"
                        buttonMode={true}

                    />
                    <div className="flex p-3 gap-3 items-baseline">
                        Edges Threshold (%):
                        <input
                            type="number"
                            min={0}
                            max={100}
                            className="p-1 border border-black rounded-lg w-[75px] text-center"
                            value={Math.round((edgesThreshold / (graphData.maxEdgeCount ?? 100)) * 100)}
                            onChange={(e) => {
                                const currentValue = edgesThreshold;
                                const newValue = (parseInt(e.target.value) / 100) * (graphData.maxEdgeCount ?? 100);
                                setEdgesThreshold(newValue)
                                setPreviousEdgesThreshold(currentValue);
                            }}
                        />
                        <span>
                            <Slider
                                value={[(edgesThreshold / (graphData.maxEdgeCount ?? 100)) * 100]} // Convert absolute threshold to percentage for the slider
                                className="w-[300px]"
                                min={0}
                                max={100}
                                onValueChange={(value: number[]) => {
                                    // Convert the percentage back to an absolute number for edgesThreshold
                                    const newValue = (value[0] / 100) * (graphData.maxEdgeCount ?? 100);
                                    setEdgesThreshold(newValue);
                                }}
                                onValueCommit={(value: number[]) => {
                                    // This can be used for actions upon releasing the slider, similar to onValueChange
                                    const newValue = (value[0] / 100) * (graphData.maxEdgeCount ?? 100);
                                    setEdgesThreshold(newValue);
                                    setPreviousEdgesThreshold(edgesThreshold); // Update previous threshold if needed
                                }}
                            />


                        </span>
                    </div>

                </div>

                <div
                    id="graph"
                    className="bg-slate-200 border border-black rounded-lg "
                >

                    <ForceGraph2D
                        // @ts-expect-error this type won't match up in typescript but it's ok
                        graphData={currentGraphData}
                        nodeRelSize={30}
                        width={windowWidth}
                        height={window.innerHeight - 200}
                        ref={forceGraphRef}
                        onNodeHover={handleNodeHover}
                        onLinkHover={handleLinkHover}
                        linkCurvature={(link) => link.curvature || 0}
                        nodeAutoColorBy={"problemId"}
                        // cooldownTime={freezeNodes ? 0 : Infinity} // this controls the "steadiness" -- 1 is the most steady, infinity is the least
                        onNodeClick={(node, event) => {
                            setContextMenu({ visible: true, x: event.clientX, y: event.clientY, node: node });
                        }}
                        onNodeDragEnd={(node) => {
                            if (pinnable) {
                                if (node.border !== true) {
                                    toast.success("Node pinned", {
                                        icon: "📌",
                                        position: "bottom-right",
                                    })
                                }
                                node.fx = node.x;
                                node.fy = node.y;
                                node.border = true;
                            }

                        }}
                        onNodeRightClick={(node, event) => {
                            console.log("Node right clicked: ", node);
                            event.preventDefault();

                        }}
                        onLinkClick={(link) => {
                            console.log("Link clicked: ", link.source, link.target);
                        }}
                        onLinkRightClick={(link) => {
                            console.log("Link right clicked: ", link.source, link.target);
                        }}
                        nodeCanvasObject={(node, ctx, globalScale) => {
                            const label = node.label;
                            const fontSize = 14 / globalScale;
                            const radius = 14 / globalScale;
                            node.radius = radius;
                            ctx.beginPath();
                            switch (node.shape) {
                                case 'circle':
                                    ctx.arc(node.x!, node.y!, radius, 0, 2 * Math.PI, false);
                                    break;
                                case 'triangle':
                                    ctx.beginPath();
                                    ctx.moveTo(node.x!, node.y! - radius);
                                    ctx.lineTo(node.x! + radius, node.y! + radius);
                                    ctx.lineTo(node.x! - radius, node.y! + radius);
                                    ctx.closePath();
                                    break;
                                case 'square':
                                    ctx.rect(node.x! - radius, node.y! - radius, radius * 2, radius * 2);
                                    break;
                                default:
                                    ctx.arc(node.x!, node.y!, radius, 0, 2 * Math.PI, false);

                            }

                            ctx.fillStyle = node.color ?? 'blue';
                            ctx.fill();

                            // border
                            if (node.border) {
                                ctx.lineWidth = 5 / globalScale;
                                ctx.strokeStyle = 'blue';
                                ctx.stroke();
                            }

                            const labelOffsetY = radius + fontSize;
                            ctx.font = `${fontSize}px Sans-Serif`;
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'middle';
                            ctx.fillStyle = 'black';
                            ctx.fillText(label, node.x!, node.y! + labelOffsetY);
                        }}
                        linkDirectionalArrowLength={20}
                        // linkDirectionalParticles={2}
                        // linkDirectionalParticleWidth={7}
                        linkDirectionalArrowColor={(link) => link.color || ''}
                        linkDirectionalArrowRelPos={1}
                        linkWidth={link => link.width || 1}
                        d3VelocityDecay={0.8}
                        // d3AlphaDecay={0.05}
                        minZoom={0.4}
                        maxZoom={2}
                    />
                </div>
            </div>
        </>
    )
}