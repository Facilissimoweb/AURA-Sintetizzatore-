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
import SavedCabinet from './components/SavedCabinet';
import AudioStudio from './components/AudioStudio';

import { SavedFileRecord, getAllAudioFiles, saveAudioFile, deleteAudioFile, updateAudioFileName } from './lib/db';

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

  // Automatic Gain Control (AGC) State
  const [isAgcEnabled, setIsAgcEnabled] = useState<boolean>(true);
  const [agcTargetLevel, setAgcTargetLevel] = useState<number>(0.20);
  const [currentAgcGainDb, setCurrentAgcGainDb] = useState<number>(0.0);

  // No-Headphones / Feedback Reduction State
  const [isNoHeadphonesMode, setIsNoHeadphonesMode] = useState<boolean>(false);
  const [noiseGateThreshold, setNoiseGateThreshold] = useState<number>(0.012);
  const [muteMonitorDuringRecord, setMuteMonitorDuringRecord] = useState<boolean>(true);
  const [isRecordingActive, setIsRecordingActive] = useState<boolean>(false);

  const isNoHeadphonesModeRef = useRef<boolean>(false);
  const noiseGateThresholdRef = useRef<number>(0.012);
  const muteMonitorDuringRecordRef = useRef<boolean>(true);
  const isRecordingActiveRef = useRef<boolean>(false);

  useEffect(() => {
    isNoHeadphonesModeRef.current = isNoHeadphonesMode;
  }, [isNoHeadphonesMode]);

  useEffect(() => {
    noiseGateThresholdRef.current = noiseGateThreshold;
  }, [noiseGateThreshold]);

  useEffect(() => {
    muteMonitorDuringRecordRef.current = muteMonitorDuringRecord;
  }, [muteMonitorDuringRecord]);

  useEffect(() => {
    isRecordingActiveRef.current = isRecordingActive;

    // Dynamically mute speaker output when recording is active to block feedback loop
    const ctx = audioCtxRef.current;
    if (ctx && masterGainNodeRef.current) {
      if (isNoHeadphonesMode && muteMonitorDuringRecord && isRecordingActive) {
        masterGainNodeRef.current.gain.setTargetAtTime(0.0, ctx.currentTime, 0.01);
      } else {
        masterGainNodeRef.current.gain.setTargetAtTime(volume, ctx.currentTime, 0.01);
      }
    }
  }, [isRecordingActive, volume, isNoHeadphonesMode, muteMonitorDuringRecord]);

  // AGC Refs for non-blocking dynamic calculations
  const isAgcEnabledRef = useRef<boolean>(true);
  const agcTargetLevelRef = useRef<number>(0.20);
  const agcGainNodeRef = useRef<GainNode | null>(null);
  const agcAnalyserNodeRef = useRef<AnalyserNode | null>(null);
  const agcIntervalRef = useRef<number | null>(null);
  const currentAgcGainRef = useRef<number>(1.0);

  // Synchronize dynamic AGC parameters to refs to bypass setInterval stale closure
  useEffect(() => {
    isAgcEnabledRef.current = isAgcEnabled;
  }, [isAgcEnabled]);

  useEffect(() => {
    agcTargetLevelRef.current = agcTargetLevel;
  }, [agcTargetLevel]);

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

  // Saved files list with temporary object URLs
  const [savedFiles, setSavedFiles] = useState<(SavedFileRecord & { url: string })[]>([]);
  const [serverFolders, setServerFolders] = useState<{ name: string; files: any[] }[]>([]);

  // Fetch folders from the server records directory
  const fetchServerFolders = async () => {
    try {
      const res = await fetch('/api/records');
      if (res.ok) {
        const data = await res.json();
        setServerFolders(data.folders || []);
      }
    } catch (err) {
      console.error('Failed to load server folders:', err);
    }
  };

  // Load saved audio files on mount
  useEffect(() => {
    let active = true;
    let urlsToRevoke: string[] = [];

    getAllAudioFiles()
      .then((records) => {
        if (!active) return;
        const filesWithUrls = records.map((rec) => {
          const url = URL.createObjectURL(rec.blob);
          urlsToRevoke.push(url);
          return {
            ...rec,
            url,
          };
        });
        setSavedFiles(filesWithUrls);
      })
      .catch((err) => console.error('Failed to load saved audio files:', err));

    // Also fetch server folders on mount
    fetchServerFolders();

    return () => {
      active = false;
      urlsToRevoke.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const handleSaveToServer = async (blob: Blob, name: string, folderName: string) => {
    const formData = new FormData();
    formData.append('audio_file', blob, name);
    formData.append('folderName', folderName);
    formData.append('customName', name);

    try {
      const res = await fetch('/api/records?action=save-file', {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        await fetchServerFolders();
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to save file to server:', err);
      return false;
    }
  };

  const handleSaveFile = async (
    blob: Blob,
    name: string,
    source: 'modulator' | 'chat_tts' | 'user_upload',
    customServerFolder?: string
  ) => {
    const id = `audio-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const record: SavedFileRecord = {
      id,
      name,
      blob,
      timestamp: Date.now(),
      size: blob.size,
      source,
    };

    try {
      // Save locally
      await saveAudioFile(record);
      const url = URL.createObjectURL(blob);
      setSavedFiles((prev) => [
        { ...record, url },
        ...prev,
      ]);

      // Mirror to physical server folder
      const serverFolder = customServerFolder || (source === 'modulator' ? 'modulator' : source === 'chat_tts' ? 'ai_chat' : 'uploads');
      await handleSaveToServer(blob, name, serverFolder);

      triggerToast(
        language === 'en'
          ? `File "${name}" saved to Vault & Server folder /records/${serverFolder}! `
          : `File "${name}" salvato nel Vault e nella cartella Server /records/${serverFolder}!`
      );
    } catch (err) {
      console.error('Failed to save file:', err);
      triggerToast(
        language === 'en' ? 'Failed to save file.' : 'Errore nel salvataggio del file.',
        'error'
      );
    }
  };

  const handleDeleteSavedFile = async (id: string) => {
    try {
      const file = savedFiles.find((f) => f.id === id);
      if (file) {
        URL.revokeObjectURL(file.url);
      }
      await deleteAudioFile(id);
      setSavedFiles((prev) => prev.filter((f) => f.id !== id));
      triggerToast(
        language === 'en'
          ? 'File deleted from local Vault!'
          : 'File rimosso dal Vault locale!'
      );
    } catch (err) {
      console.error('Failed to delete file:', err);
    }
  };

  const handleRenameSavedFile = async (id: string, newName: string) => {
    try {
      await updateAudioFileName(id, newName);
      setSavedFiles((prev) =>
        prev.map((f) => (f.id === id ? { ...f, name: newName } : f))
      );
      triggerToast(
        language === 'en'
          ? 'File renamed successfully!'
          : 'File rinominato con successo!'
      );
    } catch (err) {
      console.error('Failed to rename file:', err);
    }
  };

  const handleUploadSavedFile = async (file: File) => {
    await handleSaveFile(file, file.name, 'user_upload');
  };

  const handleCreateServerFolder = async (folderName: string) => {
    try {
      const res = await fetch('/api/records?action=create-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderName }),
      });
      if (res.ok) {
        await fetchServerFolders();
        triggerToast(
          language === 'en'
            ? `Folder "${folderName}" created on server!`
            : `Cartella "${folderName}" creata sul server!`
        );
        return true;
      } else {
        const data = await res.json();
        triggerToast(data.error || 'Failed to create folder', 'error');
        return false;
      }
    } catch (err) {
      console.error('Failed to create folder:', err);
      return false;
    }
  };

  const handleDeleteServerFile = async (filePath: string) => {
    try {
      const res = await fetch('/api/records?action=delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath }),
      });
      if (res.ok) {
        await fetchServerFolders();
        triggerToast(
          language === 'en'
            ? 'Deleted from Server folder!'
            : 'Eliminato dalla cartella del Server!'
        );
      } else {
        const data = await res.json();
        triggerToast(data.error || 'Failed to delete from server', 'error');
      }
    } catch (err) {
      console.error('Failed to delete file from server:', err);
    }
  };

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

      // AGC Node 1: Dynamic gain controller
      const agcGain = ctx.createGain();
      agcGain.gain.setValueAtTime(1.0, ctx.currentTime);
      agcGainNodeRef.current = agcGain;

      // AGC Node 2: Dynamic input volume analyzer (inspects post-lowcut signal)
      const agcAnalyser = ctx.createAnalyser();
      agcAnalyser.fftSize = 256; // fast window for tracking
      agcAnalyserNodeRef.current = agcAnalyser;

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
      // Mic -> LowCut Filter -> AgcGain -> PitchWorklet -> Warmth EQ -> Nasal EQ -> Clarity EQ -> Limiter -> Analyser -> Volume Gain -> Speaker Output
      microphoneNodeRef.current.connect(lowCut);
      
      // Feed-forward connection: split lowCut output to both agcGain and agcAnalyser
      lowCut.connect(agcGain);
      lowCut.connect(agcAnalyser);

      agcGain.connect(pitchNode);
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

      // Start Dynamic Automatic Gain Control (AGC) high-frequency tracking loop
      if (agcIntervalRef.current) clearInterval(agcIntervalRef.current);
      currentAgcGainRef.current = 1.0;
      agcIntervalRef.current = window.setInterval(() => {
        const analyserNode = agcAnalyserNodeRef.current;
        const gainNode = agcGainNodeRef.current;
        const currentContext = audioCtxRef.current;
        if (!analyserNode || !gainNode || !currentContext) return;

        let rms = 0.0;
        try {
          if (analyserNode.getFloatTimeDomainData) {
            const dataArray = new Float32Array(analyserNode.fftSize);
            analyserNode.getFloatTimeDomainData(dataArray);
            let sum = 0.0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i] * dataArray[i];
            }
            rms = Math.sqrt(sum / dataArray.length);
          } else {
            const dataArray = new Uint8Array(analyserNode.fftSize);
            analyserNode.getByteTimeDomainData(dataArray);
            let sum = 0.0;
            for (let i = 0; i < dataArray.length; i++) {
              const val = (dataArray[i] - 128) / 128;
              sum += val * val;
            }
            rms = Math.sqrt(sum / dataArray.length);
          }
        } catch (e) {
          console.warn("AGC analyzer retrieval failed:", e);
        }

        if (!isAgcEnabledRef.current) {
          if (isNoHeadphonesModeRef.current) {
            // Noise Gate active even when AGC is disabled
            const nextGain = rms < noiseGateThresholdRef.current ? 0.001 : 1.0;
            gainNode.gain.setTargetAtTime(nextGain, currentContext.currentTime, 0.015);
          } else {
            setCurrentAgcGainDb(0.0);
            currentAgcGainRef.current = 1.0;
            gainNode.gain.setTargetAtTime(1.0, currentContext.currentTime, 0.015);
          }
          return;
        }

        // Noise floor gate: avoid boosting silence/static hiss
        let targetGain = 1.0;
        if (isNoHeadphonesModeRef.current && rms < noiseGateThresholdRef.current) {
          targetGain = 0.001; // Gate closed - mute microphone input
        } else if (rms < 0.005) {
          targetGain = 1.0;
        } else {
          // targetGain = targetLevel / rms
          targetGain = agcTargetLevelRef.current / rms;
        }

        // Clamp the gain offset to prevent excessive peak loudness (-12dB to +18dB)
        const minGain = (isNoHeadphonesModeRef.current && rms < noiseGateThresholdRef.current) ? 0.001 : 0.25;
        const maxGain = 8.0;
        const clampedTarget = Math.max(minGain, Math.min(maxGain, targetGain));

        const lastGain = currentAgcGainRef.current;
        // Asymmetric attack/release envelope: Fast attack (limiting/attenuation) and slow release (boost)
        const envelopeCoefficient = clampedTarget < lastGain ? 0.35 : 0.04;
        const nextGain = lastGain + (clampedTarget - lastGain) * envelopeCoefficient;

        currentAgcGainRef.current = nextGain;

        try {
          gainNode.gain.setTargetAtTime(nextGain, currentContext.currentTime, 0.02);
        } catch (e) {
          console.warn("AGC gain scaling failed:", e);
        }

        const dbOffset = 20 * Math.log10(nextGain);
        setCurrentAgcGainDb(dbOffset);
      }, 40);

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
    // Teardown AGC processing interval
    if (agcIntervalRef.current) {
      clearInterval(agcIntervalRef.current);
      agcIntervalRef.current = null;
    }
    currentAgcGainRef.current = 1.0;
    setCurrentAgcGainDb(0.0);

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

  const handleResetSettings = () => {
    setPitch(1.0);
    setDelay(40.0);
    setWarmth(0.0);
    setNasal(0.0);
    setClarity(0.0);
    setVolume(0.8);
    setIsAgcEnabled(true);
    setAgcTargetLevel(0.20);
    setActivePresetId(null);
    triggerToast(
      language === 'en' 
        ? 'Modeling parameters reset to default values!' 
        : 'Parametri del modulatore azzerati ai valori naturali!'
    );
  };

  return (
    <div className="bg-industrial-bg text-black min-h-screen flex flex-col overflow-x-clip font-sans antialiased">
      {/* Dynamic Navigation Header */}
      <Header 
        language={language} 
        setLanguage={setLanguage} 
        isEngineRunning={isEngineRunning} 
        toggleEngine={toggleEngine}
        showSafetyBanner={showSafetyBanner}
        setShowSafetyBanner={setShowSafetyBanner}
        onResetSettings={handleResetSettings}
      />

      <main className="flex-1 lg:grid lg:grid-cols-[290px_1fr_290px] xl:grid-cols-[350px_1fr_350px] items-stretch border-b-2 border-black bg-industrial-bg">
        
        {/* COLUMN 1: PRESETS & CAPTURE */}
        <section className="p-4 sm:p-5 border-b-2 lg:border-b-0 lg:border-r-2 border-black flex flex-col space-y-6 justify-start bg-neutral-50/30">
          <div id="section-presets">
            <PresetSelector
              presets={SYNTH_PRESETS}
              activePresetId={activePresetId}
              onSelectPreset={handleSelectPreset}
              language={language}
            />
          </div>
          <div id="section-capture">
            <AudioRecorder
              isEngineRunning={isEngineRunning}
              audioCtx={audioCtxRef.current}
              outputNode={analyserNodeRef.current}
              language={language}
              onUseForClone={handleUseForClone}
              onSaveToCabinet={(blob, name) => handleSaveFile(blob, name, 'modulator')}
              onRecordingStateChange={setIsRecordingActive}
            />
          </div>
        </section>

        {/* COLUMN 2: CORE MODULATOR CONTROL */}
        <section id="section-modulator" className="p-4 sm:p-5 border-b-2 lg:border-b-0 lg:border-r-2 border-black flex flex-col space-y-5 justify-between bg-white">
          <div className="space-y-5">
            
            {/* Larsen Warning Alert Banner */}
            {showSafetyBanner && (
              <div className="bg-[#fff3cc] border-2 border-black p-4 flex items-start justify-between text-black relative">
                <div className="flex items-start space-x-3">
                  <ShieldAlert className="w-5 h-5 flex-shrink-0 text-industrial-orange mt-0.5" />
                  <div>
                    <h4 className="font-mono text-[11px] font-bold uppercase tracking-wider">
                      {language === 'en' ? '[ALERT] Larsen Feedback Warning' : '[ALERT] Prevenzione Larsen'}
                    </h4>
                    <p className="font-sans text-[10px] sm:text-xs text-black/75 mt-1 leading-relaxed max-w-2xl">
                      {language === 'en'
                        ? 'To avoid uncomfortable high-pitch feedback loops, please wear headphones or earbuds before starting the vocal modulator.'
                        : 'Per testare l\'elaborazione della tua voce senza fastidiosi fischi, indossa le cuffie o gli auricolari prima di attivare il microfono.'}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowSafetyBanner(false)}
                  className="text-black/50 hover:text-black p-1 transition-colors"
                  title="Close safety warning"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* NO-HEADPHONES & NOISE SUPPRESSION PANEL */}
            <div className="bg-white border-2 border-black p-4.5 sm:p-5 relative neo-shadow">
              <div className="flex items-center justify-between border-b-2 border-black pb-2.5 mb-3.5">
                <div className="flex items-center space-x-2">
                  <div className={`p-1 border border-black ${isNoHeadphonesMode ? 'bg-industrial-orange' : 'bg-neutral-100'}`}>
                    <Volume2 className="w-4 h-4 text-black" />
                  </div>
                  <div>
                    <h4 className="font-mono text-[11px] font-bold uppercase tracking-wider">
                      {language === 'en' ? 'NO-HEADPHONES RECORDING' : 'REGISTRAZIONE SENZA CUFFIE'}
                    </h4>
                    <span className="font-sans text-[9px] text-black/50 block">
                      {language === 'en' ? 'Advanced Noise Gate & Anti-Feedback' : 'Filtro Antirumore Dinamico & Soppressione Larsen'}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setIsNoHeadphonesMode(!isNoHeadphonesMode);
                    triggerToast(
                      language === 'en'
                        ? `No-Headphones Mode ${!isNoHeadphonesMode ? 'Enabled' : 'Disabled'}`
                        : `Modalità Senza Cuffie ${!isNoHeadphonesMode ? 'Attivata' : 'Disattivata'}`
                    );
                  }}
                  className={`px-2.5 py-1.5 border-2 border-black font-mono text-[9px] font-bold uppercase tracking-wider transition-all duration-75 active:translate-y-[1px] active:translate-x-[1px] ${
                    isNoHeadphonesMode
                      ? 'bg-black text-white hover:bg-neutral-800'
                      : 'bg-white text-black hover:bg-neutral-100'
                  }`}
                >
                  {isNoHeadphonesMode ? (language === 'en' ? 'ACTIVE' : 'ATTIVA') : (language === 'en' ? 'OFF' : 'SPENTA')}
                </button>
              </div>

              {isNoHeadphonesMode ? (
                <div className="space-y-3.5 animate-fadeIn">
                  {/* Informative alert badge */}
                  <div className="bg-[#eef2f6] border border-black p-2 flex items-start space-x-2 text-black text-[10px]">
                    <Sparkle className="w-3.5 h-3.5 text-industrial-orange flex-shrink-0 mt-0.5 animate-pulse" />
                    <p className="font-sans text-[10px] text-black/75 leading-relaxed">
                      {language === 'en'
                        ? 'Hardware Echo Cancellation (AEC) is active. The software Noise Gate and Auto-Mute features will now filter out speaker feedback and static background hiss.'
                        : 'L\'Eco-Cancellation hardware (AEC) è attiva. Il Noise Gate software e l\'Auto-Mute filtreranno i fischi di feedback e i rumori di fondo.'}
                    </p>
                  </div>

                  {/* Auto-Mute switch */}
                  <div className="flex items-center justify-between bg-neutral-50 border border-black p-2.5">
                    <div className="space-y-0.5 pr-2">
                      <span className="font-mono text-[9px] font-bold uppercase block">
                        {language === 'en' ? 'AUTO-MUTE MONITOR' : 'AUTO-MUTE MONITORING'}
                      </span>
                      <span className="font-sans text-[9px] text-black/60 block leading-tight">
                        {language === 'en'
                          ? 'Mutes speakers during active recording to prevent 100% of feedback.'
                          : 'Spegne le casse durante la registrazione per azzerare al 100% il feedback.'}
                      </span>
                    </div>
                    <button
                      onClick={() => setMuteMonitorDuringRecord(!muteMonitorDuringRecord)}
                      className={`px-2 py-1 border border-black font-mono text-[8px] font-bold uppercase transition-colors ${
                        muteMonitorDuringRecord ? 'bg-industrial-orange text-black' : 'bg-white text-black'
                      }`}
                    >
                      {muteMonitorDuringRecord ? (language === 'en' ? 'ON' : 'SI') : (language === 'en' ? 'OFF' : 'NO')}
                    </button>
                  </div>

                  {/* Noise Gate threshold slider */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between text-[9px] font-mono font-bold uppercase">
                      <span className="text-black/60">
                        {language === 'en' ? 'NOISE GATE SENSITIVITY' : 'SOGLIA FILTRO ANTIRUMORE (GATE)'}
                      </span>
                      <span className="text-black">
                        {noiseGateThreshold === 0.005 
                          ? (language === 'en' ? 'LOW (0.005)' : 'BASSA (0.005)') 
                          : noiseGateThreshold === 0.012 
                          ? (language === 'en' ? 'OPTIMAL (0.012)' : 'OTTIMALE (0.012)')
                          : noiseGateThreshold === 0.025
                          ? (language === 'en' ? 'HIGH (0.025)' : 'ALTA (0.025)')
                          : `${noiseGateThreshold.toFixed(3)}`}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="0.002"
                        max="0.05"
                        step="0.001"
                        value={noiseGateThreshold}
                        onChange={(e) => setNoiseGateThreshold(parseFloat(e.target.value))}
                        className="brutalist-range flex-1"
                      />
                    </div>
                    <p className="font-sans text-[9px] text-black/45 leading-normal">
                      {language === 'en'
                        ? 'Higher values block louder room/speaker noise but require you to speak louder.'
                        : 'Valori più alti bloccano rumori più forti (es. ventole o casse) ma richiedono di parlare più vicino.'}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="font-sans text-[10px] sm:text-xs text-black/50 leading-relaxed">
                  {language === 'en'
                    ? 'Toggle this mode on to enable real-time speaker feedback protection and a customizable microphone noise gate for crystal-clear recordings without headphones.'
                    : 'Attiva questa modalità per abilitare la protezione anti-feedback acustico in tempo reale e un noise gate microfonico personalizzabile per registrare senza cuffie.'}
                </p>
              )}
            </div>

            {/* Vocal Modeling Sliders Panel */}
            <div className="bg-white border-2 border-black p-4.5 sm:p-6 flex-1 flex flex-col justify-between relative neo-shadow">
              <div className="space-y-5">
                
                {/* Panel Title */}
                <div className="flex items-center justify-between border-b-2 border-black pb-3">
                  <div>
                    <h3 className="font-display text-sm sm:text-base font-bold text-black uppercase tracking-tight">
                      {language === 'en' ? 'Vocal Modeling Engine' : 'Modulatore Fisiologico'}
                    </h3>
                    <span className="font-mono text-[9px] text-black/50 uppercase tracking-wider block mt-0.5">
                      {language === 'en' ? 'Adjust parameters below to sculpt virtual vocal tracts' : 'Modellazione e sintesi delle corde vocali artificiali'}
                    </span>
                  </div>
                  <span className="font-mono text-[10px] text-black/40 font-bold">[02]</span>
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
                    setActivePresetId(null);
                  }}
                  leftLabel={language === 'en' ? 'Deep' : 'Grave'}
                  rightLabel={language === 'en' ? 'Acute' : 'Acuto'}
                  helpText={language === 'en' ? 'Shift vocal range up or down using the multi-phase delay lines.' : 'Regola l\'altezza tonale complessiva delle corde vocali senza alterare la velocità.'}
                  icon={<Waves className="w-4 h-4" />}
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
                  icon={<Sparkle className="w-4 h-4" />}
                />

                {/* Automatic Gain Control (AGC) Panel */}
                <div className="border-t-2 border-black pt-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-mono text-[10px] sm:text-xs font-bold text-black uppercase tracking-wider flex items-center">
                        <Activity className="w-4 h-4 mr-1.5 text-industrial-orange" />
                        {language === 'en' ? 'Automatic Gain Control (AGC)' : 'Ctrl Automatico Guadagno (AGC)'}
                      </h4>
                      <span className="font-mono text-[8px] text-black/50 uppercase tracking-wider block mt-0.5">
                        {language === 'en' ? 'Normalizes input levels dynamically' : 'Normalizzazione dinamica pre-shifter'}
                      </span>
                    </div>

                    <button
                      onClick={() => setIsAgcEnabled(!isAgcEnabled)}
                      className={`px-3 py-1.5 border-2 border-black font-mono text-[10px] font-bold uppercase tracking-wider transition-all duration-75 active:translate-y-[1px] active:translate-x-[1px] ${
                        isAgcEnabled
                          ? 'bg-black text-white hover:bg-neutral-800'
                          : 'bg-white text-black hover:bg-neutral-100'
                      }`}
                    >
                      {isAgcEnabled ? (language === 'en' ? 'ACTIVE' : 'ATTIVO') : (language === 'en' ? 'BYPASS' : 'BYPASS')}
                    </button>
                  </div>

                  {isAgcEnabled && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-neutral-50 border-2 border-black p-2.5 flex flex-col justify-between">
                        <span className="font-mono text-[8px] text-black/50 uppercase font-bold block mb-0.5">
                          {language === 'en' ? 'DYNAMIC_GAIN_OFFSET' : 'COMPENSAZIONE_GUADAGNO'}
                        </span>
                        <span className={`font-mono font-extrabold text-xs tracking-wider ${isEngineRunning ? 'text-industrial-orange' : 'text-black/40'}`}>
                          {isEngineRunning ? `${currentAgcGainDb >= 0 ? '+' : ''}${currentAgcGainDb.toFixed(1)} dB` : '-- dB'}
                        </span>
                      </div>
                      <div className="bg-neutral-50 border-2 border-black p-2.5 flex flex-col justify-between">
                        <span className="font-mono text-[8px] text-black/50 uppercase font-bold block mb-0.5">
                          {language === 'en' ? 'INPUT_AMPLITUDE' : 'STATO_SORGENTE'}
                        </span>
                        <span className="font-mono font-extrabold text-[10px] tracking-wider text-black">
                          {isEngineRunning ? (currentAgcGainDb > 1.5 ? (language === 'en' ? 'WEAK (BOOST)' : 'DEBOLE (+)') : currentAgcGainDb < -1.5 ? (language === 'en' ? 'STRONG (ATTEN)' : 'FORTE (-)') : (language === 'en' ? 'OPTIMAL' : 'OTTIMALE')) : '--'}
                        </span>
                      </div>
                    </div>
                  )}

                  <ControlSlider
                    id="agc-target-slider"
                    label={language === 'en' ? 'AGC Target Normalization (RMS)' : 'Target Normalizzazione AGC (RMS)'}
                    badgeValue={isAgcEnabled ? agcTargetLevel.toFixed(2) : 'OFF'}
                    minValue={0.05}
                    maxValue={0.4}
                    step={0.01}
                    currentValue={agcTargetLevel}
                    onChange={(val) => {
                      setAgcTargetLevel(val);
                    }}
                    helpText={language === 'en' ? 'Target signal intensity to normalize towards. Optimal range is 0.15 - 0.25.' : 'Regola l\'intensità del segnale a cui normalizzare. Valore ottimale: 0.15 - 0.25.'}
                  />
                </div>

                {/* Equalizer Formants Section */}
                <div className="border-t-2 border-black pt-5 space-y-4">
                  <div>
                    <h4 className="font-mono text-[10px] sm:text-xs font-bold text-black uppercase tracking-wider flex items-center">
                      <Sparkles className="w-4 h-4 mr-1.5 text-industrial-orange" />
                      {language === 'en' ? 'Vocal Formant & Resonators' : 'Filtri Formantici (Risonanza Biologica)'}
                    </h4>
                    <p className="font-sans text-[10px] text-black/50 mt-0.5 leading-normal">
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
            </div>
          </div>

          {/* Bottom Volume & Main Activation Row */}
          <div className="border-t-2 border-black pt-5 mt-5 flex flex-col sm:flex-row items-center justify-between gap-5">
            
            {/* Volume Slider */}
            <div className="w-full sm:w-1/2 space-y-1.5">
              <div className="flex justify-between text-[10px] font-mono font-bold uppercase tracking-wider">
                <span className="text-black/60 flex items-center">
                  <Volume2 className="w-4 h-4 mr-1 text-industrial-orange" />
                  {language === 'en' ? 'OUTPUT_VOLUME' : 'VOLUME_GENERALE'}
                </span>
                <span className="text-black">{Math.round(volume * 100)}%</span>
              </div>
              <input
                id="volume-slider"
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="brutalist-range"
              />
            </div>

            {/* Primary Launch Action Button */}
            <button
              id="power-btn"
              onClick={toggleEngine}
              disabled={isInitializing}
              className={`w-full sm:w-auto px-6 py-4.5 font-mono font-bold text-xs uppercase tracking-widest border-2 border-black transition-all duration-75 active:translate-y-[1px] active:translate-x-[1px] flex items-center justify-center gap-2 ${
                isEngineRunning
                  ? 'bg-industrial-orange text-black font-semibold'
                  : 'bg-black text-white hover:bg-industrial-orange hover:text-black font-semibold'
              }`}
            >
              {isInitializing ? (
                <>
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                  <span>{language === 'en' ? 'BOOTING_DSP...' : 'CARICAMENTO...'}</span>
                </>
              ) : isEngineRunning ? (
                <>
                  <Power className="w-4 h-4 animate-pulse" />
                  <span>{language === 'en' ? 'STOP_MODULATOR' : 'SPEGNI_MODULATORE'}</span>
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4" />
                  <span>{language === 'en' ? 'START_MODULATOR' : 'AVVIA_MODULATORE'}</span>
                </>
              )}
            </button>

          </div>
        </section>

        {/* COLUMN 3: DIAGNOSTICS & CHAT */}
        <section className="p-4 sm:p-5 flex flex-col space-y-6 justify-start bg-neutral-50/30">
          
          {/* Visual Analyzer Wave/Spectrum Screen */}
          <div id="section-visualizer" className="w-full">
            <Visualizer
              analyserNode={analyserNodeRef.current}
              isEngineRunning={isEngineRunning}
              language={language}
            />
          </div>

          {/* AI Voice Clone Chatbot Section */}
          <div id="section-chat" className="w-full">
            <AICloneChat 
              language={language}
              recordedBlob={recordedBlob}
              recordedUrl={recordedUrl}
              onClearRecorded={() => {
                setRecordedBlob(null);
                setRecordedUrl(null);
              }}
              onSaveToCabinet={(blob, name) => handleSaveFile(blob, name, 'chat_tts')}
            />
          </div>

          {/* Saved Audio Vault Cabinet */}
          <div id="section-cabinet" className="w-full">
            <SavedCabinet
              language={language}
              savedFiles={savedFiles}
              onDeleteFile={handleDeleteSavedFile}
              onRenameFile={handleRenameSavedFile}
              onUploadFile={handleUploadSavedFile}
              serverFolders={serverFolders}
              onCreateServerFolder={handleCreateServerFolder}
              onDeleteServerFile={handleDeleteServerFile}
              onSaveToServer={handleSaveToServer}
            />
          </div>

          {/* Signal Flow Pipeline Chart */}
          <div id="section-pipeline" className="w-full">
            <SignalPipeline
              isEngineRunning={isEngineRunning}
              language={language}
              stats={stats}
            />
          </div>
        </section>

      </main>

      {/* AUDIO MONTAGE & MIXING STUDIO */}
      <section className="p-4 sm:p-5 border-b-2 border-black bg-industrial-bg">
        <div className="max-w-[1400px] mx-auto">
          <AudioStudio 
            language={language}
            savedFiles={savedFiles}
            serverFolders={serverFolders}
            onSaveFile={handleSaveFile}
            triggerToast={triggerToast}
          />
        </div>
      </section>

      {/* Technical footer details */}
      <Footer language={language} />

      {/* Floating System-Wide Notification Toast */}
      {toast && (
        <div className={`fixed bottom-5 right-5 z-50 border-2 border-black text-black px-5 py-3.5 font-mono text-[10px] uppercase tracking-wider flex items-center space-x-3 transition-all duration-100 bg-white shadow-[4px_4px_0px_0px_#000000]`}>
          <div className="w-6 h-6 border-2 border-black bg-black text-white flex items-center justify-center">
            <CheckCircle className={`w-3.5 h-3.5 ${toast.type === 'error' ? 'text-industrial-orange' : 'text-emerald-400'}`} />
          </div>
          <span className="font-bold">
            {toast.message}
          </span>
        </div>
      )}
    </div>
  );
}
