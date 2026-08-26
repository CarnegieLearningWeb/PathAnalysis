import React from 'react';
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

interface FilterComponentProps {
    onFilterChange: (filters: string[]) => void;
    currentFilters: string[];
    showSelectedSequence: boolean;
    showAllStudents: boolean;
    onShowSelectedSequenceChange: (show: boolean) => void;
    onShowAllStudentsChange: (show: boolean) => void;
}

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
        <div className="space-y-3">
            <Label className="text-sm font-medium">Graphs to Display:</Label>
            <div className="space-y-2">
                <div className="flex items-center space-x-2">
                    <Checkbox
                        id="show-selected-sequence"
                        checked={showSelectedSequence}
                        onCheckedChange={(checked: boolean | 'indeterminate') => onShowSelectedSequenceChange(checked as boolean)}
                    />
                    <Label htmlFor="show-selected-sequence" className="cursor-pointer">Selected Sequence</Label>
                </div>
                <div className="flex items-center space-x-2">
                    <Checkbox
                        id="show-all-students"
                        checked={showAllStudents}
                        onCheckedChange={(checked: boolean | 'indeterminate') => onShowAllStudentsChange(checked as boolean)}
                    />
                    <Label htmlFor="show-all-students" className="cursor-pointer">All Students, All Paths</Label>
                </div>
                <div className="flex items-center space-x-2">
                    <Checkbox
                        id="graduated"
                        checked={currentFilters.includes('GRADUATED')}
                        onCheckedChange={(checked: boolean | 'indeterminate') => handleCheckboxChange('GRADUATED', checked as boolean)}
                    />
                    <Label htmlFor="graduated" className="cursor-pointer">Graduated (filtered)</Label>
                </div>
                <div className="flex items-center space-x-2">
                    <Checkbox
                        id="promoted"
                        checked={currentFilters.includes('PROMOTED')}
                        onCheckedChange={(checked: boolean | 'indeterminate') => handleCheckboxChange('PROMOTED', checked as boolean)}
                    />
                    <Label htmlFor="promoted" className="cursor-pointer">Promoted (filtered)</Label>
                </div>
            </div>
        </div>
    );
};

export default FilterComponent;
