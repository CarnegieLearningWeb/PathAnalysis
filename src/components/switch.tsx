import React from 'react';
import './../Switch.css'; // Import the CSS for styling

interface SwitchProps {
  isOn: boolean;
  handleToggle: () => void;
  disabled?: boolean;
}

const Switch: React.FC<SwitchProps> = ({ isOn, handleToggle, disabled = false }) => {
  return (
    <div className="flex items-center justify-between space-x-4">
      <label className="text-sm font-medium text-gray-700">
        {/*Include Self Loops*/}
      </label>
      <button
        type="button"
        role="switch"
        aria-checked={isOn}
        disabled={disabled}
        onClick={disabled ? undefined : handleToggle}
        className={`
            relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent 
            transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
            ${disabled 
              ? 'bg-gray-300 cursor-not-allowed opacity-50' 
              : `cursor-pointer ${isOn ? 'bg-blue-600' : 'bg-gray-200'}`
            }
        `}
      >
        <span className="sr-only">Toggle self loops</span>
        <span
          className={`
                pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 
                transition duration-200 ease-in-out
                ${isOn ? 'translate-x-5' : 'translate-x-0'}
            `}
        />
      </button>
    </div>
  );
};
export default Switch;