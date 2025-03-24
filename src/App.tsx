import './App.css';
import { useContext, useMemo, useState } from 'react';
import { Button } from './components/ui/button';
import Upload from "@/components/Upload.tsx";
import GraphvizParent from "@/components/GraphvizParent.tsx";
import FilterComponent from './components/FilterComponent.tsx';
import SelfLoopSwitch from './components/selfLoopSwitch.tsx';
import Slider from '@/components/slider.tsx';
import SequenceSelector from "@/components/SequenceSelector.tsx";
import { Context, SequenceCount } from "@/Context.tsx";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"

import Loading from './components/Loading.tsx';

function App() {
    // State to hold the uploaded CSV data as a string
    // const [csvData, setCsvData] = useState<string>('');
    // State to manage the filter value for filtering the graph data
    const [filter, setFilter] = useState<string>('');
    // State to toggle whether self-loops (transitions back to the same node) should be included
    const [selfLoops, setSelfLoops] = useState<boolean>(true);
    // State to manage the minimum number of visits for displaying edges in the graph
    const [minVisitsPercentage, setMinVisitsPercentage] = useState<number>(10);
    const { resetData, loading, error, top5Sequences, setSelectedSequence, selectedSequence, csvData, setCSVData } = useContext(Context);
    const [maxEdgeCount, setMaxEdgeCount] = useState<number>(100); // Default value

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
            {!showControls && <Upload onDataProcessed={handleDataProcessed} />}

            {loading && <Loading />}
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
                            <PopoverTrigger className="w-fit bg-slate-500 p-3 rounded-lg text-white">Properties</PopoverTrigger>
                            <PopoverContent className="w-96 bg-white rounded-lg shadow-lg p-6 border border-gray-200 mx-10">
                                <div className="flex flex-col space-y-6">
                                    {/* Filter Section */}
                                    <div className="space-y-2">
                                        <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
                                        <FilterComponent onFilterChange={setFilter} />
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
                                            <SelfLoopSwitch isOn={selfLoops} handleToggle={handleToggle} />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-gray-700">Edge Visits</label>
                                            <Slider
                                                step={1}
                                                min={0}
                                                max={100}
                                                value={minVisitsPercentage}
                                                onChange={handleSlider}
                                                maxEdgeCount={maxEdgeCount}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </PopoverContent>
                        </Popover>


                        {/* Graph and Data Display */}
                        {!loading && csvData && (
                            <div>
                                <div className="relative w-full h-[700px] border border-gray-300 bg-white overflow-fit">
                                    <div className="w-max h-max mx-auto ">
                                        {/* GraphvizParent component generates and displays the graph based on the CSV data */}
                                        <GraphvizParent
                                            csvData={csvData}
                                            filter={filter}
                                            selfLoops={selfLoops}
                                            minVisits={minVisits}
                                            onMaxEdgeCountChange={setMaxEdgeCount}
                                        />
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
