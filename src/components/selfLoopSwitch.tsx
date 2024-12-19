import React from 'react';
import './../Switch.css'; // Import the CSS for styling

interface SwitchProps {
  isOn: boolean;
  handleToggle: () => void;
}

const Switch: React.FC<SwitchProps> = ({ isOn, handleToggle }) => {
  return (
    <div className="switch-container" onClick={handleToggle}>
        <label>Self Loops?</label>
      <div className={`switch ${isOn ? true:false}`}>
        <div className="switch-handle"></div>
      </div>
    </div>
  );
};
export default Switch;