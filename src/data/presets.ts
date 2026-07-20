import { SynthPreset } from '../types';

export const SYNTH_PRESETS: SynthPreset[] = [
  {
    id: 'warm-male',
    nameEn: 'Warm Baritone',
    nameIt: 'Baritono Caldo',
    emoji: '🎤',
    pitch: 0.85,
    delay: 40.0,
    warmth: 6.0,
    nasal: -4.5,
    clarity: 2.0,
    descriptionEn: 'Deep chest resonance and velvety tone, ideal for podcast presence.',
    descriptionIt: 'Profonda risonanza di petto e tono caldo, ideale per la voce da podcast.'
  },
  {
    id: 'velvety-female',
    nameEn: 'Velvety Soprano',
    nameIt: 'Timbro Femminile',
    emoji: '👩',
    pitch: 1.24,
    delay: 32.0,
    warmth: -2.0,
    nasal: -2.0,
    clarity: 5.5,
    descriptionEn: 'Elevated pitch and enhanced clarity, smooth and natural register.',
    descriptionIt: 'Tono rialzato e brillantezza aumentata, registro morbido e naturale.'
  },
  {
    id: 'whisper-intimate',
    nameEn: 'Cozy Whisper',
    nameIt: 'Voce Intima',
    emoji: '🍃',
    pitch: 1.00,
    delay: 45.0,
    warmth: 3.0,
    nasal: -8.0,
    clarity: 9.0,
    descriptionEn: 'Intimate close-mic whisper with high frequency air and zero pitch alteration.',
    descriptionIt: 'Sussurro intimo ravvicinato con enfasi sulle alte frequenze e pitch originale.'
  },
  {
    id: 'clear-presence',
    nameEn: 'Clear Presence',
    nameIt: 'Presenza Chiara',
    emoji: '✨',
    pitch: 1.05,
    delay: 35.0,
    warmth: 1.5,
    nasal: -3.0,
    clarity: 8.0,
    descriptionEn: 'Crisp articulation and high speech intelligibility, cuts through ambient noise.',
    descriptionIt: 'Articolazione nitida e massima comprensibilità, ideale per eliminare i rumori.'
  },
  {
    id: 'elf-sprite',
    nameEn: 'Forest Sprite',
    nameIt: 'Elfo dei Boschi',
    emoji: '🧚',
    pitch: 1.42,
    delay: 25.0,
    warmth: -4.0,
    nasal: -3.0,
    clarity: 6.0,
    descriptionEn: 'Bright, tiny sprite voice with light and energetic tonal properties.',
    descriptionIt: 'Voce elfica brillante e minuta, con caratteristiche tonali chiare ed energetiche.'
  },
  {
    id: 'stone-giant',
    nameEn: 'Stone Giant',
    nameIt: 'Gigante di Pietra',
    emoji: '🪨',
    pitch: 0.72,
    delay: 50.0,
    warmth: 9.0,
    nasal: -6.0,
    clarity: -2.0,
    descriptionEn: 'Titanic rumbling scale, simulates massive physical vocal tract volume.',
    descriptionIt: 'Rimbombo titanico, simula le corde vocali di una creatura di enormi dimensioni.'
  }
];
