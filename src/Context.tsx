import {createContext, ReactNode, useState} from 'react';
import { GlobalDataType, GraphData } from './lib/types';
// import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
interface ContextInterface {
    data: GlobalDataType[] | null;
    error: string | null;
    setError: (error: string | null) => void;
    graphData: GraphData | null;
    loading: boolean;
    top5Sequences: SequenceCount[] | null;
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

export const Context = createContext({} as ContextInterface);
const initialState = {
    data: null,
    graphData: null,
    loading: false,
    top5Sequences: null,
    selectedSequence: undefined,
}

interface ProviderProps {
    children: ReactNode;
}


export const Provider = ({children}: ProviderProps) => {
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

    const [top5Sequences, setTop5Sequences] = useState<SequenceCount[] | null>(initialState.top5Sequences)
    const [selectedSequence, setSelectedSequence] = useState<SequenceCount["sequence"] | undefined>(initialState.selectedSequence);

    const resetData = () => {
        setData(null)
        setError(null)
        setGraphData(null)
        setTop5Sequences(null)
        setSelectedSequence(undefined)
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
                error,
                setError,
                setLoading,
                setData,
                setGraphData,
                resetData,
                setTop5Sequences,
                setSelectedSequence,
            }}
        >
            {children}
        </Context.Provider>
    )
}