import React from 'react';

interface SequenceFilterCheckboxProps {
    showOnlySequenceStudents: boolean;
    onChange: (value: boolean) => void;
}

const SequenceFilterCheckbox: React.FC<SequenceFilterCheckboxProps> = ({
    showOnlySequenceStudents,
    onChange
}) => {
    return (
        <div className="w-full mt-2 mb-2">
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-3">
                <label className="flex items-center cursor-pointer">
                    <input
                        type="checkbox"
                        checked={showOnlySequenceStudents}
                        onChange={(e) => onChange(e.target.checked)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="ml-2 text-xs font-medium text-gray-700">
                        Include only students on this path in edge counts
                    </span>
                </label>
            </div>
        </div>
    );
};

export default SequenceFilterCheckbox;