import { useEffect, useRef, useState } from 'react';
import { MicOff, Sparkles, Activity } from 'lucide-react';
import { Language, VisualizerMode } from '../types';

interface VisualizerProps {
  analyserNode: AnalyserNode | null;
  isEngineRunning: boolean;
  language: Language;
}

export default function Visualizer({ analyserNode, isEngineRunning, language }: VisualizerProps) {
  const [mode, setMode] = useState<VisualizerMode>('waveform');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const animationIdRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high-DPI screens
    const handleResize = () => {
      if (!containerRef.current || !canvasRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      
      canvasRef.current.width = rect.width * dpr;
      canvasRef.current.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    handleResize();

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Visualizer Animation Loop
  useEffect(() => {
    if (!isEngineRunning || !analyserNode) {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
        animationIdRef.current = null;
      }
      
      // Draw idle line on the canvas
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const dpr = window.devicePixelRatio || 1;
          const w = canvas.width / dpr;
          const h = canvas.height / dpr;
          ctx.clearRect(0, 0, w, h);
          ctx.fillStyle = '#0f172a'; // Deep slate blue background
          ctx.fillRect(0, 0, w, h);
          
          // Draw subtle flat line with wave noise
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = 'rgba(79, 70, 229, 0.25)'; // Indigo low opacity
          ctx.beginPath();
          ctx.moveTo(0, h / 2);
          for (let x = 0; x < w; x++) {
            const y = h / 2 + Math.sin(x * 0.05 + Date.now() * 0.003) * 1.5;
            ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      }
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const renderLoop = () => {
      animationIdRef.current = requestAnimationFrame(renderLoop);

      const dpr = window.devicePixelRatio || 1;
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;

      // Semi-transparent background for premium ghost trail effect
      ctx.fillStyle = 'rgba(15, 23, 42, 0.18)'; // Premium slate dark backdrop
      ctx.fillRect(0, 0, w, h);

      // Subtle horizontal gridlines
      ctx.strokeStyle = 'rgba(51, 65, 85, 0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, h * 0.25); ctx.lineTo(w, h * 0.25);
      ctx.moveTo(0, h * 0.5);  ctx.lineTo(w, h * 0.5);
      ctx.moveTo(0, h * 0.75); ctx.lineTo(w, h * 0.75);
      ctx.stroke();

      if (mode === 'waveform') {
        // OSCILLOSCOPE TIME DOMAIN RENDER
        analyserNode.getByteTimeDomainData(dataArray);

        // Render soft backglow wave
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.25)'; // Indigo-500 backglow
        ctx.beginPath();
        let sliceWidth = w / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0;
          const y = (v * h) / 2;
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
          x += sliceWidth;
        }
        ctx.stroke();

        // Render crisp foreground sharp wave
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#6366f1'; // Indigo-500
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#6366f1';
        ctx.beginPath();
        x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0;
          const y = (v * h) / 2;
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
          x += sliceWidth;
        }
        ctx.stroke();
        
        // Reset shadow for next drawings
        ctx.shadowBlur = 0;

      } else {
        // FREQUENCY DOMAIN SPECTRUM RENDER
        analyserNode.getByteFrequencyData(dataArray);

        const barWidth = (w / (bufferLength * 0.6)) * 2.0;
        let x = 0;

        for (let i = 0; i < bufferLength * 0.65; i++) {
          // Boost higher frequencies visual scale slightly for aesthetics
          const boost = i > bufferLength * 0.25 ? 1.3 : 1.0;
          const barHeight = (dataArray[i] / 255.0) * h * 0.85 * boost;

          if (barHeight > 1) {
            // Draw gradient filled capsule-like bars
            const gradient = ctx.createLinearGradient(x, h, x, h - barHeight);
            gradient.addColorStop(0, '#3b82f6'); // Blue-500 bottom
            gradient.addColorStop(0.5, '#6366f1'); // Indigo-500 middle
            gradient.addColorStop(1, '#a855f7'); // Purple-500 top

            ctx.fillStyle = gradient;
            
            // Draw slightly rounded bar top
            ctx.beginPath();
            ctx.roundRect(x, h - barHeight, barWidth - 1, barHeight, [2, 2, 0, 0]);
            ctx.fill();
          }

          x += barWidth;
        }
      }
    };

    renderLoop();

    return () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
    };
  }, [isEngineRunning, analyserNode, mode]);

  return (
    <div className="bg-white border border-slate-100 rounded-3xl p-4 sm:p-5 shadow-xl shadow-slate-100/50 flex flex-col">
      {/* Header section with toggle */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-xs sm:text-sm font-bold text-slate-800 tracking-wide uppercase flex items-center">
            <Activity className="w-4 h-4 mr-1.5 text-indigo-600 animate-pulse" />
            {language === 'en' ? 'Vocal Wave & Spectrum' : 'Ondoscopio e Spettro'}
          </h3>
          <p className="text-[10px] sm:text-xs text-slate-400">
            {language === 'en' ? 'Real-time audio signal diagnostic' : 'Diagnostica del segnale in tempo reale'}
          </p>
        </div>

        {/* Visualizer Mode Toggle Buttons */}
        <div className="flex bg-slate-50 p-0.5 rounded-xl border border-slate-100">
          <button
            onClick={() => setMode('waveform')}
            className={`px-3 py-1 text-[10px] sm:text-xs rounded-lg font-bold transition-all ${
              mode === 'waveform'
                ? 'bg-white text-indigo-600 border border-slate-200/50 shadow-sm'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            {language === 'en' ? 'Wave' : 'Onda'}
          </button>
          <button
            onClick={() => setMode('frequency')}
            className={`px-3 py-1 text-[10px] sm:text-xs rounded-lg font-bold transition-all ${
              mode === 'frequency'
                ? 'bg-white text-indigo-600 border border-slate-200/50 shadow-sm'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            {language === 'en' ? 'Spectrum' : 'Spettro'}
          </button>
        </div>
      </div>

      {/* Visualizer Frame */}
      <div 
        ref={containerRef}
        className="relative w-full aspect-video bg-slate-950 rounded-2xl overflow-hidden border border-slate-900 shadow-[0_8px_30px_rgba(0,0,0,0.15)]"
      >
        <canvas ref={canvasRef} className="w-full h-full block" />
        
        {/* Waiting / Inactive Overlay */}
        {!isEngineRunning && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 text-slate-500 transition-all duration-300 pointer-events-none p-4 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-850 flex items-center justify-center mb-2.5 animate-bounce">
              <MicOff className="w-5 h-5 text-slate-400" />
            </div>
            <span className="text-xs font-semibold text-slate-300 tracking-wide uppercase flex items-center">
              <Sparkles className="w-3.5 h-3.5 mr-1 text-indigo-400 animate-spin" />
              {language === 'en' ? 'Aura Synthesizer Offline' : 'Aura Modulatore Spento'}
            </span>
            <p className="text-[10px] sm:text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">
              {language === 'en' 
                ? 'Tap "Start Modulator" to stream voice through the custom physical modeling chain.'
                : 'Avvia il modulatore per visualizzare le armoniche vocali in tempo reale.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
