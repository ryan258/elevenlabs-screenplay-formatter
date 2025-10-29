import React from 'react';

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  id: string;
}

const Slider: React.FC<SliderProps> = ({ label, value, min, max, step, onChange, id }) => (
  <div>
    <label htmlFor={id} className="block text-sm font-medium text-text-secondary flex justify-between">
      <span>{label}</span>
      <span>{value.toFixed(2)}</span>
    </label>
    <input
      id={id}
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={onChange}
      className="w-full h-2 bg-primary rounded-lg appearance-none cursor-pointer range-lg accent-highlight"
    />
  </div>
);

export default Slider;
