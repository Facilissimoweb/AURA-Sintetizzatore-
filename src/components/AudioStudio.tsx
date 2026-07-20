import React, { useState, useRef, useEffect } from 'react';
import { 
  Music, 
  Trash2, 
  Play, 
  Pause, 
  Volume2, 
  Settings, 
  Save, 
  Plus, 
  Activity, 
  Sliders, 
  ChevronRight, 
  Download, 
  FileAudio,
  FolderHeart,
  Wand2,
  Clock,
  VolumeX,
  Gauge,
  Archive
} from 'lucide-react';
import { Language } from '../types';
import { SavedFileRecord } from '../lib/db';
import JSZip from 'jszip';

interface AudioStudioProps {
  language: Language;
  savedFiles: (SavedFileRecord & { url: string })[];
  serverFolders: { name: string; files: any[] }[];
  onSaveFile: (blob: Blob, name: string, source: 'modulator' | 'chat_tts' | 'user_upload') => Promise<void>;
  triggerToast: (msg: string, type?: 'success' | 'error') => void;
}

interface StudioTrack {
  id: string;
  name: string;
  blob: Blob;
  url: string;
  volume: number;       // 0 to 2
  speed: number;        // 0.5 to 2
  delay: number;        // Delay in seconds before playback starts
  duration: number;     // Loaded duration in seconds
  trimStart: number;    // Start crop point in seconds
  trimEnd: number;      // End crop point in seconds
}

interface SourceFile {
  name: string;
  blob?: Blob;
  url: string;
  sourceName: string;
  size?: number;
}

export default function AudioStudio({
  language,
  savedFiles,
  serverFolders,
  onSaveFile,
  triggerToast
}: AudioStudioProps) {
  const [tracks, setTracks] = useState<StudioTrack[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [exportName, setExportName] = useState('Aura_Super_Mix');
  const [isExporting, setIsExporting] = useState(false);
  const [previewDuration, setPreviewDuration] = useState(0);

  // ZIP batch download states
  const [selectedFileNamesForZip, setSelectedFileNamesForZip] = useState<string[]>([]);
  const [zipName, setZipName] = useState('Aura_Archive');
  const [isZipExporting, setIsZipExporting] = useState(false);

  const activeAudioNodesRef = useRef<{ source: AudioBufferSourceNode; gain: GainNode }[]>([]);
  const previewContextRef = useRef<AudioContext | null>(null);
  const playStartTimeRef = useRef<number>(0);
  const playbackTimerRef = useRef<any>(null);

  // Stop active real-time preview playback
  const stopAllPreview = () => {
    if (playbackTimerRef.current) {
      clearTimeout(playbackTimerRef.current);
      playbackTimerRef.current = null;
    }
    activeAudioNodesRef.current.forEach(({ source }) => {
      try {
        source.stop();
      } catch (e) {
        // Source might have already ended
      }
    });
    activeAudioNodesRef.current = [];
    setIsPlaying(false);
  };

  useEffect(() => {
    return () => {
      stopAllPreview();
    };
  }, []);

  // Calculate overall mix timeline length
  useEffect(() => {
    let maxLen = 0;
    tracks.forEach(track => {
      const activeDur = Math.max(0, track.trimEnd - track.trimStart) / track.speed;
      const endPt = track.delay + activeDur;
      if (endPt > maxLen) {
        maxLen = endPt;
      }
    });
    setPreviewDuration(parseFloat(maxLen.toFixed(2)));
  }, [tracks]);

  // Decode audio Blob to Web Audio Buffer
  const decodeBlobToBuffer = async (ctx: AudioContext, blob: Blob): Promise<AudioBuffer> => {
    const arrayBuffer = await blob.arrayBuffer();
    return new Promise((resolve, reject) => {
      ctx.decodeAudioData(arrayBuffer, (decoded) => {
        resolve(decoded);
      }, (err) => {
        reject(err);
      });
    });
  };

  // Play preview of the layered mixer tracks simultaneously
  const playMixPreview = async () => {
    stopAllPreview();

    if (tracks.length === 0) {
      triggerToast(
        language === 'en' ? 'Add some audio tracks first!' : 'Aggiungi prima delle tracce audio!',
        'error'
      );
      return;
    }

    try {
      // Use or create audio context
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtxClass();
      previewContextRef.current = ctx;

      setIsPlaying(true);
      playStartTimeRef.current = ctx.currentTime;

      const nodesList: { source: AudioBufferSourceNode; gain: GainNode }[] = [];

      for (const track of tracks) {
        // Decode
        const buffer = await decodeBlobToBuffer(ctx, track.blob);

        const sourceNode = ctx.createBufferSource();
        sourceNode.buffer = buffer;
        sourceNode.playbackRate.value = track.speed;

        const gainNode = ctx.createGain();
        gainNode.gain.setValueAtTime(track.volume, ctx.currentTime);

        // Connect nodes: source -> gain -> master speaker
        sourceNode.connect(gainNode);
        gainNode.connect(ctx.destination);

        // Crop/Trim calculations
        const sampleRate = buffer.sampleRate;
        const startOffset = track.trimStart; 
        const durationToPlay = Math.max(0, track.trimEnd - track.trimStart);

        // Schedule playback at: currentTime + track.delay
        sourceNode.start(ctx.currentTime + track.delay, startOffset, durationToPlay);
        
        nodesList.push({ source: sourceNode, gain: gainNode });
      }

      activeAudioNodesRef.current = nodesList;

      // Automatically end visual state when the longest track finishes
      const maxTrackDuration = Math.max(...tracks.map(t => t.delay + (Math.max(0, t.trimEnd - t.trimStart) / t.speed)));
      playbackTimerRef.current = setTimeout(() => {
        setIsPlaying(false);
      }, maxTrackDuration * 1000);

    } catch (err) {
      console.error('Playback error:', err);
      setIsPlaying(false);
      triggerToast(
        language === 'en' ? 'Playback rendering failed.' : 'Riproduzione multitraccia fallita.',
        'error'
      );
    }
  };

  // Helper to resolve either a memory Blob or server URL file into a Blob
  const getBlobFromSourceFile = async (src: SourceFile): Promise<Blob> => {
    if (src.blob) {
      return src.blob;
    }
    const response = await fetch(src.url);
    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${src.url}`);
    }
    return await response.blob();
  };

  // Save/Add selected files to the mixer timeline
  const addTrackToTimeline = async (src: SourceFile) => {
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtxClass();
      
      const blob = await getBlobFromSourceFile(src);
      const buffer = await decodeBlobToBuffer(ctx, blob);
      const duration = buffer.duration;
      ctx.close();

      const newTrack: StudioTrack = {
        id: `track-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        name: src.name.split('/').pop()?.replace(/\.[^/.]+$/, "") || src.name.replace(/\.[^/.]+$/, ""), // remove extension & folder for visual cleanliness
        blob,
        url: URL.createObjectURL(blob),
        volume: 1.0,
        speed: 1.0,
        delay: 0.0,
        duration,
        trimStart: 0,
        trimEnd: duration
      };

      setTracks((prev) => [...prev, newTrack]);
      triggerToast(
        language === 'en'
          ? `Added "${src.name.split('/').pop() || src.name}" to Audio Studio timeline!`
          : `Traccia "${src.name.split('/').pop() || src.name}" aggiunta all'editor!`
      );
    } catch (err) {
      console.error('Error adding track:', err);
      triggerToast(
        language === 'en' ? 'Failed to parse audio file.' : 'Errore nel caricamento del file.',
        'error'
      );
    }
  };

  // Toggle a file selection for the batch ZIP download
  const toggleFileForZip = (fileName: string) => {
    setSelectedFileNamesForZip((prev) => {
      if (prev.includes(fileName)) {
        return prev.filter((name) => name !== fileName);
      } else {
        return [...prev, fileName];
      }
    });
  };

  // Batch download selected files as a ZIP archive
  const handleDownloadZip = async () => {
    if (selectedFileNamesForZip.length === 0) {
      triggerToast(
        language === 'en' ? 'Please select at least one file to export.' : 'Seleziona almeno un file da esportare.',
        'error'
      );
      return;
    }

    setIsZipExporting(true);
    triggerToast(
      language === 'en' ? 'Compiling ZIP archive...' : 'Compilazione dell\'archivio ZIP...'
    );

    try {
      const zip = new JSZip();
      
      for (const name of selectedFileNamesForZip) {
        const src = availableSourceFiles.find(f => f.name === name);
        if (src) {
          const blob = await getBlobFromSourceFile(src);
          // Keep the flat filename, replacing any path slashes with underscores to avoid folder issues in ZIP
          const zipFileName = src.name.replace(/\//g, '_');
          zip.file(zipFileName, blob);
        }
      }

      const zipContent = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipContent);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${zipName.trim().replace(/[^a-zA-Z0-9_\-]/g, "_") || 'Aura_Archive'}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      triggerToast(
        language === 'en' ? 'ZIP archive downloaded successfully!' : 'Archivio ZIP scaricato con successo!'
      );
    } catch (err) {
      console.error('Error generating ZIP:', err);
      triggerToast(
        language === 'en' ? 'Failed to generate ZIP archive.' : 'Generazione dell\'archivio ZIP fallita.',
        'error'
      );
    } finally {
      setIsZipExporting(false);
    }
  };

  const removeTrack = (id: string) => {
    setTracks((prev) => {
      const file = prev.find(t => t.id === id);
      if (file) URL.revokeObjectURL(file.url);
      return prev.filter((t) => t.id !== id);
    });
  };

  const updateTrackParam = (id: string, param: keyof StudioTrack, value: number) => {
    setTracks((prev) =>
      prev.map((track) => {
        if (track.id === id) {
          const updated = { ...track, [param]: value };
          // Ensure trim limits are logically sound
          if (param === 'trimStart' && value >= track.trimEnd) {
            updated.trimStart = track.trimEnd - 0.05;
          }
          if (param === 'trimEnd' && value <= track.trimStart) {
            updated.trimEnd = track.trimStart + 0.05;
          }
          return updated;
        }
        return track;
      })
    );
  };

  // Convert rendered AudioBuffer into a CD-Quality WAV format Blob
  const bufferToWav = (buffer: AudioBuffer): Blob => {
    const numOfChan = buffer.numberOfChannels;
    const length = buffer.length * numOfChan * 2 + 44;
    const bufferArr = new ArrayBuffer(length);
    const view = new DataView(bufferArr);
    const channels: Float32Array[] = [];
    let i;
    let sample;
    let offset = 0;
    let pos = 0;

    const setUint16 = (data: number) => {
      view.setUint16(pos, data, true);
      pos += 2;
    };

    const setUint32 = (data: number) => {
      view.setUint32(pos, data, true);
      pos += 4;
    };

    // write WAVE header
    setUint32(0x46464952); // "RIFF"
    setUint32(length - 8); // file length - 8
    setUint32(0x45564157); // "WAVE"
    setUint32(0x20746d66); // "fmt " chunk
    setUint32(16); // chunk length
    setUint16(1); // sample format (raw PCM)
    setUint16(numOfChan);
    setUint32(buffer.sampleRate);
    setUint32(buffer.sampleRate * 2 * numOfChan); // byte rate
    setUint16(numOfChan * 2); // block align
    setUint16(16); // bits per sample
    setUint32(0x61746164); // "data" chunk
    setUint32(length - pos - 4);

    // write interleaved data
    for (i = 0; i < buffer.numberOfChannels; i++) {
      channels.push(buffer.getChannelData(i));
    }

    while (pos < length) {
      for (i = 0; i < numOfChan; i++) {
        sample = Math.max(-1, Math.min(1, channels[i][offset] || 0)); // clamp safely
        sample = sample < 0 ? sample * 0x8000 : sample * 0x7fff; // convert to 16-bit
        view.setInt16(pos, sample, true);
        pos += 2;
      }
      offset++;
    }

    return new Blob([bufferArr], { type: 'audio/wav' });
  };

  // Synchronous Rendering (Bounce) via OfflineAudioContext
  const renderAndSaveMix = async () => {
    if (tracks.length === 0) return;

    setIsExporting(true);
    stopAllPreview();

    try {
      // Find overall max time
      let maxDuration = 0.5;
      tracks.forEach(t => {
        const activeDur = Math.max(0, t.trimEnd - t.trimStart) / t.speed;
        const endPt = t.delay + activeDur;
        if (endPt > maxDuration) {
          maxDuration = endPt;
        }
      });

      const sampleRate = 44100;
      const totalFrames = Math.ceil(maxDuration * sampleRate);

      // Create OfflineAudioContext (Stereo, 44100Hz)
      const OfflineCtxClass = window.OfflineAudioContext || (window as any).webkitOfflineAudioContext;
      const offlineCtx = new OfflineCtxClass(2, totalFrames, sampleRate);

      // Prepare nodes on Offline Canvas
      for (const track of tracks) {
        // Decode
        const buffer = await decodeBlobToBuffer(offlineCtx as any, track.blob);

        const sourceNode = offlineCtx.createBufferSource();
        sourceNode.buffer = buffer;
        sourceNode.playbackRate.value = track.speed;

        const gainNode = offlineCtx.createGain();
        gainNode.gain.setValueAtTime(track.volume, 0);

        sourceNode.connect(gainNode);
        gainNode.connect(offlineCtx.destination);

        const startOffset = track.trimStart;
        const durationToPlay = Math.max(0, track.trimEnd - track.trimStart);

        // Schedule on physical offset line
        sourceNode.start(track.delay, startOffset, durationToPlay);
      }

      // Render mixdown synchronously
      const renderedBuffer = await offlineCtx.startRendering();
      
      // Encode to WAV Blob
      const wavBlob = bufferToWav(renderedBuffer);
      const nameWithExt = `${exportName.trim().replace(/[^a-zA-Z0-9_\-]/g, "_") || 'AuraMix'}_${Date.now().toString().slice(-4)}.wav`;

      // Save using core file save pipeline
      await onSaveFile(wavBlob, nameWithExt, 'user_upload');
      
      triggerToast(
        language === 'en'
          ? `Mix exported and saved as "${nameWithExt}"!`
          : `Mix esportato e salvato come "${nameWithExt}"!`
      );
      
    } catch (err: any) {
      console.error('Mixdown error:', err);
      triggerToast(
        language === 'en' ? 'Mixdown rendering failed.' : 'Errore durante la compilazione del mix.',
        'error'
      );
    } finally {
      setIsExporting(false);
    }
  };

  // Compile all files from local and server for addition & batch ZIP export
  const availableSourceFiles: SourceFile[] = [];
  savedFiles.forEach(f => {
    availableSourceFiles.push({ 
      name: f.name, 
      blob: f.blob, 
      url: f.url, 
      sourceName: language === 'en' ? 'Local Vault' : 'Cassaforte',
      size: f.size
    });
  });

  serverFolders.forEach(folder => {
    folder.files.forEach(f => {
      availableSourceFiles.push({
        name: `${folder.name}/${f.name}`,
        url: f.url,
        sourceName: `Server/${folder.name}`,
        size: f.size
      });
    });
  });

  return (
    <div id="section-studio" className="bg-white border-2 border-black p-4.5 sm:p-5 flex flex-col space-y-4 relative neo-shadow">
      
      {/* Studio Header */}
      <div className="flex items-center justify-between border-b-2 border-black pb-3">
        <div>
          <h3 className="font-display text-sm font-bold text-black uppercase flex items-center tracking-tight">
            <Music className="w-4.5 h-4.5 mr-1.5 text-industrial-orange animate-bounce" />
            {language === 'en' ? 'Aura Montage Studio' : 'Aura Studio di Montaggio'}
          </h3>
          <span className="font-mono text-[9px] text-black/50 uppercase tracking-wider block mt-0.5">
            {language === 'en' ? 'Mix, Layer, Trim, and Alter intensities of produced clips' : 'Unisci, sovrapponi, taglia e regola l\'intensità delle clip prodotte'}
          </span>
        </div>
        <div className="font-mono text-[9px] bg-black text-white px-2 py-0.5 uppercase">
          {language === 'en' ? 'Multi-track Engine' : 'Motore Multitraccia'}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* Left column: Add Track Panel (Sources drawer) */}
        <div className="lg:col-span-4 border-2 border-black p-3 bg-neutral-50 flex flex-col space-y-3">
          <div className="border-b border-black/15 pb-1 flex justify-between items-center">
            <span className="font-mono text-[10px] font-bold text-black uppercase block">
              {language === 'en' ? '1. SELECT SOURCE CLIP' : '1. SELEZIONA CLIP DI ORIGINE'}
            </span>
            <span className="font-mono text-[8px] bg-black text-white px-1 font-bold">
              {availableSourceFiles.length} {language === 'en' ? 'TOTAL' : 'TOTALE'}
            </span>
          </div>

          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin">
            {availableSourceFiles.length === 0 ? (
              <div className="p-4.5 text-center bg-white border border-black/10 text-black/45">
                <FileAudio className="w-7 h-7 mx-auto text-black/30 mb-1" />
                <span className="font-mono text-[9px] uppercase font-bold block">
                  {language === 'en' ? 'No Clips Available' : 'Nessun file disponibile'}
                </span>
                <span className="font-sans text-[9px] block leading-tight mt-0.5">
                  {language === 'en' 
                    ? 'Produce modulated recordings or voice clone messages first.' 
                    : 'Registra prima delle voci o ricevi risposte dal clone vocale.'}
                </span>
              </div>
            ) : (
              availableSourceFiles.map((src, idx) => (
                <div 
                  key={`${src.name}-${idx}`} 
                  className="p-2 bg-white border border-black flex items-center justify-between hover:bg-white/90 group"
                >
                  <div className="flex items-center space-x-2 min-w-0 flex-1 pr-1.5">
                    <input
                      type="checkbox"
                      checked={selectedFileNamesForZip.includes(src.name)}
                      onChange={() => toggleFileForZip(src.name)}
                      className="w-3.5 h-3.5 border-2 border-black accent-black cursor-pointer flex-shrink-0"
                      title={language === 'en' ? 'Select for ZIP Batch Export' : 'Seleziona per esportazione ZIP'}
                    />
                    <div className="min-w-0 flex-1">
                      <span className="font-mono text-[10px] font-bold uppercase text-black block truncate" title={src.name}>
                        {src.name.split('/').pop() || src.name}
                      </span>
                      <span className="font-mono text-[7.5px] uppercase font-bold text-industrial-orange block truncate">
                        {src.sourceName} {src.size ? `• ${(src.size / 1024).toFixed(1)} KB` : ''}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => addTrackToTimeline(src)}
                    className="p-1 border border-black bg-black text-white hover:bg-industrial-orange hover:text-black font-mono text-[9px] font-bold uppercase flex items-center gap-0.5 transition-all flex-shrink-0"
                  >
                    <Plus className="w-3 h-3" />
                    <span>{language === 'en' ? 'ADD' : 'AGGIUNGI'}</span>
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Batch ZIP Export panel */}
          <div className="mt-2 border-t border-black pt-3 flex flex-col space-y-2">
            <div className="flex items-center space-x-1.5">
              <Archive className="w-3.5 h-3.5 text-industrial-orange" />
              <span className="font-mono text-[10px] font-bold text-black uppercase block">
                {language === 'en' ? 'BATCH ZIP EXPORT' : 'ESPORTAZIONE DI GRUPPO (ZIP)'}
              </span>
            </div>
            
            {selectedFileNamesForZip.length > 0 ? (
              <div className="space-y-2 bg-neutral-100 p-2 border border-black">
                <div className="flex justify-between items-center text-[9px] font-mono">
                  <span className="font-bold text-black/60">
                    {language === 'en' ? 'SELECTED CLIPS:' : 'CLIP SELEZIONATE:'}
                  </span>
                  <span className="font-bold text-industrial-orange bg-white px-1.5 border border-black">
                    {selectedFileNamesForZip.length}
                  </span>
                </div>
                
                {/* Selected tags */}
                <div className="flex flex-wrap gap-1 max-h-[70px] overflow-y-auto pr-0.5 py-1">
                  {selectedFileNamesForZip.map(name => (
                    <span key={name} className="inline-flex items-center font-mono text-[7.5px] bg-white border border-black px-1.5 py-0.5">
                      <span className="truncate max-w-[120px]">{name.split('/').pop() || name}</span>
                      <button 
                        onClick={() => toggleFileForZip(name)}
                        className="ml-1 text-black hover:text-red-600 font-extrabold focus:outline-none"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>

                {/* ZIP name input and Export Button */}
                <div className="space-y-2 pt-1 border-t border-black/10">
                  <div className="flex border border-black bg-white overflow-hidden">
                    <span className="bg-neutral-50 px-2 py-1 text-[8px] font-mono font-bold text-black/55 uppercase border-r border-black flex items-center">
                      {language === 'en' ? 'ZIP_NAME' : 'NOME_ZIP'}
                    </span>
                    <input
                      type="text"
                      value={zipName}
                      onChange={(e) => setZipName(e.target.value)}
                      placeholder="Aura_Clips"
                      className="flex-1 text-[9px] font-mono uppercase bg-white px-1.5 focus:outline-none"
                    />
                  </div>

                  <div className="flex gap-1.5">
                    <button
                      onClick={handleDownloadZip}
                      disabled={isZipExporting}
                      className="flex-1 py-1.5 px-2 border border-black bg-black text-white hover:bg-industrial-orange hover:text-black disabled:bg-neutral-300 disabled:text-black/55 font-mono text-[9px] font-bold uppercase flex items-center justify-center gap-1 active:translate-y-[0.5px] transition-all cursor-pointer"
                    >
                      <Download className="w-3 h-3" />
                      <span>
                        {isZipExporting 
                          ? (language === 'en' ? 'CREATING...' : 'CREAZIONE...') 
                          : (language === 'en' ? 'DOWNLOAD ZIP' : 'SCARICA ZIP')}
                      </span>
                    </button>
                    
                    <button
                      onClick={() => setSelectedFileNamesForZip([])}
                      className="py-1.5 px-2 border border-black bg-white hover:bg-neutral-200 text-black font-mono text-[9px] font-bold uppercase flex items-center justify-center active:translate-y-[0.5px] transition-all cursor-pointer"
                      title={language === 'en' ? 'Clear Selection' : 'Cancella Selezione'}
                    >
                      {language === 'en' ? 'CLEAR' : 'RESET'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-2.5 text-center border border-dashed border-black/25 bg-white">
                <span className="font-mono text-[8px] text-black/40 uppercase block">
                  {language === 'en' ? 'No items selected for batch download' : 'Nessun elemento selezionato per il download'}
                </span>
                <span className="font-sans text-[8.5px] text-black/50 block mt-1 leading-normal">
                  {language === 'en' 
                    ? 'Check the box next to any clip in the list above to start compiling a ZIP file.' 
                    : 'Spunta la casella accanto a qualsiasi clip nella lista sopra per comporre un file ZIP.'}
                </span>
              </div>
            )}
          </div>

          <div className="bg-[#fcf8f2] border border-black p-2.5">
            <p className="font-sans text-[9px] text-black/60 leading-normal">
              {language === 'en'
                ? 'Tip: You can load multiple copies of the same clip to repeat it or create eco effects by offsetting delays!'
                : 'Suggerimento: Puoi caricare più volte la stessa clip per ripeterla o creare effetti d’eco distanziando i ritardi!'}
            </p>
          </div>
        </div>

        {/* Right column: Assembly Workspace and Mix Controls */}
        <div className="lg:col-span-8 flex flex-col space-y-3.5">
          
          {/* Active timeline tracks */}
          <div className="border-2 border-black p-3 bg-white space-y-3 flex-1">
            <div className="flex items-center justify-between border-b border-black/10 pb-1.5">
              <span className="font-mono text-[10px] font-bold text-black uppercase">
                {language === 'en' ? '2. MONTAGE WORKSPACE (TIMELINE)' : '2. WORKSPACE DI MONTAGGIO (TIMELINE)'}
              </span>
              <span className="font-mono text-[9px] font-extrabold text-industrial-orange">
                {language === 'en' ? `DURATION: ${previewDuration}s` : `DURATA: ${previewDuration}s`}
              </span>
            </div>

            {tracks.length === 0 ? (
              <div className="p-8 text-center text-black/45">
                <Sliders className="w-10 h-10 mx-auto mb-2 text-black/25" />
                <p className="font-mono text-[10px] uppercase font-bold">
                  {language === 'en' ? 'Timeline is Empty' : 'La timeline è vuota'}
                </p>
                <p className="font-sans text-[9px] max-w-[250px] mx-auto mt-0.5">
                  {language === 'en'
                    ? 'Click "ADD" on any clip in the left drawer to start building your mix!'
                    : 'Clicca su "AGGIUNGI" su una clip a sinistra per comporre la tua sequenza!'}
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1 scrollbar-thin">
                {tracks.map((track, idx) => (
                  <div key={track.id} className="p-3 border border-black bg-neutral-50 relative flex flex-col space-y-2.5">
                    
                    {/* Track info & Delete */}
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1 pr-2">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-mono text-[8px] bg-black text-white px-1 font-bold">
                            #{idx + 1}
                          </span>
                          <span className="font-mono text-[10px] font-bold uppercase truncate text-black block max-w-full">
                            {track.name}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => removeTrack(track.id)}
                        className="text-black/35 hover:text-red-600 p-0.5"
                        title={language === 'en' ? 'Remove Track' : 'Rimuovi Traccia'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Track Sliders Settings */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-black/5">
                      
                      {/* Left: Volume & Speed (Intensità & Velocità) */}
                      <div className="space-y-2">
                        {/* 1. Volume Slider */}
                        <div className="space-y-0.5">
                          <div className="flex justify-between text-[8px] font-mono font-bold text-black/55 uppercase">
                            <span className="flex items-center gap-0.5"><Volume2 className="w-2.5 h-2.5 text-industrial-orange" /> {language === 'en' ? 'VOLUME / GAIN' : 'VOLUME / INTENSITÀ'}</span>
                            <span>{track.volume.toFixed(1)}x</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="2"
                            step="0.1"
                            value={track.volume}
                            onChange={(e) => updateTrackParam(track.id, 'volume', parseFloat(e.target.value))}
                            className="brutalist-range w-full h-1"
                          />
                        </div>

                        {/* 2. Speed Slider */}
                        <div className="space-y-0.5">
                          <div className="flex justify-between text-[8px] font-mono font-bold text-black/55 uppercase">
                            <span className="flex items-center gap-0.5"><Gauge className="w-2.5 h-2.5" /> {language === 'en' ? 'SPEED RATE' : 'VELOCITÀ DI RIPRODUZIONE'}</span>
                            <span>{track.speed.toFixed(2)}x</span>
                          </div>
                          <input
                            type="range"
                            min="0.5"
                            max="2"
                            step="0.05"
                            value={track.speed}
                            onChange={(e) => updateTrackParam(track.id, 'speed', parseFloat(e.target.value))}
                            className="brutalist-range w-full h-1"
                          />
                        </div>
                      </div>

                      {/* Right: Delay & Trim Crop (Ritardo & Ritaglio) */}
                      <div className="space-y-2">
                        {/* 3. Delay Timeline Start Offset */}
                        <div className="space-y-0.5">
                          <div className="flex justify-between text-[8px] font-mono font-bold text-black/55 uppercase">
                            <span className="flex items-center gap-0.5"><Clock className="w-2.5 h-2.5 text-indigo-500" /> {language === 'en' ? 'START DELAY (TIME)' : 'RITARDO INIZIO (TEMPO)'}</span>
                            <span>{track.delay.toFixed(1)}s</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="30"
                            step="0.2"
                            value={track.delay}
                            onChange={(e) => updateTrackParam(track.id, 'delay', parseFloat(e.target.value))}
                            className="brutalist-range w-full h-1"
                          />
                        </div>

                        {/* 4. Trim Crop Ranges */}
                        <div className="space-y-0.5">
                          <div className="flex justify-between text-[8px] font-mono font-bold text-black/55 uppercase">
                            <span>{language === 'en' ? 'CROP (TRIM RANGE)' : 'RITAGLIO (DA/A)'}</span>
                            <span>{track.trimStart.toFixed(1)}s - {track.trimEnd.toFixed(1)}s</span>
                          </div>
                          <div className="flex items-center gap-1.5 pt-0.5">
                            <div className="flex-1">
                              <input
                                type="range"
                                min="0"
                                max={track.duration}
                                step="0.1"
                                value={track.trimStart}
                                onChange={(e) => updateTrackParam(track.id, 'trimStart', parseFloat(e.target.value))}
                                className="brutalist-range w-full h-1"
                              />
                            </div>
                            <span className="text-[7px] font-mono font-bold text-black/40">TO</span>
                            <div className="flex-1">
                              <input
                                type="range"
                                min="0"
                                max={track.duration}
                                step="0.1"
                                value={track.trimEnd}
                                onChange={(e) => updateTrackParam(track.id, 'trimEnd', parseFloat(e.target.value))}
                                className="brutalist-range w-full h-1"
                              />
                            </div>
                          </div>
                        </div>

                      </div>

                    </div>

                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Master Panel Controls */}
          <div className="border-2 border-black p-3.5 bg-neutral-100 space-y-3">
            <span className="font-mono text-[10px] font-bold text-black uppercase block border-b border-black/10 pb-1">
              {language === 'en' ? '3. MASTER STUDIO CONTROL' : '3. CONTROLLO MASTER STUDIO'}
            </span>

            <div className="flex flex-col sm:flex-row gap-2">
              
              {/* Play All Preview */}
              <button
                onClick={isPlaying ? stopAllPreview : playMixPreview}
                disabled={tracks.length === 0}
                className={`py-2 px-4 border-2 border-black font-mono font-bold text-[10px] uppercase flex items-center justify-center space-x-1.5 transition-all duration-75 active:translate-y-[1px] active:translate-x-[1px] ${
                  isPlaying 
                    ? 'bg-industrial-orange text-black' 
                    : 'bg-white text-black hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed'
                }`}
              >
                {isPlaying ? (
                  <>
                    <Pause className="w-3.5 h-3.5 fill-current" />
                    <span>{language === 'en' ? 'Stop Preview' : 'Ferma Anteprima'}</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>{language === 'en' ? 'Play Preview Mix' : 'Ascolta Mix Anteprima'}</span>
                  </>
                )}
              </button>

              {/* Mixdown File Export input name */}
              <div className="flex-1 flex border-2 border-black bg-white overflow-hidden">
                <span className="bg-neutral-50 px-2.5 py-1.5 text-[8.5px] font-mono font-bold text-black/55 uppercase border-r border-black flex items-center">
                  {language === 'en' ? 'EXPORT_NAME' : 'NOME_EXPORT'}
                </span>
                <input
                  type="text"
                  value={exportName}
                  onChange={(e) => setExportName(e.target.value)}
                  placeholder="SuperMix"
                  className="flex-1 text-[10px] font-mono uppercase bg-white px-2 focus:outline-none"
                />
              </div>

              {/* Render and save compilation */}
              <button
                onClick={renderAndSaveMix}
                disabled={tracks.length === 0 || isExporting}
                className="py-2 px-4 border-2 border-black bg-black text-white hover:bg-industrial-orange hover:text-black font-mono font-bold text-[10px] uppercase flex items-center justify-center space-x-1.5 transition-all duration-75 active:translate-y-[1px] active:translate-x-[1px] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Wand2 className="w-3.5 h-3.5 text-industrial-orange" />
                <span>
                  {isExporting 
                    ? (language === 'en' ? 'Bouncing...' : 'Compilazione in corso...') 
                    : (language === 'en' ? 'Bounce & Save Mix' : 'Salva e Monta Mix')}
                </span>
              </button>

            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
