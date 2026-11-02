'use client';

// "Instalar app": registers the service worker and offers to install Konnexa on the phone's home screen.
// Android/Chrome: native prompt. iPhone/Safari: instructions (Safari has no install prompt). Hidden once installed.
import React, { useEffect, useState } from 'react';
import { Download } from 'lucide-react';

export default function InstallApp() {
  const [prompt, setPrompt] = useState<any>(null);
  const [ios, setIos] = useState(false);
  const [installed, setInstalled] = useState(true);
  const [help, setHelp] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
    setInstalled(standalone);
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent));
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed || (!prompt && !ios)) return null;
  return (
    <div className="px-1">
      <button
        onClick={async () => {
          if (prompt) {
            prompt.prompt();
            await prompt.userChoice.catch(() => null);
            setPrompt(null);
          } else setHelp((v) => !v);
        }}
        className="w-full h-10 rounded-lg border border-brand-blue/30 bg-brand-blue/[0.05] text-brand-navy text-[13px] font-semibold inline-flex items-center justify-center gap-2"
      >
        <Download className="w-4 h-4" /> Instalar app en el celular
      </button>
      {help && (
        <p className="mt-2 text-[12px] text-slate-600 leading-snug">
          En Safari toca <strong>Compartir</strong> (el cuadro con la flecha hacia arriba) y luego <strong>Agregar a inicio</strong>. Konnexa quedará como una app en tu pantalla.
        </p>
      )}
    </div>
  );
}
