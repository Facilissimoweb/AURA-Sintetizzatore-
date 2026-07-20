import { useState, useEffect } from 'react';
import { 
  Menu, 
  X, 
  Globe, 
  Power, 
  RotateCcw, 
  ShieldAlert, 
  Cpu, 
  Activity, 
  Layout, 
  Layers, 
  MessageSquare,
  Mic
} from 'lucide-react';
import { Language } from '../types';

interface HeaderProps {
  language: Language;
  setLanguage: (lang: Language) => void;
  isEngineRunning: boolean;
  toggleEngine: () => void;
  showSafetyBanner: boolean;
  setShowSafetyBanner: (val: boolean) => void;
  onResetSettings: () => void;
}

export default function Header({ 
  language, 
  setLanguage, 
  isEngineRunning, 
  toggleEngine,
  showSafetyBanner,
  setShowSafetyBanner,
  onResetSettings
}: HeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [systemTime, setSystemTime] = useState<string>('');
  const [config, setConfig] = useState<{
    hasGeminiKey: boolean;
    hasElevenLabsKey: boolean;
    hasGroqKey: boolean;
  }>({
    hasGeminiKey: false,
    hasElevenLabsKey: false,
    hasGroqKey: false,
  });

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'it' : 'en');
  };

  // Fetch API Configuration loaded state to confirm keys
  useEffect(() => {
    fetch('/api/config')
      .then((res) => res.json())
      .then((data) => setConfig(data))
      .catch((err) => console.error('Error loading config inside header:', err));
  }, []);

  // Live system clock inside menu
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setSystemTime(now.toLocaleTimeString());
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Quick navigation menu definitions
  const navItems = [
    {
      id: 'presets',
      targetId: 'section-presets',
      icon: Layout,
      labelEn: 'Preset Selection',
      labelIt: 'Libreria Preset',
    },
    {
      id: 'modulator',
      targetId: 'section-modulator',
      icon: Layers,
      labelEn: 'Modeling Tract',
      labelIt: 'Modulatore Fisiologico',
    },
    {
      id: 'capture',
      targetId: 'section-capture',
      icon: Mic,
      labelEn: 'Vocal Capture',
      labelIt: 'Cattura & Registra',
    },
    {
      id: 'visualizer',
      targetId: 'section-visualizer',
      icon: Activity,
      labelEn: 'Realtime Scope',
      labelIt: 'Analizzatore Spettro',
    },
    {
      id: 'chat',
      targetId: 'section-chat',
      icon: MessageSquare,
      labelEn: 'Voice Clone Chatbot',
      labelIt: 'Chatbot Clone IA',
    },
    {
      id: 'pipeline',
      targetId: 'section-pipeline',
      icon: Cpu,
      labelEn: 'Signal Flow',
      labelIt: 'Flusso di Segnale',
    },
  ];

  return (
    <header className="border-b-2 border-black bg-white select-none relative">
      <div className="grid grid-cols-[1fr_auto] md:grid-cols-[280px_1fr_280px] lg:grid-cols-[350px_1fr_350px] items-stretch w-full">
        {/* Brand box */}
        <div className="p-4 sm:p-5 border-r-2 border-black flex items-center space-x-3.5">
          <div className="font-display font-bold text-xl leading-none border-2 border-black px-2 py-1 bg-industrial-orange text-black">
            A
          </div>
          <div>
            <h1 className="font-display text-base sm:text-lg font-bold uppercase tracking-tight text-black leading-none">
              AURA Studio
            </h1>
            <span className="font-mono text-[9px] uppercase tracking-wider text-black/55 block mt-1">
              {language === 'en' ? 'Synthesis v2.4 // Natural Engine' : 'Sintesi v2.4 // Motore Naturale'}
            </span>
          </div>
        </div>

        {/* Stream Status indicator - Hidden on Mobile */}
        <div className="hidden md:flex p-4 sm:p-5 border-r-2 border-black items-center justify-start md:justify-center bg-[#fdfdfd]">
          <div className="flex items-center space-x-2.5">
            <span className={`w-2.5 h-2.5 border border-black ${isEngineRunning ? 'bg-industrial-orange animate-pulse' : 'bg-transparent'}`} />
            <span className="font-mono text-[10px] uppercase font-bold tracking-wider text-black">
              {isEngineRunning 
                ? (language === 'en' ? 'IO: ACTIVE STREAM' : 'IO: FLUSSO ATTIVO')
                : (language === 'en' ? 'IO: BYPASS ACTIVE' : 'IO: IN BYPASS')}
            </span>
          </div>
        </div>

        {/* Stats, Language and Hamburg Toggler Button box */}
        <div className="p-4 sm:p-5 flex items-center justify-end gap-3 sm:gap-4 lg:gap-5">
          {/* Status & Latency Indicators - Hidden on Mobile */}
          <div className="hidden md:flex items-center space-x-3.5">
            <span className="font-mono text-[9px] uppercase tracking-wider text-black/60 font-bold">
              {language === 'en' ? 'Latency' : 'Latenza'}: {isEngineRunning ? '~20ms' : '-- ms'}
            </span>
            <span className="font-mono text-[9px] uppercase tracking-wider text-black/60 font-bold">
              LOC: {language === 'en' ? 'UK' : 'IT'}
            </span>
          </div>

          {/* Quick Language Toggle - Hidden on Mobile */}
          <button
            onClick={toggleLanguage}
            className="hidden md:flex font-mono text-[10px] uppercase font-bold tracking-wider px-2 py-1.5 border-2 border-black bg-white hover:bg-industrial-bg active:translate-y-[1px] active:translate-x-[1px] items-center gap-1.5"
            title={language === 'en' ? 'Switch to Italian' : 'Passa all\'Inglese'}
          >
            <Globe className="w-3.5 h-3.5 text-black" />
            <span>{language}</span>
          </button>

          {/* Hamburger Menu Trigger Button - Always Visible */}
          <button
            onClick={() => setIsMenuOpen(true)}
            className="font-mono text-[10px] uppercase font-bold tracking-wider px-3 py-1.5 sm:py-2 border-2 border-black bg-white hover:bg-industrial-orange hover:text-black transition-colors duration-75 active:translate-y-[1px] active:translate-x-[1px] flex items-center gap-2 neo-shadow-sm"
            title={language === 'en' ? 'Open Navigation Control Panel' : 'Apri Navigazione e Controllo'}
          >
            <Menu className="w-4 h-4 text-black" />
            <span>MENU</span>
          </button>
        </div>
      </div>

      {/* Slide-out Menu Backdrop */}
      {isMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/65 z-40 backdrop-blur-sm transition-opacity duration-200"
          onClick={() => setIsMenuOpen(false)}
        />
      )}

      {/* Slide-out Brutalist Navigation Side Drawer */}
      <div className={`fixed inset-y-0 right-0 z-50 w-full sm:w-[380px] bg-white border-l-4 border-black shadow-[-4px_0px_0px_0px_#000000] flex flex-col justify-between transition-transform duration-300 ease-in-out ${
        isMenuOpen ? 'translate-x-0' : 'translate-x-full'
      }`}>
        
        {/* Drawer Header Box */}
        <div className="p-4 sm:p-5 border-b-2 border-black flex items-center justify-between bg-industrial-orange text-black">
          <div className="flex items-center space-x-2">
            <Menu className="w-5 h-5 text-black" />
            <span className="font-display font-bold text-xs uppercase tracking-widest">
              {language === 'en' ? 'AURA CONTROL PANEL' : 'PANNELLO DI CONTROLLO'}
            </span>
          </div>
          <button 
            onClick={() => setIsMenuOpen(false)}
            className="border-2 border-black px-2 py-1 bg-white text-black hover:bg-black hover:text-white transition-colors duration-75 font-mono text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 active:translate-y-[1px] active:translate-x-[1px]"
          >
            <X className="w-3.5 h-3.5" />
            <span>{language === 'en' ? 'CLOSE' : 'CHIUDI'}</span>
          </button>
        </div>

        {/* Drawer Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-6">
          
          {/* Section 1: Navigation Shortcuts */}
          <div className="space-y-2.5">
            <span className="font-mono text-[9px] text-black/50 uppercase font-bold tracking-widest block">
              {language === 'en' ? '// SYSTEM MODULES NAV' : '// NAVIGAZIONE MODULI'}
            </span>
            <div className="grid grid-cols-1 gap-1.5">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setIsMenuOpen(false);
                    // Slight delay to allow menu animation to close smoothly
                    setTimeout(() => {
                      document.getElementById(item.targetId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }, 100);
                  }}
                  className="w-full text-left p-3 border-2 border-black hover:bg-industrial-bg bg-white transition-all active:translate-x-[1px] active:translate-y-[1px] flex items-center justify-between group neo-shadow-sm"
                >
                  <div className="flex items-center space-x-2.5">
                    <item.icon className="w-4 h-4 text-black" />
                    <span className="font-mono text-xs font-bold text-black uppercase">
                      {language === 'en' ? item.labelEn : item.labelIt}
                    </span>
                  </div>
                  <span className="font-mono text-[9px] text-black/40 group-hover:text-black font-extrabold">➔</span>
                </button>
              ))}
            </div>
          </div>

          {/* Section 2: Core Hardware Actions */}
          <div className="space-y-2.5 border-t-2 border-black pt-5">
            <span className="font-mono text-[9px] text-black/50 uppercase font-bold tracking-widest block">
              {language === 'en' ? '// SYSTEM LEVEL ACTIONS' : '// UTILITY DI SISTEMA'}
            </span>

            {/* Live Master Bypass Toggle */}
            <button
              onClick={() => {
                toggleEngine();
              }}
              className={`w-full p-3 border-2 border-black font-mono text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-between active:translate-x-[1px] active:translate-y-[1px] ${
                isEngineRunning 
                  ? 'bg-industrial-orange text-black font-extrabold shadow-[2px_2px_0px_0px_#000000]' 
                  : 'bg-black text-white hover:bg-industrial-orange hover:text-black font-semibold'
              }`}
            >
              <span className="flex items-center gap-2">
                <Power className="w-4 h-4" />
                {isEngineRunning 
                  ? (language === 'en' ? 'STOP VOCAL STREAM' : 'DISATTIVA SINTESI')
                  : (language === 'en' ? 'START VOCAL STREAM' : 'ATTIVA MODULATORE')}
              </span>
              <span className="text-[10px] font-mono">[{isEngineRunning ? 'ON' : 'OFF'}]</span>
            </button>

            {/* Language Selection switch */}
            <button
              onClick={toggleLanguage}
              className="w-full p-3 border-2 border-black bg-white hover:bg-industrial-bg text-black font-mono text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-between active:translate-x-[1px] active:translate-y-[1px]"
            >
              <span className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-black" />
                {language === 'en' ? 'SWITCH LANGUAGE' : 'LINGUA INTERFACCIA'}
              </span>
              <span className="text-[10px] font-bold uppercase border-2 border-black px-1.5 py-0.5 bg-neutral-100">{language}</span>
            </button>

            {/* Reset voice parameters shortcut */}
            <button
              onClick={() => {
                onResetSettings();
              }}
              className="w-full p-3 border-2 border-black bg-white hover:bg-red-50 hover:text-red-700 text-black font-mono text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-between active:translate-x-[1px] active:translate-y-[1px]"
              title={language === 'en' ? 'Reset vocal chords parameters to default natural state' : 'Ripristina i parametri vocali allo stato naturale'}
            >
              <span className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4" />
                {language === 'en' ? 'RESET VOCAL PARAMS' : 'RESET PARAMETRI CORDE'}
              </span>
              <span className="text-[9px] font-extrabold opacity-55">➔</span>
            </button>

            {/* Toggle safety banner */}
            <button
              onClick={() => setShowSafetyBanner(!showSafetyBanner)}
              className="w-full p-3 border-2 border-black bg-white hover:bg-industrial-bg text-black font-mono text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-between active:translate-x-[1px] active:translate-y-[1px]"
            >
              <span className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4" />
                {language === 'en' ? 'LARSEN ALERT BANNER' : 'BANNER ALERT LARSEN'}
              </span>
              <span className={`text-[9px] font-bold border px-1.5 py-0.5 uppercase ${
                showSafetyBanner 
                  ? 'bg-amber-100 text-amber-900 border-amber-400' 
                  : 'bg-neutral-100 text-neutral-500 border-neutral-300'
              }`}>
                {showSafetyBanner ? (language === 'en' ? 'ACTIVE' : 'ATTIVO') : (language === 'en' ? 'MUTED' : 'SPENTO')}
              </span>
            </button>
          </div>

          {/* Section 3: Key Connections Diagnostic */}
          <div className="space-y-2.5 border-t-2 border-black pt-5">
            <span className="font-mono text-[9px] text-black/50 uppercase font-bold tracking-widest block">
              {language === 'en' ? '// BACKEND CONFIGURED KEYS' : '// STATO CONNESSIONI API'}
            </span>
            <div className="bg-[#fcfcfc] border-2 border-black p-3.5 space-y-3 neo-shadow-sm">
              {/* ElevenLabs API key loaded status */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Activity className="w-3.5 h-3.5 text-black" />
                  <span className="font-mono text-[10px] font-bold uppercase text-black">ElevenLabs Key</span>
                </div>
                <span className={`font-mono text-[8px] font-bold uppercase px-1.5 py-0.5 border border-black ${
                  config.hasElevenLabsKey ? 'bg-emerald-100 text-emerald-900' : 'bg-red-100 text-red-900'
                }`}>
                  {config.hasElevenLabsKey 
                    ? (language === 'en' ? 'CONFIGURED' : 'ATTIVA') 
                    : (language === 'en' ? 'MISSING' : 'MANCANTE')}
                </span>
              </div>

              {/* Gemini API Key loaded status */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Cpu className="w-3.5 h-3.5 text-black" />
                  <span className="font-mono text-[10px] font-bold uppercase text-black">Gemini Key</span>
                </div>
                <span className={`font-mono text-[8px] font-bold uppercase px-1.5 py-0.5 border border-black ${
                  config.hasGeminiKey ? 'bg-emerald-100 text-emerald-900' : 'bg-red-100 text-red-900'
                }`}>
                  {config.hasGeminiKey 
                    ? (language === 'en' ? 'CONFIGURED' : 'ATTIVA') 
                    : (language === 'en' ? 'MANCANTE' : 'MANCANTE')}
                </span>
              </div>

              {/* Groq Whisper Transcriber status */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Mic className="w-3.5 h-3.5 text-black" />
                  <span className="font-mono text-[10px] font-bold uppercase text-black">Whisper Key</span>
                </div>
                <span className={`font-mono text-[8px] font-bold uppercase px-1.5 py-0.5 border border-black ${
                  config.hasGroqKey ? 'bg-emerald-100 text-emerald-900' : 'bg-red-100 text-red-900'
                }`}>
                  {config.hasGroqKey 
                    ? (language === 'en' ? 'CONFIGURED' : 'ATTIVA') 
                    : (language === 'en' ? 'MISSING' : 'MANCANTE')}
                </span>
              </div>

              <div className="border-t border-dashed border-black/30 pt-2 text-[10px] font-sans leading-relaxed text-black/65">
                {config.hasElevenLabsKey ? (
                  <p>
                    {language === 'en'
                      ? '✓ ElevenLabs key configured successfully. Voice cloning cloning features are live.'
                      : '✓ Chiave ElevenLabs caricata correttamente. Clonazione vocale attiva.'}
                  </p>
                ) : (
                  <p>
                    {language === 'en'
                      ? '✗ Missing ElevenLabs key. Add ELEVENLABS_API_KEY inside workspace configuration.'
                      : '✗ Chiave ElevenLabs mancante. Aggiungi ELEVENLABS_API_KEY nella configurazione.'}
                  </p>
                )}
              </div>
            </div>
          </div>

        </div>

        {/* Drawer Footer Box */}
        <div className="p-4 sm:p-5 border-t-2 border-black bg-neutral-50 flex flex-col space-y-1">
          <div className="flex justify-between items-center font-mono text-[9px] text-black/50 font-bold uppercase">
            <span>{language === 'en' ? 'LOCAL TIME' : 'ORA DI SISTEMA'}</span>
            <span className="text-black font-extrabold">{systemTime || '--:--:--'}</span>
          </div>
          <div className="flex justify-between items-center font-mono text-[9px] text-black/50 font-bold uppercase">
            <span>{language === 'en' ? 'HOST GATEWAY' : 'GATEWAY SITO'}</span>
            <span className="text-black font-extrabold">PORT: 3000 // VERIFIED</span>
          </div>
        </div>

      </div>
    </header>
  );
}
