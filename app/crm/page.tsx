'use client';

import React, { useState } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import OmnichannelInbox from '@/components/crm/OmnichannelInbox';
import LandingWizardModal from '@/components/landings/LandingWizardModal';

export default function CRMPage() {
  const [wizardOpen, setWizardOpen] = useState(false);

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">
      {/* Sidebar navigation */}
      <Sidebar onOpenWizard={() => setWizardOpen(true)} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <Header
          title="Mensajes"
          onOpenWizard={() => setWizardOpen(true)}
        />

        <main className="flex-1 p-3 md:p-4 overflow-hidden flex flex-col min-h-0">
          <OmnichannelInbox />
        </main>
      </div>

      {/* Global AI Landing Generator Wizard */}
      <LandingWizardModal
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
      />
    </div>
  );
}
