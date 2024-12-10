import React from 'react';

interface FilterComponentProps {
    onFilterChange: (filter: string) => void;
}

const FilterComponent: React.FC<FilterComponentProps> = ({ onFilterChange }) => {
    const handleFilterChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        onFilterChange(event.target.value);
    };

    return (
        <div>
            <label htmlFor="statusFilter">Filter by Completion Status:</label>
            <select id="statusFilter" onChange={handleFilterChange}>
                <option value="">All</option>
                <option value="GRADUATED">Graduated</option>
                <option value="PROMOTED">Promoted</option>
            </select>
        </div>
    );
};

export default FilterComponent;