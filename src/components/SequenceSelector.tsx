import React from 'react';
import {SequenceCount} from "@/components/GraphvizParent.tsx";

interface SequenceSelectorProps {
    sequences: SequenceCount|string;
    selectedSequence: string;
    onSequenceSelect: (sequence: string) => void;
}

const SequenceSelector: React.FC<SequenceSelectorProps> = ({
    sequences,
    selectedSequence,
    onSequenceSelect,
}) => {
    if (sequences == '') {
        return <div>No sequences available</div>; // Display a message when no sequences are present
    }

    return (
        <div>
            <select value={selectedSequence} onChange={(e) => onSequenceSelect(e.target.value)}>
                {sequences.map((sequence, count) => (
                    <option key={count} value={sequence}>
                        {count}
                    </option>
                ))}
            </select>
        </div>
    );
};

export default SequenceSelector;
