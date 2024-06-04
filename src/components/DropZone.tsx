import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

export default function DropZone() {
    const onDrop = useCallback((acceptedFiles: any) => {
        console.log(acceptedFiles);
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop })

    return (
        <div className="bg-slate-200 cursor-pointer h-20 p-2 rounded-md border-2 border-black text-center" {...getRootProps()}>
            <input {...getInputProps()} />
            {
                isDragActive ?
                    <p>Drop em here</p> :
                    <p>Drag 'n' drop some files here, or click to select files</p>
            }
        </div>
    );
}