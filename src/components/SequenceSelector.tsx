import React from 'react';
import { SequenceCount } from "@/Context";

// Define the props for the SequenceSelector component
interface SequenceSelectorProps {
    sequences: SequenceCount[]; // Array of sequences to select from
    selectedSequence: string[] | undefined; // Currently selected sequence
    onSequenceSelect: (sequence: string[]) => void; // Callback function to handle sequence selection
}

// Functional component for selecting a sequence
const SequenceSelector: React.FC<SequenceSelectorProps> = ({
    sequences,
    selectedSequence,
    onSequenceSelect,
}) => {
    // Display a message when no sequences are present
    if (sequences == null || sequences.length === 0) {
        return <div>No sequences available</div>;
    }

    return (
        <div>
            <select
                value={selectedSequence?.join(',') || ' '} // Set the selected value from the state or an empty string
                onChange={(e) => onSequenceSelect(e.target.value.split(','))} // Handle sequence selection
            >
                {sequences.map((seq: SequenceCount) => (
                    <option key={seq.sequence!.join(',')} value={seq.sequence!.join(',')}>
                        (Color nodes by path taken {seq.count} times)
                    </option>
                ))}
            </select>
        </div>
    );
};

export default SequenceSelector;
