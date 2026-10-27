'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import LandingWizardModal from '@/components/landings/LandingWizardModal';
import { logiStore } from '@/lib/store';
import { LandingPageConfig } from '@/lib/types';
import {
  Sparkles,
  Layers,
  Eye,
  ExternalLink,
  Edit,
  Trash2,
  Copy,
  CheckCircle,
  Clock,
  TrendingUp,
  ShoppingBag,
  Plus,
} from 'lucide-react';

export default function LandingsPage() {
  const [landings, setLandings] = useState<LandingPageConfig[]>([]);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const refreshData = () => {
    setLandings(logiStore.getLandings());
  };

  useEffect(() => {
    refreshData();
  }, []);

  const handleCopyUrl = (landing: LandingPageConfig) => {
    const fullUrl = window.location.origin + landing.publishedUrl;
    navigator.clipboard.writeText(fullUrl);
    setCopiedId(landing.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDelete = (id: string) => {
    if (confirm('¿Estás seguro de que deseas eliminar esta landing page?')) {
      logiStore.deleteLanding(id);
      refreshData();
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar onOpenWizard={() => setIsWizardOpen(true)} />

      <div className="flex-1 flex flex-col min-w-0">
        <Header onOpenWizard={() => setIsWizardOpen(true)} title="Landing pages" />

        <main className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8 space-y-6 max-w-[1280px] mx-auto w-full">
          {/* Intro */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-900 tracking-tight">Tus landing pages</h2>
              <p className="text-sm text-slate-500 mt-0.5">
                {landings.length} {landings.length === 1 ? 'página publicada' : 'páginas publicadas'} con pago contraentrega.
              </p>
            </div>
            <button
              onClick={() => setIsWizardOpen(true)}
              className="h-10 px-4 rounded-xl bg-brand-gradient text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-[0_8px_20px_-8px_rgba(255,37,43,0.6)] hover:brightness-105 active:scale-[0.98] transition"
            >
              <Plus className="w-4 h-4" />
              Nueva landing
            </button>
          </div>

          {landings.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
              <div className="w-12 h-12 rounded-2xl bg-brand-red/[0.07] text-brand-red flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="text-base font-semibold text-slate-900">Crea tu primera landing</h3>
              <p className="text-sm text-slate-500 mt-1 mb-5">Sube una foto de tu producto y la IA hace el resto.</p>
              <button
                onClick={() => setIsWizardOpen(true)}
                className="h-10 px-4 rounded-xl bg-slate-900 text-white text-sm font-semibold inline-flex items-center gap-2 hover:bg-slate-800 transition"
              >
                <Sparkles className="w-4 h-4" /> Crear con IA
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {landings.map((landing) => {
                const conv = landing.viewsCount > 0 ? ((landing.ordersCount / landing.viewsCount) * 100).toFixed(1) : '0';
                return (
                  <div
                    key={landing.id}
                    className="group bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:shadow-[0_12px_32px_-12px_rgba(15,23,42,0.18)] hover:-translate-y-0.5 transition flex flex-col"
                  >
                    <Link href={`/landings/editor/${landing.id}`} className="relative aspect-[16/10] bg-slate-100 overflow-hidden block">
                      <img
                        src={landing.sales?.heroImage || landing.mainImage}
                        alt={landing.productName}
                        className="w-full h-full object-cover group-hover:scale-[1.03] transition duration-500"
                      />
                      <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/50 to-transparent" />
                      <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 text-xs font-medium bg-white/95 text-slate-700 px-2 py-1 rounded-full">
                        <span className={`w-1.5 h-1.5 rounded-full ${landing.isPublished ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        {landing.isPublished ? 'Publicada' : 'Borrador'}
                      </span>
                      {landing.layout === 'sales-v2' && (
                        <span className="absolute top-3 right-3 inline-flex items-center gap-1 text-xs font-medium bg-slate-900/80 text-white px-2 py-1 rounded-full backdrop-blur">
                          <Sparkles className="w-3 h-3" /> IA
                        </span>
                      )}
                      <span className="absolute bottom-3 left-3 text-sm font-semibold text-white">
                        ${landing.promoPrice.toLocaleString('es-CO')} {landing.currency}
                      </span>
                    </Link>

                    <div className="p-4 flex-1 flex flex-col">
                      <h3 className="text-[15px] font-semibold text-slate-900 truncate">{landing.productName}</h3>
                      <p className="text-sm text-slate-500 line-clamp-2 mt-1 min-h-[40px]">{landing.headline}</p>

                      <dl className="grid grid-cols-3 gap-2 mt-4 mb-4">
                        {[
                          ['Visitas', landing.viewsCount.toLocaleString('es-CO')],
                          ['Pedidos', landing.ordersCount.toLocaleString('es-CO')],
                          ['Conversión', `${conv}%`],
                        ].map(([k, v]) => (
                          <div key={k} className="rounded-xl bg-slate-50 px-3 py-2">
                            <dt className="text-xs text-slate-500">{k}</dt>
                            <dd className="text-sm font-semibold text-slate-900 tabular-nums">{v}</dd>
                          </div>
                        ))}
                      </dl>

                      <div className="mt-auto flex items-center gap-1.5">
                        <Link
                          href={`/landings/editor/${landing.id}`}
                          className="flex-1 h-9 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[13px] font-semibold flex items-center justify-center gap-1.5 transition"
                        >
                          <Edit className="w-3.5 h-3.5" />
                          Editar
                        </Link>
                        <a
                          href={landing.publishedUrl}
                          target="_blank"
                          rel="noreferrer"
                          title="Ver landing"
                          aria-label="Ver landing"
                          className="w-9 h-9 rounded-lg border border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900 flex items-center justify-center transition"
                        >
                          <Eye className="w-4 h-4" />
                        </a>
                        <button
                          onClick={() => handleCopyUrl(landing)}
                          title="Copiar enlace"
                          aria-label="Copiar enlace"
                          className="w-9 h-9 rounded-lg border border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900 flex items-center justify-center transition"
                        >
                          {copiedId === landing.id ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => handleDelete(landing.id)}
                          title="Eliminar"
                          aria-label="Eliminar"
                          className="w-9 h-9 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      <LandingWizardModal
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        onGenerated={() => refreshData()}
      />
    </div>
  );
}
