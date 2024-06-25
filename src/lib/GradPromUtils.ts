import { DataSet1 } from "./types";


export function filterPromGrad(data: DataSet1[], promOrGrad: "GRADUATED" | "PROMOTED" | "NOT_COMPLETED" | null): DataSet1[] {
    if (promOrGrad !== null) {
        return data.filter(item => item["CF (Workspace Progress Status)"] === promOrGrad);
    } else {
        // Return the original data if promOrGrad is null
        return data;
    }
}