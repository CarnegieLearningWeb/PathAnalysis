// import React from 'react';
//
// interface SliderProps {
//   min: number;
//   max: number;
//   step?: number;
//   value: number;
//   onChange: (value: number) => void;
// }
//
// const Slider: React.FC<SliderProps> = ({ min, max, step = 1, value, onChange }) => {
//   const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
//     onChange(Number(event.target.value));
//   };
//
//   return (
//     <div style={{ width: '300px', margin: '20px auto', textAlign: 'left', float:'right'}}>
//       <input
//         type="range"
//         min={min}
//         max={max}
//         step={step}
//         value={value}
//         onChange={handleChange}
//         style={{ width: '100%' }}
//       />
//       <p>Minimum # of Edge Visits to Display: {value}</p>
//     </div>
//   );
// };
//
// export default Slider;


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
        <div style={{width: '300px', margin: '40px auto', textAlign: 'right', display: 'flex', float: 'right',  }}>
            <p style={{marginLeft: '10px'}}>Minimum # of Edge Visits to Display: {value}</p>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={handleSliderChange}
                style={{flex: 1}} // Use flex to make it responsive
            />

            <input
                type="number"
                min={min}
                max={max}
                value={value}
                onChange={handleInputChange}
                style={{width: '60px', marginLeft: '10px', border: 'black', outline: 'black'}} // Style the input box
            />

        </div>
    );
};

export default Slider;
