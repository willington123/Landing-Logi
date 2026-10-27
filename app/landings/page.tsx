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
        <Header onOpenWizard={() => setIsWizardOpen(true)} title="Mis Landing Pages" />

        <main className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
          {/* Top Bar Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                Landing Pages Generadas
              </h2>
              <p className="text-xs text-slate-500">
                Páginas públicas optimizadas para conversiones de ecommerce y pago contraentrega.
              </p>
            </div>

            <button
              onClick={() => setIsWizardOpen(true)}
              className="px-5 py-2.5 bg-brand-gradient hover:opacity-95 text-white font-bold text-xs rounded-xl shadow-glow-orange flex items-center justify-center gap-2 transition transform active:scale-95"
            >
              <Sparkles className="w-4 h-4 text-amber-200" />
              <span>Crear Nueva Landing con IA</span>
            </button>
          </div>

          {/* Landings Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {landings.map((landing) => (
              <div
                key={landing.id}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-lg transition-all duration-200 flex flex-col group"
              >
                {/* Image & Badges */}
                <div className="relative h-48 bg-slate-900 overflow-hidden">
                  <img
                    src={landing.mainImage}
                    alt={landing.productName}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                  />
                  <div className="absolute top-3 left-3 flex gap-1.5">
                    <span className="text-[10px] font-black bg-brand-red text-white px-2 py-0.5 rounded shadow">
                      {landing.discountBadge || 'OFERTA ACTIVA'}
                    </span>
                    <span className="text-[10px] font-bold bg-brand-navy text-white px-2 py-0.5 rounded shadow">
                      {landing.themeStyle}
                    </span>
                  </div>

                  <div className="absolute bottom-3 right-3">
                    <span className="text-[11px] font-black bg-black/75 text-white backdrop-blur-sm px-2.5 py-1 rounded-lg">
                      ${landing.promoPrice.toLocaleString()} {landing.currency}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-1.5">
                    <h3 className="text-sm font-bold text-slate-900 group-hover:text-brand-red transition line-clamp-1">
                      {landing.productName}
                    </h3>
                    <p className="text-xs text-slate-500 line-clamp-2">
                      {landing.headline}
                    </p>
                  </div>

                  {/* Metrics */}
                  <div className="grid grid-cols-3 gap-2 py-3 border-y border-slate-100 text-center">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Visitas</p>
                      <p className="text-xs font-black text-slate-800">{landing.viewsCount}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Pedidos</p>
                      <p className="text-xs font-black text-emerald-600">{landing.ordersCount}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Conv.</p>
                      <p className="text-xs font-black text-brand-navy">
                        {landing.viewsCount > 0
                          ? ((landing.ordersCount / landing.viewsCount) * 100).toFixed(1)
                          : '0'}%
                      </p>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center gap-2 pt-1">
                    <Link
                      href={`/landings/editor/${landing.id}`}
                      className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>Editar</span>
                    </Link>

                    <button
                      onClick={() => handleCopyUrl(landing)}
                      title="Copiar URL Pública"
                      className="p-2 border border-slate-200 hover:border-slate-300 text-slate-600 rounded-xl transition"
                    >
                      {copiedId === landing.id ? (
                        <CheckCircle className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>

                    <a
                      href={landing.publishedUrl}
                      target="_blank"
                      rel="noreferrer"
                      title="Abrir Landing Pública"
                      className="p-2 bg-brand-red hover:bg-red-700 text-white rounded-xl shadow-sm transition"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>

                    <button
                      onClick={() => handleDelete(landing.id)}
                      title="Eliminar"
                      className="p-2 border border-slate-200 hover:border-red-200 text-slate-400 hover:text-red-600 rounded-xl transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
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
