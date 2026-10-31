'use client';

import React, { useState } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import LandingWizardModal from '@/components/landings/LandingWizardModal';
import CreativesPage from '@/components/ads/CreativesPage';

export default function CreativesRoute() {
  const [wizardOpen, setWizardOpen] = useState(false);
  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar onOpenWizard={() => setWizardOpen(true)} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header onOpenWizard={() => setWizardOpen(true)} title="Creativos" />
        <main className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8 max-w-[1280px] mx-auto w-full">
          <CreativesPage />
        </main>
      </div>
      <LandingWizardModal isOpen={wizardOpen} onClose={() => setWizardOpen(false)} />
    </div>
  );
}
