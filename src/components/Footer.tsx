import { Language } from '../types';

interface FooterProps {
  language: Language;
}

export default function Footer({ language }: FooterProps) {
  return (
    <footer className="border-t-2 border-black bg-white py-4.5 px-6 sm:px-8 flex flex-col sm:flex-row justify-between items-center gap-3 font-mono text-[9px] sm:text-[10px] text-black font-semibold uppercase tracking-wider">
      <div>
        {language === 'en'
          ? 'SYSTEM: AUDIO_WORKLET_OK // STABLE_LATENCY_20MS'
          : 'SISTEMA: AUDIO_WORKLET_OK // LATENZA_STABILE_20MS'}
      </div>
      <div>
        © 2026 AURA AUDIO TECHNOLOGIES. {language === 'en' ? 'ALL RIGHTS RESERVED.' : 'TUTTI I DIRITTI RISERVATI.'}
      </div>
    </footer>
  );
}
