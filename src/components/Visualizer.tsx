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
          ctx.fillStyle = '#000000'; // Pure black background
          ctx.fillRect(0, 0, w, h);
          
          // Draw subtle flat line with wave noise
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = 'rgba(255, 77, 0, 0.25)'; // Industrial Orange low opacity
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

      // Semi-transparent background for trails
      ctx.fillStyle = 'rgba(0, 0, 0, 0.22)'; // Pure black trail backdrop
      ctx.fillRect(0, 0, w, h);

      // Subtle horizontal gridlines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, h * 0.25); ctx.lineTo(w, h * 0.25);
      ctx.moveTo(0, h * 0.5);  ctx.lineTo(w, h * 0.5);
      ctx.moveTo(0, h * 0.75); ctx.lineTo(w, h * 0.75);
      ctx.stroke();

      if (mode === 'waveform') {
        analyserNode.getByteTimeDomainData(dataArray);

        // Render soft backglow wave
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(255, 77, 0, 0.3)'; // Orange backglow
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
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#ff4d00'; // Solid Industrial Orange
        ctx.shadowBlur = 6;
        ctx.shadowColor = '#ff4d00';
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
        
        ctx.shadowBlur = 0;

      } else {
        analyserNode.getByteFrequencyData(dataArray);

        const barWidth = (w / (bufferLength * 0.6)) * 2.0;
        let x = 0;

        for (let i = 0; i < bufferLength * 0.65; i++) {
          const boost = i > bufferLength * 0.25 ? 1.25 : 1.0;
          const barHeight = (dataArray[i] / 255.0) * h * 0.85 * boost;

          if (barHeight > 1) {
            const gradient = ctx.createLinearGradient(x, h, x, h - barHeight);
            gradient.addColorStop(0, '#ff4d00'); // Orange bottom
            gradient.addColorStop(1, '#ffffff'); // White top

            ctx.fillStyle = gradient;
            
            ctx.beginPath();
            ctx.rect(x, h - barHeight, barWidth - 1, barHeight);
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
    <div className="bg-white border-2 border-black p-4.5 flex flex-col relative neo-shadow">
      {/* Header section with toggle */}
      <div className="flex items-center justify-between mb-4.5 border-b-2 border-black pb-3">
        <div>
          <h3 className="font-display text-sm font-bold text-black uppercase flex items-center tracking-tight">
            <Activity className="w-4.5 h-4.5 mr-1.5 text-industrial-orange" />
            {language === 'en' ? 'Vocal Wave Diagnostic' : 'Diagnostica Segnale'}
          </h3>
          <span className="font-mono text-[9px] text-black/50 uppercase tracking-wider block mt-0.5">
            {language === 'en' ? 'Signal response oscilloscope' : 'Analizzatore frequenza e forma d\'onda'}
          </span>
        </div>

        {/* Visualizer Mode Toggle Buttons */}
        <div className="flex border-2 border-black bg-white p-0.5 font-mono text-[10px]">
          <button
            onClick={() => setMode('waveform')}
            className={`px-3 py-1 font-bold uppercase transition-all ${
              mode === 'waveform'
                ? 'bg-black text-white'
                : 'text-black hover:bg-industrial-bg'
            }`}
          >
            {language === 'en' ? 'Wave' : 'Onda'}
          </button>
          <button
            onClick={() => setMode('frequency')}
            className={`px-3 py-1 font-bold uppercase transition-all ${
              mode === 'frequency'
                ? 'bg-black text-white'
                : 'text-black hover:bg-industrial-bg'
            }`}
          >
            {language === 'en' ? 'Spectrum' : 'Spettro'}
          </button>
        </div>
      </div>

      {/* Visualizer Frame */}
      <div 
        ref={containerRef}
        className="relative w-full aspect-[21/9] sm:aspect-video bg-black overflow-hidden border-2 border-black"
      >
        <canvas ref={canvasRef} className="w-full h-full block" />
        
        {/* Waiting / Inactive Overlay */}
        {!isEngineRunning && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/95 text-white/50 pointer-events-none p-4 text-center select-none">
            <div className="w-11 h-11 border-2 border-dashed border-white/20 flex items-center justify-center mb-3">
              <MicOff className="w-4.5 h-4.5 text-white/40" />
            </div>
            <span className="font-mono text-[10px] font-bold text-industrial-orange tracking-widest uppercase flex items-center">
              SYSTEM_OFFLINE
            </span>
            <p className="font-sans text-[10px] text-white/40 mt-1 max-w-xs leading-relaxed">
              {language === 'en' 
                ? 'Initialize system to visualize biological wave harmonics'
                : 'Avvia il modulatore per visualizzare le armoniche vocali'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
