import { GlobalDataType } from "@/lib/types";
import { useState } from "react";
import DropZone from "./DropZone";

export default function Debug() {
    const [data, setData] = useState<GlobalDataType[]>([])
    const handleData = (data: GlobalDataType[]) => {
        setData(data)
        console.log("Data from file: ", data);
        
    }

    const handleLoading = (loading: boolean) => {
    }

    return (
        <>

            <DropZone afterDrop={handleData} onLoadingChange={handleLoading} />
        </>
    )
}