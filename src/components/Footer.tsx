import { Language } from '../types';

interface FooterProps {
  language: Language;
}

export default function Footer({ language }: FooterProps) {
  return (
    <footer className="border-t border-slate-100 bg-white py-6 text-center text-[10px] sm:text-xs text-slate-400 font-medium px-4">
      <div className="max-w-7xl mx-auto space-y-1.5">
        <p className="leading-relaxed">
          {language === 'en'
            ? 'AURA Studio leverages parallel Web Audio AudioWorklet workers to prevent latency, phase cancellation, and digital distortion.'
            : 'AURA Studio utilizza il calcolo parallelo via AudioWorklet Web API per prevenire la latenza e fruscii metallici.'}
        </p>
        <p className="text-slate-500 font-bold">
          © 2026 AURA Audio Technologies. {language === 'en' ? 'All rights reserved.' : 'Tutti i diritti riservati.'}
        </p>
      </div>
    </footer>
  );
}
