import './App.css';
import React, {useEffect, useState} from 'react';
import Upload from "@/components/Upload.tsx";
import GraphvizParent from "@/components/GraphvizParent.tsx";
import FilterComponent from './components/FilterComponent.tsx';
import SelfLoopSwitch from './components/selfLoopSwitch.tsx';
import Slider from './components/slider.tsx';

const App: React.FC = () => {
    const [csvData, setCsvData] = useState<string>('');
    const [filter, setFilter] = useState<string>('');
    const [selfLoops, setSelfLoops] = useState<boolean>(true);
    const [minVisits, setMinVisits] = useState<number>(30);

    const handleToggle = () => setSelfLoops(!selfLoops);
    const handleSlider = (value: number) => setMinVisits(value);
    const handleDataProcessed = (uploadedCsvData: string) => setCsvData(uploadedCsvData);
    useEffect(() => {

    }, []);
    return (
        <div>
            <h1>Path Analysis Tool</h1>
            <Upload onDataProcessed={handleDataProcessed} />
            <FilterComponent onFilterChange={setFilter} />
            <SelfLoopSwitch isOn={selfLoops} handleToggle={handleToggle} />
            <Slider step={10} min={0} max={1000} value={minVisits} onChange={handleSlider} />
            <GraphvizParent csvData={csvData} filter={filter} selfLoops={selfLoops} minVisits={minVisits} />
        </div>
    );
};

export default App;