'use client';

// Sample of a landing style (opened from "Crear landing con IA" → Ver muestra). Made-up product, drawn pictures,
// orders are not saved.
import { useMemo } from 'react';
import { notFound } from 'next/navigation';
import SalesPageRenderer from '@/components/landings/SalesPageRenderer';
import { demoLanding } from '@/lib/landing-demo';
import { IMPACT_STYLES } from '@/lib/landing-styles';
import type { ImpactStyle } from '@/lib/types';

export default function StyleSamplePage({ params }: { params: { style: string } }) {
  const ok = IMPACT_STYLES.some((s) => s.id === params.style);
  const config = useMemo(() => (ok ? demoLanding(params.style as ImpactStyle) : null), [ok, params.style]);
  if (!config) notFound();
  return <SalesPageRenderer config={config} previewMode onOrderSubmit={async (o) => o} />;
}
