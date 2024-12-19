import React from 'react';

interface SliderProps {
    min: number;
    max: number;
    step?: number;
    value: number;
    onChange: (value: number) => void;
}

const Slider: React.FC<SliderProps> = ({min, max, step = 1, value, onChange}) => {
    const handleSliderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = Number(event.target.value);
        onChange(newValue);
    };

    const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = Number(event.target.value);
        if (newValue >= min && newValue <= max) {
            onChange(newValue);
        }
    };

    return (
        <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
            Minimum Edge Visits: {value}
        </label>
        <div className="flex items-center space-x-4">
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={handleSliderChange}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer 
                    accent-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
                type="number"
                min={min}
                max={max}
                value={value}
                onChange={handleInputChange}
                className="w-20 px-2 py-1 text-sm border border-gray-300 rounded-md 
                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
        </div>
    </div>
    );
};

export default Slider;
