'use client';

// Public landing (client side): Meta Pixel + order submission.
// With Supabase configured the landing comes from the server and orders go to the API;
// otherwise it falls back to the browser's local storage (local testing).
import React, { useEffect, useState } from 'react';
import HighImpactLandingRenderer from '@/components/landings/HighImpactLandingRenderer';
import { logiStore } from '@/lib/store';
import { LandingPageConfig } from '@/lib/types';
import { initMetaPixel, trackPixelOnce } from '@/lib/meta-pixel';

function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
      <div className="w-14 h-14 rounded-2xl bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-lg mb-4">404</div>
      <h1 className="text-xl font-bold text-slate-900 mb-1">Página no encontrada</h1>
      <p className="text-sm text-slate-500 max-w-sm">Esta oferta no existe o ya no está disponible.</p>
    </div>
  );
}

export default function PublicLanding({ initial, slug, cloud }: { initial: LandingPageConfig | null; slug: string; cloud: boolean }) {
  const [config, setConfig] = useState<LandingPageConfig | null>(initial);
  const [loading, setLoading] = useState(!cloud && !initial);

  // Local mode: read from this browser.
  useEffect(() => {
    if (cloud || initial) return;
    setConfig(logiStore.getLandingBySlug(slug) || null);
    setLoading(false);
  }, [cloud, initial, slug]);

  // Visit counter: once per browser session, never for bots without JS.
  useEffect(() => {
    if (!config) return;
    const key = `lp_viewed_${config.id}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch {
      // private mode: count anyway
    }
    if (cloud) {
      fetch('/api/public/view', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ landingId: config.id }) }).catch(() => {});
    } else {
      const l = logiStore.getLandingBySlug(config.slug);
      if (l) logiStore.saveLanding({ ...l, viewsCount: (l.viewsCount || 0) + 1 });
    }
  }, [config, cloud]);

  // Meta Pixel
  useEffect(() => {
    if (!config?.metaPixelId) return;
    initMetaPixel(config.metaPixelId);
    trackPixelOnce(`view-${config.id}`, 'ViewContent', {
      content_name: config.productName,
      content_ids: [config.id],
      content_type: 'product',
      value: config.promoPrice,
      currency: config.currency || 'COP',
    });
  }, [config]);

  const submitOrder = async (order: any) => {
    if (!cloud) return logiStore.createOrder(order);
    const q = new URLSearchParams(window.location.search);
    const res = await fetch('/api/public/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...order,
        landingId: config!.id,
        utmSource: q.get('utm_source'),
        utmCampaign: q.get('utm_campaign'),
        utmContent: q.get('utm_content'),
        adId: q.get('ad_id'),
        fbclid: q.get('fbclid'),
        pageUrl: window.location.href,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) throw new Error(data.error || 'No pudimos registrar tu pedido. Inténtalo de nuevo.');
    return { ...data.order, pixelEvent: data.pixelEvent };
  };

  if (loading) return <div className="min-h-screen bg-white" />;
  if (!config) return <NotFound />;
  return (
    <main className="min-h-screen bg-white">
      <HighImpactLandingRenderer config={config} previewMode={false} onOrderSubmit={submitOrder} />
    </main>
  );
}
