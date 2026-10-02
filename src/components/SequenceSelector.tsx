import React from 'react';
import { SequenceCount } from "@/Context";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectSeparator,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

// Define the props for the SequenceSelector component
interface SequenceSelectorProps {
    sequences: SequenceCount[]; // Array of sequences to select from
    selectedSequence: string[] | undefined; // Currently selected sequence
    onSequenceSelect: (sequence: string[]) => void; // Callback function to handle sequence selection
}

// Sentinel value for the "None" entry: an empty selected sequence highlights
// no path and renders only the full graphs (matches the Streamlit tool).
const NONE_VALUE = '__none__';

/** Renders a step list the way the graphs read it: A → B → C. */
export const formatSequence = (sequence: readonly string[]): string =>
    sequence.join(' → ');

/**
 * Picks the path that gets highlighted across every graph.
 *
 * Replaces a bare native <select> whose options all read "Path taken N times" —
 * indistinguishable from one another. Options now carry the step list itself, so
 * the choice can be made without trial and error.
 */
const SequenceSelector: React.FC<SequenceSelectorProps> = ({
    sequences,
    selectedSequence,
    onSequenceSelect,
}) => {
    // Display a message when no sequences are present
    if (sequences == null || sequences.length === 0) {
        return (
            <p className="flex h-9 items-center text-sm text-muted-foreground">
                No sequences available
            </p>
        );
    }

    // An empty (but defined) sequence means "None" was explicitly chosen;
    // undefined means nothing has been chosen yet, so show the placeholder.
    const currentValue = selectedSequence === undefined
        ? ''
        : selectedSequence.length === 0
            ? NONE_VALUE
            : selectedSequence.join(',');

    return (
        <Select
            value={currentValue}
            onValueChange={(value) =>
                onSequenceSelect(value === NONE_VALUE ? [] : value.split(','))
            }
        >
            <SelectTrigger
                id="sequence-selector"
                aria-label="Selected sequence"
                className="h-9"
            >
                <SelectValue placeholder="Select a sequence…" />
            </SelectTrigger>
            <SelectContent className="max-w-[min(40rem,90vw)]">
                <SelectItem value={NONE_VALUE}>
                    None — show full graphs only
                </SelectItem>
                <SelectSeparator />
                {sequences.map((seq: SequenceCount) => (
                    <SelectItem
                        key={seq.sequence!.join(',')}
                        value={seq.sequence!.join(',')}
                        className="items-start whitespace-normal py-1.5"
                    >
                        {/* `count` is attempts, not students: getTopSequences
                            increments once per (student, problem, session) path
                            whose steps match, so one student with three matching
                            sessions counts three times. The panel caption beside
                            this reads distinct students, so a bare "47×" invites
                            reading it as 47 people next to a caption saying 28.
                            Name the unit. */}
                        <span className="font-medium tabular-nums">
                            Taken {seq.count.toLocaleString()}×
                        </span>
                        <span className="mx-1.5 text-muted-foreground">·</span>
                        <span className="text-muted-foreground">
                            {formatSequence(seq.sequence!)}
                        </span>
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
};

export default SequenceSelector;
