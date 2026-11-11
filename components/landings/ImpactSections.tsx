'use client';

// "Impacto Premium": dark, high-contrast direct-response sales page. Every section pushes to the order form
// (the drawer of SalesPageRenderer): offer bar with timer, hero with a model and the product, trust seals,
// benefits, ingredients, real reviews, packages with "más vendido", FAQ and a final call to action.
// Prices always come from the seller's combos; reviews only from the seller.
import React, { useState } from 'react';
import { Barlow_Condensed } from 'next/font/google';
import {
  Award,
  Baby,
  Battery,
  Check,
  ChevronsRight,
  Clock,
  Droplets,
  Dumbbell,
  Eye,
  Feather,
  Flame,
  Frown,
  Gem,
  Heart,
  Home,
  Leaf,
  Lock,
  Minus,
  Moon,
  Package,
  PawPrint,
  Plus,
  ShieldCheck,
  ShoppingCart,
  Smartphone,
  Smile,
  Sparkles,
  Star,
  Sun,
  Target,
  Thermometer,
  Timer,
  Truck,
  Wallet,
  Wind,
  Wrench,
  Zap,
  AlertTriangle,
  type LucideIcon,
} from 'lucide-react';
import type { LandingDesign, LandingPageConfig, ProductCombo } from '@/lib/types';
import { splitTime, useOfferCountdown } from '@/lib/offer-countdown';

const display = Barlow_Condensed({ weight: ['600', '700', '800'], style: ['normal', 'italic'], subsets: ['latin'], display: 'swap' });

const ICONS: Record<string, LucideIcon> = {
  Zap, ShieldCheck, Clock, Heart, Sparkles, Battery, Droplets, Sun, Moon, Leaf, Flame, Smile, Frown, AlertTriangle,
  Wallet, Truck, Award, Target, Feather, Wind, Thermometer, Dumbbell, Home, Baby, PawPrint, Smartphone, Wrench, Gem,
  Eye, Timer, Package, Lock,
};
const Ico = ({ name, className, style }: { name?: string; className?: string; style?: React.CSSProperties }) => {
  const C = (name && ICONS[name]) || Sparkles;
  return <C className={className} style={style} strokeWidth={2} />;
};

// **word** → that word in the brand color. " | " → line break (titles).
function Hl({ text, color, lines = false }: { text?: string; color: string; lines?: boolean }) {
  if (!text) return null;
  const rows = lines ? text.split(/\s*\|\s*/) : [text];
  return (
    <>
      {rows.map((row, r) => (
        <React.Fragment key={r}>
          {r > 0 && <br />}
          {row.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
            p.startsWith('**') && p.endsWith('**') ? (
              <span key={i} style={{ color }}>
                {p.slice(2, -2)}
              </span>
            ) : (
              <React.Fragment key={i}>{p}</React.Fragment>
            ),
          )}
        </React.Fragment>
      ))}
    </>
  );
}
const plain = (t?: string) => (t || '').replace(/\*\*/g, '').replace(/\s*\|\s*/g, ' ');

interface Props {
  config: LandingPageConfig;
  d: LandingDesign;
  brand: string;
  combos: ProductCombo[];
  combo: ProductCombo;
  money: (v: number) => string;
  onOrder: (comboId?: string) => void;
}

export default function ImpactSections({ config, d, brand, combos, combo, money, onOrder }: Props) {
  const im = config.impact!;
  // The page is always dark with a bright brand color, whatever colors come in (AI or the editor).
  const primary = lum(d.primary) > 0.08 ? d.primary : '#E11D2A';
  const bg = d.dark && lum(d.dark) < 0.06 ? d.dark : '#0B0B0F';
  const card = d.light && lum(d.light) < 0.1 ? d.light : '#16161C';
  const left = useOfferCountdown(config);
  const t = left !== null && config.countdown?.enabled ? splitTime(left) : null;
  const [faq, setFaq] = useState<number | null>(null);
  const reviews = (config.reviews || []).filter((r) => r.comment);
  const entry = combos[0];
  const off = entry && entry.regularPrice > entry.promoPrice ? Math.round((1 - entry.promoPrice / entry.regularPrice) * 100) : 0;
  const [brandA, ...brandB] = brand.trim().split(/\s+/);
  const heading = `${display.className} uppercase italic font-extrabold tracking-tight leading-[0.95]`;
  const glow = `0 0 0 1px ${primary}55, 0 10px 40px -12px ${primary}AA`;

  const Cta = ({ label = 'Ordenar ahora', big = false, comboId, className = '' }: { label?: string; big?: boolean; comboId?: string; className?: string }) => (
    <button
      type="button"
      onClick={() => onOrder(comboId)}
      className={`${display.className} group relative inline-flex items-center justify-center gap-2.5 rounded-xl font-extrabold uppercase italic tracking-wide text-white transition hover:-translate-y-0.5 active:translate-y-0 ${big ? 'h-16 px-8 text-[22px] sm:text-[24px]' : 'h-12 px-6 text-[18px]'} ${className}`}
      style={{ background: `linear-gradient(180deg, ${primary}, ${shade(primary, -22)})`, boxShadow: `0 6px 0 ${shade(primary, -45)}, 0 18px 40px -14px ${primary}` }}
    >
      <ShoppingCart className={big ? 'w-6 h-6' : 'w-5 h-5'} />
      {label}
      {big && <ChevronsRight className="w-6 h-6 transition group-hover:translate-x-1" />}
    </button>
  );

  const Title = ({ text, sub, id }: { text: string; sub?: string; id?: string }) => (
    <div id={id} className="text-center mb-8 sm:mb-10 scroll-mt-20">
      <div className="flex items-center justify-center gap-3 sm:gap-5">
        <span className="hidden sm:block h-[3px] w-16 lg:w-28 rounded-full" style={{ background: `linear-gradient(90deg, transparent, ${primary})` }} />
        <h2 className={`${heading} text-[30px] sm:text-[42px] text-white`}>
          <Hl text={text} color={primary} />
        </h2>
        <span className="hidden sm:block h-[3px] w-16 lg:w-28 rounded-full" style={{ background: `linear-gradient(90deg, ${primary}, transparent)` }} />
      </div>
      {sub && <p className="mt-2 text-[15px] text-white/70 max-w-xl mx-auto">{plain(sub)}</p>}
    </div>
  );

  const Tile = ({ v }: { v: string }) => <span className="inline-flex min-w-[34px] justify-center rounded-md bg-black/80 px-1.5 py-0.5 text-[17px] font-bold tabular-nums text-white">{v}</span>;

  const packBullets = (c: ProductCombo) => im.packBullets?.find((p) => p.units === c.units)?.bullets || [];
  const packImage = (c: ProductCombo) => im.packImages?.[String(c.units)] || c.image || config.mainImage;
  const popular = combos.find((c) => c.isPopular) || combos[Math.min(1, combos.length - 1)];

  return (
    <div className="text-white antialiased" style={{ background: bg }}>
      {/* ============ OFFER BAR ============ */}
      <div className="px-3 py-2 text-center" style={{ background: `linear-gradient(90deg, ${shade(primary, -30)}, ${primary}, ${shade(primary, -30)})` }}>
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5">
          <p className={`${display.className} italic font-bold uppercase tracking-wide text-[15px] sm:text-[18px] leading-tight`}>{plain(im.topBar)}</p>
          {t && (
            <span className="inline-flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide">
              {config.countdown?.text?.trim() || 'Termina en'}: <Tile v={t.h} /> : <Tile v={t.m} /> : <Tile v={t.s} />
            </span>
          )}
        </div>
      </div>

      {/* ============ NAV ============ */}
      <header className="sticky top-0 z-30 border-b border-white/10 backdrop-blur" style={{ background: `${bg}E6` }}>
        <div className="max-w-6xl mx-auto px-4 h-14 sm:h-16 flex items-center justify-between gap-4">
          <span className={`${heading} text-[24px] sm:text-[28px] truncate`}>
            {brandA} {brandB.length > 0 && <span style={{ color: primary }}>{brandB.join(' ')}</span>}
          </span>
          <nav className="hidden md:flex items-center gap-7 text-[13px] font-semibold text-white/80">
            <a href="#beneficios" className="hover:text-white">Beneficios</a>
            {im.ingredients?.length > 0 && <a href="#ingredientes" className="hover:text-white">Ingredientes</a>}
            {reviews.length > 0 && <a href="#opiniones" className="hover:text-white">Opiniones</a>}
            <a href="#paquetes" className="hover:text-white">Ofertas</a>
            {config.faqs?.length > 0 && <a href="#preguntas" className="hover:text-white">Preguntas</a>}
          </nav>
          <Cta className="!h-10 !px-4 !text-[15px]" />
        </div>
      </header>

      {/* ============ HERO ============ */}
      <section className="relative overflow-hidden">
        {im.heroImage && (
          <>
            <img src={im.heroImage} alt={plain(im.heroTitle)} className="absolute inset-0 h-full w-full object-cover object-center opacity-90 hidden lg:block" loading="eager" fetchPriority="high" />
            <div className="absolute inset-0 hidden lg:block" style={{ background: `linear-gradient(90deg, ${bg} 0%, ${bg}F2 38%, ${bg}80 60%, transparent 100%)` }} />
          </>
        )}
        <div className="absolute -top-40 -left-40 w-[520px] h-[520px] rounded-full blur-3xl opacity-30 pointer-events-none" style={{ background: primary }} />
        {im.heroImage && (
          <div className="lg:hidden relative">
            <img src={im.heroImage} alt={plain(im.heroTitle)} className="w-full aspect-[16/10] object-cover" loading="eager" fetchPriority="high" />
            <div className="absolute inset-x-0 bottom-0 h-24" style={{ background: `linear-gradient(transparent, ${bg})` }} />
          </div>
        )}
        <div className="relative max-w-6xl mx-auto px-4 pt-4 lg:pt-14 pb-10 lg:pb-16">
          <div className="max-w-[560px]">
            <p className="inline-flex items-center gap-2 text-[12px] sm:text-[13px] font-bold uppercase tracking-[0.14em] text-white/85">
              <span className="w-3 h-3 -skew-x-12" style={{ background: primary }} /> {plain(im.heroKicker)}
            </p>
            <h1 className={`${heading} mt-3 text-[46px] sm:text-[64px] lg:text-[72px]`}>
              <Hl text={im.heroTitle} color={primary} lines />
            </h1>
            <p className="mt-4 text-[16px] sm:text-[17px] text-white/80 leading-relaxed">{plain(im.heroText)}</p>
            <ul className="mt-5 space-y-2.5">
              {im.heroBullets.map((b, i) => (
                <li key={i} className="flex items-center gap-3 text-[15px] sm:text-[16px] font-medium">
                  <span className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ background: primary }}>
                    <Check className="w-4 h-4" strokeWidth={3} />
                  </span>
                  {plain(b)}
                </li>
              ))}
            </ul>
            <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-4">
              <div className="flex items-center gap-3">
                <div>
                  {entry && entry.regularPrice > entry.promoPrice && <p className="text-[15px] text-white/50 line-through font-semibold">{money(entry.regularPrice)}</p>}
                  <p className={`${display.className} font-extrabold text-[36px] sm:text-[44px] leading-none rounded-lg px-3 py-1`} style={{ background: primary }}>
                    {money(entry?.promoPrice || config.promoPrice)}
                  </p>
                </div>
                {off > 0 && (
                  <span className={`${display.className} -rotate-6 rounded-lg px-3 py-1 text-center font-extrabold italic leading-none`} style={{ background: '#fff', color: shade(primary, -35) }}>
                    <span className="block text-[30px]">{off}%</span>
                    <span className="block text-[11px] tracking-wide">DE DESCUENTO</span>
                  </span>
                )}
              </div>
              <div className="w-full sm:w-auto">
                <Cta big className="w-full sm:w-auto" />
                <p className="mt-2 flex items-center justify-center gap-1.5 text-[12px] text-white/70">
                  <Lock className="w-3.5 h-3.5" /> Pagas al recibir · Compra 100% segura
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ TRUST ============ */}
      <section className="border-y border-white/10" style={{ background: card }}>
        <div className="max-w-6xl mx-auto px-4 py-5 grid grid-cols-2 lg:grid-cols-4 gap-y-5">
          {im.trust.map((x, i) => (
            <div key={i} className={`flex items-center gap-3 px-2 lg:px-6 ${i > 0 ? 'lg:border-l lg:border-white/15' : ''}`}>
              <Ico name={x.icon} className="w-9 h-9 shrink-0" style={{ color: primary }} />
              <div className="min-w-0">
                <p className="text-[13px] sm:text-[14px] font-extrabold uppercase leading-tight">{plain(x.title)}</p>
                <p className="text-[12px] text-white/65 leading-tight">{plain(x.text)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ============ BENEFITS ============ */}
      <section className="relative max-w-6xl mx-auto px-4 py-14 sm:py-16">
        <Title id="beneficios" text={im.benefitsTitle} />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
          {im.benefits.map((b, i) => (
            <div key={i} className="rounded-2xl p-4 sm:p-6 text-center border transition hover:-translate-y-1" style={{ background: card, borderColor: `${primary}40`, boxShadow: glow }}>
              <Ico name={b.icon} className="w-10 h-10 sm:w-12 sm:h-12 mx-auto" style={{ color: primary }} />
              <p className="mt-3 text-[14px] sm:text-[16px] font-extrabold uppercase leading-tight">{plain(b.title)}</p>
              <p className="mt-1.5 text-[13px] sm:text-[14px] text-white/70 leading-snug">{plain(b.text)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ============ INGREDIENTS ============ */}
      {im.ingredients?.length > 0 && (
        <section className="relative py-14 sm:py-16" style={{ background: `radial-gradient(ellipse at center, ${primary}1F, transparent 70%)` }}>
          <div className="max-w-6xl mx-auto px-4">
            <Title id="ingredientes" text={im.ingredientsTitle} sub={im.ingredientsSubtitle} />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-8">
              {im.ingredients.map((x, i) => (
                <div key={i} className="text-center">
                  <div className="mx-auto w-28 h-28 sm:w-36 sm:h-36 rounded-full overflow-hidden p-[3px]" style={{ background: `linear-gradient(135deg, ${primary}, ${shade(primary, -40)})`, boxShadow: `0 0 36px -8px ${primary}` }}>
                    {x.image ? (
                      <img src={x.image} alt={x.name} className="w-full h-full rounded-full object-cover" loading="lazy" decoding="async" />
                    ) : (
                      <span className="w-full h-full rounded-full flex items-center justify-center" style={{ background: card }}>
                        <Leaf className="w-10 h-10" style={{ color: primary }} />
                      </span>
                    )}
                  </div>
                  <p className="mt-3 text-[15px] sm:text-[17px] font-extrabold uppercase">{plain(x.name)}</p>
                  <p className="mt-1 text-[13px] text-white/70 leading-snug max-w-[220px] mx-auto">{plain(x.text)}</p>
                </div>
              ))}
            </div>
            <div className="mt-10 text-center">
              <Cta big />
            </div>
          </div>
        </section>
      )}

      {/* ============ REAL REVIEWS (only the seller's) ============ */}
      {reviews.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 py-14 sm:py-16">
          <Title id="opiniones" text="Lo que dicen **nuestros clientes**" />
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {reviews.slice(0, 6).map((r) => (
              <div key={r.id} className="rounded-2xl p-5 border border-white/10" style={{ background: card }}>
                <div className="flex items-center gap-3">
                  <span className="w-11 h-11 rounded-full flex items-center justify-center text-[16px] font-bold shrink-0" style={{ background: `${primary}33`, color: primary }}>
                    {(r.author || 'C').trim().charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[14px] font-bold truncate">{r.author}</p>
                    {r.location && <p className="text-[12px] text-white/55 truncate">{r.location}</p>}
                  </div>
                </div>
                {r.rating > 0 && (
                  <span className="mt-3 inline-flex gap-0.5">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <Star key={i} className={`w-4 h-4 ${i < Math.round(r.rating) ? 'fill-amber-400 text-amber-400' : 'text-white/20'}`} />
                    ))}
                  </span>
                )}
                <p className="mt-3 text-[14px] text-white/85 italic leading-relaxed">“{r.comment}”</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ============ PACKAGES ============ */}
      <section className="relative py-14 sm:py-16 scroll-mt-16" id="paquetes" style={{ background: `linear-gradient(180deg, transparent, ${primary}12, transparent)` }}>
        <div className="max-w-6xl mx-auto px-4">
          <Title text={im.packagesTitle} sub={im.packagesSubtitle} />
          <div className={`grid gap-4 sm:gap-5 ${combos.length >= 3 ? 'lg:grid-cols-3' : combos.length === 2 ? 'sm:grid-cols-2 max-w-3xl mx-auto' : 'max-w-md mx-auto'}`}>
            {combos.map((c) => {
              const isPop = c.id === popular?.id && combos.length > 1;
              const selected = c.id === combo.id;
              return (
                <div
                  key={c.id}
                  className={`relative rounded-2xl p-5 sm:p-6 border-2 flex flex-col ${isPop ? 'lg:-translate-y-3' : ''}`}
                  style={{ background: card, borderColor: isPop ? primary : selected ? `${primary}80` : 'rgba(255,255,255,0.1)', boxShadow: isPop ? glow : undefined }}
                >
                  {(isPop || c.badge) && (
                    <span className={`${display.className} absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md px-3 py-1 text-[14px] font-extrabold uppercase italic tracking-wide inline-flex items-center gap-1`} style={{ background: primary }}>
                      <Star className="w-3.5 h-3.5 fill-white" /> {c.badge || 'Más vendido'}
                    </span>
                  )}
                  <p className={`${heading} text-center text-[26px] sm:text-[30px]`}>{c.name}</p>
                  <div className="mt-3 flex items-center gap-4">
                    <img src={packImage(c)} alt={c.name} className="w-28 h-28 sm:w-32 sm:h-32 object-cover rounded-xl shrink-0 drop-shadow-[0_10px_20px_rgba(0,0,0,0.6)]" loading="lazy" decoding="async" />
                    <ul className="space-y-1.5">
                      {packBullets(c).map((b, i) => (
                        <li key={i} className="flex items-start gap-2 text-[13px] text-white/85 leading-snug">
                          <Check className="w-4 h-4 shrink-0 mt-0.5" style={{ color: primary }} strokeWidth={3} />
                          {plain(b)}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="mt-4 text-center">
                    {c.regularPrice > c.promoPrice && <p className="text-[14px] text-white/45 line-through">{money(c.regularPrice)}</p>}
                    <p className={`${display.className} text-[34px] font-extrabold leading-none`}>{money(c.promoPrice)}</p>
                    {c.savingsText && <p className="mt-1 text-[12px] font-semibold" style={{ color: primary }}>{c.savingsText}</p>}
                  </div>
                  <Cta comboId={c.id} className="mt-4 w-full" />
                </div>
              );
            })}
          </div>
          <p className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[13px] text-white/70">
            <span className="inline-flex items-center gap-1.5"><Wallet className="w-4 h-4" style={{ color: primary }} /> Pagas en efectivo al recibir</span>
            <span className="inline-flex items-center gap-1.5"><Truck className="w-4 h-4" style={{ color: primary }} /> {config.shippingCostText || 'Envío a todo el país'}</span>
            {config.guaranteeDays > 0 && <span className="inline-flex items-center gap-1.5"><ShieldCheck className="w-4 h-4" style={{ color: primary }} /> Garantía de {config.guaranteeDays} días</span>}
          </p>
        </div>
      </section>

      {/* ============ FAQ ============ */}
      {config.faqs?.length > 0 && (
        <section className="max-w-3xl mx-auto px-4 py-14 sm:py-16">
          <Title id="preguntas" text={im.faqTitle} />
          <div className="space-y-2.5">
            {config.faqs.map((f, i) => (
              <div key={f.id} className="rounded-xl border border-white/10 overflow-hidden" style={{ background: card }}>
                <button onClick={() => setFaq(faq === i ? null : i)} aria-expanded={faq === i} className="w-full flex items-center justify-between gap-4 px-4 sm:px-5 py-4 text-left text-[15px] font-semibold">
                  {plain(f.question)}
                  {faq === i ? <Minus className="w-5 h-5 shrink-0" style={{ color: primary }} /> : <Plus className="w-5 h-5 shrink-0" style={{ color: primary }} />}
                </button>
                {faq === i && <p className="px-4 sm:px-5 pb-4 text-[14px] text-white/75 leading-relaxed">{plain(f.answer)}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ============ FINAL CTA ============ */}
      <section className="relative overflow-hidden" style={{ background: `linear-gradient(120deg, ${shade(primary, -55)}, ${shade(primary, -25)} 55%, ${shade(primary, -60)})` }}>
        <div className="max-w-6xl mx-auto px-4 py-12 sm:py-14 flex flex-col md:flex-row items-center gap-6 md:gap-10">
          <img src={packImage(popular || entry)} alt={config.productName} className="w-40 sm:w-52 aspect-square object-cover rounded-2xl drop-shadow-[0_20px_30px_rgba(0,0,0,0.6)]" loading="lazy" />
          <div className="flex-1 text-center md:text-left">
            <h2 className={`${heading} text-[34px] sm:text-[48px]`}>
              <Hl text={im.finalTitle} color="#fff" />
            </h2>
            <p className="mt-2 text-[15px] sm:text-[16px] text-white/85 max-w-xl">{plain(im.finalText)}</p>
            <Cta big className="mt-6 w-full sm:w-auto" />
          </div>
          {im.finalBadge && (
            <span className={`${display.className} hidden md:flex rotate-[-8deg] rounded-xl px-5 py-3 font-extrabold uppercase italic leading-none text-center text-[22px] items-center gap-2`} style={{ background: primary, boxShadow: '0 10px 30px -10px rgba(0,0,0,.6)' }}>
              <Timer className="w-7 h-7" /> {plain(im.finalBadge)}
            </span>
          )}
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="border-t border-white/10" style={{ background: bg }}>
        <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[12px] text-white/60">
          <span className={`${heading} text-[20px] text-white`}>
            {brandA} {brandB.length > 0 && <span style={{ color: primary }}>{brandB.join(' ')}</span>}
          </span>
          <span className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
            <span className="inline-flex items-center gap-1"><Lock className="w-3.5 h-3.5" /> Compra segura</span>
            <span className="inline-flex items-center gap-1"><Truck className="w-3.5 h-3.5" /> {config.shippingCostText || 'Envío a todo el país'}</span>
            <span className="inline-flex items-center gap-1"><Wallet className="w-3.5 h-3.5" /> Pago contraentrega</span>
          </span>
          <span>© {new Date().getFullYear()} {brand}</span>
        </div>
      </footer>
    </div>
  );
}

// Relative luminance 0 (black) … 1 (white).
function lum(hex?: string): number {
  const h = (hex || '').replace('#', '');
  if (h.length !== 6) return 0.5;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Lighter (+) or darker (−) version of a hex color, in percent.
function shade(hex: string, pct: number): string {
  const h = (hex || '#000000').replace('#', '');
  if (h.length !== 6) return hex;
  const f = (i: number) => {
    const v = parseInt(h.slice(i, i + 2), 16);
    const n = pct < 0 ? v * (1 + pct / 100) : v + (255 - v) * (pct / 100);
    return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(2)}${f(4)}`;
}
