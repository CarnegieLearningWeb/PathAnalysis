import React, {useContext} from 'react';
import { Context } from "@/Context.tsx";

interface UploadProps {
    onDataProcessed: (csvData: string) => void;
    onLoadingChange: (loading: boolean) => void;
}

const Upload: React.FC<UploadProps> = ({ onDataProcessed, onLoadingChange }) => {
    const {loading, setLoading} = useContext(Context)
    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        // const { loading, setLoading } = useContext(Context); // Assuming Context handles loading state.
        const file = event.target.files?.[0];

        if (file) {
            setLoading(true)
            // Set loading to true when the file is selected
            onLoadingChange(loading);
            console.log(onLoadingChange)

            const reader = new FileReader();
            reader.onload = (e) => {
                const csvData = e.target?.result as string;
                onDataProcessed(csvData);

                // Set loading to false when the file is processed
                setLoading(false)
                onLoadingChange(loading);
            };

            reader.onerror = () => {
                // Set loading to false in case of an error
                setLoading(false)
                onLoadingChange(loading);
                // onLoadingChange(false);
            };

            reader.readAsText(file);
        }
    };

    return (
        <div className="upload">
            <input type="file" accept=".csv" onChange={handleFileUpload} />
        </div>
    );
};

export default Upload;
