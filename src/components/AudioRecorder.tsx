import { useState, useEffect, useRef } from 'react';
import { Play, Square, Download, Trash2, Radio, Info, Sparkles, FolderHeart } from 'lucide-react';
import { Language } from '../types';

interface AudioRecorderProps {
  isEngineRunning: boolean;
  audioCtx: AudioContext | null;
  outputNode: AudioNode | null;
  language: Language;
  onUseForClone?: (blob: Blob, url: string) => void;
  onSaveToCabinet?: (blob: Blob, name: string) => void;
  onRecordingStateChange?: (isRecording: boolean) => void;
}

export default function AudioRecorder({ 
  isEngineRunning, 
  audioCtx, 
  outputNode, 
  language,
  onUseForClone,
  onSaveToCabinet,
  onRecordingStateChange
}: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const destNodeRef = useRef<MediaStreamAudioDestinationNode | null>(null);

  useEffect(() => {
    if (!isEngineRunning && isRecording) {
      stopRecording();
    }
  }, [isEngineRunning]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const startRecording = () => {
    if (!audioCtx || !outputNode) return;

    try {
      const dest = audioCtx.createMediaStreamDestination();
      destNodeRef.current = dest;
      outputNode.connect(dest);

      const mediaRecorder = new MediaRecorder(dest.stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        setRecordingBlob(blob);

        if (destNodeRef.current && outputNode) {
          try {
            outputNode.disconnect(destNodeRef.current);
          } catch (e) {
            console.warn("Failed to disconnect recording node safely:", e);
          }
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      onRecordingStateChange?.(true);
      setRecordingSeconds(0);
      setAudioUrl(null);
      setRecordingBlob(null);

      timerRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);

    } catch (err) {
      console.error("Could not initialize MediaRecorder:", err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);
    onRecordingStateChange?.(false);
  };

  const deleteRecording = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    setRecordingBlob(null);
    setRecordingSeconds(0);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="bg-white border-2 border-black p-4.5 flex flex-col justify-between neo-shadow">
      <div>
        <div className="border-b-2 border-black pb-2 mb-3 flex items-center justify-between">
          <h3 className="font-display text-sm font-bold text-black uppercase flex items-center tracking-tight">
            <Radio className={`w-4.5 h-4.5 mr-1.5 ${isRecording ? 'text-industrial-orange animate-pulse' : 'text-black'}`} />
            {language === 'en' ? 'Signal Recording' : 'Registratore Segnale'}
          </h3>
          <span className="font-mono text-[9px] text-black/40 font-bold">[RECO_ENGINE]</span>
        </div>

        <p className="font-sans text-[10px] sm:text-xs text-black/60 mb-4 leading-normal">
          {language === 'en' 
            ? 'Capture your synthesized output signal in real-time to generate a download or train the AI voice.' 
            : 'Registra l\'uscita del tuo modulatore vocale in tempo reale per l\'esportazione o la clonazione.'}
        </p>

        {!isEngineRunning ? (
          <div className="bg-white border-2 border-black p-3.5 flex items-start space-x-2.5">
            <Info className="w-4 h-4 text-industrial-orange mt-0.5 flex-shrink-0" />
            <p className="font-mono text-[9px] uppercase tracking-wider text-black/60 leading-relaxed font-semibold">
              {language === 'en' 
                ? 'SYSTEM_BYPASS: Start the vocal modulator first to record live modulated signals.'
                : 'BYPASS_ATTIVO: Avvia prima il modulatore per poter catturare il segnale vocale.'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-2.5 border-2 border-black bg-industrial-bg/40 p-4">
            {/* Timer Display */}
            <div className="font-mono text-lg sm:text-xl font-bold text-black flex items-center space-x-2 select-none">
              {isRecording && <span className="w-2.5 h-2.5 bg-industrial-orange animate-ping" />}
              <span>{formatTime(isRecording ? recordingSeconds : 0)}</span>
              <span className="text-[10px] text-black/40">[{isRecording ? 'RECORDING' : 'READY_TO_REC'}]</span>
            </div>

            {/* Record Trigger Actions */}
            <div className="mt-4 flex items-center justify-center space-x-2.5 w-full">
              {!isRecording ? (
                <button
                  onClick={startRecording}
                  className="px-4 py-2 bg-white text-black font-mono text-[10px] font-bold uppercase tracking-wider border-2 border-black hover:bg-black hover:text-white transition-all duration-75 active:translate-y-[1px] active:translate-x-[1px] flex items-center space-x-1.5"
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>{language === 'en' ? 'Start Capture' : 'Avvia Registrazione'}</span>
                </button>
              ) : (
                <button
                  onClick={stopRecording}
                  className="px-4 py-2 bg-industrial-orange text-black font-mono text-[10px] font-bold uppercase tracking-wider border-2 border-black hover:bg-black hover:text-white transition-all duration-75 active:translate-y-[1px] active:translate-x-[1px] flex items-center space-x-1.5"
                >
                  <Square className="w-3 h-3 fill-current" />
                  <span>{language === 'en' ? 'Stop & Compile' : 'Ferma e Genera'}</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Compiled recording list preview */}
        {audioUrl && (
          <div className="mt-4.5 pt-4 border-t-2 border-black space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[9px] uppercase tracking-wider font-bold text-black flex items-center">
                <span className="w-2 h-2 border border-black bg-industrial-orange mr-1.5 animate-pulse" />
                {language === 'en' ? 'SIGNAL_COMPILED' : 'SEGNALE_COMPILATO'}
              </span>
              <button
                onClick={deleteRecording}
                className="text-black/50 hover:text-industrial-orange transition-colors p-1"
                title={language === 'en' ? 'Discard recording' : 'Elimina registrazione'}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {/* Inline Custom HTML5 audio bar with industrial colors */}
            <div className="w-full bg-white border-2 border-black p-1.5">
              <audio src={audioUrl} controls className="w-full h-8 outline-none accent-industrial-orange" />
            </div>

            {/* Actions Grid */}
            <div className="flex flex-col gap-2 w-full text-left">
              <div className="grid grid-cols-2 gap-2">
                <a
                  href={audioUrl}
                  download="aura-voice-modulated.webm"
                  className="py-2 px-3 bg-white hover:bg-industrial-bg text-black font-mono text-[10px] font-bold uppercase tracking-wider border-2 border-black text-center flex items-center justify-center gap-1.5 transition-all duration-75 active:translate-y-[1px] active:translate-x-[1px]"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{language === 'en' ? 'Download' : 'Scarica'}</span>
                </a>

                {onSaveToCabinet && recordingBlob && (
                  <button
                    onClick={() => {
                      const name = `modulated_vocal_${Date.now().toString().slice(-4)}.webm`;
                      onSaveToCabinet(recordingBlob, name);
                    }}
                    className="py-2 px-3 bg-white hover:bg-industrial-bg text-black font-mono text-[10px] font-bold uppercase tracking-wider border-2 border-black flex items-center justify-center gap-1.5 transition-all duration-75 active:translate-y-[1px] active:translate-x-[1px]"
                  >
                    <FolderHeart className="w-3.5 h-3.5 text-industrial-orange" />
                    <span>{language === 'en' ? 'Save Vault' : 'Salva'}</span>
                  </button>
                )}
              </div>

              {onUseForClone && recordingBlob && (
                <button
                  onClick={() => onUseForClone(recordingBlob, audioUrl)}
                  className="w-full py-2.5 px-3 bg-black text-white hover:bg-white hover:text-black font-mono text-[10px] font-bold uppercase tracking-wider border-2 border-black flex items-center justify-center gap-1.5 transition-all duration-75 active:translate-y-[1px] active:translate-x-[1px]"
                >
                  <Sparkles className="w-3.5 h-3.5 text-industrial-orange animate-pulse" />
                  <span>{language === 'en' ? 'Train AI Chat' : 'Invia a Chat AI'}</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
