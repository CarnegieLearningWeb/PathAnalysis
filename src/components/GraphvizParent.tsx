// React component code
import { useContext, useEffect, useRef, useState, useMemo } from 'react';
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
import { Download } from 'lucide-react';

// History item interface
interface HistoryItem {
    id: string;
    type: 'node' | 'edge';
    timestamp: Date;
    title: string;
    content: string;
    graphType: string;
    expanded: boolean;
}

const titleCase = (str: string | null) => str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : '';

// Helper function to compare arrays for exact equality
const arraysEqual = (a: string[], b: string[]): boolean => {
    if (a.length !== b.length) return false;
    return a.every((val, index) => val === b[index]);
};

interface GraphvizParentProps {
    csvData: string;
    filter: string | null;
    selfLoops: boolean;
    minVisits: number;
    onMaxEdgeCountChange: (count: number) => void;
    onMaxMinEdgeCountChange: (count: number) => void;
    errorMode: boolean;
    uniqueStudentMode: boolean;
}

const GraphvizParent: React.FC<GraphvizParentProps> = ({
    csvData,
    filter,
    selfLoops,
    minVisits,
    onMaxEdgeCountChange,
    onMaxMinEdgeCountChange,
    errorMode,
    uniqueStudentMode
}) => {
    const [dotString, setDotString] = useState<string | null>(null);
    const [filteredDotString, setFilteredDotString] = useState<string | null>(null);
    const [topDotString, setTopDotString] = useState<string | null>(null);
    const { selectedSequence, setSelectedSequence, top5Sequences, setTop5Sequences } = useContext(Context);

    // History state management
    const [activeTab, setActiveTab] = useState<'graphs' | 'history'>('graphs');
    const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
    
    // Track recent clicks to prevent duplicates
    const recentClicks = useRef<Set<string>>(new Set());

    // Refs for rendering the Graphviz graphs
    const graphRefMain = useRef<HTMLDivElement>(null);
    const graphRefFiltered = useRef<HTMLDivElement>(null);
    const graphRefTop = useRef<HTMLDivElement>(null);

    // Memoized data processing for main graph - responds to both selfLoops setting and uniqueStudentMode
    const mainGraphData = useMemo(() => {
        if (!csvData) return null;
        
        const sortedData = loadAndSortData(csvData);
        // Self-loops should only be included when selfLoops is enabled AND not in unique student mode
        // In unique student mode (first attempts), self-loops are logically impossible
        const includeLoops = selfLoops && !uniqueStudentMode;
        const stepSequences = createStepSequences(sortedData, includeLoops);
        const outcomeSequences = createOutcomeSequences(sortedData);
        
        // Add equation answer analysis
        const equationStats = analyzeEquationAnswerTransitions(stepSequences, outcomeSequences);
        console.log(formatEquationAnswerStats(equationStats));
        
        const results = countEdges(stepSequences, outcomeSequences, sortedData);
        
        return {
            sortedData,
            stepSequences,
            outcomeSequences,
            ...results
        };
    }, [csvData, selfLoops, uniqueStudentMode]); // Depends on both selfLoops and uniqueStudentMode
    
    // Main graph calculation - STATIC (only responds to uniqueStudentMode)
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

            // Update the maxEdgeCount in the parent component based on mode
            const maxCountToUse = uniqueStudentMode ? maxEdgeCount : Math.max(...Object.values(totalVisits), 1);
            console.log("GraphvizParent: Setting maxEdgeCount to:", maxCountToUse, "for mode:", uniqueStudentMode ? "unique students" : "total visits");
            onMaxEdgeCountChange(maxCountToUse);

            // Calculate and update the maximum minimum-edge count
            const sequenceToUse = selectedSequence || topSequences[0]?.sequence;
            if (sequenceToUse) {
                console.log("GraphvizParent: Calculating maxMinEdgeCount for MAIN graph");
                console.log("GraphvizParent: Sequence length:", sequenceToUse.length);
                console.log("GraphvizParent: Total edge count keys:", Object.keys(newEdgeCounts).length);
                console.log("GraphvizParent: Unique student mode:", uniqueStudentMode);
                
                // Use edgeCounts (unique students) or totalVisits based on mode
                const countsToUse = uniqueStudentMode ? newEdgeCounts : totalVisits;
                const maxMinEdgeCount = calculateMaxMinEdgeCount(countsToUse, sequenceToUse);
                console.log("GraphvizParent: Setting maxMinEdgeCount to:", maxMinEdgeCount);
                onMaxMinEdgeCountChange(maxMinEdgeCount);
            }

            if (JSON.stringify(top5Sequences) !== JSON.stringify(topSequences) || top5Sequences === null) {
                setTop5Sequences(topSequences);
                if (topSequences && selectedSequence === undefined) {
                    setSelectedSequence(topSequences[0].sequence);
                }
            }

            // Use appropriate data for thickness normalization based on mode
            const countsForThickness = uniqueStudentMode ? newEdgeCounts : totalVisits;
            const maxCountForThickness = uniqueStudentMode ? maxEdgeCount : Math.max(...Object.values(totalVisits), 1);
            const normalizedThicknesses = normalizeThicknesses(countsForThickness, maxCountForThickness, 10);
            
            console.log("GraphvizParent: Using counts for thickness:", uniqueStudentMode ? "unique students" : "total visits");
            console.log("GraphvizParent: Max count for thickness:", maxCountForThickness);

            // Main graph - responds to uniqueStudentMode and minVisits slider
            // Use mode-appropriate edge counts
            const edgeCountsForGraph = uniqueStudentMode ? newEdgeCounts : totalVisits;
            
            // Use simple fixed threshold for connectivity, but allow minVisits to control visibility
            const optimalThreshold = 1;
            
            const dotString = generateDotString(
                normalizedThicknesses,
                ratioEdges,
                edgeOutcomeCounts,
                edgeCountsForGraph,
                totalNodeEdges,
                optimalThreshold, // Use calculated optimal threshold
                minVisits, // Use minVisits from slider to control main graph
                sequenceToUse,
                false,
                totalVisits,
                repeatVisits,
                errorMode, // Use actual errorMode setting
                mainGraphData.firstAttemptOutcomes,
                uniqueStudentMode,
            );

            setDotString(dotString);

            setTopDotString(
                generateDotString(
                    normalizedThicknesses,
                    ratioEdges,
                    edgeOutcomeCounts,
                    edgeCountsForGraph,
                    totalNodeEdges,
                    0, // Use threshold 0 to show ALL edges for static top graph
                    0, // Force minVisits to 0 for static top graph
                    selectedSequence || topSequences[0].sequence,
                    true,
                    totalVisits,
                    repeatVisits,
                    false, // Force errorMode to false for static top graph
                    mainGraphData.firstAttemptOutcomes,
                    uniqueStudentMode,
                )
            );
        }
    }, [mainGraphData, selectedSequence, setTop5Sequences, top5Sequences, onMaxEdgeCountChange, onMaxMinEdgeCountChange, uniqueStudentMode, minVisits, errorMode]); // Responds to uniqueStudentMode, minVisits, errorMode and selectedSequence

    // Memoized filtered graph data
    const filteredGraphData = useMemo(() => {
        if (!filter || filter === 'ALL' || !mainGraphData) return null;
        
        const filteredData = mainGraphData.sortedData.filter(row => row['CF (Workspace Progress Status)'] === filter);
        const filteredStepSequences = createStepSequences(filteredData, selfLoops && !uniqueStudentMode);
        const filteredOutcomeSequences = createOutcomeSequences(filteredData);
        
        const results = countEdges(filteredStepSequences, filteredOutcomeSequences, filteredData);
        
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
    }, [filter, mainGraphData, selfLoops, uniqueStudentMode]);

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
                console.log("GraphvizParent: Calculating maxMinEdgeCount for FILTERED graph");
                console.log("GraphvizParent: Filter:", filter);
                console.log("GraphvizParent: Filtered edge count keys:", Object.keys(filteredEdgeCounts).length);
                console.log("GraphvizParent: Filtered unique student mode:", uniqueStudentMode);
                const filteredCountsToUse = uniqueStudentMode ? filteredEdgeCounts : filteredTotalVisits;
                const filteredMinEdgeCount = calculateMaxMinEdgeCount(filteredCountsToUse, sequenceToUse);
                console.log("GraphvizParent: Setting filtered maxMinEdgeCount to:", filteredMinEdgeCount);
                onMaxMinEdgeCountChange(filteredMinEdgeCount);
            }

            // Use appropriate data for filtered thickness normalization based on mode
            const filteredCountsForThickness = uniqueStudentMode ? filteredEdgeCounts : filteredTotalVisits;
            const filteredMaxCountForThickness = uniqueStudentMode ? filteredMaxEdgeCount : Math.max(...Object.values(filteredTotalVisits), 1);
            const normalizedThicknesses = normalizeThicknesses(filteredCountsForThickness, filteredMaxCountForThickness, 10);

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
                filteredGraphData.firstAttemptOutcomes,
                uniqueStudentMode,
            );

            setFilteredDotString(filteredDotString);
        } else {
            setFilteredDotString(null);
            // Reset max min edge count to the main graph's value
            if (mainGraphData) {
                const sequenceToUse = selectedSequence || top5Sequences?.[0]?.sequence;
                if (sequenceToUse) {
                    const resetCountsToUse = uniqueStudentMode ? mainGraphData.edgeCounts : mainGraphData.totalVisits;
                    const maxMinEdgeCount = calculateMaxMinEdgeCount(resetCountsToUse, sequenceToUse);
                    onMaxMinEdgeCountChange(maxMinEdgeCount);
                }
            }
        }
    }, [filteredGraphData, minVisits, selectedSequence, top5Sequences, errorMode, mainGraphData, onMaxMinEdgeCountChange, uniqueStudentMode]);

    // Cleanup all event listeners when component unmounts
    useEffect(() => {
        return () => {
            // Clean up all event listeners for all graphs
            eventListenersRef.current.forEach((_, filename) => {
                cleanupEventListeners(filename);
            });
        };
    }, []);

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

    // Helper functions for history management
    const formatTime = (date: Date): string => {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };

    const formatContent = (content: string): string => {
        return content.replace(/\\n/g, '\n');
    };

    const toggleHistoryItem = (itemId: string) => {
        setHistoryItems(prev => prev.map(item => 
            item.id === itemId ? { ...item, expanded: !item.expanded } : item
        ));
    };

    // Helper function to parse edge names that may contain arrows in step names
    const parseEdgeName = (edgeName: string): [string, string] => {
        const lastArrowIndex = edgeName.lastIndexOf('->');
        if (lastArrowIndex === -1) {
            return [edgeName, ''];
        }
        
        const currentStep = edgeName.substring(0, lastArrowIndex);
        const nextStep = edgeName.substring(lastArrowIndex + 2);
        
        return [currentStep, nextStep];
    };

    // Helper function to calculate progress status statistics for students at a node
    const calculateNodeProgressStats = (nodeName: string): { graduated: number; promoted: number; other: number; total: number } => {
        if (!mainGraphData) return { graduated: 0, promoted: 0, other: 0, total: 0 };
        
        const { stepSequences, sortedData } = mainGraphData;
        const studentsAtNode = new Set<string>();
        
        // Find all students who visited this node
        // stepSequences has structure: { [studentId]: { [problemName]: string[] } }
        if (stepSequences && Object.keys(stepSequences).length > 0) {
            Object.entries(stepSequences).forEach(([studentId, studentProblems]) => {
                // studentProblems is { [problemName]: string[] }
                if (studentProblems && typeof studentProblems === 'object') {
                    Object.values(studentProblems).forEach((problemSequence: string[]) => {
                        if (Array.isArray(problemSequence) && problemSequence.includes(nodeName)) {
                            studentsAtNode.add(studentId);
                        }
                    });
                }
            });
        }
        
        // Count progress status for students who visited this node
        let graduatedCount = 0;
        let promotedCount = 0;
        let otherCount = 0;
        
        if (sortedData && sortedData.length > 0) {
            // Create a map of all students and their progress status
            const studentProgressMap = new Map<string, string>();
            sortedData.forEach((row: any) => {
                const studentId = row['Anon Student Id'];
                const progressStatus = row['CF (Workspace Progress Status)'];
                if (studentId && progressStatus) {
                    studentProgressMap.set(studentId, progressStatus);
                }
            });
            
            studentsAtNode.forEach(studentId => {
                const progressStatus = studentProgressMap.get(studentId);
                
                if (progressStatus === 'GRADUATED') {
                    graduatedCount++;
                } else if (progressStatus === 'PROMOTED') {
                    promotedCount++;
                } else if (progressStatus) {
                    otherCount++;
                }
            });
        }
        
        return {
            graduated: graduatedCount,
            promoted: promotedCount,
            other: otherCount,
            total: studentsAtNode.size
        };
    };

    // Generate node tooltip content
    const generateNodeTooltip = (nodeName: string, graphType: string): string => {
        if (!mainGraphData) return `Node: ${nodeName}`;
        
        const { stepSequences, edgeCounts, edgeOutcomeCounts, firstAttemptOutcomes } = mainGraphData;
        
        // Find outgoing edges for outcome calculations
        const outgoingEdges = Object.keys(edgeCounts).filter(edge => edge.startsWith(`${nodeName}->`));
        
        // Calculate statistics based on mode
        let totalVisitors = 0;
        let totalNodeVisits = 0;
        const visitCounts: { [studentId: string]: number } = {};
        
        // Check if this is the selected sequence graph and we need to filter
        const isSelectedSequenceGraph = graphType === 'Selected Sequence';
        const sequenceToFilter = isSelectedSequenceGraph ? selectedSequence : null;
        
        if (stepSequences && Object.keys(stepSequences).length > 0) {
            Object.entries(stepSequences).forEach(([studentId, studentProblems]) => {
                // studentProblems is { [problemName]: string[] }
                if (studentProblems && typeof studentProblems === 'object') {
                    
                    // For selected sequence graph, check if student took the exact path
                    if (isSelectedSequenceGraph && sequenceToFilter) {
                        let studentFollowedSequence = false;
                        Object.values(studentProblems).forEach((problemSequence: string[]) => {
                            if (Array.isArray(problemSequence) && arraysEqual(problemSequence, sequenceToFilter)) {
                                studentFollowedSequence = true;
                            }
                        });
                        if (!studentFollowedSequence) {
                            return; // Skip this student if they didn't follow the exact sequence
                        }
                    }
                    
                    let studentNodeVisits = 0;
                    Object.values(studentProblems).forEach((problemSequence: string[]) => {
                        if (Array.isArray(problemSequence)) {
                            if (uniqueStudentMode) {
                                // In unique student mode, count only if student visited this node
                                const nodeVisits = problemSequence.filter(step => step === nodeName).length;
                                if (nodeVisits > 0) {
                                    studentNodeVisits = 1; // Count as 1 unique visit regardless of repeats
                                }
                            } else {
                                // In total visits mode, count all visits including repeats
                                const nodeVisits = problemSequence.filter(step => step === nodeName).length;
                                studentNodeVisits += nodeVisits;
                            }
                        }
                    });
                    
                    if (studentNodeVisits > 0) {
                        visitCounts[studentId] = studentNodeVisits;
                        totalNodeVisits += studentNodeVisits;
                    }
                }
            });
            totalVisitors = Object.keys(visitCounts).length;
        }
        
        const avgVisitsPerStudent = totalVisitors > 0 ? (totalNodeVisits / totalVisitors).toFixed(1) : '0';
        
        // Calculate correct student visit statistics
        let studentsWithSingleVisit = 0;
        let studentsWithMultipleVisits = 0;
        
        Object.values(visitCounts).forEach((visitCount: number) => {
            if (visitCount > 1) {
                studentsWithMultipleVisits++;
            } else {
                studentsWithSingleVisit++;
            }
        });
        
        
        const singleVisits = studentsWithSingleVisit;
        const multipleVisits = studentsWithMultipleVisits;
        
        // Note: Removed graph connectivity section to match history tab format
        
        // Calculate progress status statistics
        const progressStats = calculateNodeProgressStats(nodeName);
        const graduatedPercentage = progressStats.total > 0 ? ((progressStats.graduated / progressStats.total) * 100).toFixed(1) : '0';
        const promotedPercentage = progressStats.total > 0 ? ((progressStats.promoted / progressStats.total) * 100).toFixed(1) : '0';
        
        // Calculate outcome statistics for this node (from outgoing edges)
        const nodeOutcomes: { [outcome: string]: number } = {};
        const nodeFirstAttemptOutcomes: { [outcome: string]: number } = {};
        
        outgoingEdges.forEach(edge => {
            // All outcomes (including repeat attempts)
            const outcomes = edgeOutcomeCounts[edge] || {};
            Object.entries(outcomes).forEach(([outcome, count]) => {
                nodeOutcomes[outcome] = (nodeOutcomes[outcome] || 0) + count;
            });
            
            // First attempt outcomes only
            const firstAttempts = firstAttemptOutcomes[edge] || {};
            Object.entries(firstAttempts).forEach(([outcome, count]) => {
                nodeFirstAttemptOutcomes[outcome] = (nodeFirstAttemptOutcomes[outcome] || 0) + count;
            });
        });
        
        const totalOutcomes = Object.values(nodeOutcomes).reduce((sum, count) => sum + count, 0);
        const totalFirstAttempts = Object.values(nodeFirstAttemptOutcomes).reduce((sum, count) => sum + count, 0);
        
        const outcomeSummary = Object.entries(nodeOutcomes)
            .sort(([,a], [,b]) => b - a)
            .map(([outcome, count]) => {
                const percentage = totalOutcomes > 0 ? ((count / totalOutcomes) * 100).toFixed(1) : '0';
                return `${outcome}: ${count} (${percentage}%)`;
            })
            .slice(0, 5) // Show top 5 outcomes
            .join('\n      ');
        
        const firstAttemptSummary = Object.entries(nodeFirstAttemptOutcomes)
            .sort(([,a], [,b]) => b - a)
            .map(([outcome, count]) => {
                const percentage = totalFirstAttempts > 0 ? ((count / totalFirstAttempts) * 100).toFixed(1) : '0';
                return `${outcome}: ${count} (${percentage}%)`;
            })
            .slice(0, 5) // Show top 5 first attempt outcomes
            .join('\n      ');
        
        const activityLabel = uniqueStudentMode ? 'Student Activity' : 'Visit Activity';
        const visitorsLabel = uniqueStudentMode ? 'Total Students Visited' : 'Total Students Who Visited';
        const visitsLabel = uniqueStudentMode ? 'Total Visits (including repeats)' : 'Total Visits to This Node';
        const otherPercentage = progressStats.total > 0 ? ((progressStats.other / progressStats.total) * 100).toFixed(1) : '0.0';
        
        return `${activityLabel}:\n`
            + `    • ${visitorsLabel}: ${totalVisitors}\n`
            + `    • ${visitsLabel}: ${totalNodeVisits}\n`
            + `    • Students with single visit: ${singleVisits}\n`
            + `    • Students with multiple visits: ${multipleVisits}\n`
            + `    • Average visits per student: ${avgVisitsPerStudent}\n\n`
            + `Student Progress Status:\n`
            + `    • Graduated: ${progressStats.graduated} (${graduatedPercentage}%)\n`
            + `    • Promoted: ${progressStats.promoted} (${promotedPercentage}%)\n`
            + `    • Other: ${progressStats.other} (${otherPercentage}%)\n`
            + `    • Total students tracked: ${progressStats.total}\n\n`
            + `Learning Outcomes:\n`
            + `    • All Outcomes:\n`
            + `      ${outcomeSummary || 'No outcome data available'}\n\n`
            + `    • First Attempt Outcomes:\n`
            + `      ${firstAttemptSummary || 'No first attempt data available'}`;
    };
    

    // Helper function to calculate exact progress status statistics for an edge
    const calculateEdgeProgressStats = (edgeName: string): { graduated: number; promoted: number; other: number; total: number; graduatedPercentage: string; promotedPercentage: string } => {
        if (!mainGraphData) return { graduated: 0, promoted: 0, other: 0, total: 0, graduatedPercentage: '0', promotedPercentage: '0' };
        
        const { stepSequences, sortedData } = mainGraphData;
        const [fromStep, toStep] = parseEdgeName(edgeName);
        const studentsOnEdge = new Set<string>();
        
        // Find all students who took this specific transition
        if (stepSequences && Object.keys(stepSequences).length > 0) {
            Object.entries(stepSequences).forEach(([studentId, studentProblems]) => {
                if (studentProblems && typeof studentProblems === 'object') {
                    Object.values(studentProblems).forEach((problemSequence: string[]) => {
                        if (Array.isArray(problemSequence)) {
                            if (uniqueStudentMode) {
                                // In unique student mode, only count the first occurrence of this transition
                                for (let i = 0; i < problemSequence.length - 1; i++) {
                                    if (problemSequence[i] === fromStep && problemSequence[i + 1] === toStep) {
                                        studentsOnEdge.add(studentId);
                                        break; // Only count first occurrence per student
                                    }
                                }
                            } else {
                                // In total visits mode, we still count unique students but they represent all who ever made this transition
                                for (let i = 0; i < problemSequence.length - 1; i++) {
                                    if (problemSequence[i] === fromStep && problemSequence[i + 1] === toStep) {
                                        studentsOnEdge.add(studentId);
                                        break; // Still only add each student once to the set
                                    }
                                }
                            }
                        }
                    });
                }
            });
        }
        
        // Count exact progress status for students who took this transition
        let graduatedCount = 0;
        let promotedCount = 0;
        let otherCount = 0;
        
        if (sortedData && sortedData.length > 0 && studentsOnEdge.size > 0) {
            // Create a map of student progress status
            const studentProgressMap = new Map<string, string>();
            sortedData.forEach((row: any) => {
                const studentId = row['Anon Student Id'];
                const progressStatus = row['CF (Workspace Progress Status)'];
                if (studentId && progressStatus) {
                    studentProgressMap.set(studentId, progressStatus);
                }
            });
            
            studentsOnEdge.forEach(studentId => {
                const progressStatus = studentProgressMap.get(studentId);
                if (progressStatus === 'GRADUATED') {
                    graduatedCount++;
                } else if (progressStatus === 'PROMOTED') {
                    promotedCount++;
                } else if (progressStatus) {
                    otherCount++;
                }
            });
        }
        
        const total = studentsOnEdge.size;
        const graduatedPercentage = total > 0 ? ((graduatedCount / total) * 100).toFixed(1) : '0';
        const promotedPercentage = total > 0 ? ((promotedCount / total) * 100).toFixed(1) : '0';
        
        // Note: Progress status is always based on unique students regardless of mode
        // because progress status is a property of individual students, not visits
        
        return {
            graduated: graduatedCount,
            promoted: promotedCount,
            other: otherCount,
            total,
            graduatedPercentage,
            promotedPercentage
        };
    };

    // Generate edge tooltip content
    const generateEdgeTooltip = (edgeName: string, _graphType: string): string => {
        if (!mainGraphData) return `Edge: ${edgeName}`;
        
        const { edgeCounts, edgeOutcomeCounts, totalNodeEdges, ratioEdges, totalVisits } = mainGraphData;
        const outcomes = edgeOutcomeCounts[edgeName] || {};
        const [currentStep, _nextStep] = parseEdgeName(edgeName);
        
        // Use different counts based on mode
        const edgeCount = uniqueStudentMode ? (edgeCounts[edgeName] || 0) : (totalVisits[edgeName] || 0);
        
        // Calculate total visits to the start node by summing all outgoing edges
        const totalVisitsFromStartNode = Object.keys(totalVisits)
            .filter(edge => edge.startsWith(`${currentStep}->`))
            .reduce((sum, edge) => sum + (totalVisits[edge] || 0), 0);
            
        const totalAtStartNode = uniqueStudentMode ? 
            (totalNodeEdges[currentStep] || 0) : 
            (totalVisitsFromStartNode || totalNodeEdges[currentStep] || 0);
        
        const ratioPercentage = ((ratioEdges[edgeName] || 0) * 100).toFixed(1);
        const totalOutcomes = Object.values(outcomes).reduce((sum, count) => sum + count, 0);
        
        const pathCount = edgeCount;
        const totalAtStart = totalAtStartNode;
        const notTakingPath = Math.max(0, totalAtStart - pathCount); // Ensure non-negative
        
        // Calculate progress status statistics
        const progressStats = calculateEdgeProgressStats(edgeName);
        
        // All outcomes breakdown
        const allOutcomes = Object.entries(outcomes)
            .sort(([,a], [,b]) => b - a)
            .map(([outcome, count]) => {
                const percentage = totalOutcomes > 0 ? ((count / totalOutcomes) * 100).toFixed(1) : '0';
                return `${outcome}: ${count} (${percentage}%)`;
            })
            .join('\n      ');
        
        // Calculate actual first attempt outcomes from mainGraphData
        const edgeFirstAttemptOutcomes = mainGraphData?.firstAttemptOutcomes?.[edgeName] || {};
        const totalFirstAttempts = Object.values(edgeFirstAttemptOutcomes).reduce((sum, count) => sum + count, 0);
        
        const firstAttemptOutcomes = Object.entries(edgeFirstAttemptOutcomes)
            .sort(([,a], [,b]) => b - a)
            .map(([outcome, count]) => {
                const percentage = totalFirstAttempts > 0 ? ((count / totalFirstAttempts) * 100).toFixed(1) : '0';
                return `${outcome}: ${count} (${percentage}%)`;
            })
            .join('\n      ');
        
        // Calculate visual thickness (normalized) based on mode
        const countsForThickness = uniqueStudentMode ? edgeCounts : totalVisits;
        const maxCount = Math.max(...Object.values(countsForThickness));
        const thickness = maxCount > 0 ? ((pathCount / maxCount) * 10).toFixed(1) : '1.0';
        
        const modeLabel = uniqueStudentMode ? 'Students' : 'Visits';
        const pathLabel = uniqueStudentMode ? 'Students taking this path' : 'Total visits on this path';
        const startLabel = uniqueStudentMode ? `Students at ${currentStep}` : `Total visits to ${currentStep}`;
        const notTakingLabel = uniqueStudentMode ? 'Students NOT taking this path' : 'Visits to other paths from this node';
        
        return `${modeLabel} Flow:\n`
            + `    • ${pathLabel}: ${pathCount}\n`
            + `    • ${startLabel}: ${totalAtStart}\n`
            + `    • ${notTakingLabel}: ${notTakingPath}\n`
            + `    • Transition Probability: ${ratioPercentage}%\n`
            + `      (${pathCount} of ${totalAtStart} ${modeLabel.toLowerCase()})\n\n`
            + `Student Progress Status:\n`
            + `    • Graduated: ${progressStats.graduated} (${progressStats.graduatedPercentage}%)\n`
            + `    • Promoted: ${progressStats.promoted} (${progressStats.promotedPercentage}%)\n`
            + `    • Other: ${progressStats.other} (${progressStats.total > 0 ? ((progressStats.other / progressStats.total) * 100).toFixed(1) : '0.0'}%)\n`
            + `    • Total students tracked: ${progressStats.total}\n\n`
            + `Transition Outcomes:\n`
            + `    • All Outcomes:\n`
            + `      ${allOutcomes || 'No outcome data'}\n\n`
            + `    • First Attempt Outcomes:\n`
            + `      ${firstAttemptOutcomes || 'No first attempt data'}\n\n`
            + `Visual Properties:\n`
            + `    • Edge Thickness: ${thickness} (normalized)\n`
            + `    • Path Frequency: ${pathCount} ${modeLabel.toLowerCase()}\n`
            + `    • Min ${modeLabel} Threshold: ${minVisits}`;
    };

    // Store references to attached event listeners for cleanup
    const eventListenersRef = useRef<Map<string, { elements: Element[], handlers: ((e: Event) => void)[] }>>(new Map());

    // Store transform states for each graph to persist across tab switches
    const transformStates = useRef<{[key: string]: {
        scale: number;
        translateX: number;
        translateY: number;
        initialScale: number;
        initialTranslateX: number;
        initialTranslateY: number;
        isDragging: boolean;
        lastMouseX: number;
        lastMouseY: number;
    }}>({});

    // Cleanup function to remove all event listeners for a specific graph
    const cleanupEventListeners = (filename: string) => {
        const listeners = eventListenersRef.current.get(filename);
        if (listeners) {
            listeners.elements.forEach((element, index) => {
                const handler = listeners.handlers[index];
                if (handler) {
                    element.removeEventListener('click', handler);
                }
            });
            eventListenersRef.current.delete(filename);
        }
    };

    // Render Graphviz graphs using d3-graphviz with advanced centering and zoom functionality
    const renderGraph = (
        dot: string | null,
        ref: React.RefObject<HTMLDivElement>,
        filename: string,
        numberOfGraphs: number
    ) => {
        if (dot && ref.current) {
            // Clean up existing event listeners for this graph
            cleanupEventListeners(filename);
            
            // Dynamically adjust width based on the number of graphs
            const width = numberOfGraphs === 3 ? 325 : 425;
            const height = 530;
            
            // Account for container padding more accurately
            const containerPadding = 16; // p-4 = 16px padding on each side
            const effectiveWidth = width - (containerPadding * 2);
            const effectiveHeight = height - (containerPadding * 2);

            try {
                graphviz(ref.current)
                    .width(width)
                    .height(height)
                    .engine('dot')
                    .zoom(false)
                    .fit(false)
                    .tweenShapes(false)
                    .renderDot(dot);

                // Add advanced centering, zoom and pan functionality after rendering
                setTimeout(() => {
                    if (ref.current) {
                        const svg = ref.current.querySelector('svg') as SVGSVGElement;
                        if (svg) {
                            const gElement = svg.querySelector('g') as SVGGElement;

                            // Calculate initial centering and scaling
                            let initialScale = 1;
                            let initialTranslateX = 0;
                            let initialTranslateY = 0;

                            if (gElement) {
                                const bbox = gElement.getBBox();
                                
                                if (bbox.width > 0 && bbox.height > 0) {
                                    // Only scale down if the graph is actually too large
                                    const padding = 60;
                                    const availableWidth = effectiveWidth - padding * 2;
                                    const availableHeight = effectiveHeight - padding * 2;
                                    
                                    // Only scale if graph is larger than available space
                                    if (bbox.width > availableWidth || bbox.height > availableHeight) {
                                        const scaleX = availableWidth / bbox.width;
                                        const scaleY = availableHeight / bbox.height;
                                        initialScale = Math.min(scaleX, scaleY);
                                    } else {
                                        // Graph fits fine, use normal scale
                                        initialScale = 1.0;
                                    }
                                    
                                    // Calculate scaled dimensions
                                    const scaledWidth = bbox.width * initialScale;
                                    const scaledHeight = bbox.height * initialScale;
                                    
                                    // Calculate top-left position for the scaled graph
                                    const scaledBboxTopLeftX = bbox.x * initialScale;
                                    const scaledBboxTopLeftY = bbox.y * initialScale;
                                    
                                    // Calculate proper centering
                                    initialTranslateX = (width - scaledWidth) / 2 - scaledBboxTopLeftX;
                                    initialTranslateY = (height - scaledHeight) / 2 - scaledBboxTopLeftY;
                                    
                                    // Add upward bias to prevent bottom nodes from being cut off
                                    initialTranslateY -= 60;
                                    
                                    // Add leftward bias to center graphs better
                                    initialTranslateX -= 50;
                                    
                                    console.log(`Centering calculation for ${filename}:`, {
                                        containerSize: { width, height },
                                        effectiveSize: { width: effectiveWidth, height: effectiveHeight },
                                        bbox: { x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height },
                                        scale: initialScale,
                                        scaledDimensions: { width: scaledWidth, height: scaledHeight },
                                        translate: { x: initialTranslateX, y: initialTranslateY },
                                        containerPadding
                                    });
                                }
                            }

                            // Always reset to correct initial centering values for new renders
                            // This ensures proper centering every time the graph is rendered
                            transformStates.current[filename] = {
                                scale: initialScale,
                                translateX: initialTranslateX,
                                translateY: initialTranslateY,
                                initialScale: initialScale,
                                initialTranslateX: initialTranslateX,
                                initialTranslateY: initialTranslateY,
                                isDragging: false,
                                lastMouseX: 0,
                                lastMouseY: 0
                            };

                            // Create local transform state for interaction handling
                            // Always start with the correctly calculated centering values
                            const transformState = {
                                scale: transformStates.current[filename].scale,
                                translateX: transformStates.current[filename].translateX,
                                translateY: transformStates.current[filename].translateY,
                                isDragging: false,
                                lastMouseX: 0,
                                lastMouseY: 0
                            };

                            // Function to update SVG transform
                            const updateTransform = () => {
                                if (gElement) {
                                    gElement.setAttribute('transform', 
                                        `translate(${transformState.translateX}, ${transformState.translateY}) scale(${transformState.scale})`
                                    );
                                }
                            };

                            // Apply current transform
                            updateTransform();

                            // Zoom constraints
                            const minScale = 0.1;
                            const maxScale = 3.0;

                            // Reset view function
                            const resetView = () => {
                                transformState.scale = transformStates.current[filename].initialScale;
                                transformState.translateX = transformStates.current[filename].initialTranslateX;
                                transformState.translateY = transformStates.current[filename].initialTranslateY;
                                // Update persistent state
                                transformStates.current[filename].scale = transformState.scale;
                                transformStates.current[filename].translateX = transformState.translateX;
                                transformStates.current[filename].translateY = transformState.translateY;
                                updateTransform();
                            };

                            // Mouse wheel zoom with focal point
                            const wheelHandler = (e: WheelEvent) => {
                                e.preventDefault();
                                const rect = svg.getBoundingClientRect();
                                const mouseX = e.clientX - rect.left;
                                const mouseY = e.clientY - rect.top;
                                
                                const scaleFactor = e.deltaY > 0 ? 0.98 : 1.02;
                                const newScale = Math.max(minScale, Math.min(maxScale, transformState.scale * scaleFactor));
                                
                                if (newScale !== transformState.scale) {
                                    const scaleChange = newScale / transformState.scale;
                                    transformState.translateX = mouseX - scaleChange * (mouseX - transformState.translateX);
                                    transformState.translateY = mouseY - scaleChange * (mouseY - transformState.translateY);
                                    transformState.scale = newScale;
                                    // Update persistent state
                                    transformStates.current[filename].scale = transformState.scale;
                                    transformStates.current[filename].translateX = transformState.translateX;
                                    transformStates.current[filename].translateY = transformState.translateY;
                                    updateTransform();
                                }
                            };

                            // Pan functionality with boundary constraints
                            const mouseDownHandler = (e: MouseEvent) => {
                                if (e.button === 0) { // Left mouse button
                                    transformState.isDragging = true;
                                    transformState.lastMouseX = e.clientX;
                                    transformState.lastMouseY = e.clientY;
                                    svg.style.cursor = 'grabbing';
                                }
                            };

                            const mouseMoveHandler = (e: MouseEvent) => {
                                if (transformState.isDragging) {
                                    const deltaX = e.clientX - transformState.lastMouseX;
                                    const deltaY = e.clientY - transformState.lastMouseY;
                                    
                                    let newTranslateX = transformState.translateX + deltaX;
                                    let newTranslateY = transformState.translateY + deltaY;
                                    
                                    // Apply pan boundaries to prevent dragging completely outside container
                                    if (gElement) {
                                        const bbox = gElement.getBBox();
                                        const scaledWidth = bbox.width * transformState.scale;
                                        const scaledHeight = bbox.height * transformState.scale;
                                        
                                        // Calculate boundaries with padding
                                        const padding = 50;
                                        
                                        if (scaledWidth > width) {
                                            const minX = width - (bbox.x * transformState.scale + scaledWidth) - padding;
                                            const maxX = -bbox.x * transformState.scale + padding;
                                            newTranslateX = Math.max(minX, Math.min(maxX, newTranslateX));
                                        }
                                        
                                        if (scaledHeight > height) {
                                            const minY = height - (bbox.y * transformState.scale + scaledHeight) - padding;
                                            const maxY = -bbox.y * transformState.scale + padding;
                                            newTranslateY = Math.max(minY, Math.min(maxY, newTranslateY));
                                        }
                                    }
                                    
                                    transformState.translateX = newTranslateX;
                                    transformState.translateY = newTranslateY;
                                    transformState.lastMouseX = e.clientX;
                                    transformState.lastMouseY = e.clientY;
                                    updateTransform();
                                }
                            };

                            const mouseUpHandler = () => {
                                transformState.isDragging = false;
                                svg.style.cursor = 'default';
                            };

                            // Double-click to reset view
                            const doubleClickHandler = (e: MouseEvent) => {
                                e.preventDefault();
                                resetView();
                            };

                            // Add zoom and pan event listeners
                            svg.addEventListener('wheel', wheelHandler, { passive: false });
                            svg.addEventListener('dblclick', doubleClickHandler);
                            svg.addEventListener('mousedown', mouseDownHandler);
                            svg.addEventListener('mousemove', mouseMoveHandler);
                            svg.addEventListener('mouseup', mouseUpHandler);

                            const newListeners: { elements: Element[], handlers: ((e: Event) => void)[] } = {
                                elements: [],
                                handlers: []
                            };

                            // Add node click handlers - use Set to avoid duplicates more efficiently
                            const nodeSelectors = ['.node', 'g.node', '[class*="node"]', 'ellipse', 'circle'];
                            const nodeSet = new Set<Element>();
                            
                            nodeSelectors.forEach(selector => {
                                const found = svg.querySelectorAll(selector);
                                found.forEach(node => nodeSet.add(node));
                            });
                            
                            const nodes = Array.from(nodeSet);

                            nodes.forEach(node => {
                                const handler = (e: Event) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    
                                    let title = node.querySelector('title')?.textContent;
                                    let nodeName = '';
                                    
                                    if (title) {
                                        nodeName = title.split('\n')[0];
                                    } else {
                                        // Try to get title from parent group
                                        const parentGroup = node.closest('g');
                                        if (parentGroup) {
                                            const titleInGroup = parentGroup.querySelector('title')?.textContent;
                                            if (titleInGroup) {
                                                nodeName = titleInGroup.split('\n')[0];
                                            }
                                        }
                                    }
                                    
                                    // If still no title, try to get it from sibling elements
                                    if (!nodeName && node.parentElement) {
                                        const siblingTitle = node.parentElement.querySelector('title')?.textContent;
                                        if (siblingTitle) {
                                            nodeName = siblingTitle.split('\n')[0];
                                        }
                                    }
                                    
                                    if (nodeName) {
                                        // Add duplicate prevention similar to edges
                                        const clickId = `${nodeName}-${filename}-${Date.now()}`;
                                        
                                        // Check if this exact click was processed recently (within 500ms)
                                        const recentClickThreshold = 500;
                                        const now = Date.now();
                                        const recentClickIds = Array.from(recentClicks.current).filter(id => {
                                            const timestamp = parseInt(id.split('-').pop() || '0');
                                            return now - timestamp < recentClickThreshold;
                                        });
                                        
                                        // Check if this node was clicked very recently
                                        const isDuplicate = recentClickIds.some(id => 
                                            id.startsWith(`${nodeName}-${filename}-`)
                                        );
                                        
                                        if (isDuplicate) {
                                            console.log(`Prevented duplicate node click: ${nodeName}`);
                                            return;
                                        }
                                        
                                        // Add this click to recent clicks
                                        recentClicks.current.add(clickId);
                                        
                                        // Clean up old click IDs to prevent memory leak
                                        setTimeout(() => {
                                            recentClicks.current.delete(clickId);
                                        }, recentClickThreshold);
                                        
                                        console.log(`Node clicked: ${nodeName} in ${filename}`);
                                        
                                        const graphType = filename === 'selected_sequence' ? 'Selected Sequence' : 
                                                        filename === 'all_students' ? 'All Students' : 'Filtered Graph';
                                        
                                        const tooltipContent = generateNodeTooltip(nodeName, graphType);
                                        
                                        const historyItem: HistoryItem = {
                                            id: `node-${Date.now()}-${Math.random()}`,
                                            type: 'node',
                                            timestamp: new Date(),
                                            title: `Node: ${nodeName}`,
                                            content: tooltipContent,
                                            graphType,
                                            expanded: false
                                        };
                                        
                                        setHistoryItems(prev => [historyItem, ...prev].slice(0, 50));
                                    }
                                };
                                
                                node.addEventListener('click', handler);
                                (node as HTMLElement).style.cursor = 'pointer';
                                
                                newListeners.elements.push(node);
                                newListeners.handlers.push(handler);
                            });

                            // Add edge click handlers - use Set to avoid duplicates more efficiently
                            const edgeSelectors = ['.edge', 'g.edge', '[class*="edge"]'];
                            const edgeSet = new Set<Element>();
                            
                            edgeSelectors.forEach(selector => {
                                const found = svg.querySelectorAll(selector);
                                found.forEach(edge => edgeSet.add(edge));
                            });
                            
                            const edges = Array.from(edgeSet);

                            edges.forEach(edge => {
                                const handler = (e: Event) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    let title = edge.querySelector('title')?.textContent;
                                    let edgeName = '';
                                    
                                    if (title) {
                                        edgeName = title.split('\n')[0];
                                    } else {
                                        const parentGroup = edge.closest('g');
                                        if (parentGroup) {
                                            const titleInGroup = parentGroup.querySelector('title')?.textContent;
                                            if (titleInGroup) {
                                                edgeName = titleInGroup.split('\n')[0];
                                            }
                                        }
                                    }
                                    
                                    if (edgeName) {
                                        // Create a unique identifier for this click
                                        const clickId = `${edgeName}-${filename}-${Date.now()}`;
                                        
                                        // Check if this exact click was processed recently (within 500ms)
                                        const recentClickThreshold = 500;
                                        const now = Date.now();
                                        const recentClickIds = Array.from(recentClicks.current).filter(id => {
                                            const timestamp = parseInt(id.split('-').pop() || '0');
                                            return now - timestamp < recentClickThreshold;
                                        });
                                        
                                        // Check if this edge was clicked very recently
                                        const isDuplicate = recentClickIds.some(id => 
                                            id.startsWith(`${edgeName}-${filename}-`)
                                        );
                                        
                                        if (isDuplicate) {
                                            return;
                                        }
                                        
                                        // Add this click to recent clicks
                                        recentClicks.current.add(clickId);
                                        
                                        // Clean up old click IDs to prevent memory leak
                                        setTimeout(() => {
                                            recentClicks.current.delete(clickId);
                                        }, recentClickThreshold);
                                        
                                        const graphType = filename === 'selected_sequence' ? 'Selected Sequence' : 
                                                        filename === 'all_students' ? 'All Students' : 'Filtered Graph';
                                        
                                        // Create history item with basic info immediately
                                        const historyItem: HistoryItem = {
                                            id: `edge-${Date.now()}-${Math.random()}`,
                                            type: 'edge',
                                            timestamp: new Date(),
                                            title: `Edge: ${edgeName}`,
                                            content: `Loading detailed statistics for ${edgeName}...`,
                                            graphType,
                                            expanded: false
                                        };
                                        
                                        setHistoryItems(prev => [historyItem, ...prev].slice(0, 50));
                                        
                                        // Generate detailed tooltip content asynchronously
                                        setTimeout(() => {
                                            const tooltipContent = generateEdgeTooltip(edgeName, graphType);
                                            setHistoryItems(prev => 
                                                prev.map(item => 
                                                    item.id === historyItem.id 
                                                        ? { ...item, content: tooltipContent }
                                                        : item
                                                )
                                            );
                                        }, 0);
                                    }
                                };
                                
                                edge.addEventListener('click', handler);
                                (edge as HTMLElement).style.cursor = 'pointer';
                                
                                newListeners.elements.push(edge);
                                newListeners.handlers.push(handler);
                            });

                            // Store the listeners for this graph
                            eventListenersRef.current.set(filename, newListeners);

                            // Add reset view button overlay
                            const container = ref.current;
                            if (container && !container.querySelector('.reset-view-btn')) {
                                const resetButton = document.createElement('button');
                                resetButton.className = 'reset-view-btn';
                                resetButton.innerHTML = '↻';
                                resetButton.title = 'Reset View (or double-click graph)';
                                resetButton.style.cssText = `
                                    position: absolute;
                                    top: 10px;
                                    right: 10px;
                                    width: 30px;
                                    height: 30px;
                                    border: 1px solid #ccc;
                                    border-radius: 4px;
                                    background: rgba(255, 255, 255, 0.9);
                                    cursor: pointer;
                                    font-size: 16px;
                                    display: flex;
                                    align-items: center;
                                    justify-content: center;
                                    z-index: 10;
                                `;
                                resetButton.addEventListener('click', resetView);
                                container.style.position = 'relative';
                                container.appendChild(resetButton);
                            }
                        }
                    }
                }, 100);

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
        <div className="graphviz-container w-full flex flex-col">
            {/* Tab Navigation */}
            <div className="flex border-b border-gray-300 mb-4">
                <button
                    onClick={() => setActiveTab('graphs')}
                    className={`px-4 py-2 font-medium ${
                        activeTab === 'graphs'
                            ? 'border-b-2 border-blue-500 text-blue-600'
                            : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                    Graphs
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={`px-4 py-2 font-medium ${
                        activeTab === 'history'
                            ? 'border-b-2 border-blue-500 text-blue-600'
                            : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                    History {historyItems.length > 0 && (
                        <span className="ml-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                            {historyItems.length}
                        </span>
                    )}
                </button>
            </div>

            <ErrorBoundary>
                {/* Graphs Tab */}
                <div 
                    className="graphs-tab flex flex-col w-full h-full" 
                    style={{ display: activeTab === 'graphs' ? 'flex' : 'none' }}
                >
                    <div className="graphs flex justify-center w-full h-[650px] overflow-x-auto">
                        {topDotString && (
                            <div
                                className={`graph-item flex flex-col items-center ${topDotString && dotString && filteredDotString ? 'w-[400px]' : 'w-[500px]'} border-2 border-gray-700 rounded-lg p-4 bg-gray-100 flex-shrink-0`}>
                                <h2 className="text-lg font-semibold text-center mb-2">Selected Sequence</h2>
                                <div ref={graphRefTop}
                                    className="w-full h-[575px] border-2 border-gray-700 rounded-lg p-4 bg-white flex items-center justify-center"></div>
                                <ExportButton onClick={() => exportGraphAsPNG(graphRefTop, 'selected_sequence')} />
                            </div>
                        )}
                        {dotString && (
                            <div
                                className={`graph-item flex flex-col items-center ${topDotString && dotString && filteredDotString ? 'w-[400px]' : 'w-[500px]'} border-2 border-gray-700 rounded-lg p-4 bg-gray-100 flex-shrink-0`}>
                                <h2 className="text-lg font-semibold text-center mb-2">All Students, All Paths</h2>
                                <div ref={graphRefMain}
                                    className="w-full h-[575px] border-2 border-gray-700 rounded-lg p-4 bg-white flex items-center justify-center"></div>
                                <ExportButton onClick={() => exportGraphAsPNG(graphRefMain, 'all_students')} />
                            </div>
                        )}
                        {filter && filter !== 'ALL' && filteredDotString && (
                            <div
                                className={`graph-item flex flex-col items-center ${topDotString && dotString && filteredDotString ? 'w-[400px]' : 'w-[500px]'} border-2 border-gray-700 rounded-lg p-4 bg-gray-100 flex-shrink-0`}>
                                <h2 className="text-lg font-semibold text-center mb-2">Filtered Graph: {titleCase(filter)}</h2>
                                <div ref={graphRefFiltered}
                                    className="w-full h-[575px] border-2 border-gray-700 rounded-lg p-4 bg-white flex items-center justify-center"></div>
                                <ExportButton onClick={() => exportGraphAsPNG(graphRefFiltered, 'filtered_graph')} />
                            </div>
                        )}
                    </div>
                </div>

                {/* History Tab */}
                <div 
                    className="history-panel flex flex-col w-full h-full p-4 overflow-hidden"
                    style={{ display: activeTab === 'history' ? 'flex' : 'none' }}
                >
                    <div className="flex justify-between items-center mb-4 flex-shrink-0">
                        <h2 className="text-lg font-semibold">Node & Edge History</h2>
                        <div className="flex gap-2">
                            <span className="text-sm text-gray-500">
                                {historyItems.length} items
                            </span>
                            {historyItems.length > 0 && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setHistoryItems([])}
                                >
                                    Clear History
                                </Button>
                            )}
                        </div>
                    </div>

                    {historyItems.length === 0 ? (
                        <div className="flex-1 flex items-center justify-center text-gray-500">
                            <div className="text-center">
                                <p className="text-lg mb-2">No history items yet</p>
                                <p className="text-sm">Click on nodes or edges in the graphs to see their details here</p>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-4 min-h-0 pb-20">
                            {historyItems.map((item) => (
                                <div
                                    key={item.id}
                                    className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow"
                                >
                                    <div 
                                        className="flex justify-between items-start mb-2 cursor-pointer"
                                        onClick={() => toggleHistoryItem(item.id)}
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className={`inline-block w-3 h-3 rounded-full ${
                                                item.type === 'node' ? 'bg-blue-500' : 'bg-green-500'
                                            }`}></span>
                                            <h3 className="font-medium text-gray-900">{item.title}</h3>
                                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                                                {item.graphType}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-gray-500">
                                                {formatTime(item.timestamp)}
                                            </span>
                                            <span className="text-xs text-gray-400">
                                                {item.expanded ? '▼' : '▶'}
                                            </span>
                                        </div>
                                    </div>
                                    {item.expanded && (
                                        <div className="bg-gray-50 rounded p-3 text-sm font-mono whitespace-pre-wrap break-words select-text">
                                            {formatContent(item.content)}
                                        </div>
                                    )}
                                </div>
                            ))}
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

function ExportButton({ onClick, label = "Export as PNG" }: ExportButtonProps) {
    return (
        <Button
            variant={'outline'}
            onClick={onClick}
            className="flex h-2 items-center gap-1 hover:bg-blue-50 hover:border-blue-300 transition-all duration-200 shadow-sm text-xs"
        >
            <Download className="h-3 w-3" />
            {label}
        </Button>
    );
}