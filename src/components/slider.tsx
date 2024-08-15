import React from 'react';

interface SliderProps {
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
}

const Slider: React.FC<SliderProps> = ({ min, max, step = 1, value, onChange }) => {
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange(Number(event.target.value));
  };

  return (
    <div style={{ width: '300px', margin: '20px auto', textAlign: 'left' }}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={handleChange}
        style={{ width: '100%' }}
      />
      <p>Minimum # of Edge Visits for Visualization: {value}</p>
    </div>
  );
};

export default Slider;
