import React from 'react';
import './../../Switch.css';


interface SwitchProps {
  isOn: boolean;
  handleToggle: () => void;
  filter: string|null;
  isDisabled: boolean;

}
const Switch: React.FC<SwitchProps> = ({ isOn, handleToggle }) => {
  return (
    <div className="switch-container" onClick={handleToggle}>
      <div className={`switch ${isOn ? 'Promoted' : 'Graduated'}`}>
        <div className="switch-handle"></div>
      </div>
    </div>
  );
};
export default Switch;