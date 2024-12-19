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
        return <div className="text-sm">No sequences available</div>;
    }

    return (
        <div className="space-y-2">
            <select
                className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={selectedSequence?.join(',') || ' '}
                onChange={(e) => onSequenceSelect(e.target.value.split(','))}
            >
                <option value=" " disabled>Select a sequence...</option>
                {sequences.map((seq: SequenceCount) => (
                    <option
                        key={seq.sequence!.join(',')}
                        value={seq.sequence!.join(',')}
                        className="py-1"
                    >
                        Path taken {seq.count} times
                    </option>
                ))}
            </select>
        </div>
    );
};

export default SequenceSelector;
