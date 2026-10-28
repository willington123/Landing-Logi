'use client';

// Thank-you step when the landing sends the customer to WhatsApp: makes clear the order is
// only confirmed once they tap "Enviar", then opens WhatsApp after a short countdown.
import React, { useEffect, useState } from 'react';

const COUNTDOWN = 5;

function WhatsAppIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0012.04 2zm.01 1.67c4.55 0 8.24 3.7 8.24 8.24 0 2.2-.86 4.28-2.42 5.84a8.17 8.17 0 01-5.83 2.41c-1.47 0-2.92-.39-4.18-1.14l-.3-.18-3.11.82.83-3.03-.2-.31a8.192 8.192 0 01-1.26-4.41c0-4.54 3.7-8.24 8.23-8.24zm4.52 11.66c-.25-.13-1.47-.72-1.7-.81-.23-.08-.39-.13-.56.13-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.13-1.06-.39-2.02-1.25-.75-.67-1.26-1.5-1.41-1.75-.15-.25-.02-.39.11-.51.11-.11.25-.29.37-.44.12-.14.17-.25.25-.42.08-.17.04-.31-.02-.44-.06-.13-.56-1.34-.76-1.84-.2-.49-.4-.42-.56-.43h-.47c-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.1 0 1.24.9 2.44 1.03 2.61.13.17 1.78 2.71 4.3 3.8 2.53 1.09 2.53.73 2.99.69.45-.04 1.47-.6 1.68-1.18.21-.58.21-1.07.15-1.18-.06-.11-.23-.17-.48-.3z" />
    </svg>
  );
}

interface Props {
  url: string;
  firstName?: string;
  orderNumber?: string;
  previewMode?: boolean;
  onClose?: () => void;
}

export default function WhatsAppConfirmStep({ url, firstName, orderNumber, previewMode = false, onClose }: Props) {
  const [left, setLeft] = useState(previewMode ? 0 : COUNTDOWN);
  const [opened, setOpened] = useState(false);

  // Countdown, then open WhatsApp once (only on the public page).
  useEffect(() => {
    if (previewMode || opened) return;
    if (left <= 0) {
      setOpened(true);
      window.location.href = url;
      return;
    }
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left, opened, previewMode, url]);

  return (
    <div className="w-full text-center">
      <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center bg-[#25D366] text-white">
        <WhatsAppIcon className="w-9 h-9" />
      </div>
      <h3 className="text-xl font-bold text-slate-900">¡Falta un paso{firstName ? `, ${firstName}` : ''}!</h3>
      {orderNumber && <p className="text-xs text-slate-500 mt-1">Pedido {orderNumber}</p>}

      <div className="mt-4 rounded-2xl border-2 border-amber-300 bg-amber-50 px-4 py-3 text-left">
        <p className="text-sm font-bold text-amber-900">Tu pedido aún no está confirmado</p>
        <p className="text-sm text-amber-900/90 mt-0.5">Envíanos el mensaje por WhatsApp para confirmarlo. Sin confirmación no podemos despacharlo.</p>
      </div>

      <ol className="mt-4 space-y-2 text-left text-sm text-slate-700">
        <li className="flex items-center gap-3">
          <span className="w-6 h-6 shrink-0 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center">1</span>
          Toca el botón verde de abajo.
        </li>
        <li className="flex items-center gap-3">
          <span className="w-6 h-6 shrink-0 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center">2</span>
          <span>
            En WhatsApp, toca <strong>Enviar</strong> <span aria-hidden>➤</span>. El mensaje ya está escrito.
          </span>
        </li>
      </ol>

      <a
        href={url}
        onClick={() => setOpened(true)}
        className="mt-5 w-full h-14 px-6 rounded-full font-bold text-white text-[15px] inline-flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1ebe5a] shadow-[0_10px_24px_-10px_rgba(37,211,102,0.8)] transition"
      >
        <WhatsAppIcon className="w-5 h-5" />
        Confirmar mi pedido por WhatsApp
      </a>

      {!previewMode && (
        <p className="text-xs text-slate-500 mt-3" aria-live="polite">
          {!opened && left > 0 ? `Abriendo WhatsApp en ${left}…` : 'Si WhatsApp no se abrió, toca el botón verde.'}
        </p>
      )}

      {onClose && (
        <button onClick={onClose} className="mt-4 text-xs text-slate-400 underline underline-offset-2 hover:text-slate-600">
          Ya envié el mensaje
        </button>
      )}
    </div>
  );
}
