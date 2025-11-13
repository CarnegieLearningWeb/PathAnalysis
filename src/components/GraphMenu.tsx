import React, { useState } from 'react';
import { Slider } from "@/components/ui/slider";
import { Settings } from 'lucide-react';

interface GraphMenuProps {
    maxValue: number;
    value: number;
    onChange: (value: number) => void;
    uniqueStudentMode: boolean;
    // Optional props for sequence filter checkbox
    showSlider?: boolean;
    showSequenceFilter?: boolean;
    showOnlySequenceStudents?: boolean;
    onSequenceFilterChange?: (value: boolean) => void;
}

const GraphMenu: React.FC<GraphMenuProps> = ({
    maxValue,
    value,
    onChange,
    uniqueStudentMode,
    showSlider = true,
    showSequenceFilter = false,
    showOnlySequenceStudents = true,
    onSequenceFilterChange
}) => {
    const [isOpen, setIsOpen] = useState(false);

    const handleSliderChange = (newValue: number[]) => {
        onChange(newValue[0]);
    };

    return (
        <div className="absolute top-2 left-2 z-10">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-8 h-8 flex items-center justify-center bg-white border border-gray-300 rounded shadow-sm hover:bg-gray-50 transition-colors"
                title="Graph Settings"
            >
                <Settings className="w-4 h-4 text-gray-700" />
            </button>

            {isOpen && (
                <div className="absolute top-10 left-0 w-64 bg-white border border-gray-300 rounded-lg shadow-lg p-4">
                    {showSequenceFilter && onSequenceFilterChange && (
                        <div className="mb-4">
                            <label className="flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={showOnlySequenceStudents}
                                    onChange={(e) => onSequenceFilterChange(e.target.checked)}
                                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                />
                                <span className="ml-2 text-xs font-medium text-gray-700">
                                    Include only students on this path in edge counts
                                </span>
                            </label>
                        </div>
                    )}

                    {showSlider && (
                        <>
                            <div className="flex justify-between items-center mb-3">
                                <span className="text-sm font-medium text-gray-700">
                                    Min {uniqueStudentMode ? 'Students' : 'Visits'}
                                </span>
                                <span className="text-sm font-semibold text-gray-900">{value}</span>
                            </div>
                            <Slider
                                min={0}
                                max={maxValue}
                                step={1}
                                value={[value]}
                                onValueChange={handleSliderChange}
                                className="w-full"
                            />
                            <div className="flex justify-between text-xs text-gray-500 mt-2">
                                <span>0</span>
                                <span>{maxValue}</span>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default GraphMenu;