import {createContext, ReactNode, useState} from 'react';
import { GlobalDataType, GraphData } from './lib/types';
// import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
interface ContextInterface {
    data: GlobalDataType[] | null;
    error: string | null;
    setError: (error: string | null) => void;
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
    children: ReactNode;
}
export const Provider = ({ children }: ProviderProps) => {
    const [data, setData] = useState<GlobalDataType[] | null>(initialState.data)
    const [graphData, setGraphData] = useState<GraphData | null>(initialState.graphData)
    const [loading, setLoading] = useState<boolean>(initialState.loading)
    const [error, setError] = useState<string | null>(null)
    // const queryClient = useQueryClient();
    
    // const { data: uploadedData } = useQuery<GlobalDataType[]>({
    //     queryKey: ['uploadedData'],
    //     staleTime: Infinity,
    // });
    //
    // const { mutate: uploadData } = useMutation({
    //     mutationKey: ['uploadedData'],
    //     mutationFn: async (data: GlobalDataType[]) => data,
    //     onSuccess: (data) => {
    //         queryClient.setQueryData(['uploadedData'], data);
    //     },
    // });
    
    const resetData = () => {
        setData(null)
        setError(null)
        setGraphData(null)
    }

    return (
        <Context.Provider
            value={{
                data,
                graphData,
                loading,
                error,
                setError,
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