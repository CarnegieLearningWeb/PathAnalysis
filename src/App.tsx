import './App.css';
import { useContext, useEffect, useMemo, useState } from 'react';
import DropZone from './components/DropZone';
import { Button } from './components/ui/button';
import Upload from "@/components/Upload.tsx";
import GraphvizParent from "@/components/GraphvizParent.tsx";
import FilterComponent from './components/FilterComponent.tsx';
import SelfLoopSwitch from './components/selfLoopSwitch.tsx';
import Slider from './components/slider.tsx';
import SequenceSelector from "@/components/SequenceSelector.tsx";
import { Context, SequenceCount } from "@/Context.tsx";
import { Separator } from "@/components/ui/separator"
import Loading from './components/Loading.tsx';

function App() {
    // State to hold the uploaded CSV data as a string
    // const [csvData, setCsvData] = useState<string>('');
    // State to manage the filter value for filtering the graph data
    const [filter, setFilter] = useState<string>('');
    // State to toggle whether self-loops (transitions back to the same node) should be included
    const [selfLoops, setSelfLoops] = useState<boolean>(true);
    // State to manage the minimum number of visits for displaying edges in the graph
    const [minVisits, setMinVisits] = useState<number>(0);
    const [menuVisible, setMenuVisible] = useState(false);
    const { resetData, setGraphData, data, setData, loading, error, setError, top5Sequences, setSelectedSequence, setLoading, selectedSequence, csvData, setCSVData } = useContext(Context);
    const showControls = useMemo(() => {
        if (loading == false && csvData.length > 0) {
            return true;
        }
        return false;
    }, [loading, csvData]);


    const handleSelectSequence = (selectedSequence: SequenceCount["sequence"]) => {
        console.log("SS: ", top5Sequences, selectedSequence);

        if (top5Sequences) {
            // Update the selected sequence in the context
            setSelectedSequence(selectedSequence);
            console.log(`Selected sequence: ${selectedSequence}`);
        }

    };

    const handleError = (errorMessage: string) => {
        setError(errorMessage);
    }

    const toggleMenu = () => setMenuVisible(!menuVisible);
    /**
     * Toggles the self-loops inclusion in the graph by switching the state.
     */
    const handleToggle = () => setSelfLoops(!selfLoops);

    /**
     * Updates the minimum visits for edges in the graph when the slider is moved.
     *
     * @param {number} value - The new value for minimum visits.
     */
    const handleSlider = (value: number) => setMinVisits(value);

    /**
     * Updates the `csvData` state with the uploaded CSV data when the file is processed.
     *
     * @param {string} uploadedCsvData - The CSV data from the uploaded file.
     */
    const handleDataProcessed = (uploadedCsvData: string) => setCSVData(uploadedCsvData);

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
            {!showControls && <Upload onDataProcessed={handleDataProcessed}  />}
            
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
                    <div className="p-5 m-2">
                        
                        <div className="selected-sequence-bar flex justify-between bg-gray-200 p-4 mb-4">
                            <h2 className="text-lg font-semibold">Selected Sequence:</h2>
                            {selectedSequence && (
                                <h2 className="flex-1 text-sm break-words whitespace-normal ml-2">
                                    {selectedSequence.toString().split(',').join(' → ')}
                                </h2>
                            )}
                        </div>
                        {/* Properties Button */}
                        <button
                            className="flex-auto top-10 left-10 bg-blue-500 text-white z-30 rounded-md p-4 mb-4"
                            onClick={toggleMenu}
                        >
                            {menuVisible ? "Hide Properties" : "Show Properties"}
                        </button>

                        {/* Properties Menu */}

                        {menuVisible && (
                            <div className="absolute top-50 left-4 p-4 bg-gray-200 z-30 shadow-lg w-85 rounded-lg">
                                <h3 className="text-md font-semibold mb-4">Properties Menu</h3>
                                <FilterComponent onFilterChange={setFilter} />
                                {/*{selectedSequence && (*/}
                                {/*    <h2>{selectedSequence.toString().split('->').join(' -> ')}</h2>*/}
                                {/*)}*/}
                                <SequenceSelector
                                    onSequenceSelect={handleSelectSequence}
                                    sequences={top5Sequences!}
                                    selectedSequence={selectedSequence}
                                />
                                <SelfLoopSwitch isOn={selfLoops} handleToggle={handleToggle} />
                                <Slider
                                    step={5}
                                    min={0}
                                    max={5000}
                                    value={minVisits}
                                    onChange={handleSlider}
                                />
                            </div>
                        )}

                        {/* Graph and Data Display */}
                        {!loading && csvData && (
                            <div>
                                <div className="relative w-full h-[800px] border border-gray-300 bg-white overflow-auto">
                                    <div className="w-max h-max mx-auto">
                                        {/* GraphvizParent component generates and displays the graph based on the CSV data */}
                                        <GraphvizParent
                                            csvData={csvData}
                                            filter={filter}
                                            selfLoops={selfLoops}
                                            minVisits={minVisits}
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
