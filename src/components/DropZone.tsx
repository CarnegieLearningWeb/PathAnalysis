import { useCallback } from 'react';
import { Accept, useDropzone } from 'react-dropzone';
import { GlobalDataType } from '@/lib/types';
import { parseData } from '@/lib/utils';

export default function DropZone() {
    const onDrop = useCallback((acceptedFiles: File[]) => {
        acceptedFiles.forEach((file: File) => {
            const reader = new FileReader()

            reader.onabort = () => console.warn('file reading was aborted')
            reader.onerror = () => console.error('file reading has failed')
            reader.onload = () => {
                // Do whatever you want with the file contents after .readAsText()
                const textStr = reader.result
                const array: GlobalDataType[] | null = parseData(textStr)
                console.log(array)
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

    return (
        <div
            className={`bg-slate-200 cursor-pointer h-40 p-2 rounded-md border-2 border-black text-center ${(isDragActive || isFocused) ? 'bg-orange-100' : ''}`}
            {...getRootProps()}
        >
            <input {...getInputProps()} />
            {
                (isDragActive && !isDragReject) ?
                    <p>Drop em here</p> :
                    <p>Drag 'n' drop some files here, or click to select files</p>
            }
            {
                isDragReject &&
                <p className="text-red-500">File type not accepted, please try again</p>

            }
        </div>
    );
}