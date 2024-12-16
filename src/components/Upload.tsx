import React, { useContext } from 'react';
import { Context } from "@/Context.tsx";

// Define the props for the Upload component
interface UploadProps {
    onDataProcessed: (csvData: string) => void; // Callback function to handle processed CSV data
    onLoadingChange: (loading: boolean) => void; // Callback function to manage loading state
}

// Functional component for file upload
const Upload: React.FC<UploadProps> = ({ onDataProcessed, onLoadingChange }) => {
    // Access loading state and setter from Context
    const { loading, setLoading } = useContext(Context);

    // Handle file upload event
    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        // Retrieve the uploaded file from the input
        const file = event.target.files?.[0];

        if (file) {
            // Set loading state to true when the file is selected
            setLoading(true);
            onLoadingChange(loading);
            console.log(onLoadingChange);

            // Create a FileReader to read the contents of the uploaded file
            const reader = new FileReader();

            // Define what happens when the file is successfully read
            reader.onload = (e) => {
                const csvData = e.target?.result as string; // Cast the result to a string
                onDataProcessed(csvData); // Process the CSV data

                // Set loading state to false when the file is processed
                setLoading(false);
                onLoadingChange(loading);
            };

            // Define what happens in case of an error while reading the file
            reader.onerror = () => {
                // Set loading state to false in case of an error
                setLoading(false);
                onLoadingChange(loading);
            };

            // Read the file as text
            reader.readAsText(file);
        }
    };

    return (
        <div className="upload">
            <input type="file" accept=".csv, .tsv" onChange={handleFileUpload} /> {/* Input for CSV file upload */}
        </div>
    );
};

export default Upload;
