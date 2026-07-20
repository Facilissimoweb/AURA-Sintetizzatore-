import { Sparkles } from 'lucide-react';
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
    <div className="bg-white border border-slate-100 rounded-3xl p-4 sm:p-5 shadow-xl shadow-slate-100/50">
      <h3 className="text-xs sm:text-sm font-bold text-slate-800 tracking-wide uppercase flex items-center mb-3.5">
        <Sparkles className="w-4 h-4 mr-1.5 text-indigo-600 animate-pulse" />
        {language === 'en' ? 'Natural Synthesis Presets' : 'Preset di Sintesi Naturale'}
      </h3>

      {/* Grid of presets */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {presets.map((preset) => {
          const isActive = activePresetId === preset.id;
          const name = language === 'en' ? preset.nameEn : preset.nameIt;
          const desc = language === 'en' ? preset.descriptionEn : preset.descriptionIt;

          return (
            <button
              key={preset.id}
              onClick={() => onSelectPreset(preset)}
              className={`preset-btn text-left p-3.5 rounded-2xl border flex flex-col justify-between transition-all duration-300 active:scale-95 group relative ${
                isActive
                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100/40'
                  : 'bg-slate-50 border-slate-100 text-slate-700 hover:bg-slate-100/60 hover:border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-lg sm:text-xl">{preset.emoji}</span>
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                )}
              </div>
              
              <div className="mt-2.5">
                <span className={`text-xs font-bold block truncate tracking-wide ${
                  isActive ? 'text-white' : 'text-slate-800'
                }`}>{name}</span>
                <span className={`text-[9px] line-clamp-1 mt-0.5 leading-tight ${
                  isActive ? 'text-indigo-100' : 'text-slate-400 group-hover:text-slate-500'
                }`}>
                  {desc}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
