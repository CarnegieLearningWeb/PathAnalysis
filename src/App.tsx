import './App.css';
import {useContext, useMemo, useState, useEffect} from 'react';
import {Button} from './components/ui/button';
import Upload from "@/components/Upload.tsx";
import GraphvizParent from "@/components/GraphvizParent.tsx";
import FilterComponent from './components/FilterComponent.tsx';
import Slider from '@/components/slider.tsx';
import SequenceSelector from "@/components/SequenceSelector.tsx";
import {Context, SequenceCount} from "@/Context.tsx";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import {Input} from "@/components/ui/input"

import Loading from './components/Loading.tsx';
import Switch from "./components/switch.tsx";
import { useSearchParams } from 'react-router-dom';

function App() {
    // State to hold the uploaded CSV data as a string
    // const [csvData, setCsvData] = useState<string>('');
    // State to manage the filter value for filtering the graph data
    const [filter, setFilter] = useState<string>('');
    // State to toggle whether self-loops (transitions back to the same node) should be included
    const [selfLoops, setSelfLoops] = useState<boolean>(true);
    const [errorMode, setErrorMode] = useState<boolean>(false)
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
        if (maxMinEdgeCount > 0) {
            const percentage = ((maxMinEdgeCount - 1) / maxEdgeCount) * 100;
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
                    });
            } else if (csvDataParam) {
                // Use CSV data directly from URL parameter
                try {
                    const decodedData = decodeURIComponent(csvDataParam);
                    handleDataProcessed(decodedData);
                } catch (error) {
                    console.error('Error decoding CSV data from URL:', error);
                }
            }
        }
    }, [searchParams]);

    const showControls = useMemo(() => {
        return !loading && csvData.length > 0;
    }, [loading, csvData]);

    const handleSelectSequence = (selectedSequence: SequenceCount["sequence"]) => {
        if (top5Sequences) {
            setSelectedSequence(selectedSequence);
        }
    };

    /**
     * Toggles the self-loops inclusion in the graph by switching the state.
     */
    const handleToggle = () => setSelfLoops(!selfLoops);

    /**
     * Toggles the self-loops inclusion in the graph by switching the state.
     */
    const handleToggleError = () => setErrorMode(!errorMode);

    /**
     * Updates the minimum visits for edges in the graph when the slider is moved.
     *
     * @param {number} value - The new value for minimum visits.
     */
    const handleSlider = (value: number) => {
        setMinVisitsPercentage(value);
    };

    /**
     * Updates the `csvData` state with the uploaded CSV data when the file is processed.
     *
     * @param {string} uploadedCsvData - The CSV data from the uploaded file.
     */
    const handleDataProcessed = (uploadedCsvData: string) => setCSVData(uploadedCsvData);

    // Calculate actual min visits from percentage
    const minVisits = Math.round((minVisitsPercentage / 100) * maxEdgeCount);

    /**
     * Updates the minimum visits percentage when the input value changes.
     *
     * @param {string} value - The new value from the input.
     */
    const handleInputChange = (value: string) => {
        const numValue = parseInt(value);
        if (!isNaN(numValue)) {
            const percentage = Math.min(100, Math.max(0, (numValue / maxEdgeCount) * 100));
            setMinVisitsPercentage(percentage);
        }
    };

    /**
     * Updates the loading state when the file upload or processing begins or ends.
     *
     * @param {boolean} loading - Whether the data is currently loading/processing.
     */

    // Rendering the components that allow user interaction and display the graph
    return (
        <div className='p-3'>
            <header className="bg-white shadow-sm border-b border-gray-200 px-4 py-3 mb-4">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <h1 className="text-2xl text-gray-900">Path Analysis Tool</h1>
                    <div className="flex items-center space-x-4">
                        <Button
                            variant="destructive"
                            onClick={resetData}
                        >
                            Reset
                        </Button>
                    </div>
                </div>
            </header>
            {!showControls && <Upload onDataProcessed={handleDataProcessed}/>}

            {loading && <Loading/>}
            {/* Display Error Message */}
            {error && (
                <div className="text-red-500 p-4 m-4 bg-red-50 rounded-md">
                    {error.split('\n').map((errorLine, index) => (
                        <p key={index} className="mb-1">{errorLine}</p>
                    ))}
                </div>
            )}
            {/* Display the currently selected sequence */}

            {
                showControls && (
                    <div className="p-5 m-2 flex flex-col gap-3">

                        <div className="selected-sequence-bar flex justify-between bg-gray-200 p-4 mb-4">
                            <h2 className="text-lg font-semibold">Selected Sequence:</h2>
                            {selectedSequence && (
                                <h2 className="flex-1 text-sm break-words whitespace-normal ml-2">
                                    {selectedSequence.toString().split(',').join(' → ')}
                                </h2>
                            )}
                        </div>
                        {/* Properties Button */}
                        <Popover>
                            <PopoverTrigger
                                className="w-fit bg-slate-500 p-3 rounded-lg text-white">Properties</PopoverTrigger>
                            <PopoverContent className="w-96 bg-white rounded-lg shadow-lg p-6 border border-gray-200 mx-10">
                                <div className="flex flex-col space-y-6">
                                    {/* Filter Section */}
                                    <div className="space-y-2">
                                        <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
                                        <FilterComponent onFilterChange={setFilter} currentFilter={filter}/>
                                    </div>

                                    {/* Sequence Section */}
                                    <div className="space-y-2">
                                        <h3 className="text-lg font-semibold text-gray-900">Sequences</h3>
                                        <SequenceSelector
                                            onSequenceSelect={handleSelectSequence}
                                            sequences={top5Sequences || []}
                                            selectedSequence={selectedSequence}
                                        />
                                    </div>

                                    {/* Controls Section */}
                                    <div className="space-y-4">
                                        <div className="pb-2 border-b border-gray-200">
                                            <label className="text-sm font-medium text-gray-700">Include Self Loops</label>

                                            <Switch isOn={selfLoops} handleToggle={handleToggle}/>
                                        </div>

                                        <div className="pb-2 border-b border-gray-200">
                                            <label className="text-sm font-medium text-gray-700">Error Mode</label>
                                            <Switch isOn={errorMode} handleToggle={handleToggleError}/>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-gray-700">Minimum Students</label>
                                            <div className="space-y-4">
                                                <div>
                                                    <div className="flex justify-between mb-1">
                                                        {/* <span className="text-sm text-gray-500">Percentage</span>
                                                        <span className="text-sm text-gray-500">{minVisitsPercentage}%</span> */}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Slider
                                                            step={1}
                                                            min={0}
                                                            max={100}
                                                            value={minVisitsPercentage}
                                                            onChange={handleSlider}
                                                            maxEdgeCount={maxEdgeCount}
                                                        />
                                                        <span className="text-sm text-gray-500">%</span>
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="flex justify-between mb-1">
                                                        <span className="text-sm text-gray-500">Students</span>
                                                    </div>
                                                    <Input
                                                        type="number"
                                                        value={minVisits}
                                                        onChange={(e) => handleInputChange(e.target.value)}
                                                        className="w-full"
                                                        min={0}
                                                        max={maxEdgeCount}
                                                    />
                                                </div>
                                            </div>
                                            <p className="text-xs text-gray-500">
                                                Maximum threshold before any node becomes
                                                disconnected: {maxMinEdgeCount - 1} students
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </PopoverContent>
                        </Popover>


                        {/* Graph and Data Display */}
                        {!loading && csvData && (
                            <div>
                                <div className="relative w-full border border-gray-300 bg-white overflow-auto">
                                    <div className="flex justify-center w-full min-h-full">
                                        {/* GraphvizParent component generates and displays the graph based on the CSV data */}
                                        <GraphvizParent
                                            csvData={csvData}
                                            filter={filter}
                                            selfLoops={selfLoops}
                                            minVisits={minVisits}
                                            onMaxEdgeCountChange={setMaxEdgeCount}
                                            onMaxMinEdgeCountChange={setMaxMinEdgeCount}
                                            errorMode={errorMode}
                                        />
                                    </div>
                                </div>
                                {/* Legend component */}
                                <div className="mt-4 p-4 border border-gray-300 rounded-lg bg-white">
                                    <h3 className="text-lg font-semibold mb-2">Graph Legend</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <h4 className="font-medium mb-2">Node Colors</h4>
                                            <div className="space-y-2">
                                                <div className="flex items-center">
                                                    <div className="w-4 h-4 bg-white border border-gray-300 mr-2"></div>
                                                    <span>Start of Sequence</span>
                                                </div>
                                                <div className="flex items-center">
                                                    <div className="w-4 h-4 bg-[#00A6FF] mr-2"></div>
                                                    <span>End of Sequence</span>
                                                </div>
                                                <div className="text-sm text-gray-600">Nodes in between are colored with a
                                                    gradient from white to light blue based on their position in the
                                                    selected sequence.
                                                </div>
                                                <div className="text-sm text-gray-600">
                                                    Note: If a white node (that is not the first node in the selected
                                                    sequence) appears in a graph,
                                                    that node is not in the selected sequence.
                                                </div>
                                            </div>
                                        </div>
                                        {errorMode ? (
                                            <div>
                                                <h4 className="font-medium mb-2">Edge Colors (Error Mode)</h4>
                                                <div className="space-y-2">
                                                    <div className="flex items-center">
                                                        <div className="w-4 h-4 bg-red-500 mr-2"></div>
                                                        <span>ERROR</span>
                                                    </div>
                                                    <div className="flex items-center">
                                                        <div className="w-4 h-4 bg-blue-500 mr-2"></div>
                                                        <span>INITIAL_HINT / HINT_LEVEL_CHANGE</span>
                                                    </div>
                                                    <div className="flex items-center">
                                                        <div className="w-4 h-4 bg-yellow-500 mr-2"></div>
                                                        <span>JIT / FREEBIE_JIT</span>
                                                    </div>
                                                    <div className="flex items-center">
                                                        <div className="w-4 h-4 bg-black mr-2"></div>
                                                        <span>Only OK → Black</span>
                                                    </div>
                                                    <Popover>
                                                        <PopoverTrigger>
                                                            <div
                                                                className="text-sm text-blue-600 hover:text-blue-800 cursor-help">
                                                                How are edge colors calculated?
                                                            </div>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-80">
                                                            <div className="space-y-2">
                                                                <h4 className="font-medium">Edge Color Calculation (Error
                                                                    Mode)</h4>
                                                                <p className="text-sm">
                                                                    When in error-mode, only non-OK outcomes
                                                                    contribute to the color:
                                                                </p>
                                                                <ul className="text-sm list-disc pl-4 space-y-1">
                                                                    <li>Only ERROR, hints, and JIT are included in the
                                                                        blend
                                                                    </li>
                                                                    <li>OK is ignored unless it's the only outcome — then
                                                                        the edge is black
                                                                    </li>
                                                                    <li>Final color includes 90% opacity</li>
                                                                </ul>
                                                            </div>
                                                        </PopoverContent>
                                                    </Popover>
                                                </div>
                                            </div>
                                        ) : (
                                            <div>
                                                <h4 className="font-medium mb-2">Edge Colors</h4>
                                                <div className="space-y-2">
                                                    <div className="flex items-center">
                                                        <div className="w-4 h-4 bg-red-500 mr-2"></div>
                                                        <span>ERROR</span>
                                                    </div>
                                                    <div className="flex items-center">
                                                        <div className="w-4 h-4 bg-green-500 mr-2"></div>
                                                        <span>OK</span>
                                                    </div>
                                                    <div className="flex items-center">
                                                        <div className="w-4 h-4 bg-blue-500 mr-2"></div>
                                                        <span>INITIAL_HINT / HINT_LEVEL_CHANGE</span>
                                                    </div>
                                                    <div className="flex items-center">
                                                        <div className="w-4 h-4 bg-yellow-500 mr-2"></div>
                                                        <span>JIT / FREEBIE_JIT</span>
                                                    </div>
                                                    <Popover>
                                                        <PopoverTrigger>
                                                            <div
                                                                className="text-sm text-blue-600 hover:text-blue-800 cursor-help">
                                                                How are edge colors calculated?
                                                            </div>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-80">
                                                            <div className="space-y-2">
                                                                <h4 className="font-medium">Edge Color Calculation</h4>
                                                                <p className="text-sm">
                                                                    When an edge has multiple outcomes, its color is
                                                                    calculated
                                                                    as a weighted average:
                                                                </p>
                                                                <ul className="text-sm list-disc pl-4 space-y-1">
                                                                    <li>Each outcome's color is weighted by its frequency
                                                                    </li>
                                                                    <li>For example, if an edge has 70% OK (green) and 30%
                                                                        ERROR
                                                                        (red), the resulting color will be a blend of these
                                                                        colors (7 green:3 red)
                                                                    </li>
                                                                    <li>The final color includes 90% opacity to show
                                                                        overlapping
                                                                        edges
                                                                    </li>
                                                                </ul>
                                                            </div>
                                                        </PopoverContent>
                                                    </Popover>
                                                </div>
                                            </div>
                                        )}

                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )
            }
        </div>


    );
};


export default App
