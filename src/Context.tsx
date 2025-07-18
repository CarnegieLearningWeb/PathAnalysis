import {createContext, ReactNode, useState} from 'react';
import { GlobalDataType, GraphData } from './lib/types';
// import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
interface ContextInterface {
    data: GlobalDataType[] | null;
    error: string | null;
    setError: (error: string | null) => void;
    graphData: GraphData | null;

    csvData: string;
    filename: string;

    loading: boolean;
    top5Sequences: SequenceCount[] | null;
    f3L3: boolean;
    selectedSequence: string[] | undefined; // string[] or SequenceCount[].sequence?
    setLoading: (loading: boolean) => void;
    setData: (data: GlobalDataType[] | null) => void;
    setF3L3: (f3L3: boolean) => void;
    setGraphData: (graphData: GraphData | null) => void;
    setTop5Sequences: (top5Sequences: SequenceCount[] | null) => void;
    setSelectedSequence: (selectedSequence: string[] | undefined) => void;
    setCSVData: (csvData: string) => void;
    setFilename: (filename: string) => void;

    resetData: () => void;

}
export interface CSVRow {
    'Session Id'?: string;
    'Time': string;
    'Step Name': string;
    'Outcome': string;
    'CF (Workspace Progress Status)': string;
    'Problem Name': string;
    'Anon Student Id': string;
    'first or last'?: string;
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
    csvData:'',
    filename: '',
    f3L3: false,
}

interface ProviderProps {
    children: ReactNode;
}


export const Provider = ({children}: ProviderProps) => {
    const [data, setData] = useState<GlobalDataType[] | null>(initialState.data)
    const [graphData, setGraphData] = useState<GraphData | null>(initialState.graphData)
    const [loading, setLoading] = useState<boolean>(initialState.loading)
    const [error, setError] = useState<string | null>(null)

    const [csvData, setCSVData] = useState<string>(initialState.csvData)
    const [filename, setFilename] = useState<string>(initialState.filename)
    const [top5Sequences, setTop5Sequences] = useState<SequenceCount[] | null>(initialState.top5Sequences)
    const [selectedSequence, setSelectedSequence] = useState<SequenceCount["sequence"] | undefined>(initialState.selectedSequence);
    const [f3L3, setF3L3] = useState<boolean | null>(initialState.f3L3)
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
        setCSVData('')
        setFilename('')
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
                csvData,
                filename,
                setError,
                setLoading,
                setData,
                f3L3,
                setGraphData,
                setTop5Sequences,
                setSelectedSequence,
                setCSVData,
                setFilename,
                resetData,
                setF3L3
            }}
        >
            {children}
        </Context.Provider>
    )
}