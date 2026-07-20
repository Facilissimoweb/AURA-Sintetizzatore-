import { SynthPreset, Language } from '../types';

interface PresetSelectorProps {
  presets: SynthPreset[];
  activePresetId: string | null;
  onSelectPreset: (preset: SynthPreset) => void;
  language: Language;
}

export default function PresetSelector({
  presets,
  activePresetId,
  onSelectPreset,
  language,
}: PresetSelectorProps) {
  return (
    <div className="space-y-4">
      {/* Brutalist Section Header */}
      <div className="border-b-2 border-black pb-1.5 flex justify-between items-end">
        <h2 className="font-display uppercase font-semibold text-lg tracking-tight text-black">
          {language === 'en' ? 'Synthesis Presets' : 'Preset di Sintesi'}
        </h2>
        <span className="font-mono text-[10px] text-black/40 font-bold">[01]</span>
      </div>

      {/* Stack/Grid of industrial presets */}
      <div className="flex flex-col gap-2">
        {presets.map((preset) => {
          const isActive = activePresetId === preset.id;
          const name = language === 'en' ? preset.nameEn : preset.nameIt;

          return (
            <button
              key={preset.id}
              onClick={() => onSelectPreset(preset)}
              className={`w-full border-2 border-black px-4 py-3.5 flex justify-between items-center transition-all duration-75 text-left font-mono text-[11px] font-semibold tracking-wider uppercase ${
                isActive
                  ? 'bg-black text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                  : 'bg-white text-black hover:bg-industrial-bg active:bg-neutral-200'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <span className="text-base select-none">{preset.emoji}</span>
                <span>{name}</span>
              </div>
              <span 
                className={`font-mono text-[8px] font-bold px-1.5 py-0.5 border ${
                  isActive ? 'border-industrial-orange text-industrial-orange' : 'border-black/30 text-black/50'
                }`}
              >
                {preset.id.slice(0, 3).toUpperCase()}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
