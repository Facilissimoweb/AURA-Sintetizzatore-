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
  return (
    <div className="space-y-1.5">
      {/* Label and Badge */}
      <div className="flex justify-between items-end">
        <span className="font-mono text-[10px] sm:text-xs text-black font-semibold uppercase tracking-wider flex items-center">
          {icon && <span className="mr-1.5 text-industrial-orange">{icon}</span>}
          {label}
        </span>
        <span className="font-mono text-[10px] sm:text-xs text-industrial-orange font-bold">
          {badgeValue}
        </span>
      </div>

      {/* Slider range control */}
      <div className="flex items-center space-x-2">
        {leftLabel && (
          <span className="font-mono text-[9px] text-black/60 font-semibold uppercase">
            {leftLabel}
          </span>
        )}
        
        <div className="relative flex-1">
          <input
            id={id}
            type="range"
            min={minValue}
            max={maxValue}
            step={step}
            value={currentValue}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            className="brutalist-range"
          />
        </div>

        {rightLabel && (
          <span className="font-mono text-[9px] text-black/60 font-semibold uppercase">
            {rightLabel}
          </span>
        )}
      </div>

      {/* Helpful context string */}
      {helpText && (
        <p className="font-sans text-[10px] text-black/50 leading-relaxed font-normal">
          {helpText}
        </p>
      )}
    </div>
  );
}
