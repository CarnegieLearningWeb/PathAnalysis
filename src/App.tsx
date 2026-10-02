import {useContext, useMemo, useState, useEffect, type ReactNode} from 'react';
import {Button} from './components/ui/button';
import Upload from "@/components/Upload.tsx";
import GraphvizParent from "@/components/GraphvizParent.tsx";
import FilterComponent from './components/FilterComponent.tsx';
import SequenceSelector from "@/components/SequenceSelector.tsx";
import {Context, SequenceCount} from "@/Context.tsx";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card"
import {Separator} from "@/components/ui/separator"
import {SegmentedControl} from "@/components/ui/segmented-control"
import {SettingGroup, SwitchRow} from "@/components/ui/setting"
import {
    AlertTriangle,
    Bot,
    CheckCircle2,
    FileText,
    RotateCcw,
    SlidersHorizontal,
    Sparkles,
    XCircle,
} from "lucide-react"

import Loading from './components/Loading.tsx';
import { OUTCOME_LEGEND, NODE_FILL_LEGEND } from "@/components/GraphvizProcessing.ts";
import { useSearchParams } from 'react-router-dom';

// Helper function to parse and format filename for display
const formatFileTitle = (filename: string): string => {
    // Remove file extension
    const nameWithoutExt = filename.replace(/\.(csv|CSV)$/, '');

    // Split by hyphens and process each part
    const parts = nameWithoutExt.split('-').map(part => {
        // Handle specific abbreviations and terms
        switch (part.toLowerCase()) {
            case 'er':
                return 'Equivalent Ratios';
            case 'me':
                return 'Means & Extremes';
            case 'groundtruth':
            case 'ground_truth':
                return 'Ground Truth';
            case 'successful':
                return 'Successful';
            case 'unsuccessful':
                return 'Unsuccessful';
            case 'strategies':
                return 'Strategies';
            case 'match':
                return 'Match';
            case 'allstrategies':
            case 'all_strategies':
                return 'All Strategies';
            case 'astra':
                return 'ASTRA Generated';
            default:
                // Capitalize first letter of each word
                return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
        }
    });

    return parts.join(' ');
};

// Line-art icon for the loaded dataset, keyed off the filename. Uses the same
// lucide set as the rest of the chrome so it sits on the type baseline instead
// of the emoji it replaced, which rendered at a different size per platform.
const FileTypeIcon = ({ filename }: { filename: string }) => {
    const className = "h-4 w-4 shrink-0 text-muted-foreground";
    if (filename.includes('astra')) return <Bot className={className} aria-hidden />;
    if (filename.includes('unsuccessful')) return <XCircle className={className} aria-hidden />;
    if (filename.includes('successful')) return <CheckCircle2 className={className} aria-hidden />;
    if (filename.includes('ER') || filename.includes('ME')) return <Sparkles className={className} aria-hidden />;
    return <FileText className={className} aria-hidden />;
};

/** Legend colour chip. One definition so every swatch is the same size/shape. */
const Swatch = ({ color, className }: { color?: string; className?: string }) => (
    <span
        aria-hidden
        className={`mt-0.5 inline-block h-3.5 w-3.5 shrink-0 rounded-sm ring-1 ring-inset ring-black/15 ${className ?? ''}`}
        style={color ? { backgroundColor: color } : undefined}
    />
);

/** A legend entry: swatch on the left, label on the right. */
const LegendItem = ({ children, color, swatchClassName }: {
    children: ReactNode;
    color?: string;
    swatchClassName?: string;
}) => (
    <li className="flex items-start gap-2 text-sm">
        <Swatch color={color} className={swatchClassName} />
        <span className="leading-snug">{children}</span>
    </li>
);

/** Explanatory prose inside the legend. Deliberately quieter than the entries. */
const LegendNote = ({ children }: { children: ReactNode }) => (
    <p className="field-hint">{children}</p>
);

function App() {
    // State to hold the uploaded CSV data as a string
    // const [csvData, setCsvData] = useState<string>('');
    // State to manage the filter values for filtering the graph data (can show multiple)
    const [filters, setFilters] = useState<string[]>([]);

    // Which of the always-available graphs to display (independent of status filters)
    const [showSelectedSequence, setShowSelectedSequence] = useState<boolean>(true);
    const [showAllStudents, setShowAllStudents] = useState<boolean>(true);
    // State to toggle whether self-loops (transitions back to the same node) should be included
    const [selfLoops, setSelfLoops] = useState<boolean>(true);
    const [errorMode, setErrorMode] = useState<boolean>(false);
    const [uniqueStudentMode, setUniqueStudentMode] = useState<boolean>(true);
    const [nodeOutcomeMode, setNodeOutcomeMode] = useState<boolean>(false);
    const [colorNodesBySequence, setColorNodesBySequence] = useState<boolean>(true);
    const [showEdgeLabels, setShowEdgeLabels] = useState<boolean>(true);
    const [fileInfo, setFileInfo] = useState<{filename: string, source: string} | null>(null);
    // State to manage the minimum number of visits for displaying edges in the graph
    const [minVisitsPercentage, setMinVisitsPercentage] = useState<number>(0);
    const {
        resetData,
        loading,
        error,
        top5Sequences,
        setSelectedSequence,
        selectedSequence,
        csvData,
        setCSVData
    } = useContext(Context);
    const [maxEdgeCount, setMaxEdgeCount] = useState<number>(100); // Default value
    const [maxMinEdgeCount, setMaxMinEdgeCount] = useState<number>(0);

    // URL parameter handling
    const [searchParams] = useSearchParams();

    // Update minVisitsPercentage when maxMinEdgeCount changes
    useEffect(() => {
        console.log("App.tsx: maxMinEdgeCount changed to:", maxMinEdgeCount);
        console.log("App.tsx: maxEdgeCount is:", maxEdgeCount);
        if (maxMinEdgeCount > 0) {
            const percentage = (maxMinEdgeCount / maxEdgeCount) * 100;
            console.log("App.tsx: Setting slider to percentage:", percentage);
            setMinVisitsPercentage(Math.max(0, Math.min(100, percentage)));
        }
    }, [maxMinEdgeCount, maxEdgeCount]);

    // Handle URL parameter CSV loading
    useEffect(() => {
        const csvUrl = searchParams.get('csv');
        const csvDataParam = searchParams.get('data');

        // Only load from URL if no CSV data is currently loaded
        if (csvData.length === 0) {
            if (csvUrl) {
                // Extract filename from URL
                const filename = csvUrl.split('/').pop() || 'Unknown File';
                setFileInfo({ filename, source: 'Astra App' });

                // Fetch CSV from URL
                fetch(csvUrl)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error(`HTTP error! status: ${response.status}`);
                        }
                        return response.text();
                    })
                    .then(data => {
                        handleDataProcessed(data);
                    })
                    .catch(error => {
                        console.error('Error fetching CSV from URL:', error);
                        setFileInfo(null); // Clear file info on error
                    });
            } else if (csvDataParam) {
                // Use CSV data directly from URL parameter
                try {
                    const decodedData = decodeURIComponent(csvDataParam);
                    setFileInfo({ filename: 'URL Data', source: 'URL Parameter' });
                    handleDataProcessed(decodedData);
                } catch (error) {
                    console.error('Error decoding CSV data from URL:', error);
                    setFileInfo(null);
                }
            }
        }
    }, [searchParams]);

    // Clear file info when CSV data is reset
    useEffect(() => {
        if (csvData.length === 0) {
            setFileInfo(null);
        }
    }, [csvData]);

    const showControls = useMemo(() => {
        return !loading && csvData.length > 0;
    }, [loading, csvData]);

    const handleSelectSequence = (selectedSequence: SequenceCount["sequence"]) => {
        if (top5Sequences) {
            setSelectedSequence(selectedSequence);
        }
    };

    /**
     * Updates the `csvData` state with the uploaded CSV data when the file is processed.
     *
     * @param {string} uploadedCsvData - The CSV data from the uploaded file.
     * @param {string} filename - Optional filename for display purposes.
     */
    const handleDataProcessed = (uploadedCsvData: string, filename?: string) => {
        setCSVData(uploadedCsvData);
        // If filename is provided (from file upload), update file info
        if (filename) {
            setFileInfo({ filename, source: 'File Upload' });
        }
    };

    // Calculate actual min visits from percentage (still needed for GraphvizParent)
    const minVisits = Math.round((minVisitsPercentage / 100) * maxEdgeCount);

    // The steps of the highlighted path, for the toolbar's path strip.
    const selectedSteps = selectedSequence ?? [];
    const noGraphsSelected = !showSelectedSequence && !showAllStudents && filters.length === 0;

    /**
     * The display settings that live behind the "Display" popover: everything
     * that changes how a graph is *drawn* rather than which data it covers.
     * Grouped so the mutual interactions are visible — the colour group's
     * master switch (Color nodes by outcome) is what disables Error mode, and
     * counting mode is what disables self-loops.
     */
    const displaySettings = (
        <div className="space-y-5">
            <SettingGroup
                title="Node & edge colour"
                hint="These three interact: filling nodes with the outcome mix takes over the edge colouring."
            >
                <SwitchRow
                    id="setting-node-outcome-mode"
                    label="Color nodes by outcome"
                    hint="Fill each node with a 100% bar of its outcome mix; edges become neutral flow lines."
                    checked={nodeOutcomeMode}
                    onCheckedChange={setNodeOutcomeMode}
                />
                <SwitchRow
                    id="setting-color-nodes-by-sequence"
                    label="Color nodes by selected sequence"
                    hint={nodeOutcomeMode
                        ? 'Highlights sequence nodes with a bold border.'
                        : 'Shade sequence nodes white → blue by position; off = all nodes gray.'}
                    checked={colorNodesBySequence}
                    onCheckedChange={setColorNodesBySequence}
                />
                <SwitchRow
                    id="setting-error-mode"
                    label="Error mode"
                    hint="Overlay a dashed red arrow carrying each transition's error share."
                    checked={errorMode}
                    onCheckedChange={setErrorMode}
                    disabled={nodeOutcomeMode}
                    disabledHint="Unavailable while nodes show the outcome mix."
                />
            </SettingGroup>

            <SettingGroup title="Edges">
                <SwitchRow
                    id="setting-show-edge-labels"
                    label="Show edge labels"
                    hint="Counts on edges: every edge on the Selected Sequence graph, and each node's busiest outgoing edge on the full graphs."
                    checked={showEdgeLabels}
                    onCheckedChange={setShowEdgeLabels}
                />
                <SwitchRow
                    id="setting-self-loops"
                    label="Include self loops"
                    hint="Keep transitions from a step back to itself."
                    checked={selfLoops}
                    onCheckedChange={setSelfLoops}
                    disabled={uniqueStudentMode}
                    disabledHint="Not possible while counting unique students — a first attempt never repeats."
                />
            </SettingGroup>
        </div>
    );

    // Rendering the components that allow user interaction and display the graph
    return (
        <div className="min-h-screen bg-muted/40">
            <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <div className="mx-auto flex max-w-[1600px] items-center gap-4 px-6 py-2.5">
                    <div className="min-w-0">
                        <h1 className="truncate text-base font-semibold tracking-tight">Path Analysis Tool</h1>
                        <p className="hidden text-xs text-muted-foreground sm:block">
                            Student learning paths as directed graphs
                        </p>
                    </div>

                    {fileInfo && (
                        <div className="ml-auto hidden min-w-0 items-center gap-2 rounded-md border bg-card px-2.5 py-1.5 md:flex">
                            <FileTypeIcon filename={fileInfo.filename} />
                            <div className="min-w-0">
                                <p className="truncate text-sm font-medium leading-tight">
                                    {formatFileTitle(fileInfo.filename)}
                                </p>
                                <p className="truncate text-[11px] leading-tight text-muted-foreground">
                                    <span className="font-mono">{fileInfo.filename}</span>
                                    <span className="mx-1.5">·</span>
                                    {fileInfo.source}
                                </p>
                            </div>
                        </div>
                    )}

                    {showControls && (
                        <Button
                            variant="outline"
                            size="sm"
                            className={fileInfo ? 'shrink-0' : 'ml-auto shrink-0'}
                            onClick={() => {
                                resetData();
                                setFileInfo(null);
                            }}
                        >
                            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                            Reset data
                        </Button>
                    )}
                </div>
            </header>

            <main className="mx-auto max-w-[1600px] space-y-4 px-6 py-5">
                {!showControls && <Upload onDataProcessed={handleDataProcessed}/>}

                {loading && <Loading/>}

                {/* Display Error Message */}
                {error && (
                    <div
                        role="alert"
                        className="flex gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
                    >
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                        <div className="min-w-0 space-y-1">
                            {error.split('\n').map((errorLine, index) => (
                                <p key={index}>{errorLine}</p>
                            ))}
                        </div>
                    </div>
                )}

                {showControls && (
                    <>
                        {/* Control panel. Primary controls (which path, how things
                            are counted, which graphs) stay on screen; the drawing
                            options live behind the Display popover. */}
                        <Card role="group" aria-label="Analysis controls" className="overflow-hidden">
                                <div className="flex flex-wrap items-end gap-x-6 gap-y-4 p-4">
                                    <div className="min-w-[16rem] flex-1 space-y-1.5">
                                        <label htmlFor="sequence-selector" className="field-label block">
                                            Selected sequence
                                        </label>
                                        <SequenceSelector
                                            onSequenceSelect={handleSelectSequence}
                                            sequences={top5Sequences || []}
                                            selectedSequence={selectedSequence}
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <span id="counting-mode-caption" className="field-label block">
                                            Count
                                        </span>
                                        <SegmentedControl
                                            aria-labelledby="counting-mode-caption"
                                            value={uniqueStudentMode ? 'students' : 'visits'}
                                            onValueChange={(value) => setUniqueStudentMode(value === 'students')}
                                            options={[
                                                {
                                                    value: 'students',
                                                    label: 'Unique students',
                                                    title: 'Count each student once, on their first attempt at a step',
                                                },
                                                {
                                                    value: 'visits',
                                                    label: 'Total visits',
                                                    title: 'Count every attempt at a step',
                                                },
                                            ]}
                                        />
                                    </div>

                                    {/* No caption: the trigger names itself, and a
                                        caption over a button would read as a
                                        label for a field that isn't there. */}
                                    <div>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" size="sm">
                                                    <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
                                                    Display options
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent
                                                align="end"
                                                className="max-h-[70vh] w-[22rem] overflow-y-auto"
                                            >
                                                {displaySettings}
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                </div>

                                <Separator />

                                <div className="bg-muted/40 px-4 py-3">
                                    <FilterComponent
                                        onFilterChange={setFilters}
                                        currentFilters={filters}
                                        showSelectedSequence={showSelectedSequence}
                                        showAllStudents={showAllStudents}
                                        onShowSelectedSequenceChange={setShowSelectedSequence}
                                        onShowAllStudentsChange={setShowAllStudents}
                                    />
                                    {noGraphsSelected && (
                                        <p className="mt-2 text-xs text-amber-700">
                                            No graphs selected — pick at least one to see results.
                                        </p>
                                    )}
                                </div>

                                {selectedSequence && (
                                    <>
                                        <Separator />
                                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 px-4 py-2.5">
                                            <span className="field-label">Path</span>
                                            {selectedSteps.length === 0 ? (
                                                <span className="text-sm italic text-muted-foreground">
                                                    None — showing full graphs only
                                                </span>
                                            ) : (
                                                selectedSteps.map((step, index) => (
                                                    <span key={`${step}-${index}`} className="flex items-baseline gap-2">
                                                        {index > 0 && (
                                                            <span aria-hidden className="text-muted-foreground">→</span>
                                                        )}
                                                        <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium">
                                                            {step}
                                                        </span>
                                                    </span>
                                                ))
                                            )}
                                        </div>
                                    </>
                                )}
                        </Card>

                        {/* Graph and Data Display */}
                        {!loading && csvData && (
                            <>
                                <Card className="overflow-auto p-4">
                                    <div className="flex w-full min-h-full justify-center">
                                        {/* GraphvizParent component generates and displays the graph based on the CSV data */}
                                        <GraphvizParent
                                            csvData={csvData}
                                            filters={filters}
                                            selfLoops={uniqueStudentMode ? false : selfLoops}
                                            minVisits={minVisits}
                                            onMaxEdgeCountChange={setMaxEdgeCount}
                                            onMaxMinEdgeCountChange={setMaxMinEdgeCount}
                                            errorMode={errorMode}
                                            uniqueStudentMode={uniqueStudentMode}
                                            nodeOutcomeMode={nodeOutcomeMode}
                                            showSelectedSequence={showSelectedSequence}
                                            showAllStudents={showAllStudents}
                                            colorNodesBySequence={colorNodesBySequence}
                                            showEdgeLabels={showEdgeLabels}
                                            problemName={fileInfo?.filename.replace(/\.(csv|CSV)$/, '') || 'unknown'}
                                        />
                                    </div>
                                </Card>

                                {/* Legend */}
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Graph legend</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        {nodeOutcomeMode && (
                                            <p className="border-l-2 border-primary/40 bg-muted/50 px-3 py-2 text-sm leading-snug">
                                                <span className="font-medium">Color nodes by outcome is on.</span>{' '}
                                                Each node is a 100% bar of its outcome mix, in the fill colors shown
                                                below (a lighter green than the line palette — the same value reads
                                                much heavier over a large filled area); a bold black border marks nodes
                                                on the selected sequence. Edges are drawn as neutral gray flow lines.
                                            </p>
                                        )}
                                        <div className="grid gap-x-8 gap-y-6 md:grid-cols-2">
                                            <section className="space-y-2">
                                                <h4 className="field-label">
                                                    {nodeOutcomeMode ? 'Sequence marking' : 'Node colors'}
                                                </h4>
                                                {nodeOutcomeMode ? (
                                                    <>
                                                        <ul className="space-y-1.5">
                                                            <LegendItem swatchClassName="bg-white ring-2 ring-black">
                                                                On the selected sequence
                                                            </LegendItem>
                                                            <LegendItem swatchClassName="bg-white">
                                                                Not in the selected sequence
                                                            </LegendItem>
                                                        </ul>
                                                        <LegendNote>
                                                            In this mode a node's fill is its outcome mix, so sequence
                                                            membership is marked with a bold border instead of the
                                                            white → blue gradient.
                                                        </LegendNote>
                                                        <LegendNote>
                                                            Selected-sequence transitions are drawn in a solid (not
                                                            translucent) gray; edge thickness still means students per
                                                            transition.
                                                        </LegendNote>
                                                    </>
                                                ) : (
                                                    <>
                                                        <ul className="space-y-1.5">
                                                            <LegendItem swatchClassName="bg-white">
                                                                Start of sequence
                                                            </LegendItem>
                                                            <LegendItem color="#1cb0ff">
                                                                End of sequence
                                                            </LegendItem>
                                                            <LegendItem color="#CCCCCC">
                                                                Not in the selected sequence
                                                            </LegendItem>
                                                        </ul>
                                                        <LegendNote>
                                                            Nodes on the selected sequence are shaded from white
                                                            (start) to blue (end) by position; gray nodes are steps
                                                            outside the selected sequence.
                                                        </LegendNote>
                                                        <LegendNote>
                                                            The sequence's own transitions are drawn in a solid, fully
                                                            saturated version of their outcome color; thickness always
                                                            means students per transition.
                                                        </LegendNote>
                                                    </>
                                                )}
                                            </section>

                                            <section className="space-y-2">
                                                <h4 className="field-label">
                                                    {nodeOutcomeMode
                                                        ? 'Node bar colors (outcomes recorded at the step)'
                                                        : 'Edge colors (most common outcome)'}
                                                </h4>
                                                <ul className="space-y-1.5">
                                                    {(nodeOutcomeMode ? NODE_FILL_LEGEND : OUTCOME_LEGEND).map(([label, color]) => (
                                                        <LegendItem key={label} color={color}>{label}</LegendItem>
                                                    ))}
                                                    {errorMode && !nodeOutcomeMode && (
                                                        <li className="flex items-start gap-2 text-sm">
                                                            <span
                                                                aria-hidden
                                                                className="mt-2 inline-block h-0 w-3.5 shrink-0 border-t-2 border-dashed"
                                                                style={{ borderColor: '#D55E00' }}
                                                            />
                                                            <span className="leading-snug">Error share (dashed red)</span>
                                                        </li>
                                                    )}
                                                </ul>
                                                <LegendNote>
                                                    {nodeOutcomeMode
                                                        ? 'Each node’s bar is its outcome mix (colorblind-safe Okabe-Ito palette, lightened for fills); edge thickness grows with the number of students who took the transition.'
                                                        : 'Each edge is colored by its single most common outcome (colorblind-safe Okabe-Ito palette); its thickness grows with the number of students who took it.'}
                                                </LegendNote>
                                                {errorMode && !nodeOutcomeMode && (
                                                    <LegendNote>
                                                        In Error Mode a dashed red arrow carries the error signal: an
                                                        overlay whose thickness reflects how many students errored on a
                                                        transition, or the whole edge drawn dashed when every student
                                                        errored.
                                                    </LegendNote>
                                                )}
                                            </section>
                                        </div>
                                    </CardContent>
                                </Card>
                            </>
                        )}
                    </>
                )}
            </main>
        </div>
    );
};


export default App
