import { GlobalDataType } from "./types";


export function filterPromGrad(data: GlobalDataType[], promOrGrad: "GRADUATED" | "PROMOTED" | "ALL" | null): GlobalDataType[] {
    // Return all data if promOrGrad is null or "ALL"
    if (promOrGrad === "ALL" || promOrGrad === null) {
        return data;
    }
    // Only filter for GRADUATED or PROMOTED
    return data.filter(item => item["CF (Workspace Progress Status)"] === promOrGrad);
}