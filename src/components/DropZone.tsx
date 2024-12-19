import {useCallback, useState} from 'react';
import {Accept, useDropzone} from 'react-dropzone';
import {ParseResult} from '@/lib/types';
import {parseData} from '@/lib/utils';
import {Label} from "@/components/ui/label"
import {RadioGroup, RadioGroupItem} from "@/components/ui/radio-group"

interface DropZoneProps {
    afterDrop: (data:string) => void,
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
        <>
            <div className="pb-3 flex flex-col items-center">
                <div className="font-bold p-1">
                    File Type
                </div>
                <RadioGroup defaultValue={delimiters[0]} onValueChange={(e: string) => {
                    setFileType(e)

                }}>
                    {fileTypeOptions.map((option, index) => (
                        <div className="flex items-center space-x-2" key={index}>
                            <RadioGroupItem value={option.value} key={option.value}/>
                            <Label htmlFor={option.value}>{option.label}</Label>
                        </div>
                    ))}
                </RadioGroup>
            </div>
            <div
                className={`bg-slate-200 cursor-pointer h-40 p-2 rounded-md border-2 border-black text-center ${(isDragActive || isFocused) ? 'bg-orange-100' : ''}`}
                {...getRootProps()}
            >
                <input {...getInputProps()} />
                {
                    !isDragActive ?
                        <div className={`flex items-center h-full w-[fitcontent] justify-center p-2`}>
                            <p className={""}>Drag 'n' drop some files here, or click to select files</p>
                        </div>
                        :
                        <div
                            className={`flex items-center h-full w-[fitcontent] justify-center bg-slate-100 rounded-lg p-2`}>
                            <p className={""}>Drag 'n' drop some files here, or click to select files</p>
                        </div>
                }
                {isDragReject && <p className="text-red-500">Invalid file type</p>}

            
            </div>


        </>
    );
}