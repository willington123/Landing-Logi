'use client';

import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Upload,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  DollarSign,
  Phone,
  Layers,
  Wand2,
  ShieldCheck,
  Eye,
  EyeOff,
  ExternalLink,
  Plus,
  Key,
  AlertCircle,
  Check,
} from 'lucide-react';
import { generateLandingPageWithAI } from '@/lib/ai-generator';
import { logiStore } from '@/lib/store';
import { LandingPageConfig, LandingCreative } from '@/lib/types';
import { buildDefaultCreativesForProduct } from '@/lib/creative-generator';
import ProductCreativeCard from '@/components/landings/ProductCreativeCard';
import { useRouter } from 'next/navigation';

interface LandingWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerated?: (landing: LandingPageConfig) => void;
}

const PRESET_PRODUCTS = [
  {
    name: 'SmartWatch Ultra Titan Pro',
    category: 'Tecnología & Wearables',
    imageUrl: 'https://images.unsplash.com/photo-1579586337278-3befd40fd17a?q=80&w=1000&auto=format&fit=crop',
    regularPrice: 199000,
    promoPrice: 119900,
  },
  {
    name: 'Aspiradora Robótica SmartClean 360',
    category: 'Hogar Inteligente',
    imageUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=1000&auto=format&fit=crop',
    regularPrice: 389000,
    promoPrice: 229900,
  },
  {
    name: 'Rasuradora Shaver Titanium Pro',
    category: 'Cuidado Personal',
    imageUrl: 'https://images.unsplash.com/photo-1621607512214-68297480165e?q=80&w=1000&auto=format&fit=crop',
    regularPrice: 149000,
    promoPrice: 89900,
  },
  {
    name: 'Mini Proyector HD Portátil Cinema',
    category: 'Entretenimiento & Audio',
    imageUrl: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?q=80&w=1000&auto=format&fit=crop',
    regularPrice: 320000,
    promoPrice: 179900,
  },
];

export default function LandingWizardModal({ isOpen, onClose, onGenerated }: LandingWizardModalProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStatus, setGenerationStatus] = useState('');
  const [generatedLanding, setGeneratedLanding] = useState<LandingPageConfig | null>(null);

  // Form State
  const [productName, setProductName] = useState('');
  const [category, setCategory] = useState('Tecnología & Gadgets');
  const [imageUrl, setImageUrl] = useState('');
  const [galleryUrls, setGalleryUrls] = useState<string[]>([]);
  const [imageTab, setImageTab] = useState<'upload' | 'gemini' | 'presets'>('upload');
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);
  const [regularPrice, setRegularPrice] = useState(199000);
  const [promoPrice, setPromoPrice] = useState(119900);
  const [whatsappNumber, setWhatsappNumber] = useState('+573001234567');
  const [shippingType, setShippingType] = useState<'free' | 'calculated'>('free');
  const [themeStyle, setThemeStyle] = useState<LandingPageConfig['themeStyle']>('impact-vibrant');
  const [paymentMethods, setPaymentMethods] = useState<('cash_on_delivery' | 'card_online')[]>([
    'cash_on_delivery',
    'card_online',
  ]);

  // Gemini AI Key & Settings State
  const [geminiApiKey, setGeminiApiKey] = useState(() => {
    if (typeof window !== 'undefined') {
      return logiStore.getGeminiApiKey();
    }
    return '';
  });
  const [showApiKey, setShowApiKey] = useState(false);
  const [geminiError, setGeminiError] = useState<string | null>(null);
  const [geminiSuccess, setGeminiSuccess] = useState<string | null>(null);
  const [imageStyle, setImageStyle] = useState<'studio' | 'vibrant' | 'lifestyle' | 'macro'>('studio');
  const [customPrompt, setCustomPrompt] = useState('');
  const [isAnalyzingVision, setIsAnalyzingVision] = useState(false);
  const [visionFeedback, setVisionFeedback] = useState<string | null>(null);

  // Creatives generated from uploaded product image
  const [creatives, setCreatives] = useState<LandingCreative[]>([]);
  const [selectedCreativeTab, setSelectedCreativeTab] = useState<'hero' | 'infographic' | 'combo' | 'guarantee'>('hero');
  const [isEnhancingCreatives, setIsEnhancingCreatives] = useState(false);

  // Auto-sync creatives whenever the product image changes
  React.useEffect(() => {
    const targetImg = imageUrl || (PRESET_PRODUCTS[0]?.imageUrl ?? '');
    if (targetImg) {
      setCreatives((prev) => {
        if (prev.length === 0 || prev[0].productImage !== targetImg) {
          return buildDefaultCreativesForProduct({
            productName: productName || 'Tu Producto',
            category,
            productImage: targetImg,
            regularPrice: Number(regularPrice) || 199000,
            promoPrice: Number(promoPrice) || 119900,
          });
        }
        return prev;
      });
    }
  }, [imageUrl, productName, category, regularPrice, promoPrice]);

  const handleToggleCreativeInclude = (creativeId: string) => {
    setCreatives((prev) =>
      prev.map((c) => (c.id === creativeId ? { ...c, includedInLanding: !c.includedInLanding } : c))
    );
  };

  const handleChangeCreativeTheme = (creativeId: string, theme: any) => {
    setCreatives((prev) =>
      prev.map((c) => (c.id === creativeId ? { ...c, theme } : c))
    );
  };

  const handleEnhanceCreativesWithGemini = async () => {
    const targetImg = imageUrl || (PRESET_PRODUCTS[0]?.imageUrl ?? '');
    if (!targetImg) {
      alert('Sube una foto de tu producto primero.');
      return;
    }
    if (!geminiApiKey.trim()) {
      setGeminiError('Introduce tu clave API de Gemini para que la inteligencia artificial analice tu producto y optimice los creativos.');
      return;
    }

    setIsEnhancingCreatives(true);
    setGeminiError(null);

    try {
      const res = await fetch('/api/generate-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'analyze_image',
          imageBase64: targetImg,
          geminiApiKey,
        }),
      });

      const data = await res.json();
      if (data.success && data.analysis) {
        const { productName: aiName, headline, subheadline, benefits } = data.analysis;
        if (aiName) setProductName(aiName);

        const updated = buildDefaultCreativesForProduct({
          productName: aiName || productName || 'Tu Producto',
          category,
          productImage: targetImg,
          regularPrice: Number(regularPrice) || 199000,
          promoPrice: Number(promoPrice) || 119900,
          benefits,
        });

        if (headline) updated[0].title = headline;
        if (subheadline) updated[0].subtitle = subheadline;

        setCreatives(updated);
        setVisionFeedback('✨ Gemini analizó la foto y adaptó los 4 creativos con textos persuasivos basados en tu producto real.');
      } else {
        setGeminiError(data.error || 'No se pudieron optimizar los creativos con Gemini.');
      }
    } catch (err: any) {
      setGeminiError(err.message || 'Error de conexión con Gemini.');
    } finally {
      setIsEnhancingCreatives(false);
    }
  };

  if (!isOpen) return null;

  const handleApiKeyChange = (val: string) => {
    setGeminiApiKey(val);
    logiStore.saveGeminiApiKey(val);
    if (geminiError) setGeminiError(null);
  };

  const handleSelectPreset = (preset: typeof PRESET_PRODUCTS[0]) => {
    setProductName(preset.name);
    setCategory(preset.category);
    setImageUrl(preset.imageUrl);
    setGalleryUrls([preset.imageUrl]);
    setRegularPrice(preset.regularPrice);
    setPromoPrice(preset.promoPrice);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setImageUrl(base64);
        setGalleryUrls((prev) => (prev.length === 0 ? [base64] : prev));
        setVisionFeedback(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGalleryAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      Array.from(files).forEach((file) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const base64 = event.target?.result as string;
          setGalleryUrls((prev) => [...prev, base64]);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  // Analyze uploaded product photo with Gemini Vision
  const handleAnalyzeWithVision = async () => {
    if (!imageUrl) {
      alert('Primero sube o selecciona una foto de tu producto.');
      return;
    }
    if (!geminiApiKey.trim()) {
      setGeminiError('Introduce tu API Key de Google Gemini en la pestaña "Generar con Gemini IA" para que la inteligencia artificial analice tu producto.');
      setImageTab('gemini');
      return;
    }

    setIsAnalyzingVision(true);
    setVisionFeedback(null);
    setGeminiError(null);

    try {
      const res = await fetch('/api/generate-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'analyze_image',
          imageBase64: imageUrl,
          geminiApiKey,
        }),
      });

      const data = await res.json();
      if (data.success && data.analysis) {
        const { productName: aiName, category: aiCat, headline, subheadline, benefits, callouts, estimatedRegularPrice, estimatedPromoPrice } = data.analysis;
        if (aiName) setProductName(aiName);
        if (aiCat) setCategory(aiCat);
        if (estimatedRegularPrice) setRegularPrice(estimatedRegularPrice);
        if (estimatedPromoPrice) setPromoPrice(estimatedPromoPrice);

        // Update the 4 advertising creatives with Gemini Vision analysis
        const updated = buildDefaultCreativesForProduct({
          productName: aiName || productName || 'Tu Producto',
          category: aiCat || category,
          productImage: imageUrl,
          regularPrice: estimatedRegularPrice || regularPrice,
          promoPrice: estimatedPromoPrice || promoPrice,
          benefits,
        });

        if (headline) updated[0].title = headline;
        if (subheadline) updated[0].subtitle = subheadline;
        if (callouts && callouts.length > 0 && updated[1]) {
          updated[1].callouts = callouts;
        }

        setCreatives(updated);
        setVisionFeedback(`✨ Gemini Vision analizó tu foto real: Detectó "${aiName || productName}" y generó automáticamente los 4 creativos de alta conversión.`);
      } else {
        setGeminiError(data.error || 'No se pudo analizar la imagen con Gemini Vision.');
      }
    } catch (err: any) {
      setGeminiError(err.message || 'Error de conexión con la IA de Gemini.');
    } finally {
      setIsAnalyzingVision(false);
    }
  };

  // Generate real studio creatives with Gemini Vision based on uploaded image
  const handleGenerateGeminiImages = async () => {
    setGeminiError(null);
    setGeminiSuccess(null);

    if (!geminiApiKey.trim()) {
      setGeminiError('Debes ingresar tu API Key de Google Gemini para que la IA analice tu imagen y cree los creativos. Si no tienes una, obtenla gratis en Google AI Studio (aistudio.google.com/app/apikey).');
      return;
    }

    if (!imageUrl) {
      setGeminiError('Por favor selecciona o sube primero una foto de tu producto en la pestaña "Subir Mis Fotos" para que Gemini Vision genere los creativos.');
      setImageTab('upload');
      return;
    }

    setIsGeneratingImages(true);
    try {
      const res = await fetch('/api/generate-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'analyze_image',
          imageBase64: imageUrl,
          productName: productName || 'Producto',
          category,
          geminiApiKey,
        }),
      });

      const data = await res.json();
      if (data.success && data.analysis) {
        const { productName: aiName, category: aiCat, headline, subheadline, benefits, callouts, estimatedRegularPrice, estimatedPromoPrice } = data.analysis;
        if (aiName && !productName) setProductName(aiName);
        if (aiCat) setCategory(aiCat);
        if (estimatedRegularPrice && !regularPrice) setRegularPrice(estimatedRegularPrice);
        if (estimatedPromoPrice && !promoPrice) setPromoPrice(estimatedPromoPrice);

        const updated = buildDefaultCreativesForProduct({
          productName: aiName || productName || 'Tu Producto',
          category: aiCat || category,
          productImage: imageUrl,
          regularPrice: Number(regularPrice) || estimatedRegularPrice || 199000,
          promoPrice: Number(promoPrice) || estimatedPromoPrice || 119900,
          benefits,
        });

        if (headline && updated[0]) updated[0].title = headline;
        if (subheadline && updated[0]) updated[0].subtitle = subheadline;
        if (callouts && callouts.length > 0 && updated[1]) {
          updated[1].callouts = callouts;
        }

        setCreatives(updated);
        setGeminiSuccess('¡Los 4 creativos publicitarios fueron creados con éxito a partir de tu foto!');
        // Advance to step 2 to see the creatives
        setStep(2);
      } else {
        setGeminiError(data.error || 'Error al procesar la imagen con Google Gemini.');
      }
    } catch (err: any) {
      setGeminiError(err.message || 'Error al comunicarse con el servicio de Gemini.');
    } finally {
      setIsGeneratingImages(false);
    }
  };

  const handleStartGeneration = async () => {
    setIsGenerating(true);
    setStep(5);

    const steps = [
      { progress: 20, status: 'Analizando colores, ángulos y atributos de la imagen...' },
      { progress: 45, status: 'Estructurando creativos visuales y ganchos de persuasión AIDA...' },
      { progress: 70, status: 'Calculando combos estratégicos y fijando precios contraentrega...' },
      { progress: 90, status: 'Generando diseño ultra-impactante, testimonios y checkout 1-click...' },
      { progress: 100, status: '¡Landing page generada con éxito!' },
    ];

    for (const s of steps) {
      setGenerationProgress(s.progress);
      setGenerationStatus(s.status);
      await new Promise((r) => setTimeout(r, 650));
    }

    const landing = generateLandingPageWithAI({
      productName: productName || 'Producto Innovador Premium',
      category,
      imageUrl: imageUrl || PRESET_PRODUCTS[0].imageUrl,
      galleryUrls: galleryUrls.length > 0 ? galleryUrls : undefined,
      regularPrice: Number(regularPrice) || 199000,
      promoPrice: Number(promoPrice) || 119900,
      whatsappNumber: whatsappNumber || '+573001234567',
      shippingType,
      themeStyle,
    });

    if (creatives.length > 0) {
      landing.creatives = creatives;
    }

    logiStore.saveLanding(landing);
    setGeneratedLanding(landing);
    setIsGenerating(false);
    if (onGenerated) onGenerated(landing);
  };

  const resetAndClose = () => {
    setStep(1);
    setIsGenerating(false);
    setGeneratedLanding(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-brand-navyDark to-[#12236a] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white px-2.5 py-1 rounded-lg shadow-sm">
              <img
                src="/brand/logipages-logo.png"
                alt="LogiPages"
                className="h-6 w-auto object-contain"
              />
            </div>
            <div className="h-5 w-px bg-white/20" />
            <div>
              <h2 className="text-sm font-bold flex items-center gap-2">
                Asistente de Creación con Visión IA
                <span className="text-[10px] bg-brand-red text-white font-black px-2 py-0.5 rounded-full uppercase shadow">
                  Vision Engine 2.0
                </span>
              </h2>
              <p className="text-[11px] text-slate-300">
                Pasa de una simple foto a una landing de ultra conversión en 30 segundos
              </p>
            </div>
          </div>
          <button
            onClick={resetAndClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Stepper */}
        {!generatedLanding && (
          <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs font-semibold text-slate-600 overflow-x-auto scrollbar-none">
            <div className={`flex items-center gap-1.5 flex-shrink-0 ${step >= 1 ? 'text-brand-red font-bold' : 'text-slate-400'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step >= 1 ? 'bg-brand-red text-white' : 'bg-slate-200 text-slate-600'}`}>1</span>
              <span>Foto & Datos</span>
            </div>
            <div className="w-6 h-0.5 bg-slate-200 flex-shrink-0 mx-1"></div>
            <div className={`flex items-center gap-1.5 flex-shrink-0 ${step >= 2 ? 'text-brand-red font-bold' : 'text-slate-400'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step >= 2 ? 'bg-brand-red text-white' : 'bg-slate-200 text-slate-600'}`}>2</span>
              <span>Creativos IA</span>
            </div>
            <div className="w-6 h-0.5 bg-slate-200 flex-shrink-0 mx-1"></div>
            <div className={`flex items-center gap-1.5 flex-shrink-0 ${step >= 3 ? 'text-brand-red font-bold' : 'text-slate-400'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step >= 3 ? 'bg-brand-red text-white' : 'bg-slate-200 text-slate-600'}`}>3</span>
              <span>Precios & Pago</span>
            </div>
            <div className="w-6 h-0.5 bg-slate-200 flex-shrink-0 mx-1"></div>
            <div className={`flex items-center gap-1.5 flex-shrink-0 ${step >= 4 ? 'text-brand-red font-bold' : 'text-slate-400'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step >= 4 ? 'bg-brand-red text-white' : 'bg-slate-200 text-slate-600'}`}>4</span>
              <span>Estilo Visual</span>
            </div>
          </div>
        )}

        {/* Body Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* STEP 1: Product & Photo */}
          {step === 1 && (
            <div className="space-y-5">
              {/* Product Basic Name & Category FIRST so Gemini AI knows what to generate */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    1. Nombre Comercial del Producto:
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. SmartWatch Ultra Titan Pro, Cepillo Secador, etc."
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    className="w-full text-xs font-semibold bg-white border border-slate-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-brand-red focus:border-brand-red"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Categoría del Producto:
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full text-xs font-semibold bg-white border border-slate-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-brand-red focus:border-brand-red"
                  >
                    <option value="Tecnología & Gadgets">Tecnología & Gadgets</option>
                    <option value="Hogar & Cocina">Hogar & Cocina</option>
                    <option value="Belleza & Cuidado Personal">Belleza & Cuidado Personal</option>
                    <option value="Salud & Bienestar">Salud & Bienestar</option>
                    <option value="Accesorios & Moda">Accesorios & Moda</option>
                    <option value="Automotriz & Herramientas">Automotriz & Herramientas</option>
                  </select>
                </div>
              </div>

              {/* Source Tabs for Images */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  2. ¿Cómo deseas obtener las imágenes del producto?
                </label>
                <div className="flex border border-slate-200 rounded-xl p-1 bg-slate-100/80 gap-1 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setImageTab('upload')}
                    className={`flex-1 py-2 rounded-lg transition flex items-center justify-center gap-1.5 ${
                      imageTab === 'upload'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    <Upload className="w-4 h-4 text-brand-red" />
                    <span>Subir Mis Fotos (PC)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setImageTab('gemini')}
                    className={`flex-1 py-2 rounded-lg transition flex items-center justify-center gap-1.5 ${
                      imageTab === 'gemini'
                        ? 'bg-brand-navyDark text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>Gemini Vision Creativos</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setImageTab('presets')}
                    className={`flex-1 py-2 rounded-lg transition flex items-center justify-center gap-1.5 ${
                      imageTab === 'presets'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    <Layers className="w-4 h-4 text-slate-600" />
                    <span>Plantillas Rápidas</span>
                  </button>
                </div>
              </div>

              {/* TAB 1: UPLOAD LOCAL IMAGES */}
              {imageTab === 'upload' && (
                <div className="space-y-4 p-4 border border-slate-200 rounded-2xl bg-white">
                  <div>
                    <span className="block text-xs font-bold text-slate-800 mb-1">
                      Foto Principal del Producto (Hero):
                    </span>
                    <label className="border-2 border-dashed border-slate-300 hover:border-brand-red rounded-xl p-5 flex flex-col items-center justify-center cursor-pointer bg-slate-50/50 hover:bg-red-50/20 transition group">
                      <Upload className="w-7 h-7 text-slate-400 group-hover:text-brand-red mb-2 transition" />
                      <span className="text-xs font-bold text-slate-700 group-hover:text-brand-red">
                        Haz clic aquí para seleccionar una foto desde tu computador
                      </span>
                      <span className="text-[11px] text-slate-400 mt-0.5">
                        Formatos JPG, PNG, WEBP (Carga instantánea en alta resolución)
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {/* URL Input Fallback */}
                  <div className="pt-2 border-t border-slate-100">
                    <span className="text-[11px] text-slate-500 font-semibold block mb-1">
                      O pega un enlace de imagen externo:
                    </span>
                    <input
                      type="text"
                      placeholder="https://..."
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-red"
                    />
                  </div>

                  {/* Multiple Gallery Upload */}
                  <div className="pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-slate-700">
                        Fotos de la Galería (Ángulos adicionales, detalles, caja):
                      </span>
                      <label className="text-[11px] font-bold text-brand-navy hover:underline cursor-pointer flex items-center gap-1 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg transition">
                        <Plus className="w-3.5 h-3.5" />
                        <span>Añadir fotos a galería</span>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handleGalleryAdd}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>

                  {/* Preview Thumbnails */}
                  {(imageUrl || galleryUrls.length > 0) && (
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Vista Previa de Imágenes Cargadas ({galleryUrls.length || (imageUrl ? 1 : 0)}):
                        </span>
                        {imageUrl && (
                          <button
                            type="button"
                            onClick={handleAnalyzeWithVision}
                            disabled={isAnalyzingVision}
                            className="text-[11px] font-bold text-brand-navy hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2.5 py-1 rounded-lg flex items-center gap-1 transition"
                          >
                            <Sparkles className="w-3 h-3 text-amber-500" />
                            <span>
                              {isAnalyzingVision
                                ? 'Analizando con Gemini...'
                                : 'Analizar con Gemini Vision'}
                            </span>
                          </button>
                        )}
                      </div>

                      {visionFeedback && (
                        <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs font-medium flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                          <span>{visionFeedback}</span>
                        </div>
                      )}

                      <div className="flex gap-2.5 overflow-x-auto pb-1">
                        {imageUrl && (
                          <div className="relative group flex-shrink-0">
                            <img
                              src={imageUrl}
                              alt="Hero"
                              className="w-20 h-20 object-cover rounded-lg border-2 border-brand-red shadow-sm"
                            />
                            <span className="absolute bottom-1 left-1 bg-brand-red text-white text-[8px] font-bold px-1 rounded">
                              Hero
                            </span>
                          </div>
                        )}
                        {galleryUrls.map((gUrl, idx) => (
                          <div key={idx} className="relative group flex-shrink-0">
                            <img
                              src={gUrl}
                              alt={`Gal ${idx}`}
                              className="w-20 h-20 object-cover rounded-lg border border-slate-200 shadow-sm"
                            />
                            <span className="absolute bottom-1 left-1 bg-slate-900/80 text-white text-[8px] font-bold px-1 rounded">
                              #{idx + 1}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: GEMINI VISION CREATIVES */}
              {imageTab === 'gemini' && (
                <div className="p-5 border border-indigo-200 rounded-2xl bg-gradient-to-br from-indigo-50/40 via-white to-blue-50/40 space-y-4">
                  {/* Header */}
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#172C8A] via-[#FF5A16] to-[#FF252B] text-white flex items-center justify-center flex-shrink-0 shadow-md">
                      <Sparkles className="w-5 h-5 text-amber-300" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <span>Motor de Creativos con Google Gemini Vision</span>
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                          Gemini 2.0 Flash
                        </span>
                      </h4>
                      <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                        Analiza las fotos reales que subas de tu producto y crea automáticamente los 4 creativos de alta conversión para la landing (Hero Banner, Infografía con flechas, Combos 2x1 y Garantía COD).
                      </p>
                    </div>
                  </div>

                  {/* 1. GEMINI API KEY INPUT */}
                  <div className="bg-white p-3.5 rounded-xl border border-indigo-100 shadow-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Key className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Tu API Key de Google Gemini:</span>
                      </label>
                      <a
                        href="https://aistudio.google.com/app/apikey"
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 hover:underline"
                      >
                        <span>Obtener clave gratis en Google AI Studio</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>

                    <div className="relative">
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        placeholder="Pega aquí tu clave (Ej. AIzaSy...)"
                        value={geminiApiKey}
                        onChange={(e) => handleApiKeyChange(e.target.value)}
                        className={`w-full text-xs font-mono bg-slate-50 border rounded-lg pl-3 pr-10 py-2.5 text-slate-800 focus:bg-white focus:outline-none transition ${
                          geminiApiKey ? 'border-emerald-300 bg-emerald-50/20' : 'border-slate-300 focus:border-indigo-500'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                      <span>Válida para Gemini 2.0 y 1.5 Flash Vision. Se guarda segura en tu navegador.</span>
                      {geminiApiKey ? (
                        <span className="text-emerald-600 font-bold flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          Clave lista
                        </span>
                      ) : (
                        <span className="text-amber-600 font-bold">Sin clave configurada</span>
                      )}
                    </div>
                  </div>

                  {/* Photo status */}
                  <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-slate-800 block">Foto del producto para los creativos:</span>
                      <span className="text-slate-500 text-[11px]">
                        {imageUrl ? 'Foto cargada y lista para componer los banners' : 'No has seleccionado foto aún (ve a "Subir Mis Fotos")'}
                      </span>
                    </div>
                    {imageUrl && (
                      <img src={imageUrl} alt="Preview" className="w-10 h-10 object-cover rounded-lg border border-slate-300" />
                    )}
                  </div>

                  {/* ERROR BANNER */}
                  {geminiError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-800 animate-fade-in">
                      <AlertCircle className="w-4 h-4 text-brand-red flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-bold">Aviso de Google Gemini:</p>
                        <p className="mt-0.5">{geminiError}</p>
                      </div>
                    </div>
                  )}

                  {/* SUCCESS BANNER */}
                  {geminiSuccess && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2.5 text-xs text-emerald-800 animate-fade-in">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <span className="font-bold">{geminiSuccess}</span>
                    </div>
                  )}

                  {/* GENERATE CREATIVES BUTTON */}
                  <button
                    type="button"
                    onClick={handleGenerateGeminiImages}
                    disabled={isGeneratingImages}
                    className="w-full py-3 bg-gradient-to-r from-[#172C8A] via-[#FF5A16] to-[#FF252B] hover:opacity-95 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    {isGeneratingImages ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Gemini Vision está analizando tu foto y creando los creativos...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-amber-300" />
                        <span>Crear los 4 Creativos con Gemini Vision a partir de tu foto</span>
                      </>
                    )}
                  </button>

                  {/* Generated Photos Preview */}
                  {imageUrl && galleryUrls.length > 0 && (
                    <div className="pt-2 border-t border-slate-200">
                      <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1 mb-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Imagen activa para la Landing Page:
                      </span>
                      <div className="flex gap-3">
                        <div className="relative rounded-xl overflow-hidden border-2 border-brand-red shadow-md w-28 h-28 flex-shrink-0">
                          <img src={imageUrl} alt="Generada" className="w-full h-full object-cover" />
                          <span className="absolute bottom-1 inset-x-1 bg-black/70 text-white text-[9px] text-center font-bold py-0.5 rounded">
                            Hero Principal
                          </span>
                        </div>
                        <div className="text-xs text-slate-600 flex flex-col justify-center space-y-1">
                          <p className="font-bold text-slate-800">{productName || 'Producto'}</p>
                          <p className="text-[11px] text-slate-500">
                            Estilo: <span className="capitalize font-semibold text-slate-700">{imageStyle}</span>
                          </p>
                          <p className="text-[11px] text-emerald-600 font-semibold">
                            ✓ Lista para el Hero, combos y checkout
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: PRESETS */}
              {imageTab === 'presets' && (
                <div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {PRESET_PRODUCTS.map((p) => (
                      <div
                        key={p.name}
                        onClick={() => handleSelectPreset(p)}
                        className={`cursor-pointer rounded-xl border p-2 text-center transition-all ${
                          imageUrl === p.imageUrl
                            ? 'border-brand-red bg-red-50/50 ring-2 ring-brand-red/20'
                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <img src={p.imageUrl} alt={p.name} className="w-full h-20 object-cover rounded-lg mb-1.5" />
                        <p className="text-[11px] font-bold text-slate-800 line-clamp-1">{p.name}</p>
                        <p className="text-[10px] text-brand-red font-semibold">${p.promoPrice.toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: CREATIVOS PUBLICITARIOS GENERADOS CON TU IMAGEN */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-brand-navyDark via-[#172C8A] to-slate-900 text-white p-4 rounded-2xl shadow-md">
                <div>
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>Creativos Publicitarios Generados con tu Imagen</span>
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Hemos montado 4 creativos comerciales para tu landing page utilizando la foto de tu producto.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleEnhanceCreativesWithGemini}
                  disabled={isEnhancingCreatives}
                  className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#FF252B] to-[#FF5A16] hover:opacity-95 text-white text-xs font-bold shadow transition flex items-center gap-1.5 flex-shrink-0 disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                  <span>
                    {isEnhancingCreatives
                      ? 'Analizando foto con IA...'
                      : 'Optimizar con Gemini Vision'}
                  </span>
                </button>
              </div>

              {visionFeedback && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-medium flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>{visionFeedback}</span>
                </div>
              )}

              {/* Creative Tabs */}
              <div className="flex border border-slate-200 rounded-xl p-1 bg-slate-100 gap-1 text-xs font-bold overflow-x-auto">
                {[
                  { id: 'hero', label: '1. Banner Hero' },
                  { id: 'infographic', label: '2. Infografía de Puntos' },
                  { id: 'combo', label: '3. Oferta Combos 2x1' },
                  { id: 'guarantee', label: '4. Garantía & Contraentrega' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSelectedCreativeTab(tab.id as any)}
                    className={`flex-1 py-2 px-2.5 rounded-lg whitespace-nowrap transition ${
                      selectedCreativeTab === tab.id
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Creative Display Card */}
              {(() => {
                const currentCreative = creatives.find((c) => c.type === selectedCreativeTab) || creatives[0];
                if (!currentCreative) return null;

                return (
                  <div className="space-y-3">
                    <ProductCreativeCard
                      creative={currentCreative}
                      productName={productName}
                      onToggleInclude={handleToggleCreativeInclude}
                    />

                    {/* Creative Theme Picker */}
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-bold text-slate-700">
                        Tema de fondo para este creativo:
                      </span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {[
                          { id: 'brand', label: 'LogiPages Brand' },
                          { id: 'dark', label: 'Dark Luxe' },
                          { id: 'emerald', label: 'Verde Orgánico' },
                          { id: 'blue', label: 'Azul Cyber' },
                          { id: 'minimal', label: 'Blanco Puro' },
                        ].map((th) => (
                          <button
                            key={th.id}
                            type="button"
                            onClick={() => handleChangeCreativeTheme(currentCreative.id, th.id)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition border ${
                              currentCreative.theme === th.id
                                ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
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

          {/* STEP 3: Prices, Offer & Payment */}
          {step === 3 && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Precio Normal (Antes):
                  </label>
                  <div className="relative">
                    <span className="text-xs font-bold text-slate-400 absolute left-3 top-1/2 -translate-y-1/2">$</span>
                    <input
                      type="number"
                      value={regularPrice}
                      onChange={(e) => setRegularPrice(Number(e.target.value))}
                      className="w-full text-xs border border-slate-300 rounded-lg pl-7 pr-3 py-2.5 focus:ring-2 focus:ring-brand-red"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">Precio tachado de referencia para crear contraste.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-brand-red uppercase tracking-wider mb-1.5">
                    Precio Promocional (Hoy):
                  </label>
                  <div className="relative">
                    <span className="text-xs font-bold text-brand-red absolute left-3 top-1/2 -translate-y-1/2">$</span>
                    <input
                      type="number"
                      value={promoPrice}
                      onChange={(e) => setPromoPrice(Number(e.target.value))}
                      className="w-full text-xs font-bold text-brand-red border border-red-300 bg-red-50/30 rounded-lg pl-7 pr-3 py-2.5 focus:ring-2 focus:ring-brand-red"
                    />
                  </div>
                  <p className="text-[11px] text-emerald-600 font-semibold mt-1">
                    Ahorro del {Math.round(((regularPrice - promoPrice) / regularPrice) * 100)}% para el comprador.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Métodos de Pago Habilitados en Checkout:
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div
                    onClick={() => {
                      if (paymentMethods.includes('cash_on_delivery')) {
                        setPaymentMethods(paymentMethods.filter((m) => m !== 'cash_on_delivery'));
                      } else {
                        setPaymentMethods([...paymentMethods, 'cash_on_delivery']);
                      }
                    }}
                    className={`cursor-pointer p-3 rounded-xl border flex items-center gap-3 transition ${
                      paymentMethods.includes('cash_on_delivery')
                        ? 'border-emerald-500 bg-emerald-50/50 text-emerald-900'
                        : 'border-slate-200 text-slate-500'
                    }`}
                  >
                    <CheckCircle2 className={`w-5 h-5 ${paymentMethods.includes('cash_on_delivery') ? 'text-emerald-600' : 'text-slate-300'}`} />
                    <div>
                      <p className="text-xs font-bold">Pago Contraentrega (COD)</p>
                      <p className="text-[10px] text-slate-500">Pagan en efectivo al recibir (Recomendado)</p>
                    </div>
                  </div>

                  <div
                    onClick={() => {
                      if (paymentMethods.includes('card_online')) {
                        setPaymentMethods(paymentMethods.filter((m) => m !== 'card_online'));
                      } else {
                        setPaymentMethods([...paymentMethods, 'card_online']);
                      }
                    }}
                    className={`cursor-pointer p-3 rounded-xl border flex items-center gap-3 transition ${
                      paymentMethods.includes('card_online')
                        ? 'border-brand-navy bg-blue-50/50 text-brand-navy'
                        : 'border-slate-200 text-slate-500'
                    }`}
                  >
                    <CheckCircle2 className={`w-5 h-5 ${paymentMethods.includes('card_online') ? 'text-brand-navy' : 'text-slate-300'}`} />
                    <div>
                      <p className="text-xs font-bold">Tarjeta / Pago Online</p>
                      <p className="text-[10px] text-slate-500">Pasarela de pago bancario</p>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Política de Envío:
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="shipping"
                      checked={shippingType === 'free'}
                      onChange={() => setShippingType('free')}
                      className="text-brand-red focus:ring-brand-red"
                    />
                    Envío Gratis a Nivel Nacional (Convierte 3x más)
                  </label>
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="shipping"
                      checked={shippingType === 'calculated'}
                      onChange={() => setShippingType('calculated')}
                      className="text-brand-red focus:ring-brand-red"
                    />
                    Costo de envío a cargo del cliente
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Visual Theme & WhatsApp */}
          {step === 4 && (
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Estilo Visual de la Landing Page:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { id: 'impact-vibrant', title: 'Impacto Vibrante', desc: 'Rojo #FF252B + Naranja, alta adrenalina de compra', badge: 'Recomendado' },
                    { id: 'dark-luxe', title: 'Dark Luxe Premium', desc: 'Fondo negro grafito, acentos dorados y elegancia', badge: 'High-Ticket' },
                    { id: 'dropship-fast', title: 'Dropship Express', desc: 'Enfoque directo en combos y urgencia COD', badge: 'Máxima Conversión' },
                    { id: 'clean-white', title: 'Clean & Minimal', desc: 'Blanco puro, azul marino y tipografía limpia', badge: 'SaaS / Salud' },
                    { id: 'tech-neon', title: 'Cyber & Tech Neon', desc: 'Azul eléctrico, bordes cian y estética futurista', badge: 'Gadgets' },
                  ].map((t) => (
                    <div
                      key={t.id}
                      onClick={() => setThemeStyle(t.id as any)}
                      className={`cursor-pointer p-3 rounded-xl border text-left transition-all ${
                        themeStyle === t.id
                          ? 'border-brand-red bg-red-50/30 ring-2 ring-brand-red/20 shadow-sm'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-slate-900">{t.title}</span>
                        {t.badge && (
                          <span className="text-[9px] bg-brand-navy text-white px-1.5 py-0.2 rounded font-semibold">
                            {t.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500">{t.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Número de WhatsApp para Soporte y Botón Flotante:
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-emerald-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={whatsappNumber}
                    onChange={(e) => setWhatsappNumber(e.target.value)}
                    placeholder="+57 300 123 4567 (con código de país)"
                    className="w-full text-xs border border-slate-300 rounded-lg pl-9 pr-3 py-2.5 focus:ring-2 focus:ring-brand-red"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Los clientes podrán escribirte directamente si tienen dudas antes de confirmar el pedido.
                </p>
              </div>
            </div>
          )}

          {/* STEP 5: Generating / Success View */}
          {step === 5 && (
            <div className="py-6 flex flex-col items-center justify-center text-center">
              {isGenerating ? (
                <div className="max-w-md w-full space-y-4">
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-brand-gradient flex items-center justify-center shadow-glow-orange animate-bounce">
                    <Sparkles className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-base font-bold text-slate-800">
                    Generando Landing Page Inteligente...
                  </h3>
                  <p className="text-xs text-slate-500 animate-pulse">{generationStatus}</p>

                  <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden border border-slate-200">
                    <div
                      className="bg-brand-gradient h-full transition-all duration-300"
                      style={{ width: `${generationProgress}%` }}
                    />
                  </div>
                  <p className="text-[11px] font-bold text-slate-400">{generationProgress}% completado</p>
                </div>
              ) : generatedLanding ? (
                <div className="max-w-lg w-full space-y-4">
                  <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center ring-8 ring-emerald-50">
                    <CheckCircle2 className="w-9 h-9" />
                  </div>
                  <h3 className="text-lg font-black text-slate-900">
                    ¡Tu Landing Page Ha Sido Creada con Éxito!
                  </h3>
                  <p className="text-xs text-slate-600">
                    La IA ha configurado el copy persuasivo, combos con descuento inteligente, checkout 1-click contraentrega y agente de llamadas listo.
                  </p>

                  <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-left text-xs space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Producto:</span>
                      <span className="font-bold text-slate-800">{generatedLanding.productName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">URL Pública:</span>
                      <span className="font-mono text-brand-navy font-semibold">{generatedLanding.publishedUrl}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Combos Generados:</span>
                      <span className="font-semibold text-emerald-600">{generatedLanding.combos.length} variantes</span>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => {
                        resetAndClose();
                        router.push(`/landings/editor/${generatedLanding.id}`);
                      }}
                      className="flex-1 py-3 px-4 bg-brand-navyDark hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2"
                    >
                      <Eye className="w-4 h-4" />
                      Abrir en Editor Visual
                    </button>

                    <a
                      href={generatedLanding.publishedUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 py-3 px-4 bg-brand-gradient hover:opacity-95 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-glow-orange"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Ver Landing Pública
                    </a>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        {!generatedLanding && !isGenerating && (
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            {step > 1 ? (
              <button
                onClick={() => setStep(step - 1)}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 transition"
              >
                <ArrowLeft className="w-4 h-4" />
                Atrás
              </button>
            ) : (
              <div></div>
            )}

            {step < 4 ? (
              <button
                onClick={() => {
                  if (step === 1 && !productName) {
                    setProductName(PRESET_PRODUCTS[0].name);
                    setImageUrl(PRESET_PRODUCTS[0].imageUrl);
                  }
                  setStep(step + 1);
                }}
                className="flex items-center gap-1.5 px-5 py-2.5 bg-brand-navyDark hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition"
              >
                Siguiente Paso
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleStartGeneration}
                className="flex items-center gap-2 px-6 py-2.5 bg-brand-gradient hover:opacity-95 text-white rounded-xl text-xs font-bold shadow-glow-orange transition transform hover:scale-[1.02] active:scale-95"
              >
                <Sparkles className="w-4 h-4 text-amber-200" />
                Generar Landing con IA
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
