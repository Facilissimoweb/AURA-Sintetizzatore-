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
    <header className="border-b border-slate-100 bg-white/85 backdrop-blur-md sticky top-0 z-50 px-4 py-3 sm:px-6 shadow-sm">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand Logo & Name */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100">
            <Activity className={`text-white w-5 h-5 ${isEngineRunning ? 'animate-pulse' : ''}`} />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-extrabold tracking-tight text-slate-900">
              {language === 'en' ? 'AURA Synth' : 'AURA Sintetizzatore'}
            </h1>
            <p className="text-[10px] sm:text-xs text-slate-450 font-medium">
              {language === 'en' ? 'Vocal Synthesis Engine v2.4' : 'Motore di Sintesi Vocale v2.4'}
            </p>
          </div>
        </div>

        {/* Control Badges / Language Switcher */}
        <div className="flex items-center space-x-2.5">
          {/* Active Status Badge */}
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold border transition-all ${
            isEngineRunning 
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80 shadow-sm shadow-emerald-50' 
              : 'bg-slate-100 text-slate-500 border-slate-200'
          }`}>
            <span className={`w-1.5 h-1.5 mr-1.5 rounded-full ${
              isEngineRunning ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
            }`}></span>
            {isEngineRunning ? 'LIVE' : 'BYPASS'}
          </span>

          {/* Language Switch Button */}
          <button
            onClick={toggleLanguage}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs transition-all active:scale-95 shadow-sm"
            title={language === 'en' ? 'Switch to Italian' : 'Passa all\'Inglese'}
          >
            <Globe className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-mono text-[10px] uppercase font-bold">{language}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
