'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import LandingEditor from '@/components/landings/LandingEditor';
import SalesLandingEditor from '@/components/landings/SalesLandingEditor';
import { logiStore } from '@/lib/store';
import { LandingPageConfig } from '@/lib/types';

// AI-generated landings (sales-v2) use the new editor; older ones keep the classic editor.
export default function EditorPage() {
  const params = useParams();
  const id = params?.id as string;
  const [landing, setLanding] = useState<LandingPageConfig | null | undefined>(undefined);

  useEffect(() => {
    setLanding(logiStore.getLandings().find((l) => l.id === id || l.slug === id) || null);
  }, [id]);

  if (landing === undefined) return <div className="min-h-screen bg-slate-100" />;
  if (landing === null) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-3 text-center p-6">
        <p className="text-sm text-slate-600">No encontramos esta landing en este navegador.</p>
        <Link href="/landings" className="text-sm font-semibold text-brand-blue">Volver a mis landings</Link>
      </div>
    );
  }
  if (landing.layout === 'sales-v2' && landing.sales) return <SalesLandingEditor initial={landing} />;
  return <LandingEditor landingId={id} />;
}
