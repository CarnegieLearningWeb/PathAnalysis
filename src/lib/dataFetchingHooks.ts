import { useQuery } from '@tanstack/react-query';
import { IncomingDataRaw, IncomingMathiaCourse2Data } from './types';
const BASE_URL = "http://10.47.80.160:4001/api/workspace_details/path_analysis";

const oneHour = 1000 * 60 * 60;
const oneDay = oneHour * 24;
// const oneWeek = oneDay * 7;
const DATA_SHOP_ACCESS_KEY = import.meta.env.VITE_ACCESS_KEY_ID
const DATA_SHOP_SECRET_KEY = import.meta.env.VITE_SECRET_ACCESS_KEY
const DATA_SHOP_PATH = 'https://pslcdatashop.web.cmu.edu/services/datasets/4841'

async function generateSignature(secretKey: string, method: string, date: string, path: string): Promise<string> {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secretKey);
    const key = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);

    const stringToSign = `${method}\n\n\n${date}\n${path}`;
    const data = encoder.encode(stringToSign);
    const signature = await crypto.subtle.sign('HMAC', key, data);
    const base64Signature = btoa(String.fromCharCode(...new Uint8Array(signature)));
    return encodeURIComponent(base64Signature);
}

interface FetchDataShopDataProps {
    queryKey: [string, { accessKey: string, secretKey: string, problemId: string }];
}

const fetchDataShopData = async ({ queryKey }: FetchDataShopDataProps): Promise<any> => {

    // @ts-ignore this is a way to get around typescript for now
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [, { accessKey, secretKey, problemId }] = queryKey;
    const date = new Date().toUTCString();
    const method = 'GET'
    const signature: string = await generateSignature(DATA_SHOP_ACCESS_KEY, method, date, DATA_SHOP_PATH);
    const authHeader = `DATASHOP ${DATA_SHOP_ACCESS_KEY}:${signature}`;

    const response = await fetch(DATA_SHOP_PATH, {
        method: method,
        headers: {
            'Authorization': authHeader,
            'Date': date,
            'Accept': 'application/xml',
        },
    });

    if (!response.ok) {
        throw new Error('fetchDataShopData failed');
    }

    return response;
}

export const useDataShopData = () => {
    const { data: dataShopData, isLoading: isDataShopDataLoading, refetch: refetchDataShopData, isSuccess, error } = useQuery({
        queryKey: ['dataShopData', { accessKey: DATA_SHOP_ACCESS_KEY, secretKey: DATA_SHOP_SECRET_KEY, problemId: "1" }],
        queryFn: fetchDataShopData,
        staleTime: oneDay,
        enabled: true,
    });
    if (isSuccess) {
        console.log("DataShop data retrieved with React Query");
    }
    if (error) {
        console.error('error with React Query:', error);
    }
    return { dataShopData, isDataShopDataLoading, refetchDataShopData };

}

interface FetchPathAnalysisDataProps {
    queryKey: [string, { majorVersion?: string, sectionId: string, problemId: string }];
}

const fetchPathAnalysisData = async ({ queryKey }: FetchPathAnalysisDataProps): Promise<IncomingDataRaw[]> => {
    // _key is the first element of the queryKey, omitted for type error purposes
    const [, { majorVersion: majorVersionValue, sectionId: sectionIdValue, problemId: problemIdValue }] = queryKey;
    const response = await fetch(BASE_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            majorVersion: majorVersionValue || "8",
            sectionId: sectionIdValue,
            problemId: problemIdValue,
        }),
    });

    if (!response.ok) {
        throw new Error('fetchPathAnalysisData failed');
    }
    const res = await response.json();
    const data: IncomingDataRaw[] = res.data;
    return data as IncomingDataRaw[];
}

export const usePathAnalysisData = (sectionId: string, problemId: string) => {
    const { data: pathAnalysisData, isLoading: isPathAnalysisDataLoading, refetch: refetchPathAnalysisData, isSuccess, error } = useQuery({
        queryKey: ['pathAnalysisData', { majorVersion: "8", sectionId: sectionId, problemId: problemId }],
        queryFn: fetchPathAnalysisData,
        staleTime: oneDay,
        enabled: true,
    });
    if (isSuccess) {
        // console.log("Path analysis data retrieved with React Query");
    }
    if (error) {
        console.error('error with React Query:', error);
    }
    return { pathAnalysisData, isPathAnalysisDataLoading, refetchPathAnalysisData };

}

interface FetchLocalSampleDataProps {
    queryKey: [string, { fileName: string }];
}

const fetchLocalSampleData = async ({ queryKey }: FetchLocalSampleDataProps): Promise<IncomingMathiaCourse2Data[]> => {
    const [, { fileName }] = queryKey;

    const response = await fetch('/sample_data/' + fileName, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        throw new Error('fetchLocalSampleData failed');
    }
    const res = await response.json();
    const data: IncomingMathiaCourse2Data[] = res;
    return data as IncomingMathiaCourse2Data[];
}

export const useLocalSampleData = (fileName: string) => {
    const { data: localSampleData, isLoading: isLocalSampleDataLoading, refetch: refetchLocalSampleData, isSuccess, error } = useQuery({
        queryKey: ['localSampleData', { fileName: fileName }],
        queryFn: fetchLocalSampleData,
        staleTime: oneDay,
        enabled: true,
    });
    if (isSuccess) {
        console.log("Local sample data retrieved with React Query: ", localSampleData);
    }
    if (error) {
        console.error('error with React Query:', error);
    }
    return { localSampleData, isLocalSampleDataLoading, refetchLocalSampleData };
}