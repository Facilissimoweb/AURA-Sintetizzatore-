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
    <div className="bg-white border-2 border-black p-4.5 flex flex-col justify-between neo-shadow">
      <div>
        <div className="border-b-2 border-black pb-2 mb-3.5 flex items-center justify-between">
          <h3 className="font-display text-sm font-bold text-black uppercase flex items-center tracking-tight">
            <Cpu className="w-4.5 h-4.5 mr-1.5 text-industrial-orange" />
            {language === 'en' ? 'Active Signal Pipeline' : 'Percorso del Segnale'}
          </h3>
          <span className="font-mono text-[9px] text-black/40 font-bold">[02]</span>
        </div>

        <div className="space-y-4 relative">
          {/* Connecting Vertical Track */}
          <div className="absolute left-[17px] top-3.5 bottom-3.5 w-[2px] bg-black z-0" />
          
          {/* Pulsing glow line over the connector when running */}
          {isEngineRunning && (
            <div className="absolute left-[17px] top-3.5 bottom-3.5 w-[2px] bg-industrial-orange z-0 animate-pulse" />
          )}

          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <div key={step.id} className="flex items-start space-x-3.5 z-10 relative">
                {/* Node bubble */}
                <div className={`w-9 h-9 border-2 border-black flex items-center justify-center transition-all duration-100 ${
                  isEngineRunning 
                    ? 'bg-black text-white'
                    : 'bg-white text-black/40 border-black/30'
                }`}>
                  <Icon className="w-4 h-4" />
                </div>

                {/* Node Metadata text */}
                <div className="flex-1 min-w-0 pt-0.5">
                  <span className={`font-mono text-[11px] font-bold block uppercase tracking-wider ${
                    isEngineRunning ? 'text-black' : 'text-black/40'
                  }`}>
                    {language === 'en' ? step.titleEn : step.titleIt}
                  </span>
                  <span className="font-sans text-[10px] text-black/50 block truncate leading-tight mt-0.5">
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
      <div className="mt-6 pt-4 border-t-2 border-black grid grid-cols-2 gap-3 text-xs">
        <div className="bg-industrial-bg border-2 border-black p-3 flex flex-col justify-between">
          <span className="font-mono text-[9px] text-black/60 uppercase font-bold block mb-1">
            {language === 'en' ? 'ESTIMATED_LATENCY' : 'LATENZA_STIMATA'}
          </span>
          <span className={`font-mono font-extrabold text-xs tracking-wider ${isEngineRunning ? 'text-industrial-orange' : 'text-black/40'}`}>
            {isEngineRunning && stats ? `${stats.latency} ms` : '-- ms'}
          </span>
        </div>
        <div className="bg-industrial-bg border-2 border-black p-3 flex flex-col justify-between">
          <span className="font-mono text-[9px] text-black/60 uppercase font-bold block mb-1">
            {language === 'en' ? 'SAMPLE_RATE' : 'FREQ_CAMPIONAMENTO'}
          </span>
          <span className={`font-mono font-extrabold text-xs tracking-wider ${isEngineRunning ? 'text-black' : 'text-black/40'}`}>
            {isEngineRunning && stats ? `${stats.sampleRate} Hz` : '-- Hz'}
          </span>
        </div>
      </div>
    </div>
  );
}
