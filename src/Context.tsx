import { createContext, useState } from 'react';
import { GlobalDataType, GraphData } from './lib/types';
interface ContextInterface {
    data: GlobalDataType[] | null;
    graphData: GraphData | null;
    loading: boolean;
    setLoading: (loading: boolean) => void;
    setData: (data: GlobalDataType[] | null) => void;
    setGraphData: (graphData: GraphData | null) => void;
    resetData: () => void;

}
export const Context = createContext({} as ContextInterface);
const initialState = {
    data: null,
    graphData: null,
    loading: false
}

interface ProviderProps {
    children: React.ReactNode;
}
export const Provider = ({ children }: ProviderProps) => {
    const [data, setData] = useState<GlobalDataType[] | null>(initialState.data)
    const [graphData, setGraphData] = useState<GraphData | null>(initialState.graphData)
    const [loading, setLoading] = useState<boolean>(initialState.loading)

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
                setLoading,
                setData,
                setGraphData,
                resetData
            }}
        >
            {children}
        </Context.Provider>
    )
}