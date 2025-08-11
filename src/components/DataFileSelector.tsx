import { useContext, useEffect, useState } from 'react';
import { Context } from "@/Context.tsx";
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Label } from './ui/label';
import { RefreshCw } from 'lucide-react';

interface DataFile {
    filename: string;
    size: number;
    modified: string;
    path: string;
}

interface DataFilesSelectorProps {
    onDataProcessed: (csvData: string, filename?: string) => void;
}

function DataFileSelector({ onDataProcessed }: DataFilesSelectorProps) {
    const { setLoading } = useContext(Context);
    const [dataFiles, setDataFiles] = useState<DataFile[]>([]);
    const [selectedFile, setSelectedFile] = useState<string>('');
    const [error, setError] = useState<string>('');
    const [refreshing, setRefreshing] = useState(false);

    // Format file size for display
    const formatFileSize = (bytes: number): string => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    // Format date for display
    const formatDate = (dateString: string): string => {
        const date = new Date(dateString);
        return date.toLocaleString();
    };

    // Get file type icon/indicator
    const getFileTypeIcon = (filename: string): string => {
        if (filename.includes('astra')) return '🤖'; // AI/Astra generated
        if (filename.includes('successful')) return '✅'; // Successful strategies
        if (filename.includes('unsuccessful')) return '❌'; // Unsuccessful strategies
        if (filename.includes('ER')) return '🔢'; // Equivalent Ratios
        if (filename.includes('ME')) return '✖️'; // Means & Extremes
        return '📄'; // Default file icon
    };

    // Parse filename and create formatted title
    const parseFileTitle = (filename: string): string => {
        // Remove file extension
        const nameWithoutExt = filename.replace(/\.(csv|CSV)$/, '');
        
        // Split by hyphens and process each part
        const parts = nameWithoutExt.split('-').map(part => {
            // Handle specific abbreviations and terms
            switch (part.toLowerCase()) {
                case 'er':
                    return 'Equivalent Ratios';
                case 'me':
                    return 'Means & Extremes';
                case 'groundtruth':
                case 'ground_truth':
                    return 'Ground Truth';
                case 'successful':
                    return 'Successful';
                case 'unsuccessful':
                    return 'Unsuccessful';
                case 'strategies':
                    return 'Strategies';
                case 'match':
                    return 'Match';
                case 'allstrategies':
                case 'all_strategies':
                    return 'All Strategies';
                case 'astra':
                    return 'ASTRA Generated';
                default:
                    // Capitalize first letter of each word
                    return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
            }
        });
        
        return parts.join(' ');
    };

    // Fetch available data files from the server
    const fetchDataFiles = async () => {
        setRefreshing(true);
        setError('');
        
        try {
            const response = await fetch('/api/data-files');
            const data = await response.json();
            
            if (data.error) {
                setError(data.error);
                setDataFiles([]);
            } else {
                setDataFiles(data.files || []);
                // Auto-select the most recent file
                if (data.files && data.files.length > 0 && !selectedFile) {
                    setSelectedFile(data.files[0].filename);
                }
            }
        } catch (err) {
            setError('Failed to connect to server. Make sure the Path Analysis Tool server is running.');
            setDataFiles([]);
        } finally {
            setRefreshing(false);
        }
    };

    // Load selected file content
    const loadSelectedFile = async () => {
        if (!selectedFile) return;
        
        setLoading(true);
        setError('');
        
        try {
            const response = await fetch(`/api/data-files/${encodeURIComponent(selectedFile)}`);
            
            if (!response.ok) {
                throw new Error(`Failed to load file: ${response.status} ${response.statusText}`);
            }
            
            const csvData = await response.text();
            
            if (!csvData || csvData.trim() === '') {
                throw new Error('File is empty or invalid');
            }
            
            onDataProcessed(csvData, selectedFile);
            
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load file');
        } finally {
            setLoading(false);
        }
    };

    // Load files on component mount
    useEffect(() => {
        fetchDataFiles();
    }, []);

    return (
        <div className="container flex flex-col gap-4 p-4 border border-gray-200 rounded-lg bg-white">
            <div className="flex items-center justify-between">
                <Label className="text-lg font-semibold">Select Data File</Label>
                <Button 
                    onClick={fetchDataFiles} 
                    disabled={refreshing}
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2"
                >
                    <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            {error && (
                <div className="text-red-600 bg-red-50 p-3 rounded border text-sm">
                    {error}
                </div>
            )}

            {dataFiles.length > 0 ? (
                <div className="space-y-4">
                    <Select value={selectedFile} onValueChange={setSelectedFile}>
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Choose a data file..." />
                        </SelectTrigger>
                        <SelectContent className="max-h-60 overflow-y-auto">
                            {dataFiles.map((file) => (
                                <SelectItem key={file.filename} value={file.filename}>
                                    <div className="flex items-center justify-between w-full">
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                            <span className="text-lg">{getFileTypeIcon(file.filename)}</span>
                                            <span className="truncate font-mono text-sm">{file.filename}</span>
                                        </div>
                                        <div className="flex flex-col items-end text-xs text-gray-500 ml-4 flex-shrink-0">
                                            <span>{formatFileSize(file.size)}</span>
                                            <span>{formatDate(file.modified)}</span>
                                        </div>
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {selectedFile && (
                        <div className="p-3 bg-gray-50 rounded border">
                            <div className="flex items-center justify-between">
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-medium text-sm text-gray-900">Selected File:</h4>
                                    <p className="text-lg font-semibold text-blue-800 mt-1">{parseFileTitle(selectedFile)}</p>
                                    <p className="text-sm text-gray-600 font-mono truncate">{selectedFile}</p>
                                    {(() => {
                                        const file = dataFiles.find(f => f.filename === selectedFile);
                                        return file ? (
                                            <p className="text-xs text-gray-500 mt-1">
                                                {formatFileSize(file.size)} • Modified {formatDate(file.modified)}
                                            </p>
                                        ) : null;
                                    })()}
                                </div>
                                <Button 
                                    onClick={loadSelectedFile}
                                    className="ml-4 flex-shrink-0"
                                    disabled={!selectedFile}
                                >
                                    Load File
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                !error && !refreshing && (
                    <div className="text-center text-gray-500 p-8">
                        <p className="text-lg mb-2">No CSV files found</p>
                        <p className="text-sm">
                            Generate data using Astra and transport it using:
                        </p>
                        <code className="bg-gray-100 px-2 py-1 rounded text-xs mt-2 block">
                            python transport_data.py --all
                        </code>
                    </div>
                )
            )}

            {refreshing && (
                <div className="text-center text-gray-500 p-4">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                    <p>Checking for data files...</p>
                </div>
            )}
        </div>
    );
}

export default DataFileSelector;