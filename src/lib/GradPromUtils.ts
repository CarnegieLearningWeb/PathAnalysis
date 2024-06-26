import {GlobalDataType} from "./types";


export function filterPromGrad(data: GlobalDataType[], promOrGrad: "GRADUATED" | "PROMOTED" | "NOT_COMPLETED" | null): GlobalDataType[] {
    if (data == null) {
    }
    if (promOrGrad !== null) {
        return data.filter(item => item["CF (Workspace Progress Status)"] === promOrGrad);
    } else {
        // Return the original data if promOrGrad is null
        return data;
    }
}