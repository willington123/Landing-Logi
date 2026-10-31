'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Smartphone,
  Tablet,
  Monitor,
  Save,
  Sparkles,
  ExternalLink,
  Layers,
  Palette,
  Type,
  Tag,
  Wand2,
  CheckCircle,
  Copy,
  Clock,
  Flame,
  ShieldCheck,
  Plus,
} from 'lucide-react';
import { LandingPageConfig, LandingCreative } from '@/lib/types';
import { logiStore } from '@/lib/store';
import HighImpactLandingRenderer from './HighImpactLandingRenderer';
import ProductCreativeCard from './ProductCreativeCard';
import { buildDefaultCreativesForProduct } from '@/lib/creative-generator';

interface LandingEditorProps {
  landingId: string;
}

export default function LandingEditor({ landingId }: LandingEditorProps) {
  const [config, setConfig] = useState<LandingPageConfig | null>(null);
  const [viewport, setViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [activeTab, setActiveTab] = useState<'text' | 'images' | 'creatives' | 'pricing' | 'design' | 'ai'>('text');
  const [selectedEditorCreativeTab, setSelectedEditorCreativeTab] = useState<'hero' | 'infographic' | 'combo' | 'guarantee'>('hero');
  const [isOptimizingCreatives, setIsOptimizingCreatives] = useState(false);
  const [creativeFeedback, setCreativeFeedback] = useState<string | null>(null);
  const [isSavedToast, setIsSavedToast] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isGeneratingGemini, setIsGeneratingGemini] = useState(false);
  const [geminiApiKey, setGeminiApiKey] = useState(() => {
    if (typeof window !== 'undefined') {
      return logiStore.getGeminiApiKey();
    }
    return '';
  });
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [geminiError, setGeminiError] = useState<string | null>(null);

  // AI Copilot state
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAiProcessing, setIsAiProcessing] = useState(false);

  const handleUploadMainImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && config) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        const updated = {
          ...config,
          mainImage: base64,
          galleryImages: [base64, ...(config.galleryImages.slice(1) || [])],
        };
        setConfig(updated);
        logiStore.saveLanding(updated);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddGalleryImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0 && config) {
      Array.from(files).forEach((file) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const base64 = event.target?.result as string;
          setConfig((prev) => {
            if (!prev) return prev;
            const updated = { ...prev, galleryImages: [...prev.galleryImages, base64] };
            logiStore.saveLanding(updated);
            return updated;
          });
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const handleGenerateGeminiPhotos = async () => {
    // Forward directly to Gemini Vision creative optimization using the product's uploaded image
    await handleOptimizeCreativesWithGemini();
  };

  const handleToggleCreative = (creativeId: string) => {
    if (!config) return;
    const currentCreatives = config.creatives && config.creatives.length > 0
      ? config.creatives
      : buildDefaultCreativesForProduct({
          productName: config.productName,
          category: config.category,
          productImage: config.mainImage,
          regularPrice: config.regularPrice,
          promoPrice: config.promoPrice,
        });

    const updated = currentCreatives.map((c) =>
      c.id === creativeId ? { ...c, includedInLanding: !c.includedInLanding } : c
    );
    const newConfig = { ...config, creatives: updated };
    setConfig(newConfig);
    logiStore.saveLanding(newConfig);
  };

  const handleChangeTheme = (creativeId: string, theme: any) => {
    if (!config) return;
    const currentCreatives = config.creatives && config.creatives.length > 0
      ? config.creatives
      : buildDefaultCreativesForProduct({
          productName: config.productName,
          category: config.category,
          productImage: config.mainImage,
          regularPrice: config.regularPrice,
          promoPrice: config.promoPrice,
        });

    const updated = currentCreatives.map((c) =>
      c.id === creativeId ? { ...c, theme } : c
    );
    const newConfig = { ...config, creatives: updated };
    setConfig(newConfig);
    logiStore.saveLanding(newConfig);
  };

  const handleOptimizeCreativesWithGemini = async () => {
    if (!config) return;
    const key = geminiApiKey || logiStore.getGeminiApiKey();
    if (!key.trim()) {
      setShowKeyInput(true);
      setGeminiError('Introduce tu API Key de Gemini para optimizar los creativos con visión artificial.');
      return;
    }

    setIsOptimizingCreatives(true);
    setCreativeFeedback(null);
    setGeminiError(null);

    try {
      const res = await fetch('/api/generate-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'analyze_image',
          imageBase64: config.mainImage,
          productName: config.productName,
          category: config.category,
          geminiApiKey: key,
        }),
      });

      const data = await res.json();
      if (data.success && data.analysis) {
        const { headline, subheadline, benefits } = data.analysis;
        const updated = buildDefaultCreativesForProduct({
          productName: config.productName,
          category: config.category,
          productImage: config.mainImage,
          regularPrice: config.regularPrice,
          promoPrice: config.promoPrice,
          benefits,
        });

        if (headline) updated[0].title = headline;
        if (subheadline) updated[0].subtitle = subheadline;

        const newConfig = { ...config, creatives: updated };
        setConfig(newConfig);
        logiStore.saveLanding(newConfig);
        setCreativeFeedback('✨ Creativos optimizados con Gemini Vision basados en tu foto.');
        setIsSavedToast(true);
        setTimeout(() => setIsSavedToast(false), 2500);
      } else {
        setGeminiError(data.error || 'Error al optimizar creativos con Gemini.');
      }
    } catch (err: any) {
      setGeminiError(err.message || 'Error al conectar con Gemini.');
    } finally {
      setIsOptimizingCreatives(false);
    }
  };

  useEffect(() => {
    const landings = logiStore.getLandings();
    const found = landings.find((l) => l.id === landingId || l.slug === landingId);
    if (found) {
      setConfig(found);
    }
  }, [landingId]);

  if (!config) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-brand-blue border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs font-semibold text-slate-500">Cargando editor visual de Konnexa...</p>
        </div>
      </div>
    );
  }

  const handleSave = () => {
    logiStore.saveLanding(config);
    setIsSavedToast(true);
    setTimeout(() => setIsSavedToast(false), 2500);
  };

  const handleCopyPublicUrl = () => {
    const fullUrl = window.location.origin + config.publishedUrl;
    navigator.clipboard.writeText(fullUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleApplyAiInstruction = async () => {
    if (!aiPrompt.trim()) return;
    setIsAiProcessing(true);

    await new Promise((r) => setTimeout(r, 800));

    const promptLower = aiPrompt.toLowerCase();
    const updated = { ...config };

    if (promptLower.includes('urgente') || promptLower.includes('escasez') || promptLower.includes('reloj')) {
      updated.urgencyText = '🚨 ÚLTIMAS 5 UNIDADES DISPONIBLES EN BODEGA — LA OFERTA EXPIRA EN MINUTOS.';
      updated.stockLeft = 4;
      updated.countdownMinutes = 9;
      updated.discountBadge = '⚡ 60% DE DESCUENTO — LIQUIDACIÓN RELÁMPAGO';
    } else if (promptLower.includes('oscuro') || promptLower.includes('dark') || promptLower.includes('negro') || promptLower.includes('luxe')) {
      updated.themeStyle = 'dark-luxe';
    } else if (promptLower.includes('titular') || promptLower.includes('agresivo') || promptLower.includes('copy')) {
      updated.headline = `¡Atención! Dile Adiós a las Complicaciones con ${config.productName} 100% Original`;
      updated.subheadline = `La solución definitiva probada por miles de personas. No pagues nada por adelantado: recíbelo en 24-48 horas y paga en efectivo al recibir.`;
    } else {
      updated.urgencyText = `🔥 OFERTA EXCLUSIVA DE TEMPORADA — AHORRA HASTA 55% EN ${config.productName.toUpperCase()}`;
      updated.discountBadge = 'OFERTA VERIFICADA';
    }

    setConfig(updated);
    logiStore.saveLanding(updated);
    setIsAiProcessing(false);
    setAiPrompt('');
    setIsSavedToast(true);
    setTimeout(() => setIsSavedToast(false), 2500);
  };

  return (
    <div className="h-screen flex flex-col bg-slate-900 text-slate-100 overflow-hidden select-none">
      {/* Top Navbar */}
      <header className="h-14 bg-slate-950 border-b border-slate-800 flex items-center justify-between px-4 z-20">
        {/* Left: Back & Title */}
        <div className="flex items-center gap-3">
          <Link
            href="/landings"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="bg-white px-2 py-1 rounded-md hidden sm:flex items-center shadow-sm">
            <img src="/brand/konnexa-logo-dark.png" alt="Konnexa" className="h-4 w-auto object-contain" />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-white truncate max-w-[200px] sm:max-w-xs">
              {config.productName}
            </span>
            <span className="text-[10px] bg-brand-navy/60 text-blue-200 border border-brand-navy px-2 py-0.5 rounded font-mono">
              /p/{config.slug}
            </span>
          </div>
        </div>

        {/* Center: Device Viewport Switcher */}
        <div className="hidden md:flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setViewport('desktop')}
            className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              viewport === 'desktop' ? 'bg-brand-navyDark text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
            title="Vista Escritorio"
          >
            <Monitor className="w-4 h-4" />
            <span className="hidden lg:inline text-[11px]">Desktop</span>
          </button>
          <button
            onClick={() => setViewport('tablet')}
            className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              viewport === 'tablet' ? 'bg-brand-navyDark text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
            title="Vista Tablet"
          >
            <Tablet className="w-4 h-4" />
            <span className="hidden lg:inline text-[11px]">Tablet</span>
          </button>
          <button
            onClick={() => setViewport('mobile')}
            className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              viewport === 'mobile' ? 'bg-brand-navyDark text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
            title="Vista Móvil (iPhone/Android)"
          >
            <Smartphone className="w-4 h-4" />
            <span className="hidden lg:inline text-[11px]">Móvil</span>
          </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {/* Copy URL */}
          <button
            onClick={handleCopyPublicUrl}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition"
          >
            <Copy className="w-3.5 h-3.5 text-slate-400" />
            <span>{copiedLink ? '¡URL Copiada!' : 'Copiar URL'}</span>
          </button>

          {/* View Public Live Link */}
          <a
            href={config.publishedUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition"
          >
            <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">Ver Online</span>
          </a>

          {/* Save Button */}
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-brand-gradient hover:opacity-95 text-white text-xs font-bold shadow transition"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Guardar Cambios</span>
          </button>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Controls Drawer */}
        <div className="w-80 md:w-96 bg-slate-950 border-r border-slate-800 flex flex-col h-full z-10">
          {/* Subtabs */}
          <div className="grid grid-cols-6 border-b border-slate-800 text-[10px] font-bold text-slate-400 bg-slate-900/50">
            <button
              onClick={() => setActiveTab('text')}
              className={`py-3 flex flex-col items-center gap-1 transition ${
                activeTab === 'text' ? 'text-brand-green border-b-2 border-brand-green bg-slate-900' : 'hover:text-white'
              }`}
            >
              <Type className="w-3.5 h-3.5" />
              <span>Textos</span>
            </button>
            <button
              onClick={() => setActiveTab('images')}
              className={`py-3 flex flex-col items-center gap-1 transition ${
                activeTab === 'images' ? 'text-brand-green border-b-2 border-brand-green bg-slate-900' : 'hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Fotos</span>
            </button>
            <button
              onClick={() => setActiveTab('creatives')}
              className={`py-3 flex flex-col items-center gap-1 transition ${
                activeTab === 'creatives' ? 'text-yellow-400 border-b-2 border-yellow-400 bg-slate-900 font-bold' : 'hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Creativos</span>
            </button>
            <button
              onClick={() => setActiveTab('pricing')}
              className={`py-3 flex flex-col items-center gap-1 transition ${
                activeTab === 'pricing' ? 'text-brand-green border-b-2 border-brand-green bg-slate-900' : 'hover:text-white'
              }`}
            >
              <Tag className="w-3.5 h-3.5" />
              <span>Combos</span>
            </button>
            <button
              onClick={() => setActiveTab('design')}
              className={`py-3 flex flex-col items-center gap-1 transition ${
                activeTab === 'design' ? 'text-brand-green border-b-2 border-brand-green bg-slate-900' : 'hover:text-white'
              }`}
            >
              <Palette className="w-3.5 h-3.5" />
              <span>Estilo</span>
            </button>
            <button
              onClick={() => setActiveTab('ai')}
              className={`py-3 flex flex-col items-center gap-1 transition ${
                activeTab === 'ai' ? 'text-amber-400 border-b-2 border-amber-400 bg-slate-900 font-black' : 'hover:text-white'
              }`}
            >
              <Wand2 className="w-3.5 h-3.5" />
              <span>Copilot</span>
            </button>
          </div>

          {/* Drawer Body Scroll */}
          <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs text-slate-300">
            {/* TAB 1: TEXTS */}
            {activeTab === 'text' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                    Titular Persuasivo (Hero):
                  </label>
                  <input
                    type="text"
                    value={config.headline}
                    onChange={(e) => setConfig({ ...config, headline: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:ring-1 focus:ring-brand-green"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                    Subtítulo y Propuesta de Valor:
                  </label>
                  <textarea
                    rows={4}
                    value={config.subheadline}
                    onChange={(e) => setConfig({ ...config, subheadline: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:ring-1 focus:ring-brand-green"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                    Texto de Urgencia / Stock:
                  </label>
                  <input
                    type="text"
                    value={config.urgencyText}
                    onChange={(e) => setConfig({ ...config, urgencyText: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white focus:ring-1 focus:ring-brand-green"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                    Texto de Garantía:
                  </label>
                  <input
                    type="text"
                    value={config.guaranteeText}
                    onChange={(e) => setConfig({ ...config, guaranteeText: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white focus:ring-1 focus:ring-brand-green"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                    WhatsApp para Atención:
                  </label>
                  <input
                    type="text"
                    value={config.whatsappNumber}
                    onChange={(e) => setConfig({ ...config, whatsappNumber: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white focus:ring-1 focus:ring-brand-green"
                  />
                  <label className="mt-2 flex items-center justify-between gap-3 text-xs text-slate-300 cursor-pointer">
                    <span>Al terminar el pedido, llevar al cliente a WhatsApp con sus datos</span>
                    <input
                      type="checkbox"
                      checked={config.whatsappRedirect !== false}
                      onChange={(e) => setConfig({ ...config, whatsappRedirect: e.target.checked })}
                      className="rounded bg-slate-900 border-slate-700 text-brand-green focus:ring-brand-green"
                    />
                  </label>
                </div>
              </div>
            )}

            {/* TAB: IMAGES & GEMINI AI */}
            {activeTab === 'images' && (
              <div className="space-y-4">
                {/* Hero Image Management */}
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-2.5">
                  <span className="text-[11px] font-bold text-amber-400 block">
                    Foto Principal (Hero):
                  </span>
                  <div className="w-full h-40 rounded-lg overflow-hidden border border-slate-800 relative group bg-black/40 flex items-center justify-center">
                    <img
                      src={config.mainImage}
                      alt={config.productName}
                      className="w-full h-full object-contain"
                    />
                  </div>

                  <label className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold cursor-pointer flex items-center justify-center gap-1.5 transition">
                    <Plus className="w-3.5 h-3.5 text-brand-green" />
                    <span>Subir Foto Principal desde PC</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleUploadMainImage}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* Gemini AI Generator Card */}
                <div className="p-3.5 bg-gradient-to-br from-indigo-950/60 to-slate-900 border border-indigo-700/50 rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between text-indigo-300 font-bold text-xs">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-300" />
                      <span>Estudio Publicitario Gemini AI</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowKeyInput(!showKeyInput)}
                      className="text-[10px] text-indigo-400 hover:text-indigo-200 underline font-normal"
                    >
                      {showKeyInput ? 'Ocultar API Key' : 'Configurar API Key'}
                    </button>
                  </div>

                  {showKeyInput && (
                    <div className="p-2.5 bg-slate-900/90 rounded-lg border border-slate-800 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-400 font-bold">API Key de Google Gemini:</span>
                        <a
                          href="https://aistudio.google.com/app/apikey"
                          target="_blank"
                          rel="noreferrer"
                          className="text-[9px] text-indigo-400 hover:underline"
                        >
                          Obtener gratis ↗
                        </a>
                      </div>
                      <input
                        type="password"
                        placeholder="AIzaSy..."
                        value={geminiApiKey}
                        onChange={(e) => {
                          setGeminiApiKey(e.target.value);
                          logiStore.saveGeminiApiKey(e.target.value);
                          if (geminiError) setGeminiError(null);
                        }}
                        className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-[11px] text-white font-mono"
                      />
                    </div>
                  )}

                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Gemini Vision analiza la foto de tu producto y crea los 4 creativos publicitarios de alta conversión (Banner Hero, Infografía con flechas, Combos 2x1 y Garantía COD).
                  </p>

                  {creativeFeedback && (
                    <div className="p-2 bg-emerald-950/80 border border-emerald-800 rounded-lg text-emerald-200 text-[11px]">
                      {creativeFeedback}
                    </div>
                  )}

                  {geminiError && (
                    <div className="p-2 bg-red-950/80 border border-red-800 rounded-lg text-red-200 text-[11px]">
                      {geminiError}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleOptimizeCreativesWithGemini}
                    disabled={isOptimizingCreatives}
                    className="w-full py-2.5 bg-gradient-to-r from-brand-blue via-brand-green to-indigo-600 hover:opacity-95 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {isOptimizingCreatives ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Gemini Vision analizando foto...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-amber-200" />
                        <span>Crear / Optimizar 4 Creativos con Gemini Vision</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Gallery Images */}
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-300">
                      Galería de Fotos ({config.galleryImages.length}):
                    </span>
                    <label className="text-[10px] font-bold text-brand-green hover:underline cursor-pointer flex items-center gap-1">
                      <Plus className="w-3 h-3" />
                      <span>Añadir fotos</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleAddGalleryImages}
                        className="hidden"
                      />
                    </label>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-1">
                    {config.galleryImages.map((imgUrl, idx) => (
                      <div key={idx} className="relative group rounded-lg overflow-hidden border border-slate-800">
                        <img src={imgUrl} alt={`Gal ${idx}`} className="w-full h-16 object-cover" />
                        <button
                          type="button"
                          onClick={() => {
                            const updated = config.galleryImages.filter((_, i) => i !== idx);
                            const newConfig = { ...config, galleryImages: updated };
                            setConfig(newConfig);
                            logiStore.saveLanding(newConfig);
                          }}
                          className="absolute top-1 right-1 bg-red-600 text-white p-0.5 rounded opacity-0 group-hover:opacity-100 transition"
                          title="Eliminar"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB: CREATIVOS GENERADOS A PARTIR DE LAS IMÁGENES */}
            {activeTab === 'creatives' && (
              <div className="space-y-4">
                <div className="p-3 bg-gradient-to-r from-brand-navyDark to-slate-900 border border-indigo-700/50 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-white flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      <span>Estudio de Creativos con tu Imagen</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleOptimizeCreativesWithGemini}
                      disabled={isOptimizingCreatives}
                      className="px-2.5 py-1 rounded bg-gradient-to-r from-brand-blue to-brand-green text-white text-[10px] font-bold shadow hover:opacity-90 flex items-center gap-1"
                    >
                      <Sparkles className="w-3 h-3 text-yellow-300" />
                      <span>{isOptimizingCreatives ? 'Optimizando...' : 'Optimizar con Gemini'}</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Banners publicitarios de alta conversión creados a partir de la foto de tu producto.
                  </p>
                  {creativeFeedback && (
                    <div className="text-[11px] text-emerald-400 font-semibold">{creativeFeedback}</div>
                  )}
                  {geminiError && (
                    <div className="text-[11px] text-red-400 font-semibold">{geminiError}</div>
                  )}
                </div>

                {/* Sub-selector for the 4 creatives */}
                <div className="grid grid-cols-2 gap-1.5 text-[11px] font-bold">
                  {[
                    { id: 'hero', label: '1. Banner Hero' },
                    { id: 'infographic', label: '2. Infografía Puntos' },
                    { id: 'combo', label: '3. Oferta Combos 2x1' },
                    { id: 'guarantee', label: '4. Garantía & COD' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setSelectedEditorCreativeTab(tab.id as any)}
                      className={`p-2 rounded-lg text-left transition border ${
                        selectedEditorCreativeTab === tab.id
                          ? 'bg-slate-900 text-brand-green border-brand-green shadow-sm'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Creative Card Display */}
                {(() => {
                  const currentCreatives = config.creatives && config.creatives.length > 0
                    ? config.creatives
                    : buildDefaultCreativesForProduct({
                        productName: config.productName,
                        category: config.category,
                        productImage: config.mainImage,
                        regularPrice: config.regularPrice,
                        promoPrice: config.promoPrice,
                      });

                  const current = currentCreatives.find((c) => c.type === selectedEditorCreativeTab) || currentCreatives[0];
                  if (!current) return null;

                  return (
                    <div className="space-y-3">
                      <ProductCreativeCard
                        creative={current}
                        productName={config.productName}
                        onToggleInclude={handleToggleCreative}
                      />

                      {/* Theme Picker */}
                      <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-1.5">
                        <span className="text-[11px] font-bold text-slate-300 block">
                          Tema de fondo del creativo:
                        </span>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {[
                            { id: 'brand', label: 'Konnexa' },
                            { id: 'dark', label: 'Dark Luxe' },
                            { id: 'emerald', label: 'Verde' },
                            { id: 'blue', label: 'Azul' },
                            { id: 'minimal', label: 'Blanco' },
                          ].map((th) => (
                            <button
                              key={th.id}
                              type="button"
                              onClick={() => handleChangeTheme(current.id, th.id)}
                              className={`px-2 py-1 rounded text-[10px] font-semibold border transition ${
                                current.theme === th.id
                                  ? 'bg-brand-green text-white border-brand-green'
                                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                              }`}
                            >
                              {th.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* TAB 2: PRICING & COMBOS */}
            {activeTab === 'pricing' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                      Precio Normal:
                    </label>
                    <input
                      type="number"
                      value={config.regularPrice}
                      onChange={(e) => setConfig({ ...config, regularPrice: Number(e.target.value) })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-brand-blue uppercase tracking-wider mb-1">
                      Precio Promo:
                    </label>
                    <input
                      type="number"
                      value={config.promoPrice}
                      onChange={(e) => setConfig({ ...config, promoPrice: Number(e.target.value) })}
                      className="w-full bg-slate-900 border border-red-500/50 rounded-lg p-2 text-xs text-brand-blue font-bold"
                    />
                  </div>
                </div>

                <div className="space-y-3 pt-2 border-t border-slate-800">
                  <span className="text-[11px] font-bold text-slate-300 block">
                    Gestión de Combos y Cantidades:
                  </span>
                  {config.combos.map((combo, idx) => (
                    <div key={combo.id} className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-brand-green">
                          Combo #{idx + 1} ({combo.units} Unidades)
                        </span>
                        {combo.isPopular && (
                          <span className="text-[9px] bg-brand-blue text-white px-1.5 py-0.5 rounded font-black">
                            POPULAR
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        value={combo.name}
                        onChange={(e) => {
                          const updated = [...config.combos];
                          updated[idx].name = e.target.value;
                          setConfig({ ...config, combos: updated });
                        }}
                        className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-xs text-white font-medium"
                      />
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={combo.promoPrice}
                          onChange={(e) => {
                            const updated = [...config.combos];
                            updated[idx].promoPrice = Number(e.target.value);
                            setConfig({ ...config, combos: updated });
                          }}
                          className="w-1/2 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-brand-blue font-bold"
                        />
                        <input
                          type="text"
                          value={combo.savingsText}
                          onChange={(e) => {
                            const updated = [...config.combos];
                            updated[idx].savingsText = e.target.value;
                            setConfig({ ...config, combos: updated });
                          }}
                          className="w-1/2 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-[11px] text-slate-400"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 3: VISUAL DESIGN */}
            {activeTab === 'design' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-2">
                    Plantilla de Estilo Visual:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'impact-vibrant', label: 'Impacto Vibrante' },
                      { id: 'dark-luxe', label: 'Dark Luxe' },
                      { id: 'dropship-fast', label: 'Dropship Rápido' },
                      { id: 'clean-white', label: 'Minimal Blanco' },
                      { id: 'tech-neon', label: 'Cyber Neón' },
                    ].map((style) => (
                      <button
                        key={style.id}
                        onClick={() => setConfig({ ...config, themeStyle: style.id as any })}
                        className={`p-2.5 rounded-lg text-left text-xs font-semibold border transition ${
                          config.themeStyle === style.id
                            ? 'border-brand-green bg-brand-green/10 text-brand-green'
                            : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
                        }`}
                      >
                        {style.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800 space-y-3">
                  <label className="flex items-center justify-between text-xs cursor-pointer">
                    <span>Barra Urgente Superior (Countdown)</span>
                    <input
                      type="checkbox"
                      checked={config.enableStickyBar}
                      onChange={(e) => setConfig({ ...config, enableStickyBar: e.target.checked })}
                      className="rounded bg-slate-900 border-slate-700 text-brand-green focus:ring-brand-green"
                    />
                  </label>

                  <label className="flex items-center justify-between text-xs cursor-pointer">
                    <span>Popups de Notificación de Compras Recientes</span>
                    <input
                      type="checkbox"
                      checked={config.enableRecentSalesPopup}
                      onChange={(e) => setConfig({ ...config, enableRecentSalesPopup: e.target.checked })}
                      className="rounded bg-slate-900 border-slate-700 text-brand-green focus:ring-brand-green"
                    />
                  </label>
                </div>
              </div>
            )}

            {/* TAB 4: AI COPILOT */}
            {activeTab === 'ai' && (
              <div className="space-y-4">
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-1">
                  <span className="font-bold text-xs text-amber-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    Copilot de Optimización con IA
                  </span>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Escribe instrucciones en lenguaje natural para cambiar el copy, ajustar precios o modificar la urgencia de la landing page.
                  </p>
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Sugerencias rápidas:
                  </span>
                  {[
                    'Haz los titulares más agresivos y urgentes para pago contraentrega',
                    'Cambia el estilo visual a Dark Luxe elegante',
                    'Añade sensación de escasez (solo quedan 4 unidades)',
                  ].map((s, idx) => (
                    <button
                      key={idx}
                      onClick={() => setAiPrompt(s)}
                      className="w-full text-left p-2 rounded bg-slate-900 hover:bg-slate-800 text-[11px] text-slate-300 border border-slate-800 transition block truncate"
                    >
                      💡 {s}
                    </button>
                  ))}
                </div>

                <div>
                  <textarea
                    rows={4}
                    placeholder="Escribe tu instrucción para la IA..."
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:ring-1 focus:ring-amber-400"
                  />
                  <button
                    onClick={handleApplyAiInstruction}
                    disabled={isAiProcessing || !aiPrompt.trim()}
                    className="w-full mt-2 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 text-white font-bold rounded-lg text-xs shadow-md transition flex items-center justify-center gap-2"
                  >
                    {isAiProcessing ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Optimizando landing...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Aplicar Instrucción con IA</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Central Visual Canvas (Responsive Frame) */}
        <div className="flex-1 overflow-y-auto bg-slate-950 flex flex-col items-center p-4">
          <div
            className={`transition-all duration-300 bg-white text-slate-900 shadow-2xl rounded-xl overflow-hidden min-h-full ${
              viewport === 'desktop'
                ? 'w-full max-w-5xl'
                : viewport === 'tablet'
                ? 'w-[768px] border-8 border-slate-800'
                : 'w-[390px] border-[12px] border-slate-800 rounded-[44px]'
            }`}
          >
            <HighImpactLandingRenderer config={config} previewMode={true} />
          </div>
        </div>
      </div>

      {/* Floating Save Toast */}
      {isSavedToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 text-xs font-bold animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle className="w-4 h-4 text-emerald-200" />
          <span>¡Cambios guardados con éxito en Konnexa!</span>
        </div>
      )}
    </div>
  );
}
