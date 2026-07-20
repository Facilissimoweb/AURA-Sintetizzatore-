import React, { useState, useRef, useEffect } from 'react';
import { 
  FolderHeart, 
  Trash2, 
  Play, 
  Pause, 
  Download, 
  Edit2, 
  Check, 
  Search, 
  Upload, 
  FileAudio, 
  Info, 
  Calendar,
  Activity,
  MessageSquare,
  Server,
  Folder,
  FolderPlus,
  Plus,
  ChevronRight,
  ChevronLeft,
  ArrowRight
} from 'lucide-react';
import { Language } from '../types';
import { SavedFileRecord } from '../lib/db';

interface SavedCabinetProps {
  language: Language;
  savedFiles: (SavedFileRecord & { url: string })[];
  onDeleteFile: (id: string) => void;
  onRenameFile: (id: string, newName: string) => void;
  onUploadFile: (file: File) => void;

  // Server-side folders properties
  serverFolders: { name: string; files: any[] }[];
  onCreateServerFolder: (folderName: string) => Promise<boolean>;
  onDeleteServerFile: (filePath: string) => void;
  onSaveToServer: (blob: Blob, name: string, folderName: string) => Promise<boolean>;
}

export default function SavedCabinet({
  language,
  savedFiles,
  onDeleteFile,
  onRenameFile,
  onUploadFile,
  serverFolders,
  onCreateServerFolder,
  onDeleteServerFile,
  onSaveToServer
}: SavedCabinetProps) {
  // Navigation tabs: 'local' | 'server'
  const [activeTab, setActiveTab] = useState<'local' | 'server'>('server');
  
  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  
  // Editing state for local file renaming
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  
  // Active playing audio state
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);
  
  // Folder browser state (null means root folders list, string means active subfolder name)
  const [activeServerFolder, setActiveServerFolder] = useState<string | null>(null);
  
  // Create folder states
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  
  // Drag and drop states
  const [isDragging, setIsDragging] = useState(false);

  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // Playback control
  const handleTogglePlay = (audioId: string, url: string) => {
    if (playingId === audioId) {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
      setPlayingId(null);
      setPlayingUrl(null);
    } else {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
      const audio = new Audio(url);
      audioPlayerRef.current = audio;
      
      audio.onplay = () => {
        setPlayingId(audioId);
        setPlayingUrl(url);
      };

      audio.onended = () => {
        setPlayingId(null);
        setPlayingUrl(null);
      };

      audio.onerror = () => {
        setPlayingId(null);
        setPlayingUrl(null);
      };

      audio.play().catch((err) => {
        console.error('Audio playback failed:', err);
        setPlayingId(null);
        setPlayingUrl(null);
      });
    }
  };

  useEffect(() => {
    return () => {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
    };
  }, []);

  // Local renamer
  const startEditing = (id: string, currentName: string) => {
    setEditingId(id);
    setEditName(currentName);
  };

  const saveRename = (id: string) => {
    if (editName.trim()) {
      onRenameFile(id, editName.trim());
    }
    setEditingId(null);
  };

  // Drag-and-drop file uploads
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('audio/')) {
        if (activeTab === 'local') {
          onUploadFile(file);
        } else {
          // Upload to active server folder, default to 'uploads' if none active
          const folder = activeServerFolder || 'uploads';
          await onSaveToServer(file, file.name, folder);
        }
      }
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (activeTab === 'local') {
        onUploadFile(file);
      } else {
        const folder = activeServerFolder || 'uploads';
        await onSaveToServer(file, file.name, folder);
      }
    }
  };

  // Create folder action
  const handleCreateFolderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    const success = await onCreateServerFolder(newFolderName.trim());
    if (success) {
      setNewFolderName('');
      setIsCreatingFolder(false);
    }
  };

  // Filter files
  const filteredLocalFiles = savedFiles.filter((file) =>
    file.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Helper formatting size & dates
  const formatSize = (bytes: number) => {
    if (bytes === 0 || !bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (timestamp: number) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleDateString(language === 'en' ? 'en-US' : 'it-IT', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Find active folder files
  const activeFolderData = serverFolders.find(f => f.name === activeServerFolder);
  const activeFolderFiles = activeFolderData 
    ? activeFolderData.files.filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase()))
    : [];

  // Calculate total server stats
  const totalServerClips = serverFolders.reduce((acc, f) => acc + f.files.length, 0);
  const totalServerSize = serverFolders.reduce((acc, f) => acc + f.files.reduce((sum, file) => sum + (file.size || 0), 0), 0);

  return (
    <div id="section-cabinet" className="bg-white border-2 border-black p-4.5 flex flex-col space-y-4 relative neo-shadow">
      
      {/* Upper Module Heading */}
      <div className="flex items-center justify-between border-b-2 border-black pb-3">
        <div>
          <h3 className="font-display text-sm font-bold text-black uppercase flex items-center tracking-tight">
            <Server className="w-4.5 h-4.5 mr-1.5 text-industrial-orange" />
            {language === 'en' ? 'Audio Records Storage' : 'Gestione Cartelle & Audio'}
          </h3>
          <span className="font-mono text-[9px] text-black/50 uppercase tracking-wider block mt-0.5">
            {language === 'en' ? 'Manage physical folders and files on Server' : 'Struttura cartelle fisiche nel server e locale browser'}
          </span>
        </div>
      </div>

      {/* Dual Storage Mode Tabs */}
      <div className="grid grid-cols-2 gap-2 border-2 border-black p-1 bg-neutral-100">
        <button
          onClick={() => { setActiveTab('server'); setSearchTerm(''); }}
          className={`py-2 px-3 text-center font-mono text-[10px] font-bold uppercase transition-all duration-75 flex items-center justify-center space-x-1.5 ${
            activeTab === 'server'
              ? 'bg-black text-white'
              : 'bg-transparent text-black/60 hover:text-black hover:bg-white/50'
          }`}
        >
          <Server className="w-3.5 h-3.5" />
          <span>{language === 'en' ? 'Server Folders' : 'Cartelle Server'}</span>
        </button>
        <button
          onClick={() => { setActiveTab('local'); setSearchTerm(''); }}
          className={`py-2 px-3 text-center font-mono text-[10px] font-bold uppercase transition-all duration-75 flex items-center justify-center space-x-1.5 ${
            activeTab === 'local'
              ? 'bg-black text-white'
              : 'bg-transparent text-black/60 hover:text-black hover:bg-white/50'
          }`}
        >
          <FolderHeart className="w-3.5 h-3.5 text-industrial-orange" />
          <span>{language === 'en' ? 'Local Browser (IndexedDB)' : 'Vault Browser Locale'}</span>
        </button>
      </div>

      {/* Stats Counter Bar based on mode */}
      <div className="grid grid-cols-2 gap-2 text-center bg-neutral-50 border-2 border-black p-2">
        <div className="border-r-2 border-black last:border-r-0 py-1">
          <span className="font-mono text-[8px] text-black/50 uppercase font-bold block">
            {language === 'en' ? 'TOTAL_CLIPS' : 'TOTALE_FILE'}
          </span>
          <span className="font-mono text-xs font-extrabold text-black">
            {activeTab === 'local' ? savedFiles.length : totalServerClips}
          </span>
        </div>
        <div className="py-1">
          <span className="font-mono text-[8px] text-black/50 uppercase font-bold block">
            {language === 'en' ? 'STORAGE_SIZE' : 'SPAZIO_TOTAL'}
          </span>
          <span className="font-mono text-xs font-extrabold text-industrial-orange">
            {activeTab === 'local' 
              ? formatSize(savedFiles.reduce((acc, f) => acc + (f.size || 0), 0))
              : formatSize(totalServerSize)
            }
          </span>
        </div>
      </div>

      {/* SEARCH AND UPLOAD ACTIONS AREA */}
      <div className="space-y-3">
        {/* Search bar */}
        <div className="relative">
          <input
            type="text"
            placeholder={
              activeTab === 'local' 
                ? (language === 'en' ? 'Search local files...' : 'Cerca file locali...')
                : (language === 'en' ? 'Search server folder...' : 'Cerca file in questa cartella...')
            }
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs pl-8.5 pr-3.5 py-2 border-2 border-black focus:outline-none bg-white font-mono uppercase tracking-wider"
          />
          <Search className="w-4 h-4 text-black/45 absolute left-2.5 top-1/2 -translate-y-1/2" />
        </div>

        {/* Drag-and-drop Import Zone (Only active if in local or if entering a subfolder in server) */}
        {(activeTab === 'local' || activeServerFolder) && (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed p-3 text-center transition-all duration-100 ${
              isDragging
                ? 'border-industrial-orange bg-industrial-orange/5'
                : 'border-black/30 bg-white hover:border-black hover:bg-neutral-50'
            }`}
          >
            <label className="cursor-pointer block">
              <div className="flex items-center justify-center space-x-2">
                <Upload className="w-4 h-4 text-industrial-orange" />
                <span className="font-mono text-[10px] font-bold text-black uppercase tracking-wider">
                  {activeTab === 'local'
                    ? (language === 'en' ? 'Import Local Audio File' : 'Importa File Audio nel Browser')
                    : (language === 'en' ? `Upload File to /records/${activeServerFolder}` : `Carica File in records/${activeServerFolder}`)}
                </span>
              </div>
              <input
                type="file"
                accept="audio/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          </div>
        )}
      </div>

      {/* DYNAMIC LIST INTERFACE */}

      {/* TAB A: LOCAL STORAGE (IndexedDB) */}
      {activeTab === 'local' && (
        <div className="border-2 border-black bg-white max-h-[300px] overflow-y-auto divide-y-2 divide-black scrollbar-thin">
          {filteredLocalFiles.length === 0 ? (
            <div className="p-6 text-center text-black/50">
              <FileAudio className="w-8 h-8 text-black/35 mx-auto mb-2" />
              <p className="font-mono text-[10px] uppercase font-bold">
                {searchTerm 
                  ? (language === 'en' ? 'No files match search' : 'Nessun file corrisponde alla ricerca')
                  : (language === 'en' ? 'No saved audio files yet' : 'Nessun file salvato')}
              </p>
              <p className="font-sans text-[10px] text-black/50 mt-1 max-w-[200px] mx-auto leading-normal">
                {language === 'en'
                  ? 'Capture modulations or speeches to keep them here persistently!'
                  : 'Registra le voci e salvale per memorizzarle localmente sul tuo browser!'}
              </p>
            </div>
          ) : (
            filteredLocalFiles.map((file) => {
              const isPlaying = playingId === file.id;
              const isEditing = editingId === file.id;
              
              return (
                <div key={file.id} className="p-3 bg-white hover:bg-neutral-50/50 flex flex-col space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      {isEditing ? (
                        <div className="flex items-center space-x-1.5">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && saveRename(file.id)}
                            className="w-full text-xs px-2 py-1 border-2 border-black focus:outline-none bg-white font-mono uppercase"
                            autoFocus
                          />
                          <button
                            onClick={() => saveRename(file.id)}
                            className="p-1 border-2 border-black bg-black text-white hover:bg-industrial-orange hover:text-black"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-1.5">
                          <span 
                            onClick={() => startEditing(file.id, file.name)}
                            className="font-mono text-[10px] sm:text-xs font-bold text-black uppercase truncate tracking-wide cursor-pointer hover:text-industrial-orange block max-w-full"
                          >
                            {file.name}
                          </span>
                          <button onClick={() => startEditing(file.id, file.name)} className="text-black/35 hover:text-black">
                            <Edit2 className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      )}

                      <div className="flex items-center space-x-2 mt-1">
                        <span className="font-mono text-[7px] font-extrabold uppercase px-1 py-0.2 border border-black/45 bg-neutral-100 text-black/60 flex items-center gap-0.5">
                          {file.source === 'modulator' ? (
                            <>
                              <Activity className="w-2 h-2 text-industrial-orange" />
                              <span>{language === 'en' ? 'Modulator' : 'Modulatore'}</span>
                            </>
                          ) : file.source === 'chat_tts' ? (
                            <>
                              <MessageSquare className="w-2 h-2 text-indigo-500" />
                              <span>{language === 'en' ? 'AI Chat' : 'Chatbot'}</span>
                            </>
                          ) : (
                            <>
                              <Upload className="w-2 h-2 text-emerald-500" />
                              <span>{language === 'en' ? 'Imported' : 'Importato'}</span>
                            </>
                          )}
                        </span>

                        <span className="font-mono text-[8px] text-black/45 flex items-center gap-1 font-bold">
                          <Calendar className="w-2.5 h-2.5" />
                          {formatDate(file.timestamp)}
                        </span>

                        <span className="font-mono text-[8px] text-black/45 font-bold">
                          {formatSize(file.size)}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => onDeleteFile(file.id)}
                      className="text-black/40 hover:text-red-600 transition-colors p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleTogglePlay(file.id, file.url)}
                      className={`px-3 py-1.5 border-2 border-black font-mono font-bold text-[9px] uppercase tracking-wider flex items-center space-x-1 ${
                        isPlaying ? 'bg-industrial-orange text-black' : 'bg-white text-black hover:bg-neutral-50'
                      }`}
                    >
                      {isPlaying ? (
                        <><Pause className="w-3 h-3 fill-current" /><span>{language === 'en' ? 'Pause' : 'Pausa'}</span></>
                      ) : (
                        <><Play className="w-3 h-3 fill-current" /><span>{language === 'en' ? 'Play' : 'Ascolta'}</span></>
                      )}
                    </button>

                    <a
                      href={file.url}
                      download={file.name}
                      className="px-3 py-1.5 border-2 border-black bg-white hover:bg-neutral-50 text-black font-mono font-bold text-[9px] uppercase tracking-wider flex items-center space-x-1"
                    >
                      <Download className="w-3 h-3" />
                      <span>{language === 'en' ? 'Download' : 'Scarica'}</span>
                    </a>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* TAB B: SERVER WORKSPACE STORAGE (Physical directories `./records`) */}
      {activeTab === 'server' && (
        <div className="space-y-4">
          
          {/* 1. Folders grid (when NO folder is selected) */}
          {!activeServerFolder ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-black/10 pb-1">
                <span className="font-mono text-[10px] font-bold text-black uppercase">
                  {language === 'en' ? 'Server Subfolders' : 'Cartelle nel Server'}
                </span>
                
                {/* Create Folder toggler */}
                <button
                  onClick={() => setIsCreatingFolder(!isCreatingFolder)}
                  className="px-2 py-1 border-2 border-black bg-white hover:bg-neutral-50 font-mono text-[9px] uppercase font-bold flex items-center space-x-1"
                >
                  <FolderPlus className="w-3 h-3 text-industrial-orange" />
                  <span>{language === 'en' ? 'New Folder' : 'Nuova Cartella'}</span>
                </button>
              </div>

              {/* Create folder inline form */}
              {isCreatingFolder && (
                <form onSubmit={handleCreateFolderSubmit} className="flex gap-1.5 p-2 bg-neutral-50 border-2 border-black">
                  <input
                    type="text"
                    required
                    placeholder={language === 'en' ? 'Folder name...' : 'Nome cartella...'}
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    className="flex-1 text-xs px-2 py-1 border-2 border-black bg-white font-mono uppercase focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1 bg-black text-white hover:bg-industrial-orange hover:text-black border-2 border-black font-mono text-[10px] uppercase font-bold"
                  >
                    {language === 'en' ? 'Create' : 'Crea'}
                  </button>
                </form>
              )}

              {/* Folders List Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {serverFolders.map((folder) => (
                  <div
                    key={folder.name}
                    onClick={() => { setActiveServerFolder(folder.name); setSearchTerm(''); }}
                    className="p-3 border-2 border-black bg-white hover:bg-neutral-50 cursor-pointer flex items-center justify-between transition-all duration-75 active:translate-y-[1px] active:translate-x-[1px]"
                  >
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <Folder className="w-5 h-5 text-industrial-orange flex-shrink-0" />
                      <div className="min-w-0">
                        <span className="font-mono text-[11px] font-bold uppercase text-black block truncate">
                          {folder.name}
                        </span>
                        <span className="font-mono text-[8px] text-black/50 uppercase font-semibold">
                          {folder.files.length} {folder.files.length === 1 ? 'file' : 'files'}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-black/35" />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            // 2. Folder detail view (browsing files inside an entered folder)
            <div className="space-y-3">
              
              {/* Folder Breadcrumb / Back Navigation header */}
              <div className="flex items-center justify-between border-b-2 border-black pb-2">
                <button
                  onClick={() => { setActiveServerFolder(null); setSearchTerm(''); }}
                  className="font-mono text-[10px] font-extrabold text-black uppercase hover:text-industrial-orange flex items-center space-x-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>{language === 'en' ? 'Root' : 'Radice'}</span>
                  <span className="text-black/30 font-normal">/</span>
                  <span className="text-industrial-orange">{activeServerFolder}</span>
                </button>

                <span className="font-mono text-[8px] text-black/45 font-bold">
                  [{activeFolderFiles.length} / {activeFolderData?.files.length || 0} FILES]
                </span>
              </div>

              {/* Files in active folder list */}
              <div className="border-2 border-black bg-white max-h-[300px] overflow-y-auto divide-y-2 divide-black scrollbar-thin">
                {activeFolderFiles.length === 0 ? (
                  <div className="p-6 text-center text-black/55 bg-white">
                    <FileAudio className="w-8 h-8 text-black/30 mx-auto mb-2" />
                    <p className="font-mono text-[10px] uppercase font-bold">
                      {language === 'en' ? 'Folder is empty' : 'Cartella vuota'}
                    </p>
                    <p className="font-sans text-[10px] text-black/40 mt-1">
                      {language === 'en'
                        ? 'Drag and drop audio files here to upload them to this server folder!'
                        : 'Trascina o importa un file qui sopra per salvarlo in questa cartella!'}
                    </p>
                  </div>
                ) : (
                  activeFolderFiles.map((file) => {
                    const isPlaying = playingId === file.path;
                    
                    return (
                      <div key={file.path} className="p-3 bg-white hover:bg-neutral-50/50 flex flex-col space-y-2">
                        
                        {/* File details heading */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <span className="font-mono text-[10px] sm:text-xs font-bold text-black uppercase truncate block max-w-full">
                              {file.name}
                            </span>
                            <div className="flex items-center space-x-2.5 mt-1 text-black/45 font-mono text-[8px] font-bold">
                              <span className="flex items-center gap-0.5">
                                <Calendar className="w-2.5 h-2.5" />
                                {formatDate(file.timestamp)}
                              </span>
                              <span>•</span>
                              <span>{formatSize(file.size)}</span>
                            </div>
                          </div>

                          {/* Delete File directly from server! */}
                          <button
                            onClick={() => onDeleteServerFile(file.path)}
                            className="text-black/40 hover:text-red-600 transition-colors p-1"
                            title={language === 'en' ? 'Delete from server' : 'Elimina dal server'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Audio controls */}
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleTogglePlay(file.path, file.url)}
                            className={`px-3 py-1.5 border-2 border-black font-mono font-bold text-[9px] uppercase tracking-wider flex items-center space-x-1 ${
                              isPlaying ? 'bg-industrial-orange text-black' : 'bg-white text-black hover:bg-neutral-50'
                            }`}
                          >
                            {isPlaying ? (
                              <><Pause className="w-3 h-3 fill-current" /><span>{language === 'en' ? 'Pause' : 'Pausa'}</span></>
                            ) : (
                              <><Play className="w-3 h-3 fill-current" /><span>{language === 'en' ? 'Play' : 'Ascolta'}</span></>
                            )}
                          </button>

                          <a
                            href={file.url}
                            download={file.name}
                            className="px-3 py-1.5 border-2 border-black bg-white hover:bg-neutral-50 text-black font-mono font-bold text-[9px] uppercase tracking-wider flex items-center space-x-1"
                          >
                            <Download className="w-3 h-3" />
                            <span>{language === 'en' ? 'Download' : 'Scarica'}</span>
                          </a>
                        </div>

                      </div>
                    );
                  })
                )}
              </div>

            </div>
          )}

        </div>
      )}

      {/* Info Tip block */}
      <div className="bg-[#fdfdfd] border-2 border-black p-3.5 flex items-start space-x-2.5">
        <Info className="w-4 h-4 text-industrial-orange mt-0.5 flex-shrink-0" />
        <p className="font-mono text-[9px] uppercase tracking-wider text-black/55 leading-relaxed font-semibold">
          {activeTab === 'local'
            ? 'LOCAL_VAULT: Stored inside browser cache database. Fast, secure, and isolated to this device.'
            : 'SERVER_FOLDERS: Saved physically inside the `./records` directory of the server. Persisted in workspace.'}
        </p>
      </div>

    </div>
  );
}
