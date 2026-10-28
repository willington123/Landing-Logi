'use client';

// Brand-style product page (layout "sales-v2"): Shopify-like buy box above the fold,
// soft tinted sections, rich-text titles and a COD order drawer.
import React, { useEffect, useMemo, useState } from 'react';
import { Inter, Playfair_Display, Fraunces } from 'next/font/google';
import {
  Check,
  X as XIcon,
  Truck,
  ShieldCheck,
  Banknote,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Star,
  MessageCircle,
  ShoppingBag,
  Package,
  Zap,
  Clock,
  Heart,
  Sparkles,
  Battery,
  Droplets,
  Sun,
  Moon,
  Leaf,
  Flame,
  Smile,
  Frown,
  AlertTriangle,
  Wallet,
  Award,
  Target,
  Feather,
  Wind,
  Thermometer,
  Dumbbell,
  Home,
  Baby,
  PawPrint,
  Smartphone,
  Wrench,
  Gem,
  Eye,
  Timer,
  type LucideIcon,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { LandingPageConfig, LandingDesign, ProductCombo } from '@/lib/types';
import { logiStore } from '@/lib/store';

const inter = Inter({ subsets: ['latin'], display: 'swap' });
const playfair = Playfair_Display({ weight: ['600', '700'], style: ['normal', 'italic'], subsets: ['latin'], display: 'swap', preload: false });
const fraunces = Fraunces({ weight: ['600', '700'], style: ['normal', 'italic'], subsets: ['latin'], display: 'swap', preload: false });

const ICONS: Record<string, LucideIcon> = {
  Zap, ShieldCheck, Clock, Heart, Sparkles, Battery, Droplets, Sun, Moon, Leaf, Flame, Smile, Frown,
  AlertTriangle, Wallet, Truck, Award, Target, Feather, Wind, Thermometer, Dumbbell, Home, Baby, PawPrint,
  Smartphone, Wrench, Gem, Eye, Timer, Package,
};
function Icon({ name, className, style }: { name?: string; className?: string; style?: React.CSSProperties }) {
  const Cmp = (name && ICONS[name]) || Sparkles;
  return <Cmp className={className} style={style} strokeWidth={1.8} />;
}

const CO_DEPARTMENTS = [
  'Antioquia', 'Atlántico', 'Bogotá D.C.', 'Bolívar', 'Boyacá', 'Caldas', 'Caquetá', 'Casanare', 'Cauca',
  'Cesar', 'Chocó', 'Córdoba', 'Cundinamarca', 'Huila', 'La Guajira', 'Magdalena', 'Meta', 'Nariño',
  'Norte de Santander', 'Putumayo', 'Quindío', 'Risaralda', 'San Andrés', 'Santander', 'Sucre', 'Tolima',
  'Valle del Cauca', 'Arauca', 'Amazonas', 'Guainía', 'Guaviare', 'Vaupés', 'Vichada',
];

const DEFAULT_DESIGN: LandingDesign = { primary: '#FF5A16', accent: '#172C8A', dark: '#1F2937', light: '#FFF8F1', vibe: 'warm' };

// Picks black or white text for a given background color.
function readableOn(hex: string): string {
  const h = hex.replace('#', '');
  if (h.length !== 6) return '#ffffff';
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.62 ? '#111827' : '#ffffff';
}

// Renders **bold** markers. In titles the marked words get the heavy weight.
function Rich({ text, strongClass = 'font-extrabold' }: { text?: string; strongClass?: string }) {
  if (!text) return null;
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('**') && p.endsWith('**') ? (
          <strong key={i} className={strongClass}>
            {p.slice(2, -2)}
          </strong>
        ) : (
          <React.Fragment key={i}>{p}</React.Fragment>
        )
      )}
    </>
  );
}
const plain = (t?: string) => (t || '').replace(/\*\*/g, '');

interface Props {
  config: LandingPageConfig;
  previewMode?: boolean;
  onOrderSubmit?: (orderData: any) => void;
}

export default function SalesPageRenderer({ config, previewMode = false, onOrderSubmit }: Props) {
  const d = config.design || DEFAULT_DESIGN;
  const s = config.sales!;
  const onPrimary = readableOn(d.primary);
  const serif = d.vibe === 'luxury' ? playfair.className : fraunces.className;
  const headingFont = d.vibe === 'luxury' ? playfair.className : d.vibe === 'warm' ? fraunces.className : '';
  const isColombia = !config.country || config.country === 'Colombia';
  const brand = s.brandName || config.productName.split(' ')[0];

  const money = (v: number) => `$${(v || 0).toLocaleString('es-CO')} ${config.currency || 'COP'}`;
  const discount = Math.max(0, Math.round(((config.regularPrice - config.promoPrice) / (config.regularPrice || 1)) * 100));

  const combos: ProductCombo[] = config.combos?.length
    ? config.combos
    : [{ id: 'single', name: config.productName, units: 1, regularPrice: config.regularPrice, promoPrice: config.promoPrice, savingsText: '', isPopular: true }];
  const [comboId, setComboId] = useState(() => (combos.find((c) => c.isPopular) || combos[0]).id);
  const combo = combos.find((c) => c.id === comboId) || combos.find((c) => c.isPopular) || combos[0];

  const gallery = useMemo(
    () => [config.mainImage, ...(config.galleryImages || [])].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i),
    [config.mainImage, config.galleryImages]
  );
  const [imgIdx, setImgIdx] = useState(0);
  const img = (i: number) => gallery[i % gallery.length] || config.mainImage;

  const chips = s.featureChips?.length
    ? s.featureChips
    : s.heroBullets.map((t) => ({ icon: 'Sparkles', text: t }));

  const reviews = config.reviews || [];
  const avgRating = reviews.length ? reviews.reduce((a, r) => a + r.rating, 0) / reviews.length : 0;

  const [openAcc, setOpenAcc] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [drawer, setDrawer] = useState(false);

  // Order form
  const [form, setForm] = useState({ name: '', phone: '', region: isColombia ? 'Antioquia' : '', city: '', address: '', notes: '' });
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<any | null>(null);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    if (!drawer) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [drawer]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!form.name.trim()) return setFormError('Escribe tu nombre completo.');
    if (form.phone.replace(/\D/g, '').length < 7) return setFormError('Escribe un número de celular válido.');
    if (!form.city.trim()) return setFormError('Escribe tu ciudad o municipio.');
    if (!form.address.trim()) return setFormError('Escribe la dirección de entrega.');
    setSubmitting(true);
    const order = {
      landingPageId: config.id,
      productName: config.productName,
      comboName: combo.name,
      units: combo.units,
      totalAmount: combo.promoPrice,
      customerName: form.name.trim(),
      phone: form.phone.trim(),
      department: form.region.trim(),
      city: form.city.trim(),
      address: form.address.trim(),
      notes: form.notes.trim(),
      paymentMethod: 'cash_on_delivery' as const,
    };
    setTimeout(() => {
      let saved: any = order;
      if (onOrderSubmit) onOrderSubmit(order);
      else if (!previewMode) {
        try {
          saved = logiStore.createOrder(order);
        } catch {
          // ignore storage errors in demo mode
        }
      }
      setSubmitting(false);
      setDone(saved);
      try {
        confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 }, colors: [d.primary, d.accent, '#ffffff'] });
      } catch {
        // ignore
      }
    }, 500);
  };

  const whatsappHref = config.whatsappNumber
    ? `https://wa.me/${config.whatsappNumber.replace(/\D/g, '')}?text=${encodeURIComponent(config.whatsappDirectMessage || '')}`
    : '';

  // ---------- small building blocks ----------
  const CTA = ({ label, full = false, withPrice = false }: { label?: string; full?: boolean; withPrice?: boolean }) => (
    <button
      type="button"
      onClick={() => setDrawer(true)}
      className={`${full ? 'w-full' : 'w-full sm:w-auto sm:min-w-[280px]'} h-14 px-6 sm:px-8 rounded-full font-bold text-[15px] tracking-wide flex items-center justify-center gap-2.5 whitespace-nowrap transition hover:-translate-y-0.5 active:translate-y-0`}
      style={{ background: d.primary, color: onPrimary, boxShadow: `0 3px 0 ${d.dark}, 0 12px 24px -12px ${d.primary}` , border: `2px solid ${d.dark}` }}
    >
      <ShoppingBag className="w-[18px] h-[18px]" />
      {label || s.ctaText}
      {withPrice && <span className="hidden sm:inline opacity-80 font-semibold whitespace-nowrap">· {money(combo.promoPrice)}</span>}
    </button>
  );

  const SectionTitle = ({ title, subtitle, center = true }: { title?: string; subtitle?: string; center?: boolean }) => (
    <div className={`${center ? 'text-center mx-auto' : ''} max-w-2xl mb-10`}>
      <h2 className={`${headingFont} text-[28px] sm:text-4xl leading-tight font-medium tracking-tight`} style={{ color: d.dark }}>
        <Rich text={title} />
      </h2>
      {subtitle && <p className="text-[15px] sm:text-base text-slate-500 mt-3 leading-relaxed"><Rich text={subtitle} strongClass="font-semibold text-slate-700" /></p>}
    </div>
  );

  const Stars = ({ value, size = 'w-4 h-4' }: { value: number; size?: string }) => (
    <span className="inline-flex gap-0.5">
      {[0, 1, 2, 3, 4].map((i) => (
        <Star key={i} className={`${size} ${i < Math.round(value) ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
      ))}
    </span>
  );

  const accordion = [
    { id: 'details', title: 'Detalles del producto', icon: Package, body: s.productDetails || config.benefits.map((b) => `${b.title}: ${b.description}`).join(' ') },
    { id: 'shipping', title: 'Envío y pago', icon: Truck, body: s.shippingInfo || `${config.shippingCostText}. Pagas en efectivo cuando recibes tu pedido.` },
    { id: 'guarantee', title: 'Garantía', icon: ShieldCheck, body: config.guaranteeText },
  ].filter((a) => a.body);

  const firstBlock = s.benefitBlocks[0];
  const restBlocks = s.benefitBlocks.slice(1);
  const leftBenefits = config.benefits.slice(0, 2);
  const rightBenefits = config.benefits.slice(2, 4);

  return (
    <div className={`${inter.className} bg-white text-slate-700 antialiased pb-24 sm:pb-0`}>
      {/* Announcement */}
      <div className="text-center text-[13px] font-medium py-2.5 px-4 text-white" style={{ background: d.dark }}>
        <span className="inline-flex items-center gap-2">
          <Truck className="w-4 h-4 opacity-80" />
          {plain(config.urgencyText) || `${config.shippingCostText} · Pagas al recibir`}
        </span>
      </div>

      {/* Header */}
      <header className="border-b border-slate-200/80 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <span className={`${headingFont || 'tracking-tight'} text-xl sm:text-2xl font-bold`} style={{ color: d.dark }}>
            {brand}
          </span>
          <div className="flex items-center gap-4 text-[13px] text-slate-600">
            <span className="hidden sm:inline-flex items-center gap-1.5"><Banknote className="w-4 h-4" /> Pago contraentrega</span>
            <button onClick={() => setDrawer(true)} className="relative w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center" aria-label="Pedir">
              <ShoppingBag className="w-5 h-5" style={{ color: d.dark }} />
            </button>
          </div>
        </div>
      </header>

      {/* ============ PRODUCT HERO / BUY BOX ============ */}
      <section className="bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10 grid md:grid-cols-2 gap-8 lg:gap-14">
          {/* Gallery */}
          <div className="md:sticky md:top-6 self-start">
            <div className="relative aspect-square rounded-2xl overflow-hidden" style={{ background: d.light }}>
              <img src={img(imgIdx)} alt={config.productName} className="w-full h-full object-cover" />
              {discount > 0 && (
                <span className="absolute top-4 left-4 text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: d.primary, color: onPrimary }}>
                  -{discount}%
                </span>
              )}
              {gallery.length > 1 && (
                <>
                  <button onClick={() => setImgIdx((i) => (i - 1 + gallery.length) % gallery.length)} className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 shadow flex items-center justify-center hover:bg-white" aria-label="Imagen anterior">
                    <ChevronLeft className="w-5 h-5 text-slate-700" />
                  </button>
                  <button onClick={() => setImgIdx((i) => (i + 1) % gallery.length)} className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 shadow flex items-center justify-center hover:bg-white" aria-label="Imagen siguiente">
                    <ChevronRight className="w-5 h-5 text-slate-700" />
                  </button>
                </>
              )}
            </div>
            {gallery.length > 1 && (
              <div className="grid grid-cols-5 gap-2 mt-3">
                {gallery.slice(0, 5).map((g, i) => (
                  <button
                    key={i}
                    onClick={() => setImgIdx(i)}
                    className="aspect-square rounded-xl overflow-hidden border-2 transition"
                    style={{ borderColor: i === imgIdx ? d.dark : 'transparent', background: d.light }}
                    aria-label={`Ver imagen ${i + 1}`}
                  >
                    <img src={g} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
            {config.guaranteeDays > 0 && (
              <div className="mt-3 rounded-xl px-4 py-2.5 text-center text-[13px] font-semibold" style={{ background: `${d.primary}1A`, color: d.dark }}>
                Pruébalo {config.guaranteeDays} días. Si no te convence, te devolvemos tu dinero.
              </div>
            )}
          </div>

          {/* Buy box */}
          <div>
            {reviews.length > 0 ? (
              <div className="flex items-center gap-2 text-[13px] text-slate-600 mb-3">
                <Stars value={avgRating} />
                <span>
                  <strong className="text-slate-900">{avgRating.toFixed(1)}</strong> de {reviews.length} {reviews.length === 1 ? 'reseña' : 'reseñas'}
                </span>
              </div>
            ) : null}

            <h1 className={`${headingFont} text-3xl sm:text-[40px] leading-[1.1] font-bold tracking-tight`} style={{ color: d.dark }}>
              {config.productName}
            </h1>

            {s.eyebrow && (
              <span className="inline-block mt-3 text-[13px] font-semibold px-3 py-1 rounded-lg border" style={{ color: d.dark, borderColor: `${d.primary}66`, background: `${d.primary}12` }}>
                {plain(s.eyebrow)}
              </span>
            )}

            <p className="mt-4 text-[15px] leading-relaxed text-slate-600">
              <Rich text={config.subheadline} strongClass="font-semibold text-slate-900" />
            </p>

            <div className="grid grid-cols-2 gap-2 mt-5">
              {chips.slice(0, 4).map((c, i) => (
                <div key={i} className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-[13px] font-medium" style={{ background: d.light, color: d.dark }}>
                  <Icon name={c.icon} className="w-4 h-4 flex-shrink-0" style={{ color: d.dark }} />
                  <span className="leading-tight">{plain(c.text)}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-6">
              {config.regularPrice > config.promoPrice && <span className="text-base sm:text-lg text-slate-400 line-through whitespace-nowrap">{money(config.regularPrice)}</span>}
              <span className="text-xl sm:text-2xl font-bold whitespace-nowrap" style={{ color: d.dark }}>{money(config.promoPrice)}</span>
              {discount > 0 && (
                <span className="text-xs font-bold px-2.5 py-1 rounded-md whitespace-nowrap" style={{ background: d.accent, color: readableOn(d.accent) }}>
                  AHORRA {discount}%
                </span>
              )}
            </div>

            {combos.length === 1 && combos[0].units > 1 && (
              <p className="mt-1.5 text-[13px] text-slate-600">
                Precio por <strong className="text-slate-900">{combos[0].name}</strong>
                {combos[0].savingsText ? ` · ${combos[0].savingsText}` : ''}
              </p>
            )}

            {/* Offers */}
            {combos.length > 1 && (
              <div className="mt-6">
                <div className="text-xs font-semibold text-slate-500 mb-2">Elige tu oferta</div>
                <div className="space-y-2">
                  {combos.map((c) => {
                    const active = c.id === comboId;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setComboId(c.id)}
                        className="relative w-full flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition"
                        style={{ borderColor: active ? d.dark : '#E5E7EB', background: active ? d.light : '#fff' }}
                      >
                        <span className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0" style={{ borderColor: active ? d.dark : '#CBD5E1' }}>
                          {active && <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.dark }} />}
                        </span>
                        <span className="flex-1">
                          <span className="block text-sm font-semibold text-slate-900">
                            {c.name}
                            {c.badge && (
                              <span
                                className="ml-2 inline-block text-[10.5px] font-bold px-2 py-0.5 rounded-full align-middle whitespace-nowrap"
                                style={c.isPopular ? { background: d.primary, color: onPrimary } : { background: d.light, color: d.dark, border: `1px solid ${d.dark}22` }}
                              >
                                {c.badge}
                              </span>
                            )}
                          </span>
                          {c.savingsText && <span className="block text-xs text-emerald-600 font-medium">{c.savingsText}</span>}
                        </span>
                        <span className="text-right">
                          <span className="block text-sm font-bold text-slate-900 whitespace-nowrap">{money(c.promoPrice)}</span>
                          {c.regularPrice > c.promoPrice && <span className="block text-xs text-slate-400 line-through">{money(c.regularPrice)}</span>}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mt-6">
              <CTA full withPrice />
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 mt-3 text-[13px] text-slate-600">
              <span className="inline-flex items-center gap-1.5"><ShieldCheck className="w-4 h-4" /> Garantía {config.guaranteeDays} días</span>
              <span className="inline-flex items-center gap-1.5"><Truck className="w-4 h-4" /> {config.shippingCostText}</span>
            </div>
            <div className="mt-4 rounded-xl border border-slate-200 px-4 py-3 flex items-center gap-3">
              <span className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
                <Banknote className="w-5 h-5" />
              </span>
              <p className="text-[13px] leading-snug">
                <strong className="text-slate-900">Pagas en efectivo al recibir.</strong> Sin tarjeta y sin pagar nada por adelantado.
              </p>
            </div>

            {/* Accordions */}
            <div className="mt-5 border-t border-slate-200">
              {accordion.map((a) => (
                <div key={a.id} className="border-b border-slate-200">
                  <button
                    type="button"
                    onClick={() => setOpenAcc(openAcc === a.id ? null : a.id)}
                    className="w-full flex items-center gap-3 py-3.5 text-sm font-medium text-slate-900"
                  >
                    <a.icon className="w-4 h-4 text-slate-500" />
                    <span className="flex-1 text-left">{a.title}</span>
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition ${openAcc === a.id ? 'rotate-180' : ''}`} />
                  </button>
                  {openAcc === a.id && <p className="pb-4 pl-7 text-sm text-slate-600 leading-relaxed"><Rich text={a.body} strongClass="font-semibold text-slate-800" /></p>}
                </div>
              ))}
            </div>

            {config.guaranteeText && (
              <div className="mt-5 rounded-2xl border-2 border-dashed p-4 flex gap-4" style={{ borderColor: `${d.primary}80`, background: `${d.primary}0A` }}>
                <span className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `${d.primary}26` }}>
                  <ShieldCheck className="w-6 h-6" style={{ color: d.dark }} />
                </span>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10.5px] font-bold px-2 py-0.5 rounded" style={{ background: d.dark, color: '#fff' }}>SIN RIESGO</span>
                    <span className="text-sm font-bold text-slate-900">Garantía de {config.guaranteeDays} días</span>
                  </div>
                  <p className="text-[13px] text-slate-600 leading-relaxed">{plain(config.guaranteeText)}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ============ PROMISE + STEPS (timeline) ============ */}
      {s.howItWorks.length > 0 && (
        <section className="py-16 sm:py-24" style={{ background: d.light }}>
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <SectionTitle title={config.headline} subtitle={plain(s.solutionText)} />
            <div className="grid md:grid-cols-2 gap-6 items-stretch">
              <div className="relative rounded-3xl overflow-hidden min-h-[320px]" style={{ background: `${d.primary}1A` }}>
                <img src={s.solutionImage || img(1)} alt="" className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute inset-x-0 bottom-0 p-5 bg-gradient-to-t from-black/55 to-transparent">
                  <span className={`${serif} italic text-2xl text-white`}>{plain(s.howItWorksTitle) || 'Así de simple'}</span>
                </div>
              </div>
              <div className="space-y-3">
                {s.howItWorks.map((st, i) => (
                  <div key={i} className="rounded-2xl bg-white border border-slate-200/80 p-5">
                    <span className="inline-block text-xs font-bold px-2.5 py-1 rounded-md mb-2" style={{ background: `${d.primary}26`, color: d.dark }}>
                      Paso {i + 1}
                    </span>
                    <h3 className="text-lg font-semibold text-slate-900">{plain(st.title)}</h3>
                    <p className="text-[15px] text-slate-600 mt-1 leading-relaxed"><Rich text={st.text} strongClass="font-semibold text-slate-800" /></p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ============ PAIN → SOLUTION CARD ============ */}
      {firstBlock && (
        <section className="py-16 sm:py-24 bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="rounded-3xl border border-slate-200 p-4 sm:p-6 grid md:grid-cols-2 gap-6 lg:gap-10 items-center">
              <div className="relative rounded-2xl overflow-hidden grid grid-cols-5 min-h-[340px]" style={{ background: d.light }}>
                <div className="col-span-3 p-5 sm:p-7 flex flex-col justify-center relative z-10">
                  <p className={`${serif} italic text-xl sm:text-2xl leading-snug`} style={{ color: d.dark }}>
                    {plain(s.painTitle)}
                  </p>
                  <div className="flex flex-col items-start gap-2 mt-4">
                    {(s.painTags?.length ? s.painTags : s.painPoints.slice(0, 2).map((p) => p.title)).map((t, i) => (
                      <span key={i} className="text-sm font-bold uppercase tracking-wide px-4 py-1.5 rounded-full border" style={{ background: i === 0 ? d.primary : '#fff', color: i === 0 ? onPrimary : d.dark, borderColor: `${d.dark}33` }}>
                        {plain(t)}
                      </span>
                    ))}
                  </div>
                  <ul className={`${serif} italic mt-5 space-y-1.5 text-[15px]`} style={{ color: d.dark }}>
                    {s.painPoints.slice(0, 3).map((p, i) => (
                      <li key={i}>• {plain(p.title)}</li>
                    ))}
                  </ul>
                </div>
                <div className="col-span-2 relative">
                  <img src={s.painImage || img(2)} alt="" className="absolute inset-0 w-full h-full object-cover" />
                </div>
              </div>
              <div className="px-1 sm:px-2">
                <h3 className={`${headingFont} text-2xl sm:text-3xl font-semibold leading-tight tracking-tight`} style={{ color: d.dark }}>
                  <Rich text={firstBlock.title} />
                </h3>
                <p className="text-[15px] text-slate-600 mt-3 leading-relaxed"><Rich text={firstBlock.text} strongClass="font-semibold text-slate-800" /></p>
                <div className="space-y-2 mt-5">
                  {firstBlock.bullets.map((b, i) => (
                    <div key={i} className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: `${d.primary}10` }}>
                      <Icon name={chips[i]?.icon} className="w-5 h-5 flex-shrink-0" style={{ color: d.dark }} />
                      <span className="text-[14px] text-slate-700"><Rich text={b} strongClass="font-semibold text-slate-900" /></span>
                    </div>
                  ))}
                </div>
                <div className="mt-6">
                  <CTA full />
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ============ FACTS BAND (dark) ============ */}
      {s.stats.length > 0 && (
        <section className="py-16 sm:py-20 text-white" style={{ background: d.dark }}>
          <div className="max-w-6xl mx-auto px-4 sm:px-6 grid md:grid-cols-2 gap-10 items-center">
            <div className="text-center md:text-left">
              <h2 className={`${headingFont} text-3xl sm:text-4xl font-bold leading-tight`}>
                {plain(s.solutionTitle)}
              </h2>
              <span className="inline-block mt-3 text-lg sm:text-xl font-extrabold italic px-4 py-1.5 rounded-lg" style={{ background: d.primary, color: onPrimary }}>
                {brand}
              </span>
              <p className="text-white/75 mt-5 leading-relaxed max-w-md mx-auto md:mx-0">{plain(config.subheadline)}</p>
            </div>
            <div className="divide-y divide-white/15">
              {s.stats.map((st, i) => (
                <div key={i} className="flex items-center gap-5 py-5">
                  <span className="w-[72px] h-[72px] rounded-full border-4 flex items-center justify-center text-center text-[13px] font-bold leading-tight px-1 flex-shrink-0" style={{ borderColor: d.primary }}>
                    {plain(st.value)}
                  </span>
                  <span className="text-base text-white/90">{plain(st.label)}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ============ BENEFIT BLOCKS ============ */}
      {restBlocks.length > 0 && (
        <section className="py-16 sm:py-24" style={{ background: d.light }}>
          <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-6">
            {restBlocks.map((b, i) => (
              <div key={i} className="rounded-3xl border-2 border-dashed bg-white p-4 sm:p-6 grid md:grid-cols-2 gap-6 lg:gap-10 items-center" style={{ borderColor: `${d.primary}55` }}>
                <img
                  src={b.image || img(i + 3)}
                  alt=""
                  className={`w-full aspect-[4/3] object-cover rounded-2xl ${i % 2 === 1 ? 'md:order-2' : ''}`}
                />
                <div className="px-1 sm:px-2">
                  <h3 className={`${headingFont} text-2xl sm:text-3xl font-semibold leading-tight tracking-tight`} style={{ color: d.dark }}>
                    <Rich text={b.title} />
                  </h3>
                  <p className="text-[15px] text-slate-600 mt-3 leading-relaxed"><Rich text={b.text} strongClass="font-semibold text-slate-800" /></p>
                  {b.bullets[0] && (
                    <div className="flex gap-3 rounded-xl p-4 mt-4" style={{ background: `${d.primary}12` }}>
                      <Icon name={chips[(i + 1) % chips.length]?.icon} className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: d.dark }} />
                      <ul className="text-[14px] text-slate-700 space-y-1">
                        {b.bullets.map((bl, j) => (
                          <li key={j}><Rich text={bl} strongClass="font-semibold text-slate-900" /></li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="mt-6">
                    <CTA full />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ============ PRODUCT IN THE CENTER ============ */}
      {config.benefits.length > 0 && (
        <section className="py-16 sm:py-24 bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <SectionTitle title={`Por qué te va a encantar **${brand}**`} subtitle={plain(s.finalCtaText)} />
            <div className="grid md:grid-cols-[1fr_auto_1fr] gap-8 md:gap-10 items-center">
              <div className="space-y-8 order-2 md:order-1">
                {leftBenefits.map((b) => (
                  <div key={b.id} className="text-center md:text-right">
                    <Icon name={b.icon} className="w-7 h-7 mx-auto md:ml-auto md:mr-0 mb-2" style={{ color: d.dark }} />
                    <h4 className="text-lg font-semibold text-slate-900">{plain(b.title)}</h4>
                    <p className="text-sm text-slate-500 mt-1 leading-relaxed">{plain(b.description)}</p>
                  </div>
                ))}
              </div>
              <div className="order-1 md:order-2 mx-auto">
                <div className="w-64 h-64 sm:w-80 sm:h-80 rounded-full border-2 border-dashed p-2" style={{ borderColor: d.primary }}>
                  <img src={config.mainImage} alt={config.productName} className="w-full h-full rounded-full object-cover" style={{ background: d.light }} />
                </div>
              </div>
              <div className="space-y-8 order-3">
                {rightBenefits.map((b) => (
                  <div key={b.id} className="text-center md:text-left">
                    <Icon name={b.icon} className="w-7 h-7 mx-auto md:mx-0 mb-2" style={{ color: d.dark }} />
                    <h4 className="text-lg font-semibold text-slate-900">{plain(b.title)}</h4>
                    <p className="text-sm text-slate-500 mt-1 leading-relaxed">{plain(b.description)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ============ COMPARISON ============ */}
      {s.comparison.length > 0 && (
        <section className="py-16 sm:py-24" style={{ background: d.light }}>
          <div className="max-w-6xl mx-auto px-4 sm:px-6 grid md:grid-cols-2 gap-10 items-center">
            <div>
              <h2 className={`${headingFont} text-[28px] sm:text-4xl font-medium leading-tight tracking-tight`} style={{ color: d.dark }}>
                <Rich text={s.comparisonTitle} />
              </h2>
              <p className="text-[15px] text-slate-600 mt-4 leading-relaxed max-w-md"><Rich text={s.solutionText} strongClass="font-semibold text-slate-800" /></p>
              <div className="mt-6 max-w-sm">
                <CTA full />
              </div>
            </div>
            <div className="rounded-3xl bg-white p-3 sm:p-5 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.15)]">
              <div className="grid grid-cols-[1.4fr_1fr_1fr] text-center text-xs sm:text-sm font-semibold">
                <div />
                <div className="rounded-t-2xl py-3" style={{ background: d.primary, color: onPrimary }}>{brand}</div>
                <div className="py-3 text-slate-500">Otros</div>
              </div>
              {s.comparison.map((r, i) => (
                <div key={i} className="grid grid-cols-[1.4fr_1fr_1fr] text-center items-center text-xs sm:text-sm border-t border-slate-100">
                  <div className="py-3.5 pr-2 text-left font-medium text-slate-800">{plain(r.feature)}</div>
                  <div className={`py-3.5 h-full flex flex-col items-center justify-center gap-0.5 ${i === s.comparison.length - 1 ? 'rounded-b-2xl' : ''}`} style={{ background: `${d.primary}1F` }}>
                    <Check className="w-5 h-5" style={{ color: d.dark }} strokeWidth={3} />
                    <span className="text-[11px] text-slate-600 leading-tight px-1">{plain(r.us)}</span>
                  </div>
                  <div className="py-3.5 flex flex-col items-center gap-0.5">
                    <XIcon className="w-5 h-5 text-rose-400" strokeWidth={3} />
                    <span className="text-[11px] text-slate-400 leading-tight px-1">{plain(r.others)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ============ REVIEWS (only real ones added by the seller) ============ */}
      {reviews.length > 0 && (
        <section className="py-16 sm:py-24 bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="flex justify-center mb-3">
              <span className="inline-flex items-center gap-2 text-[13px] px-3 py-1 rounded-full" style={{ background: d.light }}>
                <Stars value={avgRating} /> {avgRating.toFixed(1)}/5 · {reviews.length} {reviews.length === 1 ? 'reseña' : 'reseñas'}
              </span>
            </div>
            <SectionTitle title="Lo que dicen **nuestros clientes**" />
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {reviews.map((r) => (
                <div key={r.id} className="rounded-2xl border border-slate-200 p-5">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    {r.verifiedPurchase && <Check className="w-4 h-4 text-sky-500" strokeWidth={3} />}
                    {r.author}
                  </div>
                  <Stars value={r.rating} size="w-4 h-4 mt-1" />
                  <p className="text-sm text-slate-600 mt-2 leading-relaxed">{r.comment}</p>
                  {r.location && <p className="text-xs text-slate-400 mt-2">{r.location}</p>}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ============ FAQ ============ */}
      {config.faqs.length > 0 && (
        <section className="py-16 sm:py-24" style={{ background: reviews.length ? d.light : '#fff' }}>
          <div className="max-w-6xl mx-auto px-4 sm:px-6 grid md:grid-cols-[1fr_1.4fr] gap-10">
            <div>
              <h2 className={`${headingFont} text-[28px] sm:text-4xl font-medium leading-tight tracking-tight`} style={{ color: d.dark }}>
                Preguntas <strong className="font-extrabold">frecuentes</strong>
              </h2>
              <p className="text-[15px] text-slate-500 mt-3">¿Otra duda? Escríbenos y te respondemos enseguida.</p>
              {whatsappHref && (
                <a href={whatsappHref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 mt-5 h-11 px-5 rounded-full border-2 text-sm font-semibold" style={{ borderColor: d.dark, color: d.dark }}>
                  <MessageCircle className="w-4 h-4" /> Escribir por WhatsApp
                </a>
              )}
            </div>
            <div className="border-t border-slate-200">
              {config.faqs.map((f, i) => (
                <div key={f.id} className="border-b border-slate-200">
                  <button type="button" onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full flex items-center justify-between gap-4 py-5 text-left text-[15px] font-semibold text-slate-900">
                    {plain(f.question)}
                    <ChevronDown className={`w-5 h-5 flex-shrink-0 text-slate-400 transition ${openFaq === i ? 'rotate-180' : ''}`} />
                  </button>
                  {openFaq === i && <p className="pb-5 text-[15px] text-slate-600 leading-relaxed"><Rich text={f.answer} strongClass="font-semibold text-slate-800" /></p>}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ============ FINAL CTA ============ */}
      <section className="py-16 sm:py-20" style={{ background: `${d.primary}14` }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center gap-8 text-center md:text-left">
          <img src={config.mainImage} alt="" className="w-40 h-40 rounded-3xl object-cover bg-white shadow-sm flex-shrink-0" />
          <div className="flex-1">
            <h2 className={`${headingFont} text-[28px] sm:text-[34px] font-medium leading-tight tracking-tight`} style={{ color: d.dark }}>
              <Rich text={s.finalCtaTitle} />
            </h2>
            <p className="text-[15px] text-slate-600 mt-2 mb-6">{plain(s.finalCtaText)}</p>
            <CTA withPrice />
          </div>
        </div>
      </section>

      <footer className="py-8 text-center text-[13px] text-slate-500 bg-white border-t border-slate-100">
        © {new Date().getFullYear()} {brand} · Pago contraentrega · {config.country || 'Colombia'}
      </footer>

      {/* WhatsApp */}
      {whatsappHref && (
        <a href={whatsappHref} target="_blank" rel="noreferrer" className="fixed right-4 bottom-24 sm:bottom-6 z-40 w-14 h-14 rounded-full bg-[#25D366] text-white flex items-center justify-center shadow-xl hover:scale-105 transition" aria-label="Escribir por WhatsApp">
          <MessageCircle className="w-7 h-7" />
        </a>
      )}

      {/* Sticky mobile bar */}
      {config.enableStickyBar !== false && (
        <div className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-slate-200 p-3 flex items-center gap-3">
          <img src={config.mainImage} alt="" className="w-11 h-11 rounded-lg object-cover" />
          <div className="flex-1 min-w-0">
            <div className="text-xs text-slate-500 truncate">{config.productName}</div>
            <div className="text-[15px] font-bold whitespace-nowrap" style={{ color: d.dark }}>${combo.promoPrice.toLocaleString('es-CO')}</div>
          </div>
          <button onClick={() => setDrawer(true)} className="h-11 px-5 rounded-full text-sm font-bold whitespace-nowrap" style={{ background: d.primary, color: onPrimary, border: `2px solid ${d.dark}` }}>
            {s.ctaText}
          </button>
        </div>
      )}

      {/* ============ ORDER DRAWER ============ */}
      {drawer && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => !submitting && setDrawer(false)} />
          <div className="relative w-full sm:max-w-md h-full bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-5 h-16 border-b border-slate-200">
              <span className="font-semibold text-slate-900">{done ? 'Pedido recibido' : 'Completa tu pedido'}</span>
              <button onClick={() => { setDrawer(false); if (done) setDone(null); }} className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center" aria-label="Cerrar">
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            {done ? (
              <div className="flex-1 p-6 text-center flex flex-col items-center justify-center">
                <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: d.primary, color: onPrimary }}>
                  <Check className="w-8 h-8" strokeWidth={3} />
                </div>
                <h3 className="text-xl font-bold text-slate-900">¡Gracias, {done.customerName?.split(' ')[0]}!</h3>
                {done.orderNumber && <p className="text-xs text-slate-500 mt-1">Pedido {done.orderNumber}</p>}
                <p className="text-sm text-slate-600 mt-3 leading-relaxed">
                  Te contactaremos al {done.phone} para confirmar la entrega. Pagarás {money(done.totalAmount)} cuando lo recibas.
                </p>
                <button onClick={() => { setDrawer(false); setDone(null); }} className="mt-6 h-12 px-8 rounded-full font-semibold text-white" style={{ background: d.dark }}>
                  Listo
                </button>
              </div>
            ) : (
              <form onSubmit={submit} className="flex-1 overflow-y-auto p-5 space-y-3">
                <div className="flex items-center gap-3 rounded-xl p-3" style={{ background: d.light }}>
                  <img src={config.mainImage} alt="" className="w-14 h-14 rounded-lg object-cover bg-white" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-900 truncate">{config.productName}</div>
                    <div className="text-xs text-slate-500">{combo.name}</div>
                  </div>
                  <div className="text-sm font-bold text-slate-900">{money(combo.promoPrice)}</div>
                </div>

                {combos.length > 1 && (
                  <div className="flex flex-wrap gap-2">
                    {combos.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setComboId(c.id)}
                        className="flex-1 min-w-[84px] rounded-xl border-2 px-2 py-2 text-xs font-semibold"
                        style={{ borderColor: c.id === comboId ? d.dark : '#E5E7EB', color: d.dark, background: c.id === comboId ? d.light : '#fff' }}
                      >
                        {c.units} {c.units === 1 ? 'unidad' : 'unid.'}
                        <span className="block font-normal text-slate-500">${c.promoPrice.toLocaleString('es-CO')}</span>
                      </button>
                    ))}
                  </div>
                )}

                {formError && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {formError}
                  </div>
                )}

                {[
                  { k: 'name' as const, ph: 'Nombre y apellido', ac: 'name' },
                  { k: 'phone' as const, ph: 'Celular / WhatsApp', ac: 'tel', type: 'tel' },
                ].map((f) => (
                  <input key={f.k} className="w-full h-12 px-4 rounded-xl border border-slate-300 text-sm outline-none focus:border-slate-900" placeholder={f.ph} value={form[f.k]} onChange={set(f.k)} autoComplete={f.ac} type={f.type || 'text'} />
                ))}
                <div className="grid grid-cols-2 gap-3">
                  {isColombia ? (
                    <select className="w-full h-12 px-3 rounded-xl border border-slate-300 text-sm outline-none focus:border-slate-900 bg-white" value={form.region} onChange={set('region')}>
                      {CO_DEPARTMENTS.map((dep) => (
                        <option key={dep}>{dep}</option>
                      ))}
                    </select>
                  ) : (
                    <input className="w-full h-12 px-4 rounded-xl border border-slate-300 text-sm outline-none focus:border-slate-900" placeholder="Estado / Provincia" value={form.region} onChange={set('region')} />
                  )}
                  <input className="w-full h-12 px-4 rounded-xl border border-slate-300 text-sm outline-none focus:border-slate-900" placeholder="Ciudad" value={form.city} onChange={set('city')} autoComplete="address-level2" />
                </div>
                <input className="w-full h-12 px-4 rounded-xl border border-slate-300 text-sm outline-none focus:border-slate-900" placeholder="Dirección completa" value={form.address} onChange={set('address')} autoComplete="street-address" />
                <input className="w-full h-12 px-4 rounded-xl border border-slate-300 text-sm outline-none focus:border-slate-900" placeholder="Barrio / indicaciones (opcional)" value={form.notes} onChange={set('notes')} />

                <div className="flex items-center justify-between pt-3 border-t border-slate-200 text-sm">
                  <span className="text-slate-600">Total a pagar al recibir</span>
                  <span className="text-lg font-bold text-slate-900">{money(combo.promoPrice)}</span>
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-14 rounded-full font-bold text-[15px] flex items-center justify-center gap-2 disabled:opacity-60"
                  style={{ background: d.primary, color: onPrimary, border: `2px solid ${d.dark}`, boxShadow: `0 3px 0 ${d.dark}` }}
                >
                  {submitting ? 'Enviando…' : (<><Banknote className="w-5 h-5" /> Pedir y pagar al recibir</>)}
                </button>
                <p className="text-xs text-center text-slate-500">No pagas nada ahora. Te llamamos para confirmar el envío.</p>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
