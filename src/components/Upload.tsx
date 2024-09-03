import React from 'react';

interface UploadProps {
    onDataProcessed: (csvData: string) => void;
}

const Upload: React.FC<UploadProps> = ({ onDataProcessed }) => {
    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        console.log(file)
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const csvData = e.target?.result as string;
                onDataProcessed(csvData);
            };
            reader.readAsText(file);
        }
    };

    return (
        <div className="dropzone">
            <input type="file" accept=".csv" onChange={handleFileUpload} />
        </div>
    );
};

export default Upload;