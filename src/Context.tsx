import {createContext, useState} from 'react';
import {GlobalDataType, GraphData} from './lib/types';

interface ContextInterface {
    data: GlobalDataType[] | null;
    graphData: GraphData | null;
    loading: boolean;
    top5Sequences: SequenceCount[] | null;
    setLoading: (loading: boolean) => void;
    setData: (data: GlobalDataType[] | null) => void;
    setGraphData: (graphData: GraphData | null) => void;
    resetData: () => void;
    setTop5Sequences: (top5Sequences: SequenceCount[]) => void;

}

export interface SequenceCount {
    sequence: string[] | null; // or whatever type your steps are (e.g., number[])
    count: number | null;
}

export const Context = createContext({} as ContextInterface);
const initialState = {
    data: null,
    graphData: null,
    loading: false,
    top5Sequences: null
}

interface ProviderProps {
    children: React.ReactNode;
}


export const Provider = ({children}: ProviderProps) => {
    const [data, setData] = useState<GlobalDataType[] | null>(initialState.data)
    const [graphData, setGraphData] = useState<GraphData | null>(initialState.graphData)
    const [loading, setLoading] = useState<boolean>(initialState.loading)
    const [top5Sequences, setTop5Sequences] = useState<SequenceCount[] | null>(initialState.top5Sequences)
    const resetData = () => {
        setData(null)
        setGraphData(null)
        console.log("Data reset");

    }

    return (
        <Context.Provider
            value={{
                data,
                graphData,
                loading,
                top5Sequences,
                setLoading,
                setData,
                setGraphData,
                resetData,
                setTop5Sequences
            }}
        >
            {children}
        </Context.Provider>
    )
}