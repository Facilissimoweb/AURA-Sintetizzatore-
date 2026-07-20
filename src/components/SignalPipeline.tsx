import { Mic, Shield, Repeat, SlidersHorizontal, Volume2, Cpu } from 'lucide-react';
import { Language } from '../types';

interface SignalPipelineProps {
  isEngineRunning: boolean;
  language: Language;
  stats: { sampleRate: number; latency: number } | null;
}

export default function SignalPipeline({ isEngineRunning, language, stats }: SignalPipelineProps) {
  const steps = [
    {
      id: 'mic',
      icon: Mic,
      titleEn: 'Mic Input Capture',
      titleIt: 'Ingresso Microfono',
      descEn: 'Echo cancelled & suppressed',
      descIt: 'Rimozione eco e fruscio attiva',
    },
    {
      id: 'lowcut',
      icon: Shield,
      titleEn: 'Rumble Filter (80 Hz)',
      titleIt: 'Antirimbozzo (80 Hz)',
      descEn: 'Removes microphone low-end hum',
      descIt: 'Elimina risonanze sub-basse del mic',
    },
    {
      id: 'pitch',
      icon: Repeat,
      titleEn: 'Dual-Delay Pitch Shifter',
      titleIt: 'Pitch Shifter Dual-Delay',
      descEn: 'Parallel AudioWorklet DSP thread',
      descIt: 'Thread parallelo AudioWorklet',
    },
    {
      id: 'eq',
      icon: SlidersHorizontal,
      titleEn: 'Bio-resonance Formant EQ',
      titleIt: 'Eq. Formanti Biologico',
      descEn: 'Chest, nasal & presence sculpting',
      descIt: 'Scolpisce petto, naso e presenza',
    },
    {
      id: 'volume',
      icon: Volume2,
      titleEn: 'Limiter & Gain Control',
      titleIt: 'Guadagno & Limitatore',
      descEn: 'Safety limiter & output volume',
      descIt: 'Limitatore di sicurezza & volume',
    },
  ];

  return (
    <div className="bg-white border border-slate-100 rounded-3xl p-4 sm:p-5 shadow-xl shadow-slate-100/50 flex flex-col justify-between">
      <div>
        <h3 className="text-xs sm:text-sm font-bold text-slate-800 tracking-wide uppercase flex items-center mb-4">
          <Cpu className="w-4 h-4 mr-1.5 text-indigo-600" />
          {language === 'en' ? 'Active Signal Pipeline' : 'Percorso del Segnale'}
        </h3>

        <div className="space-y-3.5 relative">
          {/* Connecting Vertical Track */}
          <div className="absolute left-[17px] top-3.5 bottom-3.5 w-0.5 bg-slate-100 z-0"></div>
          
          {/* Pulsing glow line over the connector when running */}
          {isEngineRunning && (
            <div className="absolute left-[17px] top-3.5 bottom-3.5 w-0.5 bg-gradient-to-b from-indigo-600 via-purple-500 to-emerald-500 z-0 animate-pulse"></div>
          )}

          {steps.map((step, idx) => {
            const Icon = step.icon;
            return (
              <div key={step.id} className="flex items-start space-x-3.5 z-10 relative">
                {/* Node bubble */}
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 border ${
                  isEngineRunning 
                    ? 'bg-indigo-50 border-indigo-100 text-indigo-600 shadow-[0_0_10px_rgba(79,70,229,0.15)]'
                    : 'bg-slate-50 border-slate-100 text-slate-400'
                }`}>
                  <Icon className="w-4.5 h-4.5" />
                </div>

                {/* Node Metadata text */}
                <div className="flex-1 min-w-0 pt-0.5">
                  <span className={`text-xs font-bold block truncate transition-colors ${
                    isEngineRunning ? 'text-slate-800' : 'text-slate-400'
                  }`}>
                    {language === 'en' ? step.titleEn : step.titleIt}
                  </span>
                  <span className="text-[10px] text-slate-400 block truncate leading-tight mt-0.5">
                    {isEngineRunning 
                      ? (language === 'en' ? step.descEn : step.descIt) 
                      : (language === 'en' ? 'Inactive (Bypass)' : 'Inattivo (Bypass)')
                    }
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Latency and sample rate metrics row */}
      <div className="mt-6 pt-4 border-t border-slate-100 grid grid-cols-2 gap-3 text-xs">
        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
          <span className="text-slate-450 text-[10px] uppercase font-bold block mb-0.5">
            {language === 'en' ? 'Estimated Latency' : 'Latenza Stimata'}
          </span>
          <span className={`font-mono font-extrabold ${isEngineRunning ? 'text-indigo-600' : 'text-slate-400'}`}>
            {isEngineRunning && stats ? `${stats.latency} ms` : '-- ms'}
          </span>
        </div>
        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
          <span className="text-slate-450 text-[10px] uppercase font-bold block mb-0.5">
            {language === 'en' ? 'Sample Rate' : 'Frequenza Camp.'}
          </span>
          <span className={`font-mono font-extrabold ${isEngineRunning ? 'text-emerald-600' : 'text-slate-400'}`}>
            {isEngineRunning && stats ? `${stats.sampleRate} Hz` : '-- Hz'}
          </span>
        </div>
      </div>
    </div>
  );
}
