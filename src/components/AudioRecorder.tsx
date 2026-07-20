import { useState, useEffect, useRef } from 'react';
import { Play, Square, Download, Trash2, Radio, Info, Sparkles } from 'lucide-react';
import { Language } from '../types';

interface AudioRecorderProps {
  isEngineRunning: boolean;
  audioCtx: AudioContext | null;
  outputNode: AudioNode | null;
  language: Language;
  onUseForClone?: (blob: Blob, url: string) => void;
}

export default function AudioRecorder({ 
  isEngineRunning, 
  audioCtx, 
  outputNode, 
  language,
  onUseForClone
}: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const destNodeRef = useRef<MediaStreamAudioDestinationNode | null>(null);

  // Stop recording if engine gets shut off midway
  useEffect(() => {
    if (!isEngineRunning && isRecording) {
      stopRecording();
    }
  }, [isEngineRunning]);

  // Clean up timer on unmount
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
      // 1. Create a media stream destination node from the Web Audio context
      const dest = audioCtx.createMediaStreamDestination();
      destNodeRef.current = dest;

      // 2. Connect the output node to this destination so it receives the synthesized signal
      outputNode.connect(dest);

      // 3. Initialize the MediaRecorder
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

        // Disconnect destination node to prevent duplicate audio routes
        if (destNodeRef.current && outputNode) {
          try {
            outputNode.disconnect(destNodeRef.current);
          } catch (e) {
            console.warn("Failed to disconnect recording node safely:", e);
          }
        }
      };

      // 4. Start recording and launch timer
      mediaRecorder.start();
      setIsRecording(true);
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
    <div className="bg-white border border-slate-100 rounded-3xl p-4 sm:p-5 shadow-xl shadow-slate-100/50 flex flex-col justify-between">
      <div>
        <h3 className="text-xs sm:text-sm font-bold text-slate-800 tracking-wide uppercase flex items-center mb-1">
          <Radio className={`w-4 h-4 mr-1.5 ${isRecording ? 'text-red-500 animate-pulse' : 'text-indigo-600'}`} />
          {language === 'en' ? 'Vocal Capture & Recording' : 'Registratore di Modulazione'}
        </h3>
        <p className="text-[10px] sm:text-xs text-slate-400 mb-4">
          {language === 'en' 
            ? 'Record your synthesized voice and download the file.' 
            : 'Registra la tua voce modificata ed esportala in formato digitale.'}
        </p>

        {/* If engine is offline, show helpful hint */}
        {!isEngineRunning ? (
          <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 flex items-start space-x-2">
            <Info className="w-4 h-4 text-indigo-500 mt-0.5 flex-shrink-0" />
            <p className="text-[10px] sm:text-xs text-slate-500 leading-normal">
              {language === 'en' 
                ? 'To record, first tap "Start Modulator" above to stream live synthesized microphone feed.'
                : 'Per registrare, avvia prima il modulatore vocale cliccando sul pulsante principale.'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-2">
            {/* Timer Display */}
            <div className="font-mono text-xl sm:text-2xl font-bold text-slate-800 flex items-center space-x-2">
              {isRecording && <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping"></span>}
              <span>{formatTime(isRecording ? recordingSeconds : 0)}</span>
            </div>

            {/* Record Trigger Actions */}
            <div className="mt-4 flex items-center justify-center space-x-3 w-full">
              {!isRecording ? (
                <button
                  onClick={startRecording}
                  className="px-4 py-2.5 bg-red-650 hover:bg-red-500 active:scale-95 text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 transition-all shadow-md shadow-red-100"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>{language === 'en' ? 'Start Recording' : 'Inizia Registrazione'}</span>
                </button>
              ) : (
                <button
                  onClick={stopRecording}
                  className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 transition-all shadow-md shadow-slate-200"
                >
                  <Square className="w-3.5 h-3.5 fill-current text-white" />
                  <span>{language === 'en' ? 'Stop & Compile' : 'Ferma e Genera'}</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Compiled recording list preview */}
        {audioUrl && (
          <div className="mt-5 pt-4 border-t border-slate-100 space-y-3 animate-fade-in">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-xs font-bold text-emerald-600 flex items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>
                {language === 'en' ? 'Recording Compiled' : 'Registrazione Generata'}
              </span>
              <button
                onClick={deleteRecording}
                className="text-slate-400 hover:text-red-500 transition-colors p-1 rounded-lg hover:bg-slate-50"
                title={language === 'en' ? 'Discard recording' : 'Elimina registrazione'}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Inline Custom HTML5 audio bar */}
            <div className="w-full bg-slate-50 rounded-xl p-2 border border-slate-100">
              <audio src={audioUrl} controls className="w-full h-8 outline-none" />
            </div>

            {/* Download Link Trigger */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <a
                href={audioUrl}
                download="aura-voice-modulated.webm"
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 active:scale-[0.98] text-slate-800 font-bold text-xs rounded-xl flex items-center justify-center space-x-1.5 transition-all shadow-sm border border-slate-200"
              >
                <Download className="w-4 h-4" />
                <span>{language === 'en' ? 'Download File' : 'Scarica File'}</span>
              </a>

              {onUseForClone && recordingBlob && (
                <button
                  onClick={() => onUseForClone(recordingBlob, audioUrl)}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white font-bold text-xs rounded-xl flex items-center justify-center space-x-1.5 transition-all shadow-md shadow-indigo-100"
                >
                  <Sparkles className="w-4 h-4 animate-pulse" />
                  <span>{language === 'en' ? 'Use for AI Chat' : 'Invia a Chat AI'}</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
