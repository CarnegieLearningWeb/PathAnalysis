import './App.css';
import React, { useCallback, useState } from 'react';
import Upload from "@/components/Upload.tsx";
import GraphvizParent, {SequenceCount} from "@/components/GraphvizParent.tsx";
import FilterComponent from './components/FilterComponent.tsx';
import SelfLoopSwitch from './components/selfLoopSwitch.tsx';
import Slider from './components/slider.tsx';
import SequenceSelector from "@/components/SequenceSelector.tsx";

const App: React.FC = () => {
    const [csvData, setCsvData] = useState<string>('');
    const [filter, setFilter] = useState<string>('');
    const [selfLoops, setSelfLoops] = useState<boolean>(true);
    const [minVisits, setMinVisits] = useState<number>(10);
    const [topSequences, setTopSequences] = useState<SequenceCount>([]);
    const [selectedSequence, setSelectedSequence] = useState<string[]>(['']);

    const handleSelectSequence = (selectedSequence: string[]) => {
        setSelectedSequence(selectedSequence); // Fix: Use the correct parameter to update the state
        console.log(`Selected sequence: ${selectedSequence}`);
    };

    const handleToggle = () => setSelfLoops(!selfLoops);
    const handleSlider = (value: number) => setMinVisits(value);
    const handleDataProcessed = (uploadedCsvData: string) => setCsvData(uploadedCsvData);

    // Fix: Remove `topSequences` dependency from `useCallback` to avoid unnecessary re-creations
    // const handleTopSequencesUpdate = useCallback((sequences: string[][]) => {
    //     setTopSequences(sequences);
    // }, [selectedSequence]);

    return (
        <div>
            <h1>Path Analysis Tool</h1>
            <Upload onDataProcessed={handleDataProcessed} />
            <Slider step={5} min={0} max={500} value={minVisits} onChange={handleSlider}/>
            <FilterComponent onFilterChange={setFilter} />
            <SequenceSelector onSelectSequence={handleSelectSequence} sequences={topSequences} />
            <SelfLoopSwitch isOn={selfLoops} handleToggle={handleToggle} />
            <GraphvizParent
                csvData={csvData}
                filter={filter}
                selfLoops={selfLoops}
                minVisits={minVisits}
                selectedSequence={selectedSequence}
            />
        </div>
    );
};

export default App;
