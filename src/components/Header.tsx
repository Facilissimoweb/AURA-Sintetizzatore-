import { Activity, Globe } from 'lucide-react';
import { Language } from '../types';

interface HeaderProps {
  language: Language;
  setLanguage: (lang: Language) => void;
  isEngineRunning: boolean;
}

export default function Header({ language, setLanguage, isEngineRunning }: HeaderProps) {
  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'it' : 'en');
  };

  return (
    <header className="grid grid-cols-1 md:grid-cols-[280px_1fr_280px] lg:grid-cols-[350px_1fr_350px] border-b-2 border-black bg-white select-none">
      {/* Brand box */}
      <div className="p-4 sm:p-5 border-b-2 md:border-b-0 md:border-r-2 border-black flex items-center space-x-3.5">
        <div className="font-display font-bold text-xl leading-none border-2 border-black px-2 py-1 bg-industrial-orange text-black">
          A
        </div>
        <div>
          <h1 className="font-display text-base sm:text-lg font-bold uppercase tracking-tight text-black leading-none">
            {language === 'en' ? 'AURA Studio' : 'AURA Studio'}
          </h1>
          <span className="font-mono text-[9px] uppercase tracking-wider text-black/55 block mt-1">
            {language === 'en' ? 'Synthesis v2.4 // Natural Engine' : 'Sintesi v2.4 // Motore Naturale'}
          </span>
        </div>
      </div>

      {/* Stream Status indicator */}
      <div className="p-4 sm:p-5 border-b-2 md:border-b-0 md:border-r-2 border-black flex items-center justify-start md:justify-center">
        <div className="flex items-center space-x-2.5">
          <span className={`w-2.5 h-2.5 border border-black ${isEngineRunning ? 'bg-industrial-orange animate-pulse' : 'bg-transparent'}`} />
          <span className="font-mono text-[10px] uppercase font-bold tracking-wider text-black">
            {isEngineRunning 
              ? (language === 'en' ? 'IO: ACTIVE STREAM' : 'IO: FLUSSO ATTIVO')
              : (language === 'en' ? 'IO: BYPASS ACTIVE' : 'IO: IN BYPASS')}
          </span>
        </div>
      </div>

      {/* Stats and Language toggler */}
      <div className="p-4 sm:p-5 flex items-center justify-between md:justify-end gap-5">
        <div className="flex items-center space-x-5">
          <span className="font-mono text-[9px] uppercase tracking-wider text-black/60 font-bold">
            {language === 'en' ? 'Latency' : 'Latenza'}: {isEngineRunning ? '~20ms' : '-- ms'}
          </span>
          <span className="font-mono text-[9px] uppercase tracking-wider text-black/60 font-bold">
            LOC: {language === 'en' ? 'UK' : 'IT'}
          </span>
        </div>

        {/* Custom Language Toggler Button */}
        <button
          onClick={toggleLanguage}
          className="font-mono text-[10px] uppercase font-bold tracking-wider px-2 py-1.5 border-2 border-black bg-white hover:bg-industrial-bg active:translate-y-[1px] active:translate-x-[1px] flex items-center gap-1.5"
          title={language === 'en' ? 'Switch to Italian' : 'Passa all\'Inglese'}
        >
          <Globe className="w-3.5 h-3.5 text-black" />
          <span>{language}</span>
        </button>
      </div>
    </header>
  );
}
