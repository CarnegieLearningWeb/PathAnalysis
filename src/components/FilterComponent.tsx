import React from 'react';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
interface FilterComponentProps {
    onFilterChange: (filter: string) => void;
}
const FilterComponent: React.FC<FilterComponentProps> = ({ onFilterChange }) => {
    return (
        <div className="space-y-2">
        <Select onValueChange={(value) => onFilterChange(value)}>
            <SelectTrigger>
                <SelectValue placeholder="Filter by Status" />
            </SelectTrigger>
            <SelectContent>
                <SelectGroup>
                    <SelectItem value="ALL">All Statuses</SelectItem>
                    <SelectItem value="GRADUATED">Graduated</SelectItem>
                    <SelectItem value="PROMOTED">Promoted</SelectItem>
                </SelectGroup>
            </SelectContent>
        </Select>
    </div>
    );
};

export default FilterComponent;