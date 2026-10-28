'use client';

// Live preview used inside the editor's iframe. The editor sends the landing being
// edited with postMessage, so the preview updates without reloading (and keeps scroll).
import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import HighImpactLandingRenderer from '@/components/landings/HighImpactLandingRenderer';
import { logiStore } from '@/lib/store';
import { LandingPageConfig } from '@/lib/types';

export default function LandingPreviewPage() {
  const params = useParams();
  const id = params?.id as string;
  const [config, setConfig] = useState<LandingPageConfig | null>(null);

  useEffect(() => {
    setConfig(logiStore.getLandings().find((l) => l.id === id) || null);
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === 'lp-preview' && e.data.config?.id === id) setConfig(e.data.config);
    };
    window.addEventListener('message', onMessage);
    window.parent?.postMessage({ type: 'lp-preview-ready', id }, window.location.origin);
    return () => window.removeEventListener('message', onMessage);
  }, [id]);

  if (!config) return <div className="min-h-screen bg-white" />;
  return <HighImpactLandingRenderer config={config} previewMode onOrderSubmit={() => {}} />;
}
