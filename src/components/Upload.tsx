import { useContext, useState } from 'react';
import { Context } from "@/Context.tsx";
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import DataFileSelector from './DataFileSelector';

interface UploadProps {
    onDataProcessed: (csvData: string, filename?: string) => void; // Callback function to handle processed CSV data
}

// Functional component for file upload
function Upload({ onDataProcessed }: UploadProps) {
    // Access loading state and setter from Context
    const { setLoading } = useContext(Context);
    const [activeTab, setActiveTab] = useState<string>("select");

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
                // Basic validation to ensure the data is not empty or malformed
                if (!csvData || csvData.trim() === '') {
                    console.error('Empty or invalid CSV data');
                    setLoading(false);
                    return;
                }
                onDataProcessed(csvData, file.name); // Process the CSV data with filename

                // Set loading state to false when the file is processed
                setLoading(false);
            };

            // Define what happens in case of an error while reading the file
            reader.onerror = () => {
                console.error('Error reading file');
                // Set loading state to false in case of an error
                setLoading(false);
            };

            // Read the file as text
            reader.readAsText(file);
        }
    };

    return (
        <div className="container mx-auto max-w-4xl p-4">
            <div className="space-y-6">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Load Data for Analysis</h2>
                    <p className="text-gray-600">Choose how you'd like to load your CSV data</p>
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="select" className="flex items-center gap-2">
                            📂 Select from Data Folder
                        </TabsTrigger>
                        <TabsTrigger value="upload" className="flex items-center gap-2">
                            📤 Upload File
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="select" className="mt-6">
                        <DataFileSelector onDataProcessed={onDataProcessed} />
                    </TabsContent>

                    <TabsContent value="upload" className="mt-6">
                        <div className="border border-gray-200 rounded-lg p-6 bg-white">
                            <div className="space-y-4">
                                <Label htmlFor='upload' className="text-lg font-semibold">
                                    Upload CSV File
                                </Label>
                                <p className="text-sm text-gray-600">
                                    Select a CSV or TSV file from your computer to analyze student learning paths.
                                </p>
                                <Input 
                                    className='file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100' 
                                    id='upload' 
                                    type="file" 
                                    accept=".csv, .tsv" 
                                    onChange={handleFileUpload} 
                                />
                                <div className="text-xs text-gray-500">
                                    <p>Supported formats: CSV, TSV</p>
                                    <p>Required fields: Time, Step Name, Outcome, CF (Workspace Progress Status), Problem Name, Anon Student Id</p>
                                </div>
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
};

export default Upload;
