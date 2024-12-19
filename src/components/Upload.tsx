import React, { useContext } from 'react';
import { Context } from "@/Context.tsx";
import { Input } from './ui/input';
import { Label } from './ui/label';

interface UploadProps {
    onDataProcessed: (csvData: string) => void; // Callback function to handle processed CSV data
}

// Functional component for file upload
function Upload({ onDataProcessed }: UploadProps) {
    // Access loading state and setter from Context
    const { loading, setLoading } = useContext(Context);

    // Handle file upload event
    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        // Retrieve the uploaded file from the input
        const file = event.target.files?.[0];

        if (file) {
            // Set loading state to true when the file is selected
            setLoading(true);

            // Create a FileReader to read the contents of the uploaded file
            const reader = new FileReader();

            // Define what happens when the file is successfully read
            reader.onload = (e) => {
                const csvData = e.target?.result as string; // Cast the result to a string
                onDataProcessed(csvData); // Process the CSV data

                // Set loading state to false when the file is processed
                setLoading(false);
            };

            // Define what happens in case of an error while reading the file
            reader.onerror = () => {
                // Set loading state to false in case of an error
                setLoading(false);
            };

            // Read the file as text
            reader.readAsText(file);
        }
    };

    return (
        <div className="container flex flex-col gap-3 ">
            <Label htmlFor='upload'>Upload CSV</Label>
            <Input className='' id='upload' type="file" accept=".csv" onChange={handleFileUpload} /> {/* Input for CSV file upload */}
        </div>
    );
};

export default Upload;
