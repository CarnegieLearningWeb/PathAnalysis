import {useState} from "react";
import ErrorBoundary from "@/components/errorBoundary.tsx";
import Graphviz from 'graphviz-react';
interface GraphvizParentProps {
    csvData: string
}

export default function GraphvizParent({csvData}: GraphvizParentProps) {
    const [dotString, setDotString] = useState<string>('');
    const [filteredDotString, setFilteredDotString] = useState<string | null>('');

    const [filter, setFilter] = useState<string>(''); // State for the selected filter
    const [csvData, setCsvData] = useState<string>(''); // State to store raw CSV data
    const [selfLoops, setSelfLoops] = useState<boolean>(true)


    // logic here


    return (
        <>
            <ErrorBoundary>
                <div className={"container"}>

                    {dotString && <Graphviz dot={dotString} options={{useWorker: false, height: 600, width: 600}}/>}
                    <label>{filter}</label>
                    {filteredDotString &&
                        <Graphviz dot={filteredDotString} options={{useWorker: false, height: 600, width: 600}}/>}
                </div>
            </ErrorBoundary>
        </>
    )
}