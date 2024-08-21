import React from 'react';

interface SequenceSelectorProps {
    sequences: string[];
    selectedSequence: string;
    onSequenceSelect: (sequence: string) => void;
}

const SequenceSelector: React.FC<SequenceSelectorProps> = ({
    sequences,
    selectedSequence,
    onSequenceSelect,
}) => {
    if (sequences.length === 0) {
        return <div>No sequences available</div>; // Display a message when no sequences are present
    }

    return (
        <div>
            <select value={selectedSequence} onChange={(e) => onSequenceSelect(e.target.value)}>
                {sequences.map((sequence, index) => (
                    <option key={index} value={sequence}>
                        {sequence}
                    </option>
                ))}
            </select>
        </div>
    );
};

export default SequenceSelector;
