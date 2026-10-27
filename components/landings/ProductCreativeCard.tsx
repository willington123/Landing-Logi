'use client';

import React, { useRef } from 'react';
import {
  Sparkles,
  Flame,
  ShieldCheck,
  Truck,
  CheckCircle2,
  Download,
  Star,
  Zap,
  Package,
  Layers,
  Award,
  ChevronRight,
  Eye,
} from 'lucide-react';
import { LandingCreative } from '@/lib/types';

interface ProductCreativeCardProps {
  creative: LandingCreative;
  productName?: string;
  onToggleInclude?: (id: string) => void;
  onEdit?: (creative: LandingCreative) => void;
  downloadable?: boolean;
}

export default function ProductCreativeCard({
  creative,
  productName = 'Producto',
  onToggleInclude,
  onEdit,
  downloadable = true,
}: ProductCreativeCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  // Background Theme styles
  const getThemeClasses = () => {
    switch (creative.theme) {
      case 'dark':
        return 'bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white border-slate-800 shadow-2xl';
      case 'emerald':
        return 'bg-gradient-to-br from-emerald-950 via-slate-900 to-teal-950 text-white border-emerald-800/60 shadow-2xl';
      case 'blue':
        return 'bg-gradient-to-br from-[#0D1B54] via-[#172C8A] to-slate-950 text-white border-blue-800/60 shadow-2xl';
      case 'minimal':
        return 'bg-gradient-to-br from-white via-slate-50 to-slate-100 text-slate-900 border-slate-200 shadow-xl';
      case 'brand':
      default:
        return 'bg-gradient-to-br from-[#172C8A] via-[#0D1B54] to-slate-950 text-white border-slate-800 shadow-2xl';
    }
  };

  const handleDownloadImage = () => {
    // Open image or provide visual feedback
    const link = document.createElement('a');
    link.download = `creativo-${creative.type}-${Date.now()}.png`;
    link.href = creative.productImage;
    link.target = '_blank';
    link.click();
  };

  const isMinimal = creative.theme === 'minimal';

  return (
    <div className="flex flex-col rounded-2xl overflow-hidden border border-slate-200/80 bg-white shadow-md transition-all hover:shadow-xl">
      {/* Top Card Info Bar */}
      <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="font-extrabold uppercase tracking-wider text-[10px] px-2 py-0.5 rounded bg-brand-navy text-white">
            {creative.type === 'hero'
              ? 'Banner Hero Principal'
              : creative.type === 'infographic'
              ? 'Infografía de Características'
              : creative.type === 'combo'
              ? 'Creativo Promocional Combos'
              : 'Creativo Garantía & Despacho'}
          </span>
          <span className="text-slate-500 font-medium hidden sm:inline">
            Generado con tu imagen
          </span>
        </div>

        <div className="flex items-center gap-2">
          {onToggleInclude && (
            <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-bold text-slate-700">
              <input
                type="checkbox"
                checked={creative.includedInLanding}
                onChange={() => onToggleInclude(creative.id)}
                className="w-3.5 h-3.5 text-brand-red rounded border-slate-300 focus:ring-brand-red cursor-pointer"
              />
              <span>Mostrar en Landing</span>
            </label>
          )}

          {downloadable && (
            <button
              onClick={handleDownloadImage}
              title="Descargar este creativo para Meta Ads / TikTok Ads"
              className="p-1 rounded text-slate-500 hover:text-brand-navy hover:bg-slate-200 transition"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* CREATIVE VISUAL CANVAS (BASED ON UPLOADED PRODUCT IMAGE)                   */}
      {/* ========================================================================= */}
      <div
        ref={cardRef}
        className={`relative p-6 sm:p-8 overflow-hidden min-h-[340px] flex flex-col justify-between ${getThemeClasses()}`}
      >
        {/* Glow ambient effects */}
        {!isMinimal && (
          <>
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-[#FF252B]/20 via-[#FF5A16]/20 to-transparent blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-[#172C8A]/30 to-transparent blur-3xl pointer-events-none" />
          </>
        )}

        {/* 1. TOP HEADER OF THE CREATIVE */}
        <div className="relative z-10 space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            {creative.badge && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-gradient-to-r from-[#FF252B] to-[#FF5A16] text-white shadow-md">
                <Flame className="w-3.5 h-3.5 fill-white text-yellow-300" />
                <span>{creative.badge}</span>
              </span>
            )}

            <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
              isMinimal ? 'bg-slate-100 text-slate-800 border-slate-200' : 'bg-black/40 backdrop-blur-md text-white border-white/10'
            }`}>
              <div className="flex text-amber-400">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-3 h-3 fill-current" />
                ))}
              </div>
              <span className={isMinimal ? 'text-slate-700' : 'text-white/90'}>4.9/5 Calificación</span>
            </div>
          </div>

          <h3 className={`text-xl sm:text-2xl font-black tracking-tight leading-tight max-w-md ${
            isMinimal ? 'text-slate-900' : 'text-white'
          }`}>
            {creative.title}
          </h3>
          <p className={`text-xs sm:text-sm max-w-sm leading-relaxed ${
            isMinimal ? 'text-slate-600' : 'text-slate-300'
          }`}>
            {creative.subtitle}
          </p>
        </div>

        {/* 2. CENTER: THE USER'S PRODUCT IMAGE INTEGRATED INTO CREATIVE */}
        <div className="relative z-10 my-4 flex items-center justify-center">
          {/* Main Visual Composition */}
          {creative.type === 'hero' && (
            <div className="relative flex items-center justify-center group">
              {!isMinimal && (
                <div className="absolute inset-0 bg-gradient-to-r from-[#FF252B]/30 to-[#FF5A16]/30 blur-2xl rounded-full scale-110" />
              )}

              <div className={`relative w-48 h-48 sm:w-56 sm:h-56 rounded-2xl overflow-hidden border shadow-xl flex items-center justify-center p-2 ${
                isMinimal ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/20'
              }`}>
                <img
                  src={creative.productImage}
                  alt={productName}
                  className="w-full h-full object-contain filter drop-shadow-md transition-transform duration-300 group-hover:scale-105"
                />
              </div>

              {/* COD floating badge */}
              <div className="absolute -bottom-3 -right-2 bg-emerald-600 text-white text-[11px] font-black px-3 py-1.5 rounded-xl shadow-md flex items-center gap-1 border border-white/20 uppercase tracking-wide">
                <Truck className="w-3.5 h-3.5" />
                <span>Pago Contraentrega</span>
              </div>
            </div>
          )}

          {creative.type === 'infographic' && (
            <div className="relative w-full max-w-lg">
              {/* Product in Center */}
              <div className={`relative mx-auto w-40 h-40 sm:w-48 sm:h-48 rounded-2xl overflow-hidden border shadow-xl p-2 flex items-center justify-center ${
                isMinimal ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-indigo-400/30'
              }`}>
                <img
                  src={creative.productImage}
                  alt={productName}
                  className="w-full h-full object-contain filter drop-shadow-md"
                />
              </div>

              {/* 4 Feature Callouts around the product */}
              {creative.callouts && creative.callouts.length > 0 && (
                <div className="grid grid-cols-2 gap-3 mt-4">
                  {creative.callouts.map((c, i) => (
                    <div
                      key={i}
                      className={`rounded-xl p-2.5 border shadow-xs space-y-0.5 transition ${
                        isMinimal
                          ? 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                          : 'bg-white/10 backdrop-blur-md border-white/10 hover:bg-white/15'
                      }`}
                    >
                      <span className={`text-[9px] font-extrabold uppercase tracking-wider block ${
                        isMinimal ? 'text-[#172C8A]' : 'text-amber-300'
                      }`}>
                        • {c.label}
                      </span>
                      <p className={`text-xs font-bold line-clamp-2 ${
                        isMinimal ? 'text-slate-800' : 'text-white'
                      }`}>
                        {c.text}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {creative.type === 'combo' && (
            <div className="relative flex items-center justify-center gap-3">
              {/* Unit 1 */}
              <div className={`relative w-36 h-36 sm:w-44 sm:h-44 rounded-2xl overflow-hidden border shadow-md p-2 flex items-center justify-center -rotate-6 ${
                isMinimal ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-amber-400/40'
              }`}>
                <img
                  src={creative.productImage}
                  alt={productName}
                  className="w-full h-full object-contain filter drop-shadow-sm"
                />
                <span className="absolute bottom-1 inset-x-1 bg-slate-900/90 text-white text-[9px] font-bold text-center py-0.5 rounded">
                  Unidad 1
                </span>
              </div>

              {/* Plus badge */}
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-[#FF252B] to-[#FF5A16] text-white font-black text-sm flex items-center justify-center shadow-md z-20">
                +
              </div>

              {/* Unit 2 */}
              <div className={`relative w-36 h-36 sm:w-44 sm:h-44 rounded-2xl overflow-hidden border shadow-md p-2 flex items-center justify-center rotate-6 ${
                isMinimal ? 'bg-emerald-50 border-emerald-300' : 'bg-white/5 border-emerald-400/40'
              }`}>
                <img
                  src={creative.productImage}
                  alt={productName}
                  className="w-full h-full object-contain filter drop-shadow-sm"
                />
                <span className="absolute bottom-1 inset-x-1 bg-emerald-800 text-white text-[9px] font-bold text-center py-0.5 rounded">
                  Unidad 2 (50% OFF)
                </span>
              </div>
            </div>
          )}

          {creative.type === 'guarantee' && (
            <div className={`relative flex flex-col sm:flex-row items-center gap-4 p-4 rounded-2xl border w-full max-w-md ${
              isMinimal ? 'bg-slate-50 border-slate-200' : 'bg-white/10 backdrop-blur-md border-white/15'
            }`}>
              <div className={`w-28 h-28 rounded-xl overflow-hidden p-1 flex-shrink-0 flex items-center justify-center border ${
                isMinimal ? 'bg-white border-slate-200' : 'bg-white/10 border-white/20'
              }`}>
                <img
                  src={creative.productImage}
                  alt={productName}
                  className="w-full h-full object-contain"
                />
              </div>

              <div className="text-left space-y-1.5 flex-1">
                <div className={`flex items-center gap-1.5 text-xs font-extrabold uppercase ${
                  isMinimal ? 'text-emerald-700' : 'text-amber-300'
                }`}>
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Cero Riesgo para el Comprador</span>
                </div>
                <p className={`text-xs font-medium ${
                  isMinimal ? 'text-slate-600' : 'text-white/90'
                }`}>
                  1. Recibes en tu casa u oficina.<br />
                  2. Verificas el paquete con el repartidor.<br />
                  3. Pagas en efectivo al instante.
                </p>
                <div className="flex items-center gap-2 pt-1 text-[10px]">
                  <span className={`px-2 py-0.5 rounded ${isMinimal ? 'bg-slate-200 text-slate-700' : 'bg-white/15 text-white/80'}`}>Servientrega</span>
                  <span className={`px-2 py-0.5 rounded ${isMinimal ? 'bg-slate-200 text-slate-700' : 'bg-white/15 text-white/80'}`}>Interrapidísimo</span>
                  <span className={`px-2 py-0.5 rounded ${isMinimal ? 'bg-slate-200 text-slate-700' : 'bg-white/15 text-white/80'}`}>Envía</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 3. FOOTER OF THE CREATIVE */}
        <div className={`relative z-10 pt-3 border-t flex items-center justify-between flex-wrap gap-2 text-xs ${
          isMinimal ? 'border-slate-200' : 'border-white/10'
        }`}>
          {creative.highlightText ? (
            <div className={`flex items-center gap-1.5 font-bold ${
              isMinimal ? 'text-[#172C8A]' : 'text-amber-300'
            }`}>
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>{creative.highlightText}</span>
            </div>
          ) : (
            <div className={`flex items-center gap-1.5 ${
              isMinimal ? 'text-slate-500' : 'text-slate-400'
            }`}>
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Garantía Oficial LogiPages</span>
            </div>
          )}

          {creative.priceTag && (
            <div className="bg-gradient-to-r from-yellow-400 to-amber-500 text-slate-950 font-black px-3 py-1 rounded-lg text-xs shadow-xs">
              {creative.priceTag}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
