import './App.css';
import {useContext, useEffect, useState} from 'react';
import {GlobalDataType, GraphData} from './lib/types';
import DropZone from './components/DropZone';
import {Button} from './components/ui/button';
import {processDataShopData} from './lib/dataProcessingUtils';
import Loading from './components/Loading';
import Upload from "@/components/Upload.tsx";
import GraphvizParent from "@/components/GraphvizParent.tsx";
import FilterComponent from './components/FilterComponent.tsx';
import SelfLoopSwitch from './components/selfLoopSwitch.tsx';
import Slider from './components/slider.tsx';
import SequenceSelector from "@/components/SequenceSelector.tsx";
import {Context, SequenceCount} from "@/Context.tsx";

function App() {

// TODO: Upload whole workspace or single problem (# of unique problem names)
// TODO: Compare students vs. problem statistics
// TODO: Dropdown of students
// TODO: Most common sequence displayed without extra


    // State to hold the uploaded CSV data as a string
    const [csvData, setCsvData] = useState<string>('');
    // State to manage the filter value for filtering the graph data
    const [filter, setFilter] = useState<string>('');
    // State to toggle whether self-loops (transitions back to the same node) should be included
    const [selfLoops, setSelfLoops] = useState<boolean>(true);
    // State to manage the minimum number of visits for displaying edges in the graph
    const [minVisits, setMinVisits] = useState<number>(0);
    const {resetData, setGraphData, data, setData, loading, error, setError} = useContext(Context);
    const [showDropZone, setShowDropZone] = useState<boolean>(true);
    // const handleData = (data: GlobalDataType[]) => {
    //     setData(data)
    //     setShowDropZone(false)
    // }

    // Extracting context values from the `Context` provider
    const {top5Sequences, setSelectedSequence, setLoading, selectedSequence} = useContext(Context); //

    /**
     * Handles the selection of a sequence from the top 5 sequences.
     * Updates the selected sequence in the context.
     *
     * @param {SequenceCount["sequence"]} selectedSequence - The selected sequence from the top 5.
     */
    const handleSelectSequence = (selectedSequence: SequenceCount["sequence"]) => {
            console.log("SS: ", top5Sequences, selectedSequence);

            if (top5Sequences) {
                // Update the selected sequence in the context
                setSelectedSequence(selectedSequence);
                console.log(`Selected sequence: ${selectedSequence}`);
            }

        }
    ;

    const handleError = (errorMessage: string) => {
        setError(errorMessage);
    }


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
    const handleDataProcessed = (uploadedCsvData: string) => setCsvData(uploadedCsvData);

    /**
     * Updates the loading state when the file upload or processing begins or ends.
     *
     * @param {boolean} loading - Whether the data is currently loading/processing.
     */
    const handleLoadingChange = (loading: boolean) => {
        setLoading(loading);
    };

    // Rendering the components that allow user interaction and display the graph
    return (
        <div>
            <h1>Path Analysis Tool</h1>

            {/* Upload component allows uploading and processing of CSV data */}
            <Upload onDataProcessed={handleDataProcessed} onLoadingChange={handleLoadingChange}/>

            <div className="container">
                {/* Reset Button */}
                <Button
                    className="m-2"
                    variant="ghost"
                    onClick={() => {
                        resetData();
                        setShowDropZone(true);
                    }}
                >
                    Reset
                </Button>

                {/* Display Error Message */}
                {error && (
                    <div className="text-red-500 p-4 m-4 bg-red-50 rounded-md">
                        {error.split('\n').map((errorLine, index) => (
                            <p key={index} className="mb-1">{errorLine}</p>
                        ))}
                    </div>
                )}

                 Main Content
                <div className="flex items-center justify-center pt-20">
                    {loading ? (
                        <Loading/>
                    ) : (
                        showDropZone && (
                            <div>
                                <DropZone
                                    afterDrop={handleDataProcessed}
                                    onLoadingChange={handleLoadingChange}
                                    onError={handleError}
                                />
                            </div>
                        )
                    )}
                </div>

                {!loading && csvData && (
                    <div>
                        {/* FilterComponent allows filtering the graph data */}
                        <FilterComponent onFilterChange={setFilter}/>

                        {/* Display the currently selected sequence */}
                        {selectedSequence && (
                            <h2>{selectedSequence.toString().split('->').join(' -> ')}</h2>
                        )}

                        {/* SequenceSelector allows choosing one of the top 5 sequences */}
                        <SequenceSelector
                            onSequenceSelect={handleSelectSequence}
                            sequences={top5Sequences!}
                            selectedSequence={selectedSequence}
                        />

                        {/* SelfLoopSwitch toggles whether self-loops should be included in the graph */}
                        <SelfLoopSwitch isOn={selfLoops} handleToggle={handleToggle}/>

                        {/* Slider adjusts the minimum visits for displaying edges in the graph */}
                        <Slider
                            step={5}
                            min={0}
                            max={5000}
                            value={minVisits}
                            onChange={handleSlider}
                        />

                        {/* GraphvizParent component generates and displays the graph based on the CSV data */}
                        <GraphvizParent
                            csvData={csvData}
                            filter={filter}
                            selfLoops={selfLoops}
                            minVisits={minVisits}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}


export default App
