'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck,
  Truck,
  Clock,
  CheckCircle2,
  Star,
  Lock,
  Phone,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  MapPin,
  User,
  RotateCcw,
  Banknote,
  Sparkles,
  Flame,
  Check,
  AlertCircle,
  HelpCircle,
  Package,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { LandingPageConfig, ProductCombo, BenefitItem, PaymentMethodType } from '@/lib/types';
import { logiStore } from '@/lib/store';
import ProductCreativeCard from '@/components/landings/ProductCreativeCard';
import SalesPageRenderer from '@/components/landings/SalesPageRenderer';
import { orderWhatsAppUrl } from '@/lib/whatsapp-link';
import WhatsAppConfirmStep from '@/components/landings/WhatsAppConfirmStep';

interface HighImpactLandingRendererProps {
  config: LandingPageConfig;
  previewMode?: boolean;
  onOrderSubmit?: (orderData: any) => unknown;
}

const COLOMBIAN_DEPARTMENTS = [
  'Antioquia',
  'Bogotá D.C.',
  'Valle del Cauca',
  'Cundinamarca',
  'Atlántico',
  'Santander',
  'Bolívar',
  'Risaralda',
  'Caldas',
  'Tolima',
  'Boyacá',
  'Huila',
  'Meta',
  'Norte de Santander',
  'Magdalena',
  'Nariño',
  'Cesar',
  'Córdoba',
  'Quindío',
  'Sucre',
  'Cauca',
  'Casanare',
  'La Guajira',
  'Chocó',
  'Caquetá',
  'Putumayo',
  'Arauca',
  'San Andrés y Providencia',
];

const RECENT_BUYERS = [
  { name: 'Andrés Morales', city: 'Medellín, Antioquia', timeAgo: 'hace 3 minutos', combo: 'Combo 2x (Más Vendido)' },
  { name: 'Carolina Restrepo', city: 'Bogotá D.C.', timeAgo: 'hace 5 minutos', combo: 'Combo 2x' },
  { name: 'Felipe Torres', city: 'Cali, Valle del Cauca', timeAgo: 'hace 2 minutos', combo: 'Combo 1x' },
  { name: 'Valentina Gómez', city: 'Barranquilla, Atlántico', timeAgo: 'hace 7 minutos', combo: 'Combo 3x Familiar' },
  { name: 'Diego Salazar', city: 'Bucaramanga, Santander', timeAgo: 'hace 4 minutos', combo: 'Combo 2x' },
];

// AI-generated landings use the long-form sales layout; older ones keep the classic one.
export default function HighImpactLandingRenderer(props: HighImpactLandingRendererProps) {
  if (props.config.layout === 'sales-v2' && props.config.sales) {
    return <SalesPageRenderer {...props} />;
  }
  return <ClassicLandingRenderer {...props} />;
}

function ClassicLandingRenderer({
  config,
  previewMode = false,
  onOrderSubmit,
}: HighImpactLandingRendererProps) {
  // Combos
  const combos = useMemo(() => {
    if (config.combos && config.combos.length > 0) {
      return config.combos;
    }
    const basePromo = config.promoPrice || 119900;
    const baseReg = config.regularPrice || 199000;
    return [
      {
        id: 'c1',
        name: `1 Unidad — ${config.productName}`,
        units: 1,
        regularPrice: baseReg,
        promoPrice: basePromo,
        savingsText: '40% OFF',
        badge: 'OFERTA INDIVIDUAL',
        isPopular: false,
      },
      {
        id: 'c2',
        name: `2 Unidades (¡Lleva 1 y la 2da con 50% OFF!)`,
        units: 2,
        regularPrice: baseReg * 2,
        promoPrice: Math.round((basePromo * 1.68) / 100) * 100,
        savingsText: 'AHORRO EXTRA 55%',
        badge: 'MÁS VENDIDO 🔥',
        isPopular: true,
      },
      {
        id: 'c3',
        name: `3 Unidades (Pack Familiar / Amigos)`,
        units: 3,
        regularPrice: baseReg * 3,
        promoPrice: Math.round((basePromo * 2.25) / 100) * 100,
        savingsText: 'MÁXIMO AHORRO 62%',
        badge: 'MEJOR VALOR',
        isPopular: false,
      },
    ];
  }, [config]);

  const [selectedComboId, setSelectedComboId] = useState<string>(() => {
    const popular = combos.find((c) => c.isPopular);
    return popular ? popular.id : combos[0]?.id || 'c1';
  });

  const selectedCombo = useMemo(() => {
    return combos.find((c) => c.id === selectedComboId) || combos[0];
  }, [combos, selectedComboId]);

  // Gallery
  const gallery = useMemo(() => {
    const list = [config.mainImage];
    if (config.galleryImages && config.galleryImages.length > 0) {
      list.push(...config.galleryImages);
    }
    return list.filter(Boolean);
  }, [config.mainImage, config.galleryImages]);

  const [activeImageIndex, setActiveImageIndex] = useState(0);

  // Urgency Timer
  const [timeLeft, setTimeLeft] = useState((config.countdownMinutes || 15) * 60);
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 14 * 60 + 59));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Stock
  const [stock, setStock] = useState(config.stockLeft || 7);

  // Social Proof Popup
  const [showSocialProof, setShowSocialProof] = useState(false);
  const [currentBuyerIdx, setCurrentBuyerIdx] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setShowSocialProof(true);
      setCurrentBuyerIdx((prev) => (prev + 1) % RECENT_BUYERS.length);
      const hide = setTimeout(() => setShowSocialProof(false), 4000);
      return () => clearTimeout(hide);
    }, 12000);
    return () => clearInterval(timer);
  }, []);

  // Form State
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [department, setDepartment] = useState('Antioquia');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>('cash_on_delivery');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderCompletedData, setOrderCompletedData] = useState<any | null>(null);

  // FAQ open states
  const [openFaqs, setOpenFaqs] = useState<Record<number, boolean>>({ 0: true, 1: false });

  const toggleFaq = (idx: number) => {
    setOpenFaqs((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const formatMoney = (val: number) => {
    return `$${val.toLocaleString('es-CO')} ${config.currency || 'COP'}`;
  };

  const scrollToCheckout = () => {
    const el = document.getElementById('checkout-form');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const triggerConfetti = () => {
    try {
      confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#172C8A', '#FF252B', '#10B981'],
      });
    } catch {
      // Ignore
    }
  };

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!customerName.trim()) {
      setFormError('Por favor ingresa tu nombre completo.');
      return;
    }
    if (!phone.trim() || phone.replace(/\D/g, '').length < 7) {
      setFormError('Por favor ingresa un número de teléfono celular válido para coordinar la entrega.');
      return;
    }
    if (!city.trim()) {
      setFormError('Por favor ingresa tu ciudad o municipio.');
      return;
    }
    if (!address.trim()) {
      setFormError('Por favor ingresa tu dirección exacta de entrega.');
      return;
    }

    setIsSubmitting(true);
    const orderPayload = {
      orderNumber: `LP-${Math.floor(1000 + Math.random() * 9000)}`,
      landingPageId: config.id,
      productName: config.productName,
      comboName: selectedCombo.name,
      units: selectedCombo.units,
      totalAmount: selectedCombo.promoPrice,
      customerName: customerName.trim(),
      phone: phone.trim(),
      department,
      city: city.trim(),
      address: address.trim(),
      notes: notes.trim(),
      paymentMethod,
      createdAt: new Date().toISOString(),
    };

    // Wait for the saved order (the public page returns it with the real order number).
    let saved: any = orderPayload;
    try {
      if (onOrderSubmit) {
        saved = (await onOrderSubmit(orderPayload)) || orderPayload;
      } else {
        try {
          logiStore.createOrder(orderPayload);
        } catch {
          // Ignore
        }
      }
    } catch (err: any) {
      setIsSubmitting(false);
      setFormError(err?.message || 'No pudimos registrar tu pedido. Inténtalo de nuevo.');
      return;
    }
    setIsSubmitting(false);
    triggerConfetti();
    setOrderCompletedData(saved);
  };

  // wa.me link with the order details; the thank-you step opens it after a countdown.
  const completedWhatsApp = orderCompletedData ? orderWhatsAppUrl(config, orderCompletedData) : '';

  // Discount %
  const discountPercent = Math.max(
    10,
    Math.round(((config.regularPrice - config.promoPrice) / (config.regularPrice || 1)) * 100)
  );

  // Creative cards if enabled
  const heroCreative = config.creatives?.find((c) => c.type === 'hero' && c.includedInLanding);
  const infographicCreative = config.creatives?.find((c) => c.type === 'infographic' && c.includedInLanding);
  const comboCreative = config.creatives?.find((c) => c.type === 'combo' && c.includedInLanding);
  const guaranteeCreative = config.creatives?.find((c) => c.type === 'guarantee' && c.includedInLanding);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased selection:bg-brand-red selection:text-white">
      {/* 1. TOP ANNOUNCEMENT BAR (CLEAN & TRUSTWORTHY) */}
      <header className="bg-[#172C8A] text-white py-2 px-4 sticky top-0 z-40 shadow-sm border-b border-blue-900">
        <div className="max-w-5xl mx-auto flex items-center justify-between text-xs font-semibold">
          <div className="flex items-center gap-2">
            <span className="bg-emerald-500 text-white font-bold px-2 py-0.5 rounded text-[10px] uppercase tracking-wide">
              Contraentrega
            </span>
            <span className="hidden sm:inline text-white/90">
              {config.urgencyText || 'Envío Gratis a Toda Colombia • Pagas en Efectivo al Recibir en Casa'}
            </span>
            <span className="sm:hidden text-white/90">
              Pagas al recibir en casa • Envío Gratis
            </span>
          </div>

          <div className="flex items-center gap-2 font-mono text-[11px] bg-black/25 px-2.5 py-1 rounded">
            <Clock className="w-3.5 h-3.5 text-amber-300" />
            <span className="text-amber-300 font-bold">{formatCountdown(timeLeft)}</span>
          </div>
        </div>
      </header>

      {/* 2. PRODUCT HERO SECTION (CLEAN E-COMMERCE CONVERSION) */}
      <section className="bg-white border-b border-slate-200/80 pt-6 pb-12 sm:pt-10 sm:pb-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
            
            {/* LEFT: PRODUCT IMAGE & GALLERY */}
            <div className="lg:col-span-6 space-y-3">
              <div className="relative rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 aspect-square flex items-center justify-center p-3">
                {/* Discount Badge */}
                <div className="absolute top-3 left-3 bg-[#FF252B] text-white text-xs font-black px-2.5 py-1 rounded-md shadow-sm uppercase tracking-wider">
                  {config.discountBadge || `-${discountPercent}% OFF`}
                </div>

                {/* COD Seal */}
                <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-sm text-slate-800 text-[11px] font-bold px-2.5 py-1 rounded-md shadow-sm border border-slate-200 flex items-center gap-1.5">
                  <Banknote className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Pagas al recibir</span>
                </div>

                <img
                  src={gallery[activeImageIndex] || config.mainImage}
                  alt={config.productName}
                  className="w-full h-full object-contain filter drop-shadow-md"
                />
              </div>

              {/* Thumbnails */}
              {gallery.length > 1 && (
                <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
                  {gallery.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveImageIndex(idx)}
                      className={`w-16 h-16 rounded-xl overflow-hidden border-2 transition p-1 bg-slate-50 flex-shrink-0 ${
                        activeImageIndex === idx
                          ? 'border-[#172C8A] ring-1 ring-[#172C8A]'
                          : 'border-slate-200 hover:border-slate-300 opacity-80'
                      }`}
                    >
                      <img src={img} alt={`Vista ${idx}`} className="w-full h-full object-contain" />
                    </button>
                  ))}
                </div>
              )}

              {/* 4 Trust Pillars */}
              <div className="grid grid-cols-3 gap-2 pt-2 text-center text-xs">
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                  <Truck className="w-4 h-4 text-[#172C8A] mx-auto mb-1" />
                  <span className="font-bold text-slate-800 block text-[11px]">Envío Gratis</span>
                  <span className="text-[10px] text-slate-500">24 a 48 Horas</span>
                </div>
                <div className="p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-200/80">
                  <Banknote className="w-4 h-4 text-emerald-600 mx-auto mb-1" />
                  <span className="font-bold text-slate-800 block text-[11px]">Contraentrega</span>
                  <span className="text-[10px] text-emerald-700">Pagas en casa</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                  <ShieldCheck className="w-4 h-4 text-[#172C8A] mx-auto mb-1" />
                  <span className="font-bold text-slate-800 block text-[11px]">Garantía 30 Días</span>
                  <span className="text-[10px] text-slate-500">Cambio directo</span>
                </div>
              </div>
            </div>

            {/* RIGHT: PERSUASIVE PRODUCT DETAILS & DIRECT CTA */}
            <div className="lg:col-span-6 space-y-4">
              {/* Rating & Reviews */}
              <div className="flex items-center gap-2">
                <div className="flex text-amber-400">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-current" />
                  ))}
                </div>
                <span className="text-xs font-bold text-slate-700">4.9 / 5.0</span>
                <span className="text-xs text-slate-400">•</span>
                <span className="text-xs text-slate-500 underline font-medium">1.420+ Clientes Satisfechos</span>
              </div>

              {/* Titles */}
              <div>
                <span className="text-xs font-bold text-[#FF5A16] uppercase tracking-wider block mb-1">
                  {config.category || 'Producto Exclusivo'} • Stock Limitado
                </span>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">
                  {config.headline}
                </h1>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                  {config.subheadline}
                </p>
              </div>

              {/* Clean Price Card */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex items-baseline gap-3">
                  <span className="text-3xl font-black text-slate-900">
                    {formatMoney(selectedCombo.promoPrice)}
                  </span>
                  <span className="text-base text-slate-400 line-through font-semibold">
                    {formatMoney(selectedCombo.regularPrice)}
                  </span>
                  <span className="bg-emerald-100 text-emerald-800 text-xs font-black px-2 py-0.5 rounded">
                    {selectedCombo.savingsText || `Ahorras ${discountPercent}%`}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>Envío Gratis a domicilio + Pagas al repartidor en efectivo</span>
                </div>

                <div className="text-[11px] text-slate-500 pt-1 flex items-center justify-between border-t border-slate-200">
                  <span>Disponibilidad inmediata para despacho</span>
                  <span className="text-[#FF252B] font-bold">Últimas {stock} unidades</span>
                </div>
              </div>

              {/* Direct Buy Button */}
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={scrollToCheckout}
                  className="w-full py-4 px-6 bg-[#FF252B] hover:bg-[#e01e24] text-white font-extrabold text-base rounded-xl shadow-md hover:shadow-lg transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Truck className="w-5 h-5 text-white" />
                  <span>¡PEDIR CON PAGO CONTRAENTREGA!</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </button>
                <p className="text-center text-[11px] text-slate-500 flex items-center justify-center gap-1">
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Cero riesgo. No pagas nada por adelantado, pagas al recibir.</span>
                </p>
              </div>

              {/* Quick Feature Bullets */}
              <div className="pt-2 border-t border-slate-100 space-y-2 text-xs text-slate-700">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span><strong>Despacho en 24 horas</strong> mediante Servientrega, Interrapidísimo o Envía.</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span><strong>30 Días de Garantía</strong> directa por defectos o inconformidad.</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span><strong>Soporte vía WhatsApp</strong> para seguimiento de tu guía de despacho.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2.5 HERO CREATIVE BANNER (IF ENABLED) */}
      {heroCreative && (
        <section className="py-6 bg-slate-100 border-b border-slate-200">
          <div className="max-w-4xl mx-auto px-4">
            <ProductCreativeCard creative={heroCreative} productName={config.productName} downloadable={false} />
          </div>
        </section>
      )}

      {/* 3. COMBO SELECTOR (CLEAN & PERSUASIVE) */}
      <section className="py-12 bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-xl mx-auto mb-8">
            <span className="text-xs font-black text-[#172C8A] uppercase tracking-wider bg-blue-50 border border-blue-200 px-3 py-1 rounded-full inline-block mb-2">
              Paso 1: Elige tu Promoción
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              Selecciona la Oferta que Prefieras
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              Todos los paquetes incluyen <strong>Envío Gratis</strong> y <strong>Pago Contraentrega</strong>.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {combos.map((combo) => {
              const isSelected = selectedComboId === combo.id;
              return (
                <div
                  key={combo.id}
                  onClick={() => setSelectedComboId(combo.id)}
                  className={`relative p-5 rounded-2xl cursor-pointer transition flex flex-col justify-between border-2 ${
                    isSelected
                      ? 'border-[#172C8A] bg-blue-50/30 shadow-md'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  {combo.badge && (
                    <div
                      className={`absolute -top-3 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        combo.isPopular
                          ? 'bg-[#FF252B] text-white shadow-sm'
                          : 'bg-slate-800 text-white'
                      }`}
                    >
                      {combo.badge}
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between mb-2 pt-1">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                            isSelected ? 'border-[#172C8A] bg-[#172C8A]' : 'border-slate-300 bg-white'
                          }`}
                        >
                          {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                        </div>
                        <span className="text-xs font-bold text-slate-600">
                          {combo.units} {combo.units === 1 ? 'Unidad' : 'Unidades'}
                        </span>
                      </div>
                      {combo.savingsText && (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                          {combo.savingsText}
                        </span>
                      )}
                    </div>

                    <h3 className="font-bold text-sm text-slate-900 leading-snug">
                      {combo.name}
                    </h3>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-baseline justify-between">
                    <div>
                      <span className="text-xl font-black text-slate-900 block">
                        {formatMoney(combo.promoPrice)}
                      </span>
                      <span className="text-xs text-slate-400 line-through">
                        {formatMoney(combo.regularPrice)}
                      </span>
                    </div>
                    <span className="text-[11px] font-bold text-emerald-600">
                      Envío Gratis
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Combo Creative Banner if present */}
          {comboCreative && (
            <div className="mt-8">
              <ProductCreativeCard creative={comboCreative} productName={config.productName} downloadable={false} />
            </div>
          )}
        </div>
      </section>

      {/* 4. BENEFITS & ATTRIBUTES (CLEAN WHITE CARDS) */}
      <section className="py-12 sm:py-16 bg-slate-50 border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-xl mx-auto mb-10">
            <span className="text-xs font-black text-[#FF5A16] uppercase tracking-wider bg-orange-50 border border-orange-200 px-3 py-1 rounded-full inline-block mb-2">
              Calidad y Confianza
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              ¿Por Qué Este Producto Es Tu Mejor Elección?
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              Diseñado para resolver tus necesidades diarias con materiales de alta duración.
            </p>
          </div>

          {/* Infographic Creative Banner if present */}
          {infographicCreative && (
            <div className="mb-10 max-w-4xl mx-auto">
              <ProductCreativeCard creative={infographicCreative} productName={config.productName} downloadable={false} />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {config.benefits?.map((b, idx) => (
              <div
                key={b.id || idx}
                className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 text-[#172C8A] flex items-center justify-center font-bold text-sm mb-3">
                    0{idx + 1}
                  </div>
                  <h3 className="font-bold text-sm text-slate-900 mb-1 leading-snug">
                    {b.title}
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {b.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. CHECKOUT FORM (CLEAN, MODERN, 1-CLICK COD) */}
      <section id="checkout-form" className="py-12 sm:py-16 bg-white border-b border-slate-200">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          {guaranteeCreative && (
            <div className="mb-8">
              <ProductCreativeCard creative={guaranteeCreative} productName={config.productName} downloadable={false} />
            </div>
          )}

          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
            {/* Header */}
            <div className="bg-[#172C8A] p-6 text-white text-center">
              <span className="text-[11px] font-bold uppercase tracking-wider bg-white/20 text-white px-3 py-1 rounded-full inline-block mb-2">
                PAGO AL RECIBIR EN CASA 🚚
              </span>
              <h2 className="text-2xl font-black">
                Completa Tus Datos de Entrega
              </h2>
              <p className="text-xs text-white/80 mt-1">
                No pagas nada ahora. Pagas en efectivo cuando la transportadora entregue en tu puerta.
              </p>
            </div>

            {/* Selected Combo Summary */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <img src={config.mainImage} alt="Producto" className="w-12 h-12 rounded-lg object-contain bg-white border border-slate-200 p-1" />
                <div>
                  <span className="text-[10px] font-bold text-[#FF5A16] uppercase">Pedido:</span>
                  <div className="font-bold text-slate-900">{selectedCombo.name}</div>
                  <span className="text-emerald-700 font-semibold text-[11px]">Envío Gratis Incluido</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-base font-black text-slate-900 block">
                  {formatMoney(selectedCombo.promoPrice)}
                </span>
                <span className="text-[10px] text-slate-400 line-through">
                  {formatMoney(selectedCombo.regularPrice)}
                </span>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleCheckoutSubmit} className="p-6 sm:p-8 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Full Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nombre y Apellido <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Ej. Juan Pérez"
                    className="w-full text-xs pl-10 pr-3.5 py-3 border border-slate-300 rounded-xl focus:border-[#172C8A] focus:outline-none bg-slate-50/50"
                  />
                </div>
              </div>

              {/* Mobile Phone */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Teléfono Celular / WhatsApp <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Ej. 312 345 6789"
                    className="w-full text-xs pl-10 pr-3.5 py-3 border border-slate-300 rounded-xl focus:border-[#172C8A] focus:outline-none bg-slate-50/50"
                  />
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Te llamaremos o escribiremos por WhatsApp para confirmar antes de enviar.
                </span>
              </div>

              {/* Department & City */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Departamento <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full text-xs px-3.5 py-3 border border-slate-300 rounded-xl focus:border-[#172C8A] focus:outline-none bg-slate-50/50"
                  >
                    {COLOMBIAN_DEPARTMENTS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Ciudad / Municipio <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Ej. Medellín, Cali..."
                      className="w-full text-xs pl-9 pr-3 py-3 border border-slate-300 rounded-xl focus:border-[#172C8A] focus:outline-none bg-slate-50/50"
                    />
                  </div>
                </div>
              </div>

              {/* Delivery Address */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Dirección Exacta (Calle, Carrera, Número, Casa o Apto) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Ej. Carrera 43A # 1Sur - 220, Torre 2, Apto 804"
                  className="w-full text-xs px-3.5 py-3 border border-slate-300 rounded-xl focus:border-[#172C8A] focus:outline-none bg-slate-50/50"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Barrio o Indicaciones Adicionales (Opcional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ej. Barrio El Poblado, dejar en portería"
                  className="w-full text-xs px-3.5 py-3 border border-slate-300 rounded-xl focus:border-[#172C8A] focus:outline-none bg-slate-50/50"
                />
              </div>

              {/* Payment Method Badge */}
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Banknote className="w-4 h-4 text-emerald-600" />
                  <span className="font-bold text-emerald-900">Método: Pago Contraentrega</span>
                </div>
                <span className="text-[11px] text-emerald-700 font-semibold">Pagas en efectivo</span>
              </div>

              {/* Total Calculation */}
              <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-500 block">Total a pagar al recibir:</span>
                  <span className="text-[10px] text-emerald-600 font-bold">Envío 100% Gratis</span>
                </div>
                <div className="text-2xl font-black text-[#FF252B]">
                  {formatMoney(selectedCombo.promoPrice)}
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-4 bg-[#FF252B] hover:bg-[#e01e24] text-white font-black text-base rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {isSubmitting ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Enviando Pedido...</span>
                  </div>
                ) : (
                  <>
                    <Truck className="w-5 h-5 text-white" />
                    <span>¡CONFIRMAR PEDIDO — PAGAR AL RECIBIR!</span>
                  </>
                )}
              </button>

              {/* Logistics carriers footer */}
              <div className="pt-2 text-center text-[10px] text-slate-400">
                <span>Despacho seguro con transportadoras certificadas: </span>
                <span className="font-bold text-slate-600">Servientrega • Interrapidísimo • Coordinadora • Envía</span>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* 6. VERIFIED CUSTOMER REVIEWS */}
      <section className="py-12 bg-slate-50 border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-xl mx-auto mb-8">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
              Opiniones de Compradores Reales
            </span>
            <h2 className="text-2xl font-extrabold text-slate-900">
              Lo Que Dicen Nuestros Clientes
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                name: 'Andrés M.',
                city: 'Medellín',
                comment: 'Llegó en 2 días a mi casa en El Poblado. Pagué en efectivo al repartidor de Servientrega. El producto es idéntico a las fotos.',
                rating: 5,
              },
              {
                name: 'Mariana C.',
                city: 'Bogotá',
                comment: 'Excelente calidad. Me llamaron para confirmar la dirección y todo fue súper rápido. 100% recomendado.',
                rating: 5,
              },
              {
                name: 'Carlos T.',
                city: 'Cali',
                comment: 'Pedí el combo de 2 unidades para regalar una. El ahorro valió totalmente la pena y el pago contraentrega da mucha confianza.',
                rating: 5,
              },
            ].map((r, i) => (
              <div key={i} className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex text-amber-400">
                    {[...Array(r.rating)].map((_, s) => (
                      <Star key={s} className="w-3.5 h-3.5 fill-current" />
                    ))}
                  </div>
                  <span className="text-[10px] text-emerald-700 bg-emerald-50 font-bold px-2 py-0.5 rounded flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Compra Verificada
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed italic">
                  "{r.comment}"
                </p>
                <div className="pt-1 text-[11px] font-bold text-slate-800">
                  {r.name} — <span className="text-slate-500 font-normal">{r.city}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 7. FREQUENTLY ASKED QUESTIONS */}
      <section className="py-12 bg-white border-b border-slate-200">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-extrabold text-slate-900">
              Preguntas Frecuentes
            </h2>
            <p className="text-xs text-slate-500 mt-1">Resolvemos todas tus dudas antes de pedir</p>
          </div>

          <div className="space-y-3">
            {[
              {
                q: '¿Cómo funciona el Pago Contraentrega?',
                a: 'Haces tu pedido en el formulario de arriba sin pagar nada. Nosotros despachamos con transportadoras certificadas (Servientrega, Interrapidísimo o Envía) y cuando el paquete llegue a tu casa u oficina, le pagas el valor exacto en efectivo al repartidor.',
              },
              {
                q: '¿Cuánto tiempo tarda en llegar mi pedido?',
                a: 'El despacho se realiza dentro de las primeras 24 horas hábiles. Para ciudades principales la entrega tarda de 1 a 2 días hábiles; para otros municipios tarda de 2 a 4 días hábiles.',
              },
              {
                q: '¿Qué garantía tengo si el producto no funciona o viene dañado?',
                a: 'Cuentas con 30 días de Garantía Total. Si el producto tiene cualquier defecto de fábrica o daño de transporte, te enviamos uno nuevo inmediatamente sin ningún costo adicional.',
              },
              {
                q: '¿Cómo confirman mi pedido?',
                a: 'Una vez completas el formulario, nuestro equipo de despachos (o nuestro asistente telefónico) te contactará por llamada o WhatsApp para verificar los datos de entrega antes de enviar el paquete.',
              },
            ].map((faq, idx) => (
              <div key={idx} className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                <button
                  type="button"
                  onClick={() => toggleFaq(idx)}
                  className="w-full p-4 text-left font-bold text-xs sm:text-sm text-slate-900 flex items-center justify-between hover:bg-slate-100 transition"
                >
                  <span>{faq.q}</span>
                  {openFaqs[idx] ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                </button>
                {openFaqs[idx] && (
                  <div className="px-4 pb-4 pt-1 text-xs text-slate-600 leading-relaxed bg-white border-t border-slate-200">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 8. FOOTER */}
      <footer className="py-8 bg-slate-900 text-white text-center text-xs space-y-2">
        <p className="font-bold text-slate-300">
          {config.productName} — Distribuidor Autorizado
        </p>
        <p className="text-slate-500 text-[11px]">
          Despachos a toda Colombia con pago contraentrega. Todos los derechos reservados.
        </p>
      </footer>

      {/* SOCIAL PROOF FLOATING POPUP */}
      {showSocialProof && (
        <div className="fixed bottom-20 left-4 z-40 bg-white border border-slate-200 shadow-xl rounded-2xl p-3 flex items-center gap-3 max-w-xs animate-fade-in">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs flex-shrink-0">
            🚚
          </div>
          <div className="text-[11px] leading-tight">
            <span className="font-bold text-slate-900 block">{RECENT_BUYERS[currentBuyerIdx].name}</span>
            <span className="text-slate-500 text-[10px]">
              Compró {RECENT_BUYERS[currentBuyerIdx].combo} desde {RECENT_BUYERS[currentBuyerIdx].city} ({RECENT_BUYERS[currentBuyerIdx].timeAgo})
            </span>
          </div>
        </div>
      )}

      {/* STICKY MOBILE CTA BAR */}
      <div className="sm:hidden fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-slate-200 p-3 z-40 flex items-center justify-between gap-3 shadow-lg">
        <div>
          <span className="text-[10px] text-slate-500 block">Total a pagar:</span>
          <span className="text-lg font-black text-[#FF252B]">
            {formatMoney(selectedCombo.promoPrice)}
          </span>
        </div>
        <button
          onClick={scrollToCheckout}
          className="flex-1 py-3 bg-[#FF252B] text-white font-extrabold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Truck className="w-4 h-4" />
          <span>PEDIR CONTRAENTREGA</span>
        </button>
      </div>

      {/* ORDER SUCCESS MODAL */}
      {orderCompletedData && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          {completedWhatsApp ? (
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl animate-scale-up max-h-[92vh] overflow-y-auto">
            <WhatsAppConfirmStep
              url={completedWhatsApp}
              order={orderCompletedData}
              currency={config.currency || 'COP'}
              previewMode={previewMode}
              onClose={() => setOrderCompletedData(null)}
            />
          </div>
          ) : (
          <div className="bg-white rounded-3xl max-w-md w-full p-6 text-center space-y-4 shadow-2xl animate-scale-up">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto text-2xl font-black">
              ✓
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900">
                ¡Pedido Confirmado con Éxito!
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Número de Orden: <strong className="text-slate-900 font-mono">{orderCompletedData.orderNumber}</strong>
              </p>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-left text-xs space-y-1.5 text-slate-700">
              <div className="flex justify-between">
                <span>Cliente:</span>
                <strong className="text-slate-900">{orderCompletedData.customerName}</strong>
              </div>
              <div className="flex justify-between">
                <span>Teléfono:</span>
                <strong className="text-slate-900">{orderCompletedData.phone}</strong>
              </div>
              <div className="flex justify-between">
                <span>Dirección:</span>
                <strong className="text-slate-900">{orderCompletedData.address}, {orderCompletedData.city}</strong>
              </div>
              <div className="flex justify-between">
                <span>Combo:</span>
                <strong className="text-slate-900">{orderCompletedData.comboName}</strong>
              </div>
              <div className="pt-1.5 border-t border-slate-200 flex justify-between font-bold text-slate-900">
                <span>Pagas al repartidor:</span>
                <span className="text-[#FF252B] font-black">{formatMoney(orderCompletedData.totalAmount)}</span>
              </div>
            </div>

            <p className="text-[11px] text-slate-500">
              Nuestro equipo de logística te contactará en breve para verificar la guía de despacho.
            </p>

            <button
              onClick={() => setOrderCompletedData(null)}
              className="w-full py-3 bg-[#172C8A] hover:bg-blue-900 text-white font-bold text-xs rounded-xl shadow transition cursor-pointer"
            >
              Entendido / Cerrar
            </button>
          </div>
          )}
        </div>
      )}
    </div>
  );
}