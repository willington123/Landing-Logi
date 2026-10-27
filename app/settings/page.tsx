'use client';

import React, { useState } from 'react';
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
  const [storeName, setStoreName] = useState('Tienda Pro E-commerce Colombia');
  const [supportPhone, setSupportPhone] = useState('+57 300 123 4567');
  const [supportEmail, setSupportEmail] = useState('soporte@tiendapro.com');
  const [currency, setCurrency] = useState('COP');
  const [defaultGuaranteeDays, setDefaultGuaranteeDays] = useState(30);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar onOpenWizard={() => setIsWizardOpen(true)} />

      <div className="flex-1 flex flex-col min-w-0">
        <Header onOpenWizard={() => setIsWizardOpen(true)} title="Configuración de la Cuenta" />

        <main className="p-6 md:p-8 space-y-6 max-w-4xl mx-auto w-full">
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              Ajustes de Empresa & Parámetros Globales
            </h2>
            <p className="text-xs text-slate-500">
              Configura los valores por defecto que heredarán todas tus landing pages y agentes de voz.
            </p>
          </div>

          <form onSubmit={handleSave} className="space-y-6">
            {/* General Info */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Store className="w-4 h-4 text-brand-navy" />
                <h3 className="text-sm font-bold text-slate-900">Identidad del Negocio</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Nombre del Negocio / Tienda:
                  </label>
                  <input
                    type="text"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:bg-white focus:ring-1 focus:ring-brand-red"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
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
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Teléfono Oficial de Soporte (WhatsApp):
                  </label>
                  <input
                    type="text"
                    value={supportPhone}
                    onChange={(e) => setSupportPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:bg-white focus:ring-1 focus:ring-brand-red"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Correo Electrónico de Contacto:
                  </label>
                  <input
                    type="email"
                    value={supportEmail}
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
                <h3 className="text-sm font-bold text-slate-900">Políticas por Defecto para Contraentrega</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
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
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Transportadoras Autorizadas en Colombia:
                  </label>
                  <p className="p-2.5 bg-slate-50 rounded-lg text-slate-700 font-medium">
                    Servientrega, Coordinadora, Interrapidísimo, Envía
                  </p>
                </div>
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
                className="px-6 py-2.5 bg-brand-gradient hover:opacity-95 text-white font-bold text-xs rounded-xl shadow-glow-orange transition flex items-center gap-2"
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
