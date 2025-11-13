import React, { useState } from 'react';
import { Slider } from "@/components/ui/slider";

interface GraphMinVisitsSliderProps {
    maxValue: number;
    value: number;
    onChange: (value: number) => void;
    uniqueStudentMode: boolean;
}

const GraphMinVisitsSlider: React.FC<GraphMinVisitsSliderProps> = ({
    maxValue,
    value,
    onChange,
    uniqueStudentMode
}) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const handleSliderChange = (newValue: number[]) => {
        onChange(newValue[0]);
    };

    return (
        <div className="w-full mt-2 mb-2">
            <div className="bg-white border border-gray-300 rounded-lg shadow-sm p-2">
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="w-full flex justify-between items-center text-xs font-medium text-gray-700 hover:text-gray-900"
                >
                    <span>Min {uniqueStudentMode ? 'Students' : 'Visits'}: {value}</span>
                    <span className="text-gray-400">{isExpanded ? '▼' : '▲'}</span>
                </button>

                {isExpanded && (
                    <div className="mt-2 pt-2 border-t border-gray-200">
                        <Slider
                            min={0}
                            max={maxValue}
                            step={1}
                            value={[value]}
                            onValueChange={handleSliderChange}
                            className="w-full"
                        />
                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                            <span>0</span>
                            <span>{maxValue}</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default GraphMinVisitsSlider;
