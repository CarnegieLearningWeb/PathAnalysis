import React from 'react';
import {SequenceCount} from "@/Context";

interface SequenceSelectorProps {
    sequences: SequenceCount[];
    selectedSequence: string[] | undefined;
    onSequenceSelect: (sequence: string[]) => void;
}

const SequenceSelector: React.FC<SequenceSelectorProps> = ({
                                                               sequences,
                                                               selectedSequence,
                                                               onSequenceSelect,
                                                           }) => {

    if (sequences == null) {
        return <div>No sequences available</div>; // Display a message when no sequences are present
    }

    // sequences.map((seq: SequenceCount) => {
    //     const count: number = seq.count
    //     const localSequence: string[] = seq.sequence
    //     localSequence.map((s: string) => {
    //         console.log(s)
    //     })
    // })
    return (
        <div>
            <select value={selectedSequence} onChange={(e) => onSequenceSelect([e.target.value])}>
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
