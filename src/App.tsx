import './App.css';
import React, {useContext, useState} from 'react';
import Upload from "@/components/Upload.tsx";
import GraphvizParent from "@/components/GraphvizParent.tsx";
import FilterComponent from './components/FilterComponent.tsx';
import SelfLoopSwitch from './components/selfLoopSwitch.tsx';
import Slider from './components/slider.tsx';
import SequenceSelector from "@/components/SequenceSelector.tsx";
import {Context, SequenceCount} from "@/Context.tsx";

const App: React.FC = () => {
    const [csvData, setCsvData] = useState<string>('');
    const [filter, setFilter] = useState<string>('');
    const [selfLoops, setSelfLoops] = useState<boolean>(true);
    const [minVisits, setMinVisits] = useState<number>(0);
    const {top5Sequences,selectedSequence, setSelectedSequence} = useContext(Context);
    const {loading, setLoading} = useContext(Context)

    const handleSelectSequence = (selectedSequence: SequenceCount["sequence"]) => {
        console.log("SS: ", top5Sequences)

        if (top5Sequences) {
            setSelectedSequence(selectedSequence); // Fix: Use the correct parameter to update the state
            console.log(`Selected sequence: ${selectedSequence}`);
            //Selected sequence gets this far but doesn't update in GraphvizProcessing
        }
    };

    const handleToggle = () => setSelfLoops(!selfLoops);
    const handleSlider = (value: number) => setMinVisits(value);
    const handleDataProcessed = (uploadedCsvData: string) => setCsvData(uploadedCsvData);
    const handleLoadingChange = (loading: boolean) => {
        setLoading(loading);
    };

    return (
        <div>
            <h1>Path Analysis Tool</h1>
            <Upload onDataProcessed={handleDataProcessed} onLoadingChange={handleLoadingChange}/>
            <FilterComponent onFilterChange={setFilter}/>
            <h2>{selectedSequence}</h2>
            <SequenceSelector onSequenceSelect={handleSelectSequence} sequences={top5Sequences!}
                              selectedSequence={selectedSequence}/>
            <SelfLoopSwitch isOn={selfLoops} handleToggle={handleToggle}/>
            <Slider step={5} min={0} max={500}
                    value={minVisits}
                    onChange={handleSlider}/>

            <GraphvizParent
                csvData={csvData}
                filter={filter}
                selfLoops={selfLoops}
                minVisits={minVisits}
                // selectedSequence={selectedSequence}
            />
        </div>
    );
};

export default App;
