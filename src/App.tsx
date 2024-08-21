import './App.css';
import React, {useCallback, useState} from 'react';
import Upload from "@/components/Upload.tsx";
import GraphvizParent from "@/components/GraphvizParent.tsx";
import FilterComponent from './components/FilterComponent.tsx';
import SelfLoopSwitch from './components/selfLoopSwitch.tsx';
import Slider from './components/slider.tsx';
import SequenceSelector from "@/components/SequenceSelector.tsx";

const App: React.FC = () => {
    const [csvData, setCsvData] = useState<string>('');
    const [filter, setFilter] = useState<string>('');
    const [selfLoops, setSelfLoops] = useState<boolean>(true);
    const [minVisits, setMinVisits] = useState<number>(30);
    const [topSequences, setTopSequences] = useState<string[]>([]);
    const [selectedSequence, setSelectedSequence] = useState<string>(topSequences[0]);
    const handleSelectSequence = (sequence: string) => {
        setSelectedSequence(selectedSequence);
        // Add your logic here to update the node coloring based on the selected sequence
        console.log(`Selected sequence: ${sequence}`);
    };
    const handleToggle = () => setSelfLoops(!selfLoops);
    const handleSlider = (value: number) => setMinVisits(value);
    const handleDataProcessed = (uploadedCsvData: string) => setCsvData(uploadedCsvData);
    const handleTopSequencesUpdate = useCallback((sequences: string[]) => {
        setTopSequences(sequences);
        console.log("AHHHH: "+topSequences)
        }, [topSequences])

    return (
        <div>
            <h1>Path Analysis Tool</h1>
            <Upload onDataProcessed={handleDataProcessed}/>
            <FilterComponent onFilterChange={setFilter}/>
            <SequenceSelector onSelectSequence={handleSelectSequence} sequences={topSequences}/>
            <Slider step={5} min={0} max={500} value={minVisits} onChange={handleSlider}/>
            <SelfLoopSwitch isOn={selfLoops} handleToggle={handleToggle}/>
            <GraphvizParent csvData={csvData} filter={filter} selfLoops={selfLoops} minVisits={minVisits}
                               onTopSequencesUpdate={handleTopSequencesUpdate}/>
        </div>
    );
};

export default App;