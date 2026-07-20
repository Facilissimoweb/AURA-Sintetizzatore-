import { useState, useEffect, useRef } from 'react';
import { 
  Mic, 
  Volume2, 
  ShieldAlert, 
  X, 
  Activity, 
  Power, 
  CheckCircle,
  Sparkles,
  Waves,
  Sparkle
} from 'lucide-react';

import Header from './components/Header';
import PresetSelector from './components/PresetSelector';
import Visualizer from './components/Visualizer';
import SignalPipeline from './components/SignalPipeline';
import AudioRecorder from './components/AudioRecorder';
import ControlSlider from './components/ControlSlider';
import Footer from './components/Footer';
import AICloneChat from './components/AICloneChat';

import { SYNTH_PRESETS } from './data/presets';
import { workletProcessorCode } from './lib/audioWorkletCode';
import { Language, AudioStats, SynthPreset } from './types';

// Create the AudioWorklet Blob URL once at module level to prevent memory leaks
const workletBlob = new Blob([workletProcessorCode], { type: 'application/javascript' });
const workletBlobUrl = URL.createObjectURL(workletBlob);

export default function App() {
  const [language, setLanguage] = useState<Language>('it'); // Default to 'it' based on the reference HTML
  const [isEngineRunning, setIsEngineRunning] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [showSafetyBanner, setShowSafetyBanner] = useState(true);
  const [activePresetId, setActivePresetId] = useState<string | null>('warm-male'); // Start with Warm Baritone preset values

  // DSP State parameters
  const [pitch, setPitch] = useState(0.85);
  const [delay, setDelay] = useState(40.0);
  const [warmth, setWarmth] = useState(6.0);
  const [nasal, setNasal] = useState(-4.5);
  const [clarity, setClarity] = useState(2.0);
  const [volume, setVolume] = useState(0.8);

  // Audio nodes and context refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const microphoneNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const lowCutNodeRef = useRef<BiquadFilterNode | null>(null);
  const pitchWorkletNodeRef = useRef<AudioWorkletNode | null>(null);
  const eqWarmthNodeRef = useRef<BiquadFilterNode | null>(null);
  const eqNasalNodeRef = useRef<BiquadFilterNode | null>(null);
  const eqClarityNodeRef = useRef<BiquadFilterNode | null>(null);
  const limiterNodeRef = useRef<BiquadFilterNode | null>(null);
  const masterGainNodeRef = useRef<GainNode | null>(null);
  const analyserNodeRef = useRef<AnalyserNode | null>(null);

  // Audio statistics
  const [stats, setStats] = useState<AudioStats | null>(null);

  // Shared vocal print cloning states
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);

  const handleUseForClone = (blob: Blob, url: string) => {
    setRecordedBlob(blob);
    setRecordedUrl(url);
    triggerToast(
      language === 'en'
        ? 'Voice sample successfully sent to the AI Voice Clone Chatbot module!'
        : 'Profilo vocale trasferito al modulo della Chat AI!'
    );
  };
  
  // Custom Toast notifications
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const triggerToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
  };

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      setToast(null);
    }, 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Handle DSP node parameter updates in real-time if context is active
  useEffect(() => {
    const ctx = audioCtxRef.current;
    if (!ctx || ctx.state === 'closed') return;

    // Pitch Shifter Factor
    if (pitchWorkletNodeRef.current) {
      const p = pitchWorkletNodeRef.current.parameters.get('pitchFactor');
      if (p) p.setValueAtTime(pitch, ctx.currentTime);
    }
  }, [pitch]);

  useEffect(() => {
    const ctx = audioCtxRef.current;
    if (!ctx || ctx.state === 'closed') return;

    // Delay Size / Crossfading Window
    if (pitchWorkletNodeRef.current) {
      const d = pitchWorkletNodeRef.current.parameters.get('delaySizeMs');
      if (d) d.setValueAtTime(delay, ctx.currentTime);
    }
  }, [delay]);

  useEffect(() => {
    const ctx = audioCtxRef.current;
    if (!ctx || ctx.state === 'closed') return;

    // EQ - Chest Warmth
    if (eqWarmthNodeRef.current) {
      eqWarmthNodeRef.current.gain.setValueAtTime(warmth, ctx.currentTime);
    }
  }, [warmth]);

  useEffect(() => {
    const ctx = audioCtxRef.current;
    if (!ctx || ctx.state === 'closed') return;

    // EQ - Nasal Control
    if (eqNasalNodeRef.current) {
      eqNasalNodeRef.current.gain.setValueAtTime(nasal, ctx.currentTime);
    }
  }, [nasal]);

  useEffect(() => {
    const ctx = audioCtxRef.current;
    if (!ctx || ctx.state === 'closed') return;

    // EQ - Vocal Clarity Presence
    if (eqClarityNodeRef.current) {
      eqClarityNodeRef.current.gain.setValueAtTime(clarity, ctx.currentTime);
    }
  }, [clarity]);

  useEffect(() => {
    const ctx = audioCtxRef.current;
    if (!ctx || ctx.state === 'closed') return;

    // Master Volume Gain
    if (masterGainNodeRef.current) {
      masterGainNodeRef.current.gain.setValueAtTime(volume, ctx.currentTime);
    }
  }, [volume]);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      stopAudioEngine();
    };
  }, []);

  const initAudioEngine = async () => {
    try {
      setIsInitializing(true);
      
      // Request mic input with optimal feedback constraints
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      localStreamRef.current = stream;

      // Instantiate core Web Audio Context
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass();
      audioCtxRef.current = ctx;

      // 1. Register and mount the inline custom AudioWorklet PitchProcessor
      await ctx.audioWorklet.addModule(workletBlobUrl);

      // 2. Initialize and construct the DSP graph nodes
      microphoneNodeRef.current = ctx.createMediaStreamSource(stream);

      // Low-cut filter at 80Hz to reject microphone vibration and room rumbling
      const lowCut = ctx.createBiquadFilter();
      lowCut.type = 'highpass';
      lowCut.frequency.setValueAtTime(80, ctx.currentTime);
      lowCutNodeRef.current = lowCut;

      // AudioWorklet Pitch Shift Node
      const pitchNode = new AudioWorkletNode(ctx, 'pitch-processor');
      pitchWorkletNodeRef.current = pitchNode;

      // Peaking Filter at 150 Hz to control chest resonance warmth
      const warmthEq = ctx.createBiquadFilter();
      warmthEq.type = 'peaking';
      warmthEq.frequency.setValueAtTime(150, ctx.currentTime);
      warmthEq.Q.setValueAtTime(1.0, ctx.currentTime);
      eqWarmthNodeRef.current = warmthEq;

      // Peaking Filter at 900 Hz to scoop out or emphasize nasal timbres
      const nasalEq = ctx.createBiquadFilter();
      nasalEq.type = 'peaking';
      nasalEq.frequency.setValueAtTime(900, ctx.currentTime);
      nasalEq.Q.setValueAtTime(1.2, ctx.currentTime);
      eqNasalNodeRef.current = nasalEq;

      // Peaking Filter at 3.2 kHz to boost human voice presence & brilliance
      const clarityEq = ctx.createBiquadFilter();
      clarityEq.type = 'peaking';
      clarityEq.frequency.setValueAtTime(3200, ctx.currentTime);
      clarityEq.Q.setValueAtTime(1.0, ctx.currentTime);
      eqClarityNodeRef.current = clarityEq;

      // Lowpass Safety Limiter at 7.5 kHz to filter out metallic sizzles and clipping
      const limiter = ctx.createBiquadFilter();
      limiter.type = 'lowpass';
      limiter.frequency.setValueAtTime(7500, ctx.currentTime);
      limiterNodeRef.current = limiter;

      // Master output volume controller
      const masterGain = ctx.createGain();
      masterGainNodeRef.current = masterGain;

      // Diagnostic Spectrum Analyser
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      analyserNodeRef.current = analyser;

      // 3. Bind the DSP chain sequentially
      // Mic -> LowCut Filter -> PitchWorklet -> Warmth EQ -> Nasal EQ -> Clarity EQ -> Limiter -> Analyser -> Volume Gain -> Speaker Output
      microphoneNodeRef.current.connect(lowCut);
      lowCut.connect(pitchNode);
      pitchNode.connect(warmthEq);
      warmthEq.connect(nasalEq);
      nasalEq.connect(clarityEq);
      clarityEq.connect(limiter);
      limiter.connect(analyser);
      analyser.connect(masterGain);
      masterGain.connect(ctx.destination);

      // Apply current state values to the freshly created nodes immediately
      const p = pitchNode.parameters.get('pitchFactor');
      if (p) p.setValueAtTime(pitch, ctx.currentTime);

      const d = pitchNode.parameters.get('delaySizeMs');
      if (d) d.setValueAtTime(delay, ctx.currentTime);

      warmthEq.gain.setValueAtTime(warmth, ctx.currentTime);
      nasalEq.gain.setValueAtTime(nasal, ctx.currentTime);
      clarityEq.gain.setValueAtTime(clarity, ctx.currentTime);
      masterGain.gain.setValueAtTime(volume, ctx.currentTime);

      // Populate diagnostics
      setStats({
        sampleRate: ctx.sampleRate,
        latency: Math.round(ctx.baseLatency ? ctx.baseLatency * 1000 : 20),
      });

      setIsEngineRunning(true);
      triggerToast(
        language === 'en' 
          ? 'Vocal Modulator successfully initialized!' 
          : 'Modulatore Vocale attivato con successo!'
      );
    } catch (err) {
      console.error("Initialization failed:", err);
      triggerToast(
        language === 'en'
          ? 'Error: Could not access microphone. Ensure permissions are granted.'
          : 'Errore: Impossibile accedere al microfono. Verifica i permessi.',
        'error'
      );
      stopAudioEngine();
    } finally {
      setIsInitializing(false);
    }
  };

  const stopAudioEngine = () => {
    // Teardown Web Audio Context
    if (audioCtxRef.current) {
      try {
        audioCtxRef.current.close();
      } catch (e) {
        console.warn("Failed to close audio context cleanly:", e);
      }
      audioCtxRef.current = null;
    }

    // Terminate hardware audio recording inputs
    if (localStreamRef.current) {
      try {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      } catch (e) {
        console.warn("Failed to stop microphone tracks:", e);
      }
      localStreamRef.current = null;
    }

    setIsEngineRunning(false);
    setStats(null);
  };

  const toggleEngine = () => {
    if (isEngineRunning) {
      stopAudioEngine();
      triggerToast(
        language === 'en' ? 'Vocal modulator bypassed.' : 'Modulatore vocale spento.'
      );
    } else {
      initAudioEngine();
    }
  };

  const handleSelectPreset = (preset: SynthPreset) => {
    setActivePresetId(preset.id);
    
    // Smoothly assign preset coordinates
    setPitch(preset.pitch);
    setDelay(preset.delay);
    setWarmth(preset.warmth);
    setNasal(preset.nasal);
    setClarity(preset.clarity);

    triggerToast(
      language === 'en'
        ? `Preset "${preset.nameEn}" successfully applied!`
        : `Preset "${preset.nameIt}" applicato!`
    );
  };

  return (
    <div className="bg-slate-50 text-slate-900 min-h-screen flex flex-col overflow-x-hidden antialiased">
      {/* Dynamic Navigation Header */}
      <Header 
        language={language} 
        setLanguage={setLanguage} 
        isEngineRunning={isEngineRunning} 
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col space-y-6">
        
        {/* Anti-Feedback Safety Warning Banner */}
        {showSafetyBanner && (
          <div className="bg-amber-50/80 border border-amber-200/80 rounded-3xl p-4 sm:p-5 flex items-start justify-between text-amber-900 relative shadow-xl shadow-amber-100/30 backdrop-blur-md">
            <div className="flex items-start space-x-3.5">
              <ShieldAlert className="w-5.5 h-5.5 flex-shrink-0 text-amber-600 mt-0.5" />
              <div>
                <h4 className="font-extrabold text-xs sm:text-sm tracking-wide">
                  {language === 'en' ? 'Larsen Feedback Warning' : 'Prevenzione Larsen (Fischio di Ritorno)'}
                </h4>
                <p className="text-[11px] sm:text-xs text-amber-800/85 mt-1 leading-relaxed max-w-2xl">
                  {language === 'en'
                    ? 'To avoid uncomfortable high-pitch feedback loops, please wear headphones or earbuds before starting the vocal modulator.'
                    : 'Per testare l\'elaborazione della tua voce senza fastidiosi fischi, indossa le cuffie o gli auricolari prima di attivare il microfono.'}
                </p>
              </div>
            </div>
            <button 
              onClick={() => setShowSafetyBanner(false)}
              className="text-amber-500/60 hover:text-amber-800 p-1 rounded-lg transition-colors"
              title="Close safety warning"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Central Dashboard Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          
          {/* Main Controls Section (Left Column) */}
          <section className="lg:col-span-7 flex flex-col space-y-6">
            
            {/* Quick Presets Selector Grid */}
            <PresetSelector
              presets={SYNTH_PRESETS}
              activePresetId={activePresetId}
              onSelectPreset={handleSelectPreset}
              language={language}
            />

            {/* Vocal Modeling Sliders Panel */}
            <div className="bg-white border border-slate-100 rounded-3xl p-5 sm:p-6 shadow-xl shadow-slate-100/50 flex-1 flex flex-col justify-between">
              <div className="space-y-6">
                
                {/* Panel Title */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="text-sm sm:text-base font-extrabold text-slate-800 tracking-wide uppercase">
                      {language === 'en' ? 'Vocal Modeling Engine' : 'Modulatore Fisiologico'}
                    </h3>
                    <p className="text-[10px] sm:text-xs text-slate-400">
                      {language === 'en' ? 'Adjust parameters below to sculpt your virtual vocal cords.' : 'Regola le proprietà biologiche delle corde vocali artificiali.'}
                    </p>
                  </div>
                </div>

                {/* Slider 1: Vocal Pitch */}
                <ControlSlider
                  id="pitch-slider"
                  label={language === 'en' ? 'Vocal Pitch (Shifting factor)' : 'Altezza Tonale (Pitch)'}
                  badgeValue={`${pitch.toFixed(2)}x`}
                  minValue={0.50}
                  maxValue={1.80}
                  step={0.01}
                  currentValue={pitch}
                  onChange={(val) => {
                    setPitch(val);
                    setActivePresetId(null); // Clear preset selection on manual override
                  }}
                  leftLabel={language === 'en' ? 'Deep' : 'Grave'}
                  rightLabel={language === 'en' ? 'Acute' : 'Acuto'}
                  helpText={language === 'en' ? 'Shift vocal range up or down using the multi-phase delay lines.' : 'Regola l\'altezza tonale complessiva delle corde vocali senza alterare la velocità.'}
                  icon={<Waves className="w-4 h-4 text-indigo-600" />}
                />

                {/* Slider 2: Delay Window */}
                <ControlSlider
                  id="delay-slider"
                  label={language === 'en' ? 'Crossfading Frame (Window Size)' : 'Finestra Crossfading (Latenza)'}
                  badgeValue={`${delay.toFixed(1)} ms`}
                  minValue={15.0}
                  maxValue={75.0}
                  step={1.0}
                  currentValue={delay}
                  onChange={(val) => {
                    setDelay(val);
                    setActivePresetId(null);
                  }}
                  helpText={language === 'en' ? 'Lower frames decrease latency but add buzz. 30-45ms is physically optimal.' : 'Tempi bassi riducono il ritardo ma generano fruscii. 30-45ms rappresenta il range biologico.'}
                  icon={<Sparkle className="w-4 h-4 text-indigo-600" />}
                />

                {/* Equalizer Formants Section */}
                <div className="border-t border-slate-100 pt-6 space-y-5">
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-slate-800 flex items-center">
                      <Sparkles className="w-4 h-4 mr-1.5 text-indigo-600 animate-pulse" />
                      {language === 'en' ? 'Vocal Formant & Resonators (Biquad Chain)' : 'Filtri Formantici (Risonanza Biologica)'}
                    </h4>
                    <p className="text-[10px] text-slate-400">
                      {language === 'en' ? 'Adjust gain peaks to simulate different human vocal tract sizes.' : 'Regola i picchi di frequenza per simulare diverse anatomie del cavo orale.'}
                    </p>
                  </div>

                  {/* Warmth (150 Hz) */}
                  <ControlSlider
                    id="warmth-slider"
                    label={language === 'en' ? 'Chest Warmth & Girth (150 Hz)' : 'Calore del Petto (150 Hz)'}
                    badgeValue={`${warmth > 0 ? '+' : ''}${warmth.toFixed(1)} dB`}
                    minValue={-12.0}
                    maxValue={12.0}
                    step={0.5}
                    currentValue={warmth}
                    onChange={(val) => {
                      setWarmth(val);
                      setActivePresetId(null);
                    }}
                    helpText={language === 'en' ? 'Simulate larger lungs and deep body cavity resonant properties.' : 'Enfatizza le basse frequenze per aggiungere calore corporale alla voce.'}
                  />

                  {/* Nasal Control (900 Hz) */}
                  <ControlSlider
                    id="nasal-slider"
                    label={language === 'en' ? 'Nasal Cavity Scoop (900 Hz)' : 'Controllo Timbro Nasale (900 Hz)'}
                    badgeValue={`${nasal > 0 ? '+' : ''}${nasal.toFixed(1)} dB`}
                    minValue={-18.0}
                    maxValue={6.0}
                    step={0.5}
                    currentValue={nasal}
                    onChange={(val) => {
                      setNasal(val);
                      setActivePresetId(null);
                    }}
                    helpText={language === 'en' ? 'Scoop frequencies around 900 Hz to eliminate typical nasal buzz.' : 'Attenua la banda dei 900 Hz per rimuovere la fastidiosa sonorità nasale.'}
                  />

                  {/* Presence Clarity (3.2 kHz) */}
                  <ControlSlider
                    id="clarity-slider"
                    label={language === 'en' ? 'Vocal Clarity & Presence (3.2 kHz)' : 'Presenza e Brillantezza (3.2 kHz)'}
                    badgeValue={`${clarity > 0 ? '+' : ''}${clarity.toFixed(1)} dB`}
                    minValue={-12.0}
                    maxValue={15.0}
                    step={0.5}
                    currentValue={clarity}
                    onChange={(val) => {
                      setClarity(val);
                      setActivePresetId(null);
                    }}
                    helpText={language === 'en' ? 'Boost vocal intelligence and articulation projection.' : 'Rialza le medio-alte per esaltare l\'articolazione e comprensibilità.'}
                  />
                </div>

              </div>

              {/* Bottom Volume & Main Activation Row */}
              <div className="border-t border-slate-100 pt-6 mt-6 flex flex-col sm:flex-row items-center justify-between gap-5">
                
                {/* Volume Slider */}
                <div className="w-full sm:w-1/2 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500 font-bold tracking-wide uppercase flex items-center">
                      <Volume2 className="w-4 h-4 mr-1 text-indigo-650" />
                      {language === 'en' ? 'Output Gain' : 'Volume Generale'}
                    </span>
                    <span className="font-mono text-slate-800 font-bold">{Math.round(volume * 100)}%</span>
                  </div>
                  <input
                    id="volume-slider"
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={volume}
                    onChange={(e) => setVolume(parseFloat(e.target.value))}
                    className="w-full cursor-pointer h-1.5 bg-slate-200 rounded-lg appearance-none accent-indigo-600 focus:outline-none transition-all"
                    style={{
                      background: `linear-gradient(to right, #4f46e5 0%, #4f46e5 ${volume * 100}%, #e2e8f0 ${volume * 100}%, #e2e8f0 100%)`,
                    }}
                  />
                </div>

                {/* Primary Launch Action Button */}
                <button
                  id="power-btn"
                  onClick={toggleEngine}
                  disabled={isInitializing}
                  className={`w-full sm:w-auto px-6 py-4 font-bold text-sm rounded-xl inline-flex items-center justify-center space-x-2.5 shadow-lg transition-all duration-300 active:scale-95 border ${
                    isEngineRunning
                      ? 'bg-red-600 hover:bg-red-500 text-white border-red-500 shadow-md shadow-red-100'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-500 shadow-xl shadow-indigo-100/60'
                  }`}
                >
                  {isInitializing ? (
                    <>
                      <div className="w-4.5 h-4.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>{language === 'en' ? 'Booting DSP...' : 'Inizializzazione...'}</span>
                    </>
                  ) : isEngineRunning ? (
                    <>
                      <Power className="w-4.5 h-4.5 animate-pulse" />
                      <span>{language === 'en' ? 'Disable Modulator' : 'Spegni Modulatore'}</span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-4.5 h-4.5" />
                      <span>{language === 'en' ? 'Start Vocal Modulator' : 'Avvia Modulatore Naturale'}</span>
                    </>
                  )}
                </button>

              </div>
            </div>

          </section>

          {/* Graphical & Feedback Section (Right Column) */}
          <section className="lg:col-span-5 flex flex-col space-y-6">
            
            {/* Visual Analyzer Wave/Spectrum Screen */}
            <Visualizer
              analyserNode={analyserNodeRef.current}
              isEngineRunning={isEngineRunning}
              language={language}
            />

            {/* Custom Modulator Voice Recorder */}
            <AudioRecorder
              isEngineRunning={isEngineRunning}
              audioCtx={audioCtxRef.current}
              outputNode={analyserNodeRef.current}
              language={language}
              onUseForClone={handleUseForClone}
            />

            {/* Signal Flow Pipeline Chart */}
            <SignalPipeline
              isEngineRunning={isEngineRunning}
              language={language}
              stats={stats}
            />

          </section>

        </div>

        {/* AI Voice Clone Chatbot Section */}
        <AICloneChat 
          language={language}
          recordedBlob={recordedBlob}
          recordedUrl={recordedUrl}
          onClearRecorded={() => {
            setRecordedBlob(null);
            setRecordedUrl(null);
          }}
        />

      </main>

      {/* Technical footer details */}
      <Footer language={language} />

      {/* Floating System-Wide Notification Toast */}
      {toast && (
        <div className={`fixed bottom-5 right-5 z-50 border text-slate-800 px-5 py-4 rounded-2xl shadow-xl shadow-slate-150/50 flex items-center space-x-3 transition-all duration-300 backdrop-blur-md ${
          toast.type === 'error' ? 'border-red-100 bg-red-50/95' : 'border-emerald-100 bg-emerald-50/95'
        }`}>
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
            toast.type === 'error' ? 'bg-red-500/10' : 'bg-emerald-500/10'
          }`}>
            <CheckCircle className={`w-4.5 h-4.5 ${
              toast.type === 'error' ? 'text-red-600' : 'text-emerald-600'
            }`} />
          </div>
          <span className="text-xs sm:text-sm font-bold tracking-wide text-slate-800">
            {toast.message}
          </span>
        </div>
      )}
    </div>
  );
}
