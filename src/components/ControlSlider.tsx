import { ReactNode } from 'react';

interface ControlSliderProps {
  id: string;
  label: string;
  badgeValue: string;
  minValue: number;
  maxValue: number;
  step: number;
  currentValue: number;
  onChange: (val: number) => void;
  leftLabel?: string;
  rightLabel?: string;
  helpText?: string;
  icon?: ReactNode;
}

export default function ControlSlider({
  id,
  label,
  badgeValue,
  minValue,
  maxValue,
  step,
  currentValue,
  onChange,
  leftLabel,
  rightLabel,
  helpText,
  icon,
}: ControlSliderProps) {
  const percent = ((currentValue - minValue) / (maxValue - minValue)) * 100;
  return (
    <div className="space-y-2">
      {/* Label and Badge */}
      <div className="flex justify-between items-center text-xs">
        <span className="text-slate-700 font-bold tracking-wide flex items-center">
          {icon && <span className="mr-1.5 text-indigo-600">{icon}</span>}
          {label}
        </span>
        <span className="font-mono text-[10px] sm:text-xs px-2.5 py-0.5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-md font-bold shadow-sm">
          {badgeValue}
        </span>
      </div>

      {/* Slider range control */}
      <div className="flex items-center space-x-3">
        {leftLabel && (
          <span className="text-[10px] text-indigo-600 font-bold uppercase w-10 text-left">
            {leftLabel}
          </span>
        )}
        
        <div className="relative flex-1 group">
          <input
            id={id}
            type="range"
            min={minValue}
            max={maxValue}
            step={step}
            value={currentValue}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            className="w-full cursor-pointer h-1.5 bg-slate-200 rounded-lg appearance-none accent-indigo-600 focus:outline-none transition-all group-hover:bg-slate-300"
            style={{
              background: `linear-gradient(to right, #4f46e5 0%, #4f46e5 ${percent}%, #e2e8f0 ${percent}%, #e2e8f0 100%)`,
            }}
          />
        </div>

        {rightLabel && (
          <span className="text-[10px] text-emerald-600 font-bold uppercase w-10 text-right">
            {rightLabel}
          </span>
        )}
      </div>

      {/* Helpful context string */}
      {helpText && <p className="text-[10px] text-slate-450 leading-normal">{helpText}</p>}
    </div>
  );
}
