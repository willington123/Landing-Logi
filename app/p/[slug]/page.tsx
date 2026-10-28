'use client';

import React, { useState, useEffect } from 'react';
import { notFound, useParams } from 'next/navigation';
import HighImpactLandingRenderer from '@/components/landings/HighImpactLandingRenderer';
import { logiStore } from '@/lib/store';
import { LandingPageConfig } from '@/lib/types';
import { initMetaPixel, trackPixelOnce } from '@/lib/meta-pixel';

export default function PublicLandingPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const [config, setConfig] = useState<LandingPageConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    const landing = logiStore.getLandingBySlug(slug);
    if (landing) {
      // Increment view count
      landing.viewsCount = (landing.viewsCount || 0) + 1;
      logiStore.saveLanding(landing);
      setConfig(landing);
      if (landing.metaPixelId) {
        initMetaPixel(landing.metaPixelId);
        trackPixelOnce(`view-${landing.id}`, 'ViewContent', {
          content_name: landing.productName,
          content_ids: [landing.id],
          content_type: 'product',
          value: landing.promoPrice,
          currency: landing.currency || 'COP',
        });
      }
    }
    setIsLoading(false);
  }, [slug]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <div className="w-12 h-12 border-4 border-[#FF252B] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-semibold text-slate-300">Cargando oferta exclusiva de LogiPages...</p>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center font-black text-2xl mb-4">
          404
        </div>
        <h1 className="text-2xl font-black text-slate-900 mb-2">Página no encontrada</h1>
        <p className="text-sm text-slate-600 max-w-md mb-6">
          La landing page solicitada no existe o ha sido despublicada por el comerciante.
        </p>
        <a
          href="/dashboard"
          className="px-6 py-2.5 bg-brand-gradient text-white rounded-xl text-xs font-bold shadow-md hover:opacity-95 transition"
        >
          Ir al Panel de LogiPages AI
        </a>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-white">
      <HighImpactLandingRenderer
        config={config}
        previewMode={false}
        onOrderSubmit={(orderData) => {
          logiStore.createOrder(orderData);
        }}
      />
    </main>
  );
}
