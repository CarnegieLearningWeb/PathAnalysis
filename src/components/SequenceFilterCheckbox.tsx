import React from 'react';
import { CheckboxRow } from "@/components/ui/setting";

interface SequenceFilterCheckboxProps {
    showOnlySequenceStudents: boolean;
    onChange: (value: boolean) => void;
}

/**
 * Standalone version of the "only students on this path" toggle also offered
 * inside GraphMenu. Shares CheckboxRow so both placements have the same label
 * association, hit area and type scale.
 */
const SequenceFilterCheckbox: React.FC<SequenceFilterCheckboxProps> = ({
    showOnlySequenceStudents,
    onChange
}) => {
    return (
        <div className="my-2 w-full rounded-md border bg-card p-3 shadow-sm">
            <CheckboxRow
                id="sequence-filter-only-path-students"
                label="Only students on this path"
                hint="Restrict edge counts to students who followed the selected sequence."
                checked={showOnlySequenceStudents}
                onCheckedChange={onChange}
            />
        </div>
    );
};

export default SequenceFilterCheckbox;
