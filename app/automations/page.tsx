'use client';

import React, { useState } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import LandingWizardModal from '@/components/landings/LandingWizardModal';
import AutomationBuilder from '@/components/automations/AutomationBuilder';
import WhatsAppAutoReplies from '@/components/automations/WhatsAppAutoReplies';

export default function AutomationsPage() {
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar onOpenWizard={() => setIsWizardOpen(true)} />

      <div className="flex-1 flex flex-col min-w-0">
        <Header onOpenWizard={() => setIsWizardOpen(true)} title="Automatizaciones" />

        <main className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8 space-y-6 max-w-[1280px] mx-auto w-full">
          <WhatsAppAutoReplies />
          <AutomationBuilder />
        </main>
      </div>

      <LandingWizardModal
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
      />
    </div>
  );
}
