'use client';

import React, { useMemo, useState } from 'react';
import { Anton, Playfair_Display, Poppins, Space_Grotesk, Fraunces, Inter } from 'next/font/google';
import {
  Check,
  X as XIcon,
  Truck,
  ShieldCheck,
  Banknote,
  ChevronDown,
  AlertCircle,
  Star,
  ArrowRight,
  MessageCircle,
  User,
  Phone,
  MapPin,
  Zap, Clock, Heart, Sparkles, Battery, Droplets, Sun, Moon, Leaf, Flame, Smile, Frown, AlertTriangle,
  Wallet, Award, Target, Feather, Wind, Thermometer, Dumbbell, Home, Baby, PawPrint, Smartphone, Wrench,
  Gem, Eye, Timer,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { LandingPageConfig, LandingDesign } from '@/lib/types';
import { logiStore } from '@/lib/store';

const inter = Inter({ subsets: ['latin'], display: 'swap' });
const anton = Anton({ weight: '400', subsets: ['latin'], display: 'swap', preload: false });
const playfair = Playfair_Display({ weight: ['700', '900'], subsets: ['latin'], display: 'swap', preload: false });
const poppins = Poppins({ weight: ['700', '800'], subsets: ['latin'], display: 'swap', preload: false });
const grotesk = Space_Grotesk({ weight: ['700'], subsets: ['latin'], display: 'swap', preload: false });
const fraunces = Fraunces({ weight: ['700', '900'], subsets: ['latin'], display: 'swap', preload: false });

const DISPLAY_FONT: Record<LandingDesign['vibe'], { className: string; upper: boolean }> = {
  bold: { className: anton.className, upper: true },
  luxury: { className: playfair.className, upper: false },
  fresh: { className: poppins.className, upper: false },
  tech: { className: grotesk.className, upper: false },
  warm: { className: fraunces.className, upper: false },
};

const CO_DEPARTMENTS = [
  'Antioquia', 'Atlántico', 'Bogotá D.C.', 'Bolívar', 'Boyacá', 'Caldas', 'Caquetá', 'Casanare', 'Cauca',
  'Cesar', 'Chocó', 'Córdoba', 'Cundinamarca', 'Huila', 'La Guajira', 'Magdalena', 'Meta', 'Nariño',
  'Norte de Santander', 'Putumayo', 'Quindío', 'Risaralda', 'San Andrés', 'Santander', 'Sucre', 'Tolima',
  'Valle del Cauca', 'Arauca', 'Amazonas', 'Guainía', 'Guaviare', 'Vaupés', 'Vichada',
];

const DEFAULT_DESIGN: LandingDesign = {
  primary: '#FF252B',
  accent: '#FF5A16',
  dark: '#0F172A',
  light: '#F8FAFC',
  vibe: 'bold',
};

const ICONS: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  Zap, ShieldCheck, Clock, Heart, Sparkles, Battery, Droplets, Sun, Moon, Leaf, Flame, Smile, Frown,
  AlertTriangle, Wallet, Truck, Award, Target, Feather, Wind, Thermometer, Dumbbell, Home, Baby, PawPrint,
  Smartphone, Wrench, Gem, Eye, Timer,
};

function Icon({ name, className, style }: { name: string; className?: string; style?: React.CSSProperties }) {
  const Cmp = ICONS[name] || Sparkles;
  return <Cmp className={className} style={style} />;
}

interface Props {
  config: LandingPageConfig;
  previewMode?: boolean;
  onOrderSubmit?: (orderData: any) => void;
}

export default function SalesPageRenderer({ config, previewMode = false, onOrderSubmit }: Props) {
  const d = config.design || DEFAULT_DESIGN;
  const s = config.sales!;
  const font = DISPLAY_FONT[d.vibe] || DISPLAY_FONT.bold;
  const display = `${font.className} ${font.upper ? 'uppercase tracking-tight' : 'tracking-tight'}`;
  const isColombia = !config.country || config.country === 'Colombia';

  const combos = config.combos?.length
    ? config.combos
    : [
        {
          id: 'single',
          name: config.productName,
          units: 1,
          regularPrice: config.regularPrice,
          promoPrice: config.promoPrice,
          savingsText: '',
          isPopular: true,
        },
      ];
  const [comboId, setComboId] = useState(() => (combos.find((c) => c.isPopular) || combos[0]).id);
  const combo = combos.find((c) => c.id === comboId) || combos[0];

  const gallery = useMemo(
    () => [config.mainImage, ...(config.galleryImages || [])].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i),
    [config.mainImage, config.galleryImages]
  );
  const [activeImg, setActiveImg] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Checkout
  const [form, setForm] = useState({ name: '', phone: '', region: isColombia ? 'Antioquia' : '', city: '', address: '', notes: '' });
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<any | null>(null);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const money = (v: number) => `$${(v || 0).toLocaleString('es-CO')} ${config.currency || 'COP'}`;
  const discount = Math.max(0, Math.round(((config.regularPrice - config.promoPrice) / (config.regularPrice || 1)) * 100));
  const freeShipping = !/según|calcul/i.test(config.shippingCostText || '');

  const scrollToOrder = () => document.getElementById('order')?.scrollIntoView({ behavior: 'smooth' });

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

  const CTA = ({ big = false, light = false }: { big?: boolean; light?: boolean }) => (
    <button
      type="button"
      onClick={scrollToOrder}
      className={`group inline-flex items-center justify-center gap-2 rounded-2xl font-black transition hover:-translate-y-0.5 active:translate-y-0 ${
        big ? 'px-8 py-5 text-lg w-full sm:w-auto' : 'px-6 py-4 text-base'
      }`}
      style={{
        background: light ? '#fff' : `linear-gradient(135deg, ${d.primary}, ${d.accent})`,
        color: light ? d.primary : '#fff',
        boxShadow: `0 18px 40px -12px ${d.primary}99`,
      }}
    >
      {s.ctaText}
      <ArrowRight className="w-5 h-5 transition group-hover:translate-x-1" />
    </button>
  );

  const fieldCls =
    'w-full text-sm pl-10 pr-3 py-3.5 rounded-xl border border-slate-300 bg-white outline-none focus:ring-4 transition';
  const fieldStyle = { ['--tw-ring-color' as any]: `${d.primary}26` } as React.CSSProperties;

  return (
    <div className={`${inter.className} bg-white text-slate-900 antialiased pb-20 sm:pb-0`}>
      {/* Announcement */}
      <div className="text-white text-center text-xs sm:text-sm font-bold py-2.5 px-4" style={{ background: d.primary }}>
        {config.urgencyText || `${freeShipping ? 'Envío gratis' : 'Envíos'} · Pagas al recibir`}
      </div>

      {/* HERO */}
      <section className="relative overflow-hidden text-white" style={{ background: d.dark }}>
        {s.heroImage ? (
          <>
            <img src={s.heroImage} alt="" className="absolute inset-0 w-full h-full object-cover" />
            <div
              className="absolute inset-0 lg:hidden"
              style={{ background: `linear-gradient(180deg, ${d.dark}D9 0%, ${d.dark}F2 45%, ${d.dark} 100%)` }}
            />
            <div
              className="absolute inset-0 hidden lg:block"
              style={{ background: `linear-gradient(90deg, ${d.dark} 0%, ${d.dark}E6 38%, ${d.dark}80 65%, ${d.dark}33 100%)` }}
            />
          </>
        ) : (
          <div
            className="absolute inset-0"
            style={{ background: `radial-gradient(circle at 75% 30%, ${d.primary}55, transparent 55%), radial-gradient(circle at 10% 90%, ${d.accent}40, transparent 50%)` }}
          />
        )}
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-20 grid lg:grid-cols-[1.15fr_1fr] gap-10 items-center">
          <div>
            {s.eyebrow && (
              <span
                className="inline-block text-[11px] sm:text-xs font-black uppercase tracking-[0.15em] px-3 py-1.5 rounded-full mb-5"
                style={{ background: `${d.accent}33`, color: '#fff', border: `1px solid ${d.accent}88` }}
              >
                {s.eyebrow}
              </span>
            )}
            <h1 className={`${display} text-4xl sm:text-5xl lg:text-6xl leading-[1.02] mb-5`}>{config.headline}</h1>
            <p className="text-base sm:text-lg text-white/80 leading-relaxed mb-6 max-w-xl">{config.subheadline}</p>
            <ul className="space-y-2.5 mb-8">
              {s.heroBullets.map((b, i) => (
                <li key={i} className="flex items-start gap-3 text-sm sm:text-base font-semibold">
                  <span className="mt-0.5 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: d.primary }}>
                    <Check className="w-4 h-4" strokeWidth={3} />
                  </span>
                  {b}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-end gap-x-4 gap-y-2 mb-6">
              <span className="text-4xl sm:text-5xl font-black">{money(config.promoPrice)}</span>
              {config.regularPrice > config.promoPrice && (
                <span className="text-lg text-white/50 line-through mb-1">{money(config.regularPrice)}</span>
              )}
              {discount > 0 && (
                <span className="mb-1.5 text-xs font-black px-2.5 py-1 rounded-lg" style={{ background: d.accent }}>
                  -{discount}%
                </span>
              )}
            </div>
            <CTA big />
            <div className="flex flex-wrap gap-x-5 gap-y-2 mt-6 text-xs sm:text-sm text-white/75 font-semibold">
              <span className="flex items-center gap-1.5"><Banknote className="w-4 h-4" /> Pagas al recibir</span>
              <span className="flex items-center gap-1.5"><Truck className="w-4 h-4" /> {config.shippingCostText}</span>
              <span className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4" /> Garantía {config.guaranteeDays} días</span>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-6 rounded-[2.5rem] blur-3xl opacity-50" style={{ background: d.primary }} />
            <div className="relative bg-white rounded-[2rem] p-3 shadow-2xl">
              <div className="aspect-square rounded-[1.5rem] overflow-hidden bg-slate-50">
                <img src={gallery[activeImg]} alt={config.productName} className="w-full h-full object-cover" />
              </div>
              {gallery.length > 1 && (
                <div className="flex gap-2 mt-3 overflow-x-auto">
                  {gallery.map((g, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveImg(i)}
                      className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 border-2 transition"
                      style={{ borderColor: i === activeImg ? d.primary : 'transparent' }}
                      aria-label={`Ver imagen ${i + 1}`}
                    >
                      <img src={g} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
            {config.discountBadge && (
              <div
                className="absolute -top-3 -right-2 sm:-right-4 rotate-6 text-white text-xs sm:text-sm font-black px-4 py-2 rounded-xl shadow-xl"
                style={{ background: d.accent }}
              >
                {config.discountBadge}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* STATS */}
      {s.stats.length > 0 && (
        <section className="text-white" style={{ background: `linear-gradient(135deg, ${d.primary}, ${d.accent})` }}>
          <div className="max-w-5xl mx-auto px-4 py-6 grid grid-cols-3 gap-4 text-center">
            {s.stats.map((st, i) => (
              <div key={i}>
                <div className={`${display} text-2xl sm:text-4xl`}>{st.value}</div>
                <div className="text-[11px] sm:text-sm font-semibold text-white/85 mt-1">{st.label}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* PAIN */}
      {s.painPoints.length > 0 && (
        <section className="py-16 sm:py-24" style={{ background: d.light }}>
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <h2 className={`${display} text-3xl sm:text-5xl text-center leading-tight max-w-3xl mx-auto mb-12`} style={{ color: d.dark }}>
              {s.painTitle}
            </h2>
            <div className="grid md:grid-cols-3 gap-5">
              {s.painPoints.map((p, i) => (
                <div key={i} className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/70">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4" style={{ background: '#FEE2E2' }}>
                    <Icon name={p.icon} className="w-6 h-6 text-red-500" />
                  </div>
                  <h3 className="font-black text-lg mb-2" style={{ color: d.dark }}>{p.title}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{p.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* SOLUTION */}
      <section className="py-16 sm:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 grid md:grid-cols-2 gap-10 items-center">
          <div className="relative">
            <div className="absolute -bottom-4 -left-4 w-2/3 h-2/3 rounded-3xl" style={{ background: `${d.primary}1F` }} />
            <img
              src={s.solutionImage || gallery[1] || config.mainImage}
              alt={config.productName}
              className="relative w-full aspect-[4/3] object-cover rounded-3xl shadow-xl"
            />
          </div>
          <div>
            <span className="text-xs font-black uppercase tracking-[0.15em]" style={{ color: d.primary }}>
              La solución
            </span>
            <h2 className={`${display} text-3xl sm:text-5xl leading-tight mt-2 mb-5`} style={{ color: d.dark }}>
              {s.solutionTitle}
            </h2>
            <p className="text-base sm:text-lg text-slate-600 leading-relaxed mb-8 whitespace-pre-line">{s.solutionText}</p>
            <CTA />
          </div>
        </div>
      </section>

      {/* BENEFIT BLOCKS (zig-zag) */}
      {s.benefitBlocks.map((b, i) => {
        const img = b.image || gallery[(i + 2) % gallery.length] || config.mainImage;
        const reverse = i % 2 === 1;
        return (
          <section key={i} className="py-12 sm:py-20" style={{ background: i % 2 === 0 ? d.light : '#fff' }}>
            <div className="max-w-6xl mx-auto px-4 sm:px-6 grid md:grid-cols-2 gap-10 items-center">
              <img
                src={img}
                alt={b.title}
                className={`w-full aspect-square object-cover rounded-3xl shadow-lg ${reverse ? 'md:order-2' : ''}`}
              />
              <div>
                <span
                  className={`${display} inline-flex w-12 h-12 rounded-2xl items-center justify-center text-white text-xl mb-4`}
                  style={{ background: d.primary }}
                >
                  {i + 1}
                </span>
                <h3 className={`${display} text-2xl sm:text-4xl leading-tight mb-4`} style={{ color: d.dark }}>
                  {b.title}
                </h3>
                <p className="text-base text-slate-600 leading-relaxed mb-5">{b.text}</p>
                <ul className="space-y-2.5">
                  {b.bullets.map((bl, j) => (
                    <li key={j} className="flex items-start gap-3 text-sm sm:text-base font-semibold text-slate-800">
                      <Check className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: d.primary }} strokeWidth={3} />
                      {bl}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        );
      })}

      {/* QUICK BENEFITS GRID */}
      {config.benefits.length > 0 && (
        <section className="py-16 bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
            {config.benefits.map((b) => (
              <div key={b.id} className="rounded-3xl p-5 sm:p-6 border border-slate-200 text-center">
                <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center mb-3" style={{ background: `${d.primary}14` }}>
                  <Icon name={b.icon} className="w-7 h-7" style={{ color: d.primary }} />
                </div>
                <h4 className="font-black text-sm sm:text-base mb-1" style={{ color: d.dark }}>{b.title}</h4>
                <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">{b.description}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* HOW IT WORKS */}
      {s.howItWorks.length > 0 && (
        <section className="py-16 sm:py-24 text-white" style={{ background: d.dark }}>
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <h2 className={`${display} text-3xl sm:text-5xl text-center mb-12`}>{s.howItWorksTitle}</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {s.howItWorks.map((st, i) => (
                <div key={i} className="relative rounded-3xl p-6 bg-white/5 border border-white/10">
                  <div className={`${display} text-5xl mb-3`} style={{ color: d.accent }}>
                    0{i + 1}
                  </div>
                  <h3 className="font-black text-lg mb-2">{st.title}</h3>
                  <p className="text-sm text-white/70 leading-relaxed">{st.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* COMPARISON */}
      {s.comparison.length > 0 && (
        <section className="py-16 sm:py-24 bg-white">
          <div className="max-w-3xl mx-auto px-4 sm:px-6">
            <h2 className={`${display} text-3xl sm:text-5xl text-center leading-tight mb-10`} style={{ color: d.dark }}>
              {s.comparisonTitle}
            </h2>
            <div className="rounded-3xl overflow-hidden border border-slate-200 shadow-sm">
              <div className="grid grid-cols-[1.2fr_1fr_1fr] text-xs sm:text-sm font-black">
                <div className="p-4 bg-slate-50" />
                <div className="p-4 text-center text-white" style={{ background: d.primary }}>{config.productName}</div>
                <div className="p-4 text-center bg-slate-100 text-slate-500">Otras opciones</div>
              </div>
              {s.comparison.map((r, i) => (
                <div key={i} className="grid grid-cols-[1.2fr_1fr_1fr] text-xs sm:text-sm border-t border-slate-200">
                  <div className="p-4 font-bold text-slate-800">{r.feature}</div>
                  <div className="p-4 text-center font-semibold flex flex-col items-center gap-1" style={{ background: `${d.primary}0D`, color: d.dark }}>
                    <Check className="w-5 h-5" style={{ color: d.primary }} strokeWidth={3} />
                    <span>{r.us}</span>
                  </div>
                  <div className="p-4 text-center text-slate-500 flex flex-col items-center gap-1">
                    <XIcon className="w-5 h-5 text-slate-400" strokeWidth={3} />
                    <span>{r.others}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* OFFER + CHECKOUT */}
      <section id="order" className="py-16 sm:py-24 scroll-mt-4" style={{ background: d.light }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <span className="text-xs font-black uppercase tracking-[0.15em]" style={{ color: d.primary }}>
              Pide hoy · Pagas al recibir
            </span>
            <h2 className={`${display} text-3xl sm:text-5xl mt-2`} style={{ color: d.dark }}>
              Elige tu oferta
            </h2>
          </div>

          <div className="grid lg:grid-cols-2 gap-6 items-start">
            {/* Combos */}
            <div className="space-y-3">
              {combos.map((c) => {
                const active = c.id === comboId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setComboId(c.id)}
                    className="relative w-full text-left bg-white rounded-2xl p-4 sm:p-5 border-2 transition flex items-center gap-4"
                    style={{ borderColor: active ? d.primary : '#E2E8F0', boxShadow: active ? `0 12px 30px -12px ${d.primary}66` : undefined }}
                  >
                    {c.badge && (
                      <span
                        className="absolute -top-2.5 right-4 text-[10px] font-black uppercase px-2.5 py-1 rounded-full text-white"
                        style={{ background: c.isPopular ? d.primary : d.dark }}
                      >
                        {c.badge}
                      </span>
                    )}
                    <span
                      className="w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                      style={{ borderColor: active ? d.primary : '#CBD5E1', background: active ? d.primary : '#fff' }}
                    >
                      {active && <Check className="w-3.5 h-3.5 text-white" strokeWidth={4} />}
                    </span>
                    <img src={config.mainImage} alt="" className="w-14 h-14 rounded-xl object-cover bg-slate-50" />
                    <div className="flex-1 min-w-0">
                      <div className="font-black text-sm sm:text-base" style={{ color: d.dark }}>
                        {c.units} {c.units === 1 ? 'unidad' : 'unidades'}
                      </div>
                      {c.savingsText && <div className="text-xs font-bold text-emerald-600">{c.savingsText}</div>}
                    </div>
                    <div className="text-right">
                      <div className="font-black text-base sm:text-lg" style={{ color: d.dark }}>{money(c.promoPrice)}</div>
                      {c.regularPrice > c.promoPrice && (
                        <div className="text-xs text-slate-400 line-through">{money(c.regularPrice)}</div>
                      )}
                    </div>
                  </button>
                );
              })}

              <div className="rounded-2xl p-5 bg-white border border-slate-200 flex gap-4 items-center">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: `${d.primary}14` }}>
                  <ShieldCheck className="w-7 h-7" style={{ color: d.primary }} />
                </div>
                <div>
                  <div className="font-black text-sm" style={{ color: d.dark }}>Garantía de {config.guaranteeDays} días</div>
                  <p className="text-xs text-slate-500 leading-relaxed">{config.guaranteeText}</p>
                </div>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={submit} className="bg-white rounded-3xl shadow-xl border border-slate-200 p-5 sm:p-7 space-y-3">
              <div className="flex items-center gap-2 text-sm font-black mb-1" style={{ color: d.dark }}>
                <Truck className="w-5 h-5" style={{ color: d.primary }} />
                Datos de entrega
              </div>
              {formError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {formError}
                </div>
              )}
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input className={fieldCls} style={fieldStyle} placeholder="Nombre y apellido" value={form.name} onChange={set('name')} autoComplete="name" />
              </div>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input className={fieldCls} style={fieldStyle} placeholder="Celular / WhatsApp" type="tel" value={form.phone} onChange={set('phone')} autoComplete="tel" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                {isColombia ? (
                  <select className={`${fieldCls} pl-3`} style={fieldStyle} value={form.region} onChange={set('region')}>
                    {CO_DEPARTMENTS.map((dep) => (
                      <option key={dep}>{dep}</option>
                    ))}
                  </select>
                ) : (
                  <input className={`${fieldCls} pl-3`} style={fieldStyle} placeholder="Estado / Provincia" value={form.region} onChange={set('region')} />
                )}
                <input className={`${fieldCls} pl-3`} style={fieldStyle} placeholder="Ciudad" value={form.city} onChange={set('city')} autoComplete="address-level2" />
              </div>
              <div className="relative">
                <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input className={fieldCls} style={fieldStyle} placeholder="Dirección completa" value={form.address} onChange={set('address')} autoComplete="street-address" />
              </div>
              <input className={`${fieldCls} pl-3`} style={fieldStyle} placeholder="Barrio / indicaciones (opcional)" value={form.notes} onChange={set('notes')} />

              <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                <div className="text-xs text-slate-500">
                  Total a pagar al recibir
                  <div className="text-emerald-600 font-bold">{config.shippingCostText}</div>
                </div>
                <div className="text-2xl font-black" style={{ color: d.dark }}>{money(combo.promoPrice)}</div>
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-4 rounded-2xl text-white font-black text-base flex items-center justify-center gap-2 disabled:opacity-60 transition hover:brightness-105"
                style={{ background: `linear-gradient(135deg, ${d.primary}, ${d.accent})`, boxShadow: `0 18px 40px -14px ${d.primary}` }}
              >
                {submitting ? 'Enviando…' : (
                  <>
                    <Banknote className="w-5 h-5" /> Pedir y pagar al recibir
                  </>
                )}
              </button>
              <p className="text-[11px] text-center text-slate-500">No pagas nada ahora. Te contactaremos para confirmar el envío.</p>
            </form>
          </div>
        </div>
      </section>

      {/* REVIEWS (only real ones added by the seller) */}
      {config.reviews.length > 0 && (
        <section className="py-16 bg-white">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <h2 className={`${display} text-3xl sm:text-4xl text-center mb-10`} style={{ color: d.dark }}>
              Lo que dicen nuestros clientes
            </h2>
            <div className="grid md:grid-cols-3 gap-4">
              {config.reviews.map((r) => (
                <div key={r.id} className="rounded-3xl p-5 border border-slate-200" style={{ background: d.light }}>
                  <div className="flex gap-0.5 mb-2 text-amber-400">
                    {Array.from({ length: r.rating }).map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-current" />
                    ))}
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed mb-3">“{r.comment}”</p>
                  <div className="text-xs font-bold text-slate-900">
                    {r.author} <span className="font-normal text-slate-500">· {r.location}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FAQ */}
      {config.faqs.length > 0 && (
        <section className="py-16 sm:py-20" style={{ background: config.reviews.length ? d.light : '#fff' }}>
          <div className="max-w-3xl mx-auto px-4 sm:px-6">
            <h2 className={`${display} text-3xl sm:text-4xl text-center mb-10`} style={{ color: d.dark }}>
              Preguntas frecuentes
            </h2>
            <div className="space-y-3">
              {config.faqs.map((f, i) => (
                <div key={f.id} className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between gap-4 p-5 text-left font-bold text-sm sm:text-base"
                    style={{ color: d.dark }}
                  >
                    {f.question}
                    <ChevronDown className={`w-5 h-5 flex-shrink-0 transition ${openFaq === i ? 'rotate-180' : ''}`} />
                  </button>
                  {openFaq === i && <div className="px-5 pb-5 text-sm text-slate-600 leading-relaxed">{f.answer}</div>}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FINAL CTA */}
      <section className="relative overflow-hidden text-white text-center" style={{ background: d.dark }}>
        {s.heroImage && <img src={s.heroImage} alt="" className="absolute inset-0 w-full h-full object-cover opacity-25" />}
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
          <h2 className={`${display} text-3xl sm:text-5xl leading-tight mb-4`}>{s.finalCtaTitle}</h2>
          <p className="text-base sm:text-lg text-white/75 mb-8">{s.finalCtaText}</p>
          <CTA big />
        </div>
      </section>

      <footer className="py-8 text-center text-xs text-slate-500 bg-white">
        {config.productName} · Pago contraentrega · {config.country || 'Colombia'}
      </footer>

      {/* WhatsApp */}
      {whatsappHref && (
        <a
          href={whatsappHref}
          target="_blank"
          rel="noreferrer"
          className="fixed right-4 bottom-24 sm:bottom-6 z-40 w-14 h-14 rounded-full bg-[#25D366] text-white flex items-center justify-center shadow-xl hover:scale-105 transition"
          aria-label="Escribir por WhatsApp"
        >
          <MessageCircle className="w-7 h-7" />
        </a>
      )}

      {/* Sticky mobile bar */}
      {config.enableStickyBar !== false && (
        <div className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-slate-200 p-3 flex items-center gap-3">
          <div>
            <div className="text-[10px] text-slate-500">Pagas al recibir</div>
            <div className="text-lg font-black" style={{ color: d.dark }}>{money(combo.promoPrice)}</div>
          </div>
          <button
            onClick={scrollToOrder}
            className="flex-1 py-3.5 rounded-xl text-white font-black text-sm"
            style={{ background: `linear-gradient(135deg, ${d.primary}, ${d.accent})` }}
          >
            {s.ctaText}
          </button>
        </div>
      )}

      {/* Success */}
      {done && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-7 text-center shadow-2xl">
            <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center text-white" style={{ background: d.primary }}>
              <Check className="w-8 h-8" strokeWidth={3} />
            </div>
            <h3 className="text-xl font-black text-slate-900">¡Pedido recibido!</h3>
            {done.orderNumber && <p className="text-xs text-slate-500 mt-1">Orden {done.orderNumber}</p>}
            <p className="text-sm text-slate-600 mt-3">
              {done.customerName}, te contactaremos al {done.phone} para confirmar la entrega. Pagarás {money(done.totalAmount)} al recibir.
            </p>
            <button onClick={() => setDone(null)} className="mt-6 w-full py-3 rounded-xl font-bold text-white" style={{ background: d.dark }}>
              Listo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
