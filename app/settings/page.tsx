'use client';

import React, { useEffect, useState } from 'react';
import { logiStore } from '@/lib/store';
import { pushSettings, CLOUD_SYNC_EVENT } from '@/lib/cloud';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import LandingWizardModal from '@/components/landings/LandingWizardModal';
import {
  Settings,
  Store,
  DollarSign,
  ShieldCheck,
  Users,
  Bell,
  Save,
  CheckCircle2,
} from 'lucide-react';

export default function SettingsPage() {
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [storeName, setStoreName] = useState('');
  const [supportPhone, setSupportPhone] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [currency, setCurrency] = useState('COP');
  const [defaultGuaranteeDays, setDefaultGuaranteeDays] = useState(30);
  const [metaPixelId, setMetaPixelId] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    const load = () => {
    const st = logiStore.getStoreSettings();
    setStoreName(st.storeName);
    setSupportPhone(st.supportPhone);
    setSupportEmail(st.supportEmail);
    setCurrency(st.currency);
    setDefaultGuaranteeDays(st.guaranteeDays);
    setMetaPixelId(st.metaPixelId);
    };
    load();
    window.addEventListener(CLOUD_SYNC_EVENT, load);
    return () => window.removeEventListener(CLOUD_SYNC_EVENT, load);
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const next = {
      storeName: storeName.trim(),
      supportPhone: supportPhone.trim(),
      supportEmail: supportEmail.trim(),
      currency,
      guaranteeDays: Number(defaultGuaranteeDays) || 30,
      metaPixelId: metaPixelId.trim(),
    };
    logiStore.saveStoreSettings(next);
    pushSettings(next);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar onOpenWizard={() => setIsWizardOpen(true)} />

      <div className="flex-1 flex flex-col min-w-0">
        <Header onOpenWizard={() => setIsWizardOpen(true)} title="Configuración" />

        <main className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8 space-y-6 max-w-4xl mx-auto w-full">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 tracking-tight">
              Ajustes de la tienda
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Configura los valores por defecto que heredarán todas tus landing pages y agentes de voz.
            </p>
          </div>

          <form onSubmit={handleSave} className="space-y-6">
            {/* General Info */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Store className="w-4 h-4 text-brand-navy" />
                <h3 className="text-[15px] font-semibold text-slate-900">Identidad del Negocio</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    Nombre del Negocio / Tienda:
                  </label>
                  <input
                    type="text"
                    value={storeName}
                    placeholder="Ej. Mi Tienda"
                    onChange={(e) => setStoreName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:bg-white focus:ring-1 focus:ring-brand-red"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    Moneda Principal de Venta:
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:bg-white focus:ring-1 focus:ring-brand-red"
                  >
                    <option value="COP">Peso Colombiano (COP)</option>
                    <option value="MXN">Peso Mexicano (MXN)</option>
                    <option value="USD">Dólar Estadounidense (USD)</option>
                    <option value="EUR">Euro (EUR)</option>
                    <option value="PEN">Sol Peruano (PEN)</option>
                    <option value="CLP">Peso Chileno (CLP)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    Teléfono Oficial de Soporte (WhatsApp):
                  </label>
                  <input
                    type="text"
                    value={supportPhone}
                    placeholder="+57 300 000 0000"
                    onChange={(e) => setSupportPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:bg-white focus:ring-1 focus:ring-brand-red"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    Correo Electrónico de Contacto:
                  </label>
                  <input
                    type="email"
                    value={supportEmail}
                    placeholder="soporte@mitienda.com"
                    onChange={(e) => setSupportEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:bg-white focus:ring-1 focus:ring-brand-red"
                  />
                </div>
              </div>
            </div>

            {/* Default COD Policies */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <ShieldCheck className="w-4 h-4 text-brand-red" />
                <h3 className="text-[15px] font-semibold text-slate-900">Políticas por Defecto para Contraentrega</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    Días de Garantía por Defecto:
                  </label>
                  <input
                    type="number"
                    value={defaultGuaranteeDays}
                    onChange={(e) => setDefaultGuaranteeDays(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:bg-white focus:ring-1 focus:ring-brand-red"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    Transportadoras Autorizadas en Colombia:
                  </label>
                  <p className="p-2.5 bg-slate-50 rounded-lg text-slate-700 font-medium">
                    Servientrega, Coordinadora, Interrapidísimo, Envía
                  </p>
                </div>
              </div>
            </div>

            {/* Meta Pixel */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <span className="w-4 h-4 rounded bg-[#0866FF] text-white text-[9px] font-bold flex items-center justify-center">f</span>
                <h3 className="text-[15px] font-semibold text-slate-900">Píxel de Meta (Facebook / Instagram Ads)</h3>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">ID del píxel por defecto</label>
                <input
                  value={metaPixelId}
                  onChange={(e) => setMetaPixelId(e.target.value.replace(/\D/g, ''))}
                  inputMode="numeric"
                  placeholder="Ej. 123456789012345"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-800 focus:bg-white focus:ring-1 focus:ring-brand-red"
                />
                <p className="text-xs text-slate-500 mt-1.5">
                  Se aplica a cada landing nueva (puedes cambiarlo por landing en el editor). Lo encuentras en Meta Events Manager → Orígenes de datos → tu píxel.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between">
              {savedSuccess ? (
                <span className="text-xs font-bold text-emerald-600 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  ¡Configuración guardada correctamente!
                </span>
              ) : (
                <div></div>
              )}

              <button
                type="submit"
                className="px-6 py-2.5 bg-brand-gradient hover:opacity-95 text-white font-bold text-xs rounded-xl transition flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                <span>Guardar Ajustes</span>
              </button>
            </div>
          </form>
        </main>
      </div>

      <LandingWizardModal
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
      />
    </div>
  );
}
