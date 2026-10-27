'use client';

import React, { useState } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import LandingWizardModal from '@/components/landings/LandingWizardModal';
import AutomationBuilder from '@/components/automations/AutomationBuilder';

export default function AutomationsPage() {
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar onOpenWizard={() => setIsWizardOpen(true)} />

      <div className="flex-1 flex flex-col min-w-0">
        <Header onOpenWizard={() => setIsWizardOpen(true)} title="Constructor de Automatizaciones" />

        <main className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                Flujos Reactivos de Venta & Operaciones COD
              </h2>
              <p className="text-xs text-slate-500">
                Dispara llamadas de confirmación, notificaciones de WhatsApp oficial y webhooks logísticos según eventos en tiempo real.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <AutomationBuilder />
          </div>
        </main>
      </div>

      <LandingWizardModal
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
      />
    </div>
  );
}
