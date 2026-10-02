import {useCallback, useState} from 'react';
import {Accept, useDropzone} from 'react-dropzone';
import {ParseResult} from '@/lib/types';
import {cn, parseData} from '@/lib/utils';
import {UploadCloud} from 'lucide-react';
import {Label} from "@/components/ui/label"
import {RadioGroup, RadioGroupItem} from "@/components/ui/radio-group"
type TODO = any;
interface DropZoneProps {
    afterDrop: (data:TODO) => void,
    onLoadingChange: (loading: boolean) => void,
    onError: (error: string) => void,
}

export default function DropZone({afterDrop, onLoadingChange, onError}: DropZoneProps) {
    const delimiters = ["csv", "tsv"];

    const [fileType, setFileType] = useState<string>(delimiters[1])

    const onDrop = useCallback((acceptedFiles: File[]) => {
        onLoadingChange(true);

        acceptedFiles.forEach((file: File) => {
            // Add this file type detection
            const fileExtension = file.name.split('.').pop()?.toLowerCase() || '';
            const detectedFileType = fileExtension === 'json' ? 'json' :
                fileExtension === 'tsv' ? 'tsv' :
                    fileExtension === 'csv' ? 'csv' : fileType;

            const reader = new FileReader();

            reader.onabort = () => console.warn('file reading was aborted');
            reader.onerror = () => console.error('file reading has failed');
            reader.onload = () => {
                const textStr = reader.result;
                let delimiter: string;
                // Use detectedFileType instead of fileType
                switch (detectedFileType) {
                    case 'json':
                        delimiter = '';
                        break;
                    case 'tsv':
                        delimiter = '\t';
                        break;
                    case 'csv':
                        delimiter = ',';
                        break;
                    default:
                        delimiter = ',';
                        break;
                }

                const array: ParseResult = parseData(textStr, delimiter);
                if (!array.data) {
                    onError(array.error?.details.join('\n') || 'Error parsing file');
                } else {
                    afterDrop(array.data);
                }

                onLoadingChange(false);
            };
            reader.readAsText(file);
        });
    }, [fileType, afterDrop, onLoadingChange]);

    const acceptedFileTypes: Accept = {
        'text/tab-separated-values': ['.tsv'],
        'text/csv': ['.csv'],
        'text/plain': ['.txt', '.csv', '.tsv', '.json']
    };


    const {getRootProps, getInputProps, isDragActive, isFocused, isDragReject} = useDropzone({
        onDrop,
        accept: acceptedFileTypes,
        // validator: (file) => {
        //     // returns FileError | Array.<FileError> | null
        //     if (!acceptedFileTypes[file.type]) {

        //         return {
        //             code: 'file-invalid-type',
        //             message: 'Invalid file type',
        //         }
        //     }
        //     return null;
        // }
    });


    const fileTypeOptions = [
        {
            label: 'Comma Separated',
            value: delimiters.find((delimiter) => delimiter === 'csv') as string
        },
        {
            label: 'Tab Separated',
            value: delimiters.find((delimiter) => delimiter === 'tsv') as string
        },
        // {
        //     label: 'Pipe Separated',
        //     value: delimiters.find((delimiter) => delimiter === 'pipe') as string
        // },
        // {
        //     label: 'JSON',
        //     value: delimiters.find((delimiter) => delimiter === 'json') as string
        // }
    ]
    return (
        <div className="space-y-4">
            <div
                role="group"
                aria-labelledby="dropzone-file-type"
                className="flex flex-wrap items-center gap-x-5 gap-y-2"
            >
                <span id="dropzone-file-type" className="field-label">File type</span>
                <RadioGroup
                    className="flex flex-wrap items-center gap-x-5 gap-y-2"
                    defaultValue={delimiters[0]}
                    onValueChange={(e: string) => {
                        setFileType(e)
                    }}
                >
                    {fileTypeOptions.map((option) => (
                        // The id/htmlFor pair was missing before, so the labels
                        // were decorative and only the 16px dot was clickable.
                        <div className="flex items-center gap-2" key={option.value}>
                            <RadioGroupItem id={`file-type-${option.value}`} value={option.value}/>
                            <Label htmlFor={`file-type-${option.value}`} className="cursor-pointer">
                                {option.label}
                            </Label>
                        </div>
                    ))}
                </RadioGroup>
            </div>

            <div
                className={cn(
                    "flex h-40 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed p-4 text-center transition-colors",
                    isDragActive || isFocused
                        ? "border-primary bg-primary/5"
                        : "border-input bg-muted/40 hover:bg-muted/70"
                )}
                {...getRootProps()}
            >
                <input {...getInputProps()} />
                <UploadCloud className="h-6 w-6 text-muted-foreground" aria-hidden />
                <p className="text-sm font-medium">
                    {isDragActive ? "Drop the file to load it" : "Drag a file here, or click to browse"}
                </p>
                <p className="field-hint">CSV, TSV or JSON</p>
                {isDragReject && (
                    <p className="text-xs font-medium text-destructive">Invalid file type</p>
                )}
            </div>
        </div>
    );
}