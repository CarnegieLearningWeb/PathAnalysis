import {createContext, useState} from 'react';
import {GlobalDataType, GraphData} from './lib/types';

interface ContextInterface {
    data: GlobalDataType[] | null;
    graphData: GraphData | null;
    loading: boolean;
    top5Sequences: SequenceCount[] | null;
    f3L3: boolean;
    setF3L3: (f3L3: boolean) => void;
    selectedSequence: string[] | undefined; // string[] or SequenceCount[].sequence?
    setLoading: (loading: boolean) => void;
    setData: (data: GlobalDataType[] | null) => void;
    setGraphData: (graphData: GraphData | null) => void;
    setTop5Sequences: (top5Sequences: SequenceCount[] | null) => void;
    setSelectedSequence: (selectedSequence: string[] | undefined) => void;
    resetData: () => void;

}

export interface SequenceCount {
    sequence: string[] | undefined;
    count: number;//| null;
}

export interface CSVRow {
    'Session Id': string;
    'Time': string;
    'Step Name': string;
    'Outcome': string;
    'CF (Workspace Progress Status)': string;
    'Problem Name'?: string;
    'Anon Student Id'?: string;
    'isInFirstOrLast3'?: boolean;
}

export const Context = createContext({} as ContextInterface);
const initialState = {
    data: null,
    graphData: null,
    loading: false,
    top5Sequences: null,
    selectedSequence: undefined,
    f3L3: false,
}

interface ProviderProps {
    children: React.ReactNode;
}


export const Provider = ({children}: ProviderProps) => {
    const [data, setData] = useState<GlobalDataType[] | null>(initialState.data)
    const [graphData, setGraphData] = useState<GraphData | null>(initialState.graphData)
    const [loading, setLoading] = useState<boolean>(initialState.loading)
    const [top5Sequences, setTop5Sequences] = useState<SequenceCount[] | null>(initialState.top5Sequences)
    const [selectedSequence, setSelectedSequence] = useState<SequenceCount["sequence"] | undefined>(initialState.selectedSequence);
    const [f3L3, setF3L3] = useState(false)

    const resetData = () => {
        setData(null)
        setGraphData(null)
        setTop5Sequences(null)
        setSelectedSequence(undefined)
        setF3L3(false)
        console.log("Data reset");

    }

    return (
        <Context.Provider
            value={{
                data,
                graphData,
                loading,
                top5Sequences,
                selectedSequence,
                f3L3,
                setLoading,
                setData,
                setGraphData,
                resetData,
                setTop5Sequences,
                setSelectedSequence,
                setF3L3,
            }}
        >
            {children}
        </Context.Provider>
    )
}