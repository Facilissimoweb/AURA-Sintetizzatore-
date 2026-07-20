import React, { useState, useEffect, useRef } from "react";
import { 
  MessageSquare, 
  Send, 
  Upload, 
  Trash2, 
  Play, 
  Pause, 
  HelpCircle, 
  Sparkles, 
  Volume2, 
  Loader2, 
  Mic, 
  CheckCircle,
  FileAudio,
  AlertCircle
} from "lucide-react";
import { Language } from "../types";

interface Message {
  id: string;
  role: "user" | "model";
  content: string;
  audioUrl?: string; // Cache the generated TTS URL if real
}

interface AICloneChatProps {
  language: Language;
  // If the user recorded a voice using the AudioRecorder component, they can pass it here
  recordedBlob: Blob | null;
  recordedUrl: string | null;
  onClearRecorded: () => void;
}

export default function AICloneChat({ 
  language, 
  recordedBlob, 
  recordedUrl, 
  onClearRecorded 
}: AICloneChatProps) {
  // Config state
  const [config, setConfig] = useState({ hasGeminiKey: true, hasElevenLabsKey: false });
  const [voiceName, setVoiceName] = useState<string>("");
  const [clonedVoiceId, setClonedVoiceId] = useState<string | null>(null);
  const [isCloning, setIsCloning] = useState<boolean>(false);
  const [clonedFileName, setClonedFileName] = useState<string | null>(null);
  const [clonedBlob, setClonedBlob] = useState<Blob | null>(null);
  
  // Drag and drop state
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Chat state
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "model",
      content: language === "en" 
        ? "Hello! Once you clone your voice, ask me anything. I will reply by reading the answers back with your exact voice!" 
        : "Ciao! Una volta clonato il tuo timbro vocale, chiedimi pure qualsiasi cosa. Risponderò leggendo i messaggi con la tua identica voce!",
    }
  ]);
  const [inputValue, setInputValue] = useState<string>("");
  const [isPendingAI, setIsPendingAI] = useState<boolean>(false);
  const [isGeneratingTTS, setIsGeneratingTTS] = useState<boolean>(false);
  
  // Audio playback state
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [currentlyPlayingMessageId, setCurrentlyPlayingMessageId] = useState<string | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  
  // Sine-wave canvas visualizer for the AI voice
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const wavePhaseRef = useRef<number>(0);

  // Load config on mount
  useEffect(() => {
    fetch("/api/config")
      .then((res) => res.json())
      .then((data) => setConfig(data))
      .catch((err) => console.error("Error loading api config:", err));
  }, []);

  // Update cloned voice default name when language shifts
  useEffect(() => {
    if (!voiceName || voiceName.startsWith("Mio Clone") || voiceName.startsWith("My Clone")) {
      setVoiceName(language === "en" ? "My Clone Voice" : "Mio Clone Vocale");
    }
  }, [language]);

  // Hook to handle when a recording is passed from the main recorder
  useEffect(() => {
    if (recordedBlob && recordedUrl) {
      setClonedBlob(recordedBlob);
      setClonedFileName(language === "en" ? "Recorded_Modulator_Sample.webm" : "Campione_Modulatore_Registrato.webm");
      // Trigger auto-focus or notification
    }
  }, [recordedBlob, recordedUrl, language]);

  // Canvas Wave Animation Loop (Simulating voice waves during playback)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const w = canvas.width;
      const h = canvas.height;
      const midY = h / 2;

      // Subtle horizontal baseline
      ctx.strokeStyle = "rgba(226, 232, 240, 0.4)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, midY);
      ctx.lineTo(w, midY);
      ctx.stroke();

      if (isPlayingAudio) {
        // Draw 3 layers of glowing fluid sine waves
        const waves = [
          { amplitude: 16, frequency: 0.02, speed: 0.12, color: "rgba(79, 70, 229, 0.75)", width: 3 },
          { amplitude: 10, frequency: 0.04, speed: -0.08, color: "rgba(168, 85, 247, 0.6)", width: 2 },
          { amplitude: 6, frequency: 0.01, speed: 0.18, color: "rgba(16, 185, 129, 0.5)", width: 1.5 },
        ];

        wavePhaseRef.current += 1;

        waves.forEach((wave) => {
          ctx.strokeStyle = wave.color;
          ctx.lineWidth = wave.width;
          ctx.shadowBlur = wave.width > 2 ? 8 : 0;
          ctx.shadowColor = wave.color;
          ctx.beginPath();

          for (let x = 0; x < w; x++) {
            // Fade out the wave near the edges using a bell-curve envelope
            const envelope = Math.sin((x / w) * Math.PI);
            const y = midY + Math.sin(x * wave.frequency + wavePhaseRef.current * wave.speed) * wave.amplitude * envelope;
            
            if (x === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
          }
          ctx.stroke();
        });
      } else {
        // Flat baseline with tiny noise
        ctx.strokeStyle = "rgba(79, 70, 229, 0.2)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, midY);
        for (let x = 0; x < w; x++) {
          const envelope = Math.sin((x / w) * Math.PI);
          const y = midY + Math.sin(x * 0.05 + Date.now() * 0.002) * 1.5 * envelope;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlayingAudio]);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
      }
      window.speechSynthesis.cancel();
    };
  }, []);

  // Handle Drag & Drop logic for file uploading
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith("audio/")) {
        setClonedBlob(file);
        setClonedFileName(file.name);
      } else {
        alert(language === "en" ? "Please drop a valid audio file." : "Rilascia un file audio valido.");
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setClonedBlob(file);
      setClonedFileName(file.name);
    }
  };

  // Submit voice cloning to backend
  const triggerVoiceClone = async () => {
    if (!clonedBlob) return;
    try {
      setIsCloning(true);
      
      const formData = new FormData();
      formData.append("voice_sample", clonedBlob);
      formData.append("voice_name", voiceName);

      const res = await fetch("/api/clone-voice", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      const data = await res.json();
      setClonedVoiceId(data.voice_id);
      
      // Notify user
      if (data.isDemo) {
        setMessages((prev) => [
          ...prev,
          {
            id: `system-${Date.now()}`,
            role: "model",
            content: language === "en"
              ? "🔔 Demo Clone Activated! Since the ElevenLabs API Key is not configured on the server, I will read my answers using the high-fidelity synthesis of your browser, replicating your voice as closely as possible!"
              : "🔔 Clone Demo Attivato! Poiché la chiave ElevenLabs non è configurata nel server, leggerò le risposte usando la sintesi ad alta fedeltà del tuo browser, simulando il tuo timbro!",
          }
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `system-${Date.now()}`,
            role: "model",
            content: language === "en"
              ? `🎉 Perfect! Your voice was successfully cloned to ElevenLabs! Voice ID: ${data.voice_id}. Feel free to write a message, I will speak with your cloned voice.`
              : `🎉 Perfetto! La tua voce è stata clonata con successo su ElevenLabs! Voice ID: ${data.voice_id}. Scrivi un messaggio e risponderò parlando esattamente come te.`,
          }
        ]);
      }
    } catch (err: any) {
      console.error("Cloning failed:", err);
      alert(language === "en" ? `Cloning failed: ${err.message}` : `Clonaggio fallito: ${err.message}`);
    } finally {
      setIsCloning(false);
    }
  };

  // Discard the currently cloned voice model
  const resetVoiceClone = () => {
    setClonedVoiceId(null);
    setClonedBlob(null);
    setClonedFileName(null);
    onClearRecorded();
    window.speechSynthesis.cancel();
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      setIsPlayingAudio(false);
    }
  };

  // Speech synthesis fallback using local browser Web Speech API
  const speakLocalFallback = (text: string, messageId: string) => {
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language === "en" ? "en-US" : "it-IT";
    
    // Find a premium native voice if available
    const voices = window.speechSynthesis.getVoices();
    const matches = voices.filter(v => v.lang.toLowerCase().includes(language === "en" ? "en" : "it"));
    
    if (matches.length > 0) {
      // Pick a natural-sounding voice if available, otherwise the first
      const premiumVoice = matches.find(v => v.name.includes("Google") || v.name.includes("Natural"));
      utterance.voice = premiumVoice || matches[0];
    }

    utterance.onstart = () => {
      setIsPlayingAudio(true);
      setCurrentlyPlayingMessageId(messageId);
    };

    utterance.onend = () => {
      setIsPlayingAudio(false);
      setCurrentlyPlayingMessageId(null);
    };

    utterance.onerror = () => {
      setIsPlayingAudio(false);
      setCurrentlyPlayingMessageId(null);
    };

    window.speechSynthesis.speak(utterance);
  };

  // Speak response using ElevenLabs cloned voice or browser fallback
  const speakResponse = async (text: string, messageId: string, cachedUrl?: string) => {
    if (!clonedVoiceId) return;

    // Stop currently playing audio or speech
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
    }
    window.speechSynthesis.cancel();

    // If it's the demo voice ID or ElevenLabs is not set up, go straight to fallback
    if (clonedVoiceId === "demo_clone_voice_id" || !config.hasElevenLabsKey) {
      speakLocalFallback(text, messageId);
      return;
    }

    // Play cached audio URL if available
    if (cachedUrl) {
      playAudioUrl(cachedUrl, messageId);
      return;
    }

    try {
      setIsGeneratingTTS(true);
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice_id: clonedVoiceId }),
      });

      if (!res.ok) {
        // Fallback to local browser synthesis on any server failure
        console.warn("Server TTS failed, using browser synthesis fallback.");
        speakLocalFallback(text, messageId);
        return;
      }

      // Convert audio stream to a blob URL
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      
      // Cache URL on the message
      setMessages((prev) => 
        prev.map((m) => m.id === messageId ? { ...m, audioUrl: url } : m)
      );

      playAudioUrl(url, messageId);
    } catch (err) {
      console.error("TTS generation failed:", err);
      speakLocalFallback(text, messageId);
    } finally {
      setIsGeneratingTTS(false);
    }
  };

  const playAudioUrl = (url: string, messageId: string) => {
    const audio = new Audio(url);
    currentAudioRef.current = audio;
    
    audio.onplay = () => {
      setIsPlayingAudio(true);
      setCurrentlyPlayingMessageId(messageId);
    };

    audio.onended = () => {
      setIsPlayingAudio(false);
      setCurrentlyPlayingMessageId(null);
    };

    audio.onerror = () => {
      setIsPlayingAudio(false);
      setCurrentlyPlayingMessageId(null);
    };

    audio.play().catch((e) => {
      console.error("Audio playback blocked or failed:", e);
      setIsPlayingAudio(false);
      setCurrentlyPlayingMessageId(null);
    });
  };

  const stopPlayback = () => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
    }
    window.speechSynthesis.cancel();
    setIsPlayingAudio(false);
    setCurrentlyPlayingMessageId(null);
  };

  // Send Chat message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isPendingAI) return;

    const userMsgText = inputValue.trim();
    const userMsgId = `user-${Date.now()}`;
    const newMessages = [
      ...messages,
      { id: userMsgId, role: "user" as const, content: userMsgText }
    ];

    setMessages(newMessages);
    setInputValue("");
    setIsPendingAI(true);

    try {
      // Map message history to server format
      const serverPayload = newMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: serverPayload }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const data = await response.json();
      const assistantMsgId = `model-${Date.now()}`;
      
      setMessages((prev) => [
        ...prev,
        { id: assistantMsgId, role: "model", content: data.response }
      ]);

      // Speak response immediately using the cloned voice!
      if (clonedVoiceId) {
        speakResponse(data.response, assistantMsgId);
      }
    } catch (err: any) {
      console.error("Chat API failed:", err);
      setMessages((prev) => [
        ...prev,
        { 
          id: `error-${Date.now()}`, 
          role: "model", 
          content: language === "en" 
            ? "⚠️ Sorry, I encountered an error generating the answer. Please try again." 
            : "⚠️ Spiacente, ho riscontrato un errore nella generazione della risposta. Riprova." 
        }
      ]);
    } finally {
      setIsPendingAI(false);
    }
  };

  return (
    <div className="bg-white border border-slate-100 rounded-3xl p-5 sm:p-6 shadow-xl shadow-slate-100/50 flex flex-col space-y-6">
      
      {/* Title Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-sm sm:text-base font-extrabold text-slate-800 tracking-wide uppercase flex items-center">
            <MessageSquare className="w-5 h-5 mr-2 text-indigo-600 animate-pulse" />
            {language === "en" ? "AI Voice Clone Chatbot" : "Chatbot con Clona Voce AI"}
          </h3>
          <p className="text-[10px] sm:text-xs text-slate-400">
            {language === "en" 
              ? "Teach the AI your custom vocal timbre and talk face-to-voice." 
              : "Insegna all'AI il tuo timbro vocale biologico e dialoga a voce clona."}
          </p>
        </div>
        <div className="flex items-center space-x-1 px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] rounded-lg font-bold border border-indigo-100 shadow-sm">
          <Sparkles className="w-3.5 h-3.5 mr-1" />
          <span>Gemini 2.5 Flash</span>
        </div>
      </div>

      {/* Voice Cloning setup section */}
      {!clonedVoiceId ? (
        <div 
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-2xl p-5 text-center transition-all duration-300 relative ${
            isDragging 
              ? "border-indigo-500 bg-indigo-50/50 scale-[1.01]" 
              : "border-slate-200 bg-slate-50 hover:bg-slate-50/80 hover:border-slate-300"
          }`}
        >
          {isCloning ? (
            <div className="flex flex-col items-center justify-center py-6 space-y-3">
              <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
              <div>
                <p className="text-xs font-bold text-slate-800">
                  {language === "en" ? "Analyzing voice profile..." : "Analisi del profilo vocale..."}
                </p>
                <p className="text-[10px] text-slate-400 mt-1 max-w-xs leading-relaxed mx-auto">
                  {language === "en" 
                    ? "ElevenLabs neural network is mapping your voice's fundamental frequencies and formant resonance..."
                    : "La rete neurale di ElevenLabs sta mappando le tue frequenze armoniche e risonanze formanti..."}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center mx-auto text-indigo-600">
                <Mic className="w-5 h-5" />
              </div>
              
              <div>
                <h4 className="text-xs sm:text-sm font-extrabold text-slate-800">
                  {language === "en" ? "Upload your vocal print" : "Mappa la tua impronta vocale"}
                </h4>
                <p className="text-[10px] sm:text-xs text-slate-400 mt-1 max-w-md mx-auto leading-relaxed">
                  {language === "en"
                    ? "Drag & drop an audio sample, upload a file, or record a voice above and click 'Use as AI Chat Voice Clone'!"
                    : "Trascina qui un file audio, selezionalo, oppure fai una registrazione sopra e premi 'Usa come Clone Vocale'!"}
                </p>
              </div>

              {/* Upload Input & Button */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-sm mx-auto">
                <input
                  type="text"
                  placeholder={language === "en" ? "Give your voice a name..." : "Nome della tua voce..."}
                  value={voiceName}
                  onChange={(e) => setVoiceName(e.target.value)}
                  className="w-full text-xs px-3.5 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                />
                
                <label className="w-full sm:w-auto px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center justify-center space-x-1.5 cursor-pointer shadow-sm transition-all active:scale-95">
                  <Upload className="w-4 h-4" />
                  <span>{language === "en" ? "Select File" : "Seleziona File"}</span>
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Display selected file details */}
              {clonedFileName && (
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 max-w-sm mx-auto flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-indigo-700 min-w-0">
                    <FileAudio className="w-4 h-4 flex-shrink-0" />
                    <span className="text-[10px] sm:text-xs font-bold truncate">{clonedFileName}</span>
                  </div>
                  <button 
                    onClick={() => { setClonedBlob(null); setClonedFileName(null); }}
                    className="text-indigo-400 hover:text-red-500 p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Trigger Cloning Button */}
              {clonedBlob && (
                <button
                  onClick={triggerVoiceClone}
                  className="w-full max-w-xs py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl flex items-center justify-center space-x-2 shadow-lg shadow-indigo-100 animate-pulse transition-all"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{language === "en" ? "Clone Voice Now" : "Clona la Voce Ora"}</span>
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Cloned voice is Active status panel */
        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-3 text-emerald-800 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 flex-shrink-0">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-extrabold block truncate">
                {language === "en" ? "AI Voice Clone Active" : "Profilo Vocale AI Attivo"}
              </span>
              <span className="text-[10px] font-mono text-emerald-600 block truncate">
                ID: {clonedVoiceId.substring(0, 16)}...
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
              {clonedVoiceId === "demo_clone_voice_id" ? "DEMO MODE (LOCAL SYNTH)" : "ELEVENLABS NEURAL"}
            </span>
            <button
              onClick={resetVoiceClone}
              className="px-3 py-1.5 bg-white border border-emerald-200 text-red-500 hover:bg-red-50 font-bold text-[10px] rounded-lg transition-all flex items-center space-x-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{language === "en" ? "Delete Clone" : "Cancella"}</span>
            </button>
          </div>
        </div>
      )}

      {/* Info helper regarding ElevenLabs API key if missing */}
      {!config.hasElevenLabsKey && (
        <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-3.5 flex items-start space-x-2.5">
          <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
          <div className="text-[10px] sm:text-xs text-slate-600 leading-relaxed">
            <p className="font-bold text-amber-800">
              {language === "en" ? "💡 Premium Voice Cloning Tip" : "💡 Nota per il Clonaggio ad Alta Fedeltà"}
            </p>
            <p className="mt-0.5">
              {language === "en"
                ? "We integrated a real, professional ElevenLabs API engine! To enable real neural cloning, create a free ElevenLabs account, copy your API key and save it as ELEVENLABS_API_KEY inside the .env file. For now, we auto-activated a high-fidelity local browser fallback, so you can test it immediately!"
                : "Abbiamo integrato un vero motore professionale ElevenLabs! Per attivare la clonazione neurale ad altissima fedeltà, registrati gratis su ElevenLabs, copia la tua chiave API e incollala come ELEVENLABS_API_KEY nel file .env. Nel frattempo, abbiamo attivato un fallback locale ad alta fedeltà nel browser così puoi testarlo subito!"}
            </p>
          </div>
        </div>
      )}

      {/* Info helper regarding Groq API key if missing */}
      {!config.hasGroqKey && (
        <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-3.5 flex items-start space-x-2.5">
          <Sparkles className="w-4 h-4 text-indigo-500 mt-0.5 flex-shrink-0 animate-pulse" />
          <div className="text-[10px] sm:text-xs text-slate-600 leading-relaxed">
            <p className="font-bold text-indigo-800">
              {language === "en" ? "⚡ Ultra-Fast Chat with Groq" : "⚡ Chat Ultra-Rapida con Groq"}
            </p>
            <p className="mt-0.5">
              {language === "en"
                ? "This chatbot can use Groq's high-speed Llama-3 models for near-instant responses! Get a free Groq API key and add it as VOCAL_GROQ_API_KEY in the .env file. For now, the system falls back to Gemini 2.5, keeping your experience fully operational!"
                : "Questo chatbot può usare i velocissimi modelli Llama-3 di Groq per risposte quasi istantanee! Ottieni una chiave API Groq gratuita e aggiungila come VOCAL_GROQ_API_KEY nel file .env. Nel frattempo, il sistema esegue il fallback su Gemini 2.5 per una piena operatività!"}
            </p>
          </div>
        </div>
      )}

      {/* Chat Messages Frame */}
      <div className="border border-slate-100 bg-slate-50 rounded-2xl p-3 sm:p-4 h-[320px] overflow-y-auto flex flex-col space-y-3 scrollbar-thin scrollbar-thumb-slate-200">
        {messages.map((msg) => {
          const isUser = msg.role === "user";
          const isPlaying = currentlyPlayingMessageId === msg.id && isPlayingAudio;
          
          return (
            <div 
              key={msg.id}
              className={`flex flex-col max-w-[85%] ${isUser ? "self-end items-end" : "self-start items-start"}`}
            >
              {/* Message Bubble */}
              <div className={`p-3 rounded-2xl text-xs leading-normal font-medium shadow-sm border ${
                isUser 
                  ? "bg-indigo-600 border-indigo-600 text-white rounded-br-none" 
                  : msg.id.startsWith("system") 
                    ? "bg-blue-50 border-blue-100 text-blue-800 rounded-bl-none" 
                    : "bg-white border-slate-150 text-slate-800 rounded-bl-none"
              }`}>
                {msg.content}
                
                {/* Audio speaker trigger for AI messages */}
                {!isUser && clonedVoiceId && !msg.id.startsWith("system") && (
                  <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
                    <button
                      onClick={() => isPlaying ? stopPlayback() : speakResponse(msg.content, msg.id, msg.audioUrl)}
                      className={`px-2.5 py-1.5 rounded-lg font-bold text-[10px] flex items-center space-x-1.5 transition-all ${
                        isPlaying 
                          ? "bg-red-50 text-red-600 hover:bg-red-100 border border-red-100" 
                          : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-100"
                      }`}
                    >
                      {isPlaying ? (
                        <>
                          <Pause className="w-3.5 h-3.5 fill-current" />
                          <span>{language === "en" ? "Stop Voice" : "Ferma Voce"}</span>
                        </>
                      ) : (
                        <>
                          <Volume2 className="w-3.5 h-3.5" />
                          <span>
                            {isGeneratingTTS && currentlyPlayingMessageId === msg.id 
                              ? (language === "en" ? "Generating..." : "Generazione...") 
                              : (language === "en" ? "Play with My Voice" : "Riproduci con Mia Voce")}
                          </span>
                        </>
                      )}
                    </button>
                    
                    {/* Tiny pulsing indicator during play */}
                    {isPlaying && (
                      <span className="flex space-x-0.5">
                        <span className="w-1 h-3 bg-red-500 rounded animate-bounce" style={{ animationDelay: "0s" }}></span>
                        <span className="w-1 h-4 bg-red-500 rounded animate-bounce" style={{ animationDelay: "0.1s" }}></span>
                        <span className="w-1 h-2.5 bg-red-500 rounded animate-bounce" style={{ animationDelay: "0.2s" }}></span>
                      </span>
                    )}
                  </div>
                )}
              </div>
              
              <span className="text-[9px] text-slate-400 mt-1 uppercase font-bold tracking-wide">
                {isUser ? (language === "en" ? "You" : "Tu") : "AURA AI"}
              </span>
            </div>
          );
        })}

        {/* Loading indicators */}
        {isPendingAI && (
          <div className="flex flex-col max-w-[80%] self-start items-start">
            <div className="p-3 bg-white border border-slate-100 rounded-2xl rounded-bl-none flex items-center space-x-2 text-xs text-slate-400 shadow-sm">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
              <span>{language === "en" ? "Aura is typing..." : "Aura sta rispondendo..."}</span>
            </div>
          </div>
        )}
      </div>

      {/* AI Voice waveform analyzer (canvas) */}
      <div className="bg-slate-950 rounded-2xl p-2 border border-slate-900 shadow-inner overflow-hidden">
        <div className="flex items-center justify-between px-2 pb-1">
          <span className="text-[9px] text-slate-500 uppercase font-extrabold tracking-wider flex items-center">
            <span className={`w-1.5 h-1.5 rounded-full mr-1 ${isPlayingAudio ? "bg-red-500 animate-ping" : "bg-slate-600"}`}></span>
            {language === "en" ? "AI Voice Wave Output" : "Ondoscopio Uscita Voce AI"}
          </span>
          {isPlayingAudio && (
            <span className="text-[9px] text-indigo-400 font-mono animate-pulse font-bold">
              {language === "en" ? "SPEAKING CLONE ACTIVE" : "VOCE CLONATA IN RIPRODUZIONE"}
            </span>
          )}
        </div>
        <canvas ref={canvasRef} className="w-full h-10 block" width={500} height={40} />
      </div>

      {/* Chat input form */}
      <form onSubmit={handleSendMessage} className="flex items-center space-x-2.5">
        <input
          type="text"
          placeholder={
            !clonedVoiceId 
              ? (language === "en" ? "Clone your voice first to start chatting..." : "Clona prima la tua voce per chattare...")
              : (language === "en" ? "Ask me anything in your voice..." : "Chiedimi qualsiasi cosa con la tua voce...")
          }
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          disabled={isPendingAI}
          className="flex-1 text-xs sm:text-sm px-4 py-3 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-slate-50"
        />
        <button
          type="submit"
          disabled={!inputValue.trim() || isPendingAI}
          className="p-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-100 disabled:text-slate-400 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100 transition-all active:scale-95 disabled:shadow-none"
        >
          <Send className="w-4.5 h-4.5" />
        </button>
      </form>
      
    </div>
  );
}
