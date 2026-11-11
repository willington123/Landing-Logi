'use client';

import React, { useState } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import LandingWizardModal from '@/components/landings/LandingWizardModal';
import TeamSettings from '@/components/account/TeamSettings';

// Who is part of this store, their roles, and invitations (also in Configuración).
export default function TeamRoute() {
  const [wizardOpen, setWizardOpen] = useState(false);
  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar onOpenWizard={() => setWizardOpen(true)} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header onOpenWizard={() => setWizardOpen(true)} title="Equipo" />
        <main className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8 max-w-[860px] mx-auto w-full space-y-4">
          <div>
            <p className="text-sm text-slate-500">Quién tiene acceso a esta tienda y con qué rol. Las invitaciones son por tienda: si tienes varias, invita a la persona en cada una.</p>
          </div>
          <TeamSettings only="team" />
        </main>
      </div>
      <LandingWizardModal isOpen={wizardOpen} onClose={() => setWizardOpen(false)} />
    </div>
  );
}
