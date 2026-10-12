import React from 'react';
import { CheckboxRow } from "@/components/ui/setting"
import { Separator } from "@/components/ui/separator"

interface FilterComponentProps {
    onFilterChange: (filters: string[]) => void;
    currentFilters: string[];
    showSelectedSequence: boolean;
    showAllStudents: boolean;
    onShowSelectedSequenceChange: (show: boolean) => void;
    onShowAllStudentsChange: (show: boolean) => void;
}

/** Status subsets that get their own graph panel when checked. */
const STATUS_FILTERS = [
    { value: 'GRADUATED', id: 'graph-graduated', label: 'Graduated' },
    { value: 'PROMOTED', id: 'graph-promoted', label: 'Promoted' },
] as const;

/**
 * Which graph panels to render. Laid out as one horizontal row of checkboxes so
 * it can sit in the toolbar: the two always-available graphs on the left, the
 * status-filtered subsets after a divider, because those two sets answer
 * different questions (which view vs. which population).
 */
const FilterComponent: React.FC<FilterComponentProps> = ({
    onFilterChange,
    currentFilters,
    showSelectedSequence,
    showAllStudents,
    onShowSelectedSequenceChange,
    onShowAllStudentsChange,
}) => {
    const handleCheckboxChange = (value: string, checked: boolean) => {
        if (checked) {
            // Add the filter if it's not already in the array
            if (!currentFilters.includes(value)) {
                onFilterChange([...currentFilters, value]);
            }
        } else {
            // Remove the filter
            onFilterChange(currentFilters.filter(f => f !== value));
        }
    };

    return (
        // role=group + aria-labelledby rather than fieldset/legend: a <legend>
        // is a specially-rendered box that does not participate reliably in a
        // flex row across browsers.
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5">
            <div
                role="group"
                aria-labelledby="graphs-caption"
                className="flex flex-wrap items-center gap-x-5 gap-y-2.5"
            >
                <span id="graphs-caption" className="field-label">Graphs</span>
                <CheckboxRow
                    id="show-selected-sequence"
                    label="Selected sequence"
                    checked={showSelectedSequence}
                    onCheckedChange={onShowSelectedSequenceChange}
                />
                <CheckboxRow
                    id="show-all-students"
                    label="All students, all paths"
                    checked={showAllStudents}
                    onCheckedChange={onShowAllStudentsChange}
                />
            </div>

            <Separator orientation="vertical" className="hidden h-5 sm:block" />

            <div
                role="group"
                aria-labelledby="status-graphs-caption"
                className="flex flex-wrap items-center gap-x-5 gap-y-2.5"
            >
                <span id="status-graphs-caption" className="field-label">By status</span>
                {STATUS_FILTERS.map(({ value, id, label }) => (
                    <CheckboxRow
                        key={value}
                        id={id}
                        label={label}
                        checked={currentFilters.includes(value)}
                        onCheckedChange={(checked) => handleCheckboxChange(value, checked)}
                    />
                ))}
            </div>
        </div>
    );
};

export default FilterComponent;
