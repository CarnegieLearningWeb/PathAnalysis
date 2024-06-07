import { useCallback, useState } from 'react';
import { Accept, useDropzone } from 'react-dropzone';
import { GlobalDataType } from '@/lib/types';
import { parseData } from '@/lib/utils';
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

interface DropZoneProps {
    afterDrop: (data: GlobalDataType[]) => void,
    onLoadingChange: (loading: boolean) => void
}

export default function DropZone({afterDrop, onLoadingChange}: DropZoneProps) {
    const delimiters = ["tsv", "csv", "pipe"]

    const [fileType, setFileType] = useState<string>(delimiters[0])

    const onDrop = useCallback((acceptedFiles: File[]) => {
        onLoadingChange(true);
        acceptedFiles.forEach((file: File) => {
            const reader = new FileReader()

            reader.onabort = () => console.warn('file reading was aborted')
            reader.onerror = () => console.error('file reading has failed')
            reader.onload = () => {
                // Do whatever you want with the file contents after .readAsText()
                const textStr = reader.result
                // find file type and convert to delimeter
                let delimeter: string;
                switch (fileType) {
                    case 'tsv':
                        delimeter = '\t'
                        break;
                    case 'csv':
                        delimeter = ','
                        break;
                    case 'pipe':
                        delimeter = '|'
                        break;
                    case 'json':
                        delimeter = ''
                        break;
                    default:
                        delimeter = '\t'
                        break;
                }
                const array: GlobalDataType[] | null = parseData(textStr, delimeter)
                if (array) {
                    afterDrop(array);
                }
                onLoadingChange(false);
                // console.log(array)
            }
            reader.readAsText(file)
        })

    }, [])

    const acceptedFileTypes: Accept = {
        'text/plain': ['.txt', '.csv', '.tsv', '.json'],
    }

    const { getRootProps, getInputProps, isDragActive, isFocused, isDragReject } = useDropzone({
        onDrop,
        accept: acceptedFileTypes,
    });

    const fileTypeOptions = [
        {
            label: 'Tab Separated',
            value: delimiters.find((delimiter) => delimiter === 'tsv') as string
        },
        {
            label: 'Comma Separated',
            value: delimiters.find((delimiter) => delimiter === 'csv') as string
        },
        {
            label: 'Pipe Separated',
            value: delimiters.find((delimiter) => delimiter === 'pipe') as string
        },
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
                            <RadioGroupItem value={option.value} key={option.value} />
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
                    <div className={`flex items-center h-full w-[fitcontent] justify-center bg-slate-100 rounded-lg p-2`}>
                    <p className={""}>Drag 'n' drop some files here, or click to select files</p>
                </div>
                }
                {
                    isDragReject &&
                    <p className="text-red-500 pt-10">File type not accepted, please try again</p>

                }
            </div>


        </>
    );
}