import { useContext, useState } from 'react';
import { FolderOpen, Upload as UploadIcon } from 'lucide-react';
import { Context } from "@/Context.tsx";
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import DataFileSelector from './DataFileSelector';

interface UploadProps {
    onDataProcessed: (csvData: string, filename?: string) => void; // Callback function to handle processed CSV data
}

const REQUIRED_FIELDS = [
    'Time',
    'Step Name',
    'Outcome',
    'CF (Workspace Progress Status)',
    'Problem Name',
    'Anon Student Id',
];

// Functional component for file upload
function Upload({ onDataProcessed }: UploadProps) {
    // Access loading state and setter from Context
    const { setLoading } = useContext(Context);
    const [activeTab, setActiveTab] = useState<string>("upload");

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
        <div className="mx-auto max-w-3xl space-y-5 py-6">
            <div className="space-y-1 text-center">
                <h2 className="text-xl font-semibold tracking-tight">Load data for analysis</h2>
                <p className="text-sm text-muted-foreground">
                    Upload a file, or pick one from the shared data folder.
                </p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="upload" className="gap-2">
                        <UploadIcon className="h-3.5 w-3.5" aria-hidden />
                        Upload file
                    </TabsTrigger>
                    <TabsTrigger value="select" className="gap-2">
                        <FolderOpen className="h-3.5 w-3.5" aria-hidden />
                        Data folder
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="select" className="mt-4">
                    <DataFileSelector onDataProcessed={onDataProcessed} />
                </TabsContent>

                <TabsContent value="upload" className="mt-4">
                    <Card>
                        <CardHeader>
                            <Label
                                htmlFor="upload"
                                className="text-sm font-semibold leading-none tracking-tight"
                            >
                                Upload a CSV or TSV file
                            </Label>
                            <CardDescription>
                                Choose a file from your computer to analyse student learning paths.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <Input
                                id="upload"
                                type="file"
                                accept=".csv, .tsv"
                                onChange={handleFileUpload}
                                aria-describedby="upload-requirements"
                                className="cursor-pointer text-sm file:mr-3 file:cursor-pointer file:rounded file:bg-secondary file:px-2.5 file:py-1 file:text-xs file:font-medium file:text-secondary-foreground hover:file:bg-accent"
                            />
                            <div id="upload-requirements" className="field-hint space-y-1">
                                <p>Accepted formats: CSV, TSV.</p>
                                <p>
                                    Required columns:{' '}
                                    {REQUIRED_FIELDS.map((field, index) => (
                                        <span key={field}>
                                            {index > 0 && ', '}
                                            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-foreground">
                                                {field}
                                            </code>
                                        </span>
                                    ))}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default Upload;
