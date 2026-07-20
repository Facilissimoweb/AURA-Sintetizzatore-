export interface SynthPreset {
  id: string;
  nameEn: string;
  nameIt: string;
  emoji: string;
  pitch: number;
  delay: number;
  warmth: number;
  nasal: number;
  clarity: number;
  descriptionEn: string;
  descriptionIt: string;
}

export type Language = 'en' | 'it';

export type VisualizerMode = 'waveform' | 'frequency';

export interface AudioStats {
  sampleRate: number;
  latency: number;
}
