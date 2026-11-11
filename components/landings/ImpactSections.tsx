'use client';

// "Impacto Premium" sales page and its styles (lib/landing-styles.ts): Impacto (dark, red), Explosivo (red and
// yellow), Lujo Noir (black and gold), Clínico (white and navy) and Neón (dark blue with neon). Same sections in
// every style, each pushing to the order form (the drawer of SalesPageRenderer): offer bar with timer, hero,
// trust seals, benefits, ingredients, real reviews, packages with "más vendido", FAQ and a final call to action.
// Prices always come from the seller's combos; reviews only from the seller.
import React, { useState } from 'react';
import { Barlow_Condensed, Cinzel, Exo_2, Manrope } from 'next/font/google';
import {
  Award,
  ArrowRight,
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
import type { ImpactStyle, LandingDesign, LandingPageConfig, ProductCombo } from '@/lib/types';
import { impactTheme, shade } from '@/lib/landing-styles';
import { splitTime, useOfferCountdown } from '@/lib/offer-countdown';

const barlow = Barlow_Condensed({ weight: ['600', '700', '800'], style: ['normal', 'italic'], subsets: ['latin'], display: 'swap' });
const cinzel = Cinzel({ weight: ['500', '600', '700'], subsets: ['latin'], display: 'swap', preload: false });
const manrope = Manrope({ weight: ['500', '600', '700', '800'], subsets: ['latin'], display: 'swap', preload: false });
const exo = Exo_2({ weight: ['600', '700', '800'], style: ['normal', 'italic'], subsets: ['latin'], display: 'swap', preload: false });

const ICONS: Record<string, LucideIcon> = {
  Zap, ShieldCheck, Clock, Heart, Sparkles, Battery, Droplets, Sun, Moon, Leaf, Flame, Smile, Frown, AlertTriangle,
  Wallet, Truck, Award, Target, Feather, Wind, Thermometer, Dumbbell, Home, Baby, PawPrint, Smartphone, Wrench, Gem,
  Eye, Timer, Package, Lock,
};
const Ico = ({ name, className, style }: { name?: string; className?: string; style?: React.CSSProperties }) => {
  const C = (name && ICONS[name]) || Sparkles;
  return <C className={className} style={style} strokeWidth={2} />;
};

// **word** → that word in the highlight color. " | " → line break (titles).
function Hl({ text, color, lines = false }: { text?: string; color?: string; lines?: boolean }) {
  if (!text) return null;
  const rows = lines ? text.split(/\s*\|\s*/) : [text];
  return (
    <>
      {rows.map((row, r) => (
        <React.Fragment key={r}>
          {r > 0 && <br />}
          {row.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
            p.startsWith('**') && p.endsWith('**') ? (
              <span key={i} style={color ? { color } : undefined}>
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

// Fonts and type treatment per style.
const HEAD: Record<ImpactStyle, string> = {
  impact: `${barlow.className} uppercase italic font-extrabold tracking-tight leading-[0.95]`,
  blast: `${barlow.className} uppercase italic font-extrabold tracking-tight leading-[0.92]`,
  noir: `${cinzel.className} uppercase font-semibold tracking-[0.03em] leading-[1.08]`,
  clinic: `${manrope.className} font-extrabold tracking-tight leading-[1.1]`,
  neon: `${exo.className} uppercase italic font-extrabold tracking-tight leading-[1]`,
};
const BTN: Record<ImpactStyle, string> = {
  impact: `${barlow.className} uppercase italic font-extrabold tracking-wide rounded-xl`,
  blast: `${barlow.className} uppercase italic font-extrabold tracking-wide rounded-xl`,
  noir: `${cinzel.className} uppercase font-bold tracking-[0.14em] rounded-[3px]`,
  clinic: `${manrope.className} font-bold rounded-full`,
  neon: `${exo.className} uppercase italic font-extrabold tracking-wide rounded-full`,
};

interface Props {
  config: LandingPageConfig;
  d: LandingDesign;
  brand: string;
  combos: ProductCombo[];
  combo: ProductCombo;
  money: (v: number) => string;
  onOrder: (comboId?: string) => void;
}

const GOLD_TEXT = (p: string): React.CSSProperties => ({
  background: `linear-gradient(180deg, ${shade(p, 55)} 0%, ${p} 55%, ${shade(p, -30)} 100%)`,
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  color: 'transparent',
});

export default function ImpactSections({ config, d, brand, combos, combo, money, onOrder }: Props) {
  const im = config.impact!;
  const st: ImpactStyle = im.style && HEAD[im.style] ? im.style : 'impact';
  const T = impactTheme(st, d);
  const P = T.primary;
  const head = HEAD[st];
  const condensed = st === 'impact' || st === 'blast';
  const left = useOfferCountdown(config);
  const t = left !== null && config.countdown?.enabled ? splitTime(left) : null;
  const [faq, setFaq] = useState<number | null>(null);
  const reviews = (config.reviews || []).filter((r) => r.comment);
  const entry = combos[0];
  const off = entry && entry.regularPrice > entry.promoPrice ? Math.round((1 - entry.promoPrice / entry.regularPrice) * 100) : 0;
  const [brandA, ...brandB] = brand.trim().split(/\s+/);
  const glow = `0 0 0 1px ${P}55, 0 10px 40px -12px ${P}AA`;
  const neonGlow = `0 0 0 1px ${P}66, 0 0 32px -8px ${P}, 0 0 60px -20px ${T.accent}`;
  const mutedC = { color: T.muted };
  // Color of **highlighted** words in titles.
  const hl = st === 'blast' ? '#FFD21A' : P;

  type Tone = 'main' | 'red' | 'dark' | 'light';
  const Cta = ({ label = 'Ordenar ahora', big = false, comboId, className = '', tone = 'main' }: { label?: string; big?: boolean; comboId?: string; className?: string; tone?: Tone }) => {
    let style: React.CSSProperties;
    if (tone === 'red') style = { background: 'linear-gradient(180deg,#F0242C,#B30E0E)', color: '#fff', boxShadow: '0 5px 0 #6E0707, 0 14px 30px -12px #E3141C' };
    else if (tone === 'dark') style = { background: '#120E08', color: P, boxShadow: '0 10px 24px -12px rgba(0,0,0,.7)' };
    else if (tone === 'light') style = { background: '#fff', color: P, boxShadow: '0 10px 24px -12px rgba(0,0,0,.35)' };
    else if (st === 'blast') style = { background: 'linear-gradient(180deg,#FFE65C,#FFC400)', color: '#A30D0D', boxShadow: '0 6px 0 #A37800, 0 18px 40px -12px rgba(255,210,26,.65)' };
    else if (st === 'noir') style = { background: `linear-gradient(135deg, ${shade(P, 40)}, ${P} 50%, ${shade(P, -28)})`, color: T.onPrimary, boxShadow: `0 12px 30px -14px ${P}` };
    else if (st === 'clinic') style = { background: P, color: T.onPrimary, boxShadow: `0 12px 26px -12px ${P}` };
    else if (st === 'neon') style = { background: `linear-gradient(90deg, ${P}, ${T.accent})`, color: '#fff', boxShadow: `0 0 26px -4px ${P}, 0 0 46px -12px ${T.accent}`, textShadow: '0 1px 2px rgba(0,0,0,.35)' };
    else style = { background: `linear-gradient(180deg, ${P}, ${shade(P, -22)})`, color: T.onPrimary, boxShadow: `0 6px 0 ${shade(P, -45)}, 0 18px 40px -14px ${P}` };
    const size = condensed ? (big ? 'h-16 px-8 text-[22px] sm:text-[24px]' : 'h-12 px-6 text-[18px]') : big ? 'h-14 px-8 text-[15px] sm:text-[16px]' : 'h-12 px-6 text-[14px]';
    return (
      <button
        type="button"
        onClick={() => onOrder(comboId)}
        className={`${BTN[st]} group relative inline-flex items-center justify-center gap-2.5 whitespace-nowrap transition hover:-translate-y-0.5 active:translate-y-0 ${size} ${className}`}
        style={style}
      >
        {condensed && <ShoppingCart className={big ? 'w-6 h-6' : 'w-5 h-5'} />}
        {label}
        {condensed ? big && <ChevronsRight className="w-6 h-6 transition group-hover:translate-x-1" /> : <ArrowRight className="w-[18px] h-[18px] transition group-hover:translate-x-1" />}
      </button>
    );
  };

  const Title = ({ text, sub, id }: { text: string; sub?: string; id?: string }) => {
    const subEl = sub && <p className="mt-3 text-[15px] max-w-xl mx-auto" style={mutedC}>{plain(sub)}</p>;
    if (st === 'blast')
      return (
        <div id={id} className="text-center mb-9 sm:mb-11 scroll-mt-20">
          <h2 className={`${head} inline-block -rotate-2 px-5 py-2 text-[30px] sm:text-[46px]`} style={{ background: '#FFD21A', color: '#7A0B0B', boxShadow: '6px 6px 0 #140707' }}>
            <Hl text={text} color="#E3141C" />
          </h2>
          {subEl}
        </div>
      );
    if (st === 'noir')
      return (
        <div id={id} className="text-center mb-9 sm:mb-12 scroll-mt-20">
          <div className="flex items-center justify-center gap-3 mb-4">
            <span className="h-px w-14" style={{ background: `linear-gradient(90deg, transparent, ${P})` }} />
            <span className="w-1.5 h-1.5 rotate-45" style={{ background: P }} />
            <span className="h-px w-14" style={{ background: `linear-gradient(90deg, ${P}, transparent)` }} />
          </div>
          <h2 className={`${head} text-[28px] sm:text-[40px]`} style={GOLD_TEXT(P)}>
            <Hl text={text} />
          </h2>
          {subEl && <div className={`${cinzel.className} italic`}>{subEl}</div>}
        </div>
      );
    if (st === 'clinic')
      return (
        <div id={id} className="text-center mb-9 sm:mb-11 scroll-mt-20">
          <h2 className={`${head} text-[28px] sm:text-[38px]`} style={{ color: T.text }}>
            <Hl text={text} color={P} />
          </h2>
          {subEl}
        </div>
      );
    if (st === 'neon')
      return (
        <div id={id} className="text-center mb-9 sm:mb-11 scroll-mt-20">
          <h2 className={`${head} text-[30px] sm:text-[42px]`}>
            <Hl text={text} color={P} />
          </h2>
          <span className="block mx-auto mt-3 h-1 w-20 rounded-full" style={{ background: `linear-gradient(90deg, ${P}, ${T.accent})`, boxShadow: `0 0 16px ${P}` }} />
          {subEl}
        </div>
      );
    return (
      <div id={id} className="text-center mb-8 sm:mb-10 scroll-mt-20">
        <div className="flex items-center justify-center gap-3 sm:gap-5">
          <span className="hidden sm:block h-[3px] w-16 lg:w-28 rounded-full" style={{ background: `linear-gradient(90deg, transparent, ${P})` }} />
          <h2 className={`${head} text-[30px] sm:text-[42px]`}>
            <Hl text={text} color={P} />
          </h2>
          <span className="hidden sm:block h-[3px] w-16 lg:w-28 rounded-full" style={{ background: `linear-gradient(90deg, ${P}, transparent)` }} />
        </div>
        {subEl}
      </div>
    );
  };

  const Tile = ({ v }: { v: string }) => {
    const s: React.CSSProperties =
      st === 'noir' ? { border: `1px solid ${P}`, color: P } : st === 'clinic' ? { background: 'rgba(255,255,255,.18)', color: '#fff' } : st === 'neon' ? { background: 'rgba(0,0,0,.45)', border: `1px solid ${T.line}`, color: '#fff' } : { background: 'rgba(0,0,0,.8)', color: '#fff' };
    return <span className="inline-flex min-w-[34px] justify-center rounded-md px-1.5 py-0.5 text-[17px] font-bold tabular-nums" style={s}>{v}</span>;
  };

  const packBullets = (c: ProductCombo) => im.packBullets?.find((p) => p.units === c.units)?.bullets || [];
  const packImage = (c: ProductCombo) => im.packImages?.[String(c.units)] || c.image || config.mainImage;
  const popular = combos.find((c) => c.isPopular) || combos[Math.min(1, combos.length - 1)];
  const split = st === 'clinic' || st === 'neon' || st === 'blast';
  const heroImg = im.heroImage || (split ? config.mainImage : undefined);

  // ---------- pieces that change per style ----------
  const bar: { style: React.CSSProperties; text: string } = {
    impact: { style: { background: `linear-gradient(90deg, ${shade(P, -30)}, ${P}, ${shade(P, -30)})`, color: T.onPrimary }, text: `${barlow.className} italic font-bold uppercase tracking-wide text-[15px] sm:text-[18px]` },
    blast: { style: { background: 'linear-gradient(90deg,#A80C0C,#E3141C,#A80C0C)', color: '#fff' }, text: `${barlow.className} italic font-extrabold uppercase tracking-wide text-[16px] sm:text-[20px]` },
    noir: { style: { background: '#000', color: P, borderBottom: `1px solid ${T.line}` }, text: `${cinzel.className} font-semibold uppercase tracking-[0.18em] text-[11px] sm:text-[12px]` },
    clinic: { style: { background: P, color: '#fff' }, text: `${manrope.className} font-semibold text-[12.5px] sm:text-[13.5px]` },
    neon: { style: { background: `linear-gradient(90deg, ${P}2E, ${T.accent}38)`, color: T.text, borderBottom: `1px solid ${T.line}` }, text: `${exo.className} italic font-bold uppercase tracking-wide text-[13px] sm:text-[15px]` },
  }[st];

  const Bullet = ({ text }: { text: string }) => {
    if (st === 'clinic')
      return (
        <li className="flex items-center gap-3 text-[15px] sm:text-[16px] font-medium" style={{ color: T.text }}>
          <span className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ background: `${P}1A`, color: P }}>
            <Check className="w-3.5 h-3.5" strokeWidth={3} />
          </span>
          {plain(text)}
        </li>
      );
    if (st === 'noir')
      return (
        <li className="flex items-center justify-center gap-2.5 text-[14px] sm:text-[15px] tracking-wide" style={{ color: T.text }}>
          <span className="w-1.5 h-1.5 rotate-45 shrink-0" style={{ background: P }} />
          {plain(text)}
        </li>
      );
    if (st === 'neon')
      return (
        <li className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[14px] font-semibold border backdrop-blur" style={{ background: `${T.surface}B3`, borderColor: T.line }}>
          <Zap className="w-4 h-4 shrink-0" style={{ color: P, filter: `drop-shadow(0 0 6px ${P})` }} />
          {plain(text)}
        </li>
      );
    if (st === 'blast')
      return (
        <li className={`${barlow.className} flex items-center gap-3 text-[19px] sm:text-[22px] font-bold uppercase italic leading-tight`}>
          <span className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ background: '#FFD21A', color: '#A30D0D' }}>
            <Check className="w-5 h-5" strokeWidth={3.5} />
          </span>
          {plain(text)}
        </li>
      );
    return (
      <li className="flex items-center gap-3 text-[15px] sm:text-[16px] font-medium">
        <span className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ background: P, color: T.onPrimary }}>
          <Check className="w-4 h-4" strokeWidth={3} />
        </span>
        {plain(text)}
      </li>
    );
  };

  // Price, discount seal, button and "pay on delivery".
  const HeroBuy = ({ center = false }: { center?: boolean }) => {
    const price = money(entry?.promoPrice || config.promoPrice);
    const priceFont = condensed ? `${barlow.className} font-extrabold text-[38px] sm:text-[46px]` : st === 'noir' ? `${cinzel.className} font-bold text-[30px] sm:text-[36px]` : st === 'clinic' ? `${manrope.className} font-extrabold text-[32px] sm:text-[38px]` : `${exo.className} font-extrabold italic text-[34px] sm:text-[40px]`;
    const priceStyle: React.CSSProperties =
      st === 'impact' ? { background: P, color: T.onPrimary } : st === 'blast' ? { color: '#FFD21A', textShadow: '3px 3px 0 #3D0505' } : st === 'noir' ? GOLD_TEXT(P) : st === 'neon' ? { color: P, textShadow: `0 0 18px ${P}88` } : { color: T.text };
    let seal: React.ReactNode = null;
    if (off > 0) {
      if (st === 'impact')
        seal = (
          <span className={`${barlow.className} -rotate-6 rounded-lg px-3 py-1 text-center font-extrabold italic leading-none`} style={{ background: '#fff', color: shade(P, -35) }}>
            <span className="block text-[30px]">{off}%</span>
            <span className="block text-[11px] tracking-wide">DE DESCUENTO</span>
          </span>
        );
      else if (st === 'blast')
        // The hero picture already carries the big starburst; next to the price only when there's no picture.
        seal = heroImg ? null : (
          <span
            className={`${barlow.className} w-[92px] h-[92px] flex flex-col items-center justify-center text-center font-extrabold italic uppercase leading-none rotate-[-10deg]`}
            style={{ background: '#FFD21A', color: '#C40D0D', clipPath: STAR }}
          >
            <span className="text-[11px]">Hasta</span>
            <span className="text-[30px]">{off}%</span>
            <span className="text-[10px]">Dcto. hoy</span>
          </span>
        );
      else
        seal = (
          <span
            className={`rounded-full px-3 py-1 text-[12px] font-bold uppercase tracking-wide ${st === 'noir' ? cinzel.className : ''}`}
            style={st === 'clinic' ? { background: `${P}14`, color: P } : st === 'noir' ? { border: `1px solid ${P}`, color: P } : { border: `1px solid ${P}`, color: P, boxShadow: `0 0 14px -4px ${P}` }}
          >
            Ahorra {off}%
          </span>
        );
    }
    return (
      <div className={`mt-7 flex flex-wrap items-center gap-x-5 gap-y-4 ${center ? 'justify-center' : ''}`}>
        <div className={`flex items-center gap-3 ${center ? 'justify-center' : ''}`}>
          <div className={center ? 'text-center' : ''}>
            {entry && entry.regularPrice > entry.promoPrice && <p className="text-[15px] line-through font-semibold" style={{ color: T.muted, opacity: 0.8 }}>{money(entry.regularPrice)}</p>}
            <p className={`${priceFont} leading-none ${st === 'impact' ? 'rounded-lg px-3 py-1' : ''}`} style={priceStyle}>
              {price}
            </p>
          </div>
          {seal}
        </div>
        <div className={`w-full sm:w-auto ${center ? 'flex flex-col items-center' : ''}`}>
          <Cta big className="w-full sm:w-auto" />
          <p className="mt-2 flex items-center justify-center gap-1.5 text-[12px]" style={mutedC}>
            <Lock className="w-3.5 h-3.5" /> Pagas al recibir · Compra 100% segura
          </p>
        </div>
      </div>
    );
  };

  const Kicker = () => {
    const k = plain(im.heroKicker);
    if (!k) return null;
    if (st === 'clinic') return <p className={`${manrope.className} text-[12px] sm:text-[13px] font-bold uppercase tracking-[0.18em]`} style={{ color: P }}>{k}</p>;
    if (st === 'neon') return <p className="inline-flex rounded-full border px-3 py-1 text-[11px] sm:text-[12px] font-bold uppercase tracking-[0.18em]" style={{ borderColor: P, color: P, boxShadow: `0 0 16px -6px ${P}` }}>{k}</p>;
    if (st === 'blast') return <p className={`${barlow.className} inline-block -skew-x-12 px-3 py-0.5 text-[15px] sm:text-[17px] font-extrabold uppercase italic`} style={{ background: '#140707', color: '#FFD21A' }}>{k}</p>;
    if (st === 'noir')
      return (
        <p className={`${cinzel.className} flex items-center justify-center gap-3 text-[12px] sm:text-[13px] font-semibold uppercase tracking-[0.3em]`} style={{ color: P }}>
          <span className="h-px w-10" style={{ background: P }} /> {k} <span className="h-px w-10" style={{ background: P }} />
        </p>
      );
    return (
      <p className="inline-flex items-center gap-2 text-[12px] sm:text-[13px] font-bold uppercase tracking-[0.14em]" style={{ color: 'rgba(255,255,255,.85)' }}>
        <span className="w-3 h-3 -skew-x-12" style={{ background: P }} /> {k}
      </p>
    );
  };

  // ---------- hero ----------
  let hero: React.ReactNode;
  if (st === 'noir') {
    // Wide picture (person left, product right), title in the middle.
    hero = (
      <section className="relative overflow-hidden">
        {heroImg && (
          <>
            <img src={heroImg} alt={plain(im.heroTitle)} className="absolute inset-0 h-full w-full object-cover hidden lg:block" loading="eager" fetchPriority="high" />
            <div className="absolute inset-0 hidden lg:block" style={{ background: `radial-gradient(ellipse 42% 75% at 50% 50%, ${T.bg}F5 0%, ${T.bg}C7 55%, transparent 100%), linear-gradient(180deg, transparent 70%, ${T.bg})` }} />
            <div className="lg:hidden relative">
              <img src={heroImg} alt={plain(im.heroTitle)} className="w-full aspect-[16/10] object-cover" loading="eager" fetchPriority="high" />
              <div className="absolute inset-x-0 bottom-0 h-24" style={{ background: `linear-gradient(transparent, ${T.bg})` }} />
            </div>
          </>
        )}
        <div className="relative max-w-[640px] mx-auto px-4 pt-6 lg:pt-24 pb-14 lg:pb-24 text-center">
          <Kicker />
          <h1 className={`${head} mt-5 text-[40px] sm:text-[56px] lg:text-[64px]`} style={GOLD_TEXT(P)}>
            <Hl text={im.heroTitle} lines />
          </h1>
          <p className={`${cinzel.className} italic mt-5 text-[16px] sm:text-[18px] leading-relaxed`} style={{ color: T.text }}>{plain(im.heroText)}</p>
          <ul className="mt-6 grid sm:grid-cols-2 gap-x-6 gap-y-2.5">
            {im.heroBullets.map((b, i) => <Bullet key={i} text={b} />)}
          </ul>
          <HeroBuy center />
        </div>
      </section>
    );
  } else if (split) {
    const bg =
      st === 'clinic'
        ? 'linear-gradient(180deg,#F4F7FB 0%,#FFFFFF 100%)'
        : st === 'blast'
          ? 'radial-gradient(circle at 28% 40%, #D3140F 0%, #8E0B0B 45%, #3D0505 100%)'
          : `radial-gradient(circle at 75% 30%, ${T.accent}3D, transparent 45%), radial-gradient(circle at 15% 85%, ${P}29, transparent 45%), ${T.bg}`;
    const frame: React.CSSProperties =
      st === 'clinic'
        ? { borderRadius: 28, boxShadow: '0 30px 60px -30px rgba(15,27,45,.45)' }
        : st === 'blast'
          ? { borderRadius: 18, border: '4px solid #FFD21A', boxShadow: '10px 10px 0 #140707' }
          : { borderRadius: 24, border: `1px solid ${P}88`, boxShadow: neonGlow };
    const titleSize = st === 'blast' ? 'text-[46px] sm:text-[66px] lg:text-[74px]' : st === 'neon' ? 'text-[40px] sm:text-[54px] lg:text-[58px]' : 'text-[36px] sm:text-[48px] lg:text-[54px]';
    hero = (
      <section className="relative overflow-hidden" style={{ background: bg }}>
        <div className="relative max-w-6xl mx-auto px-4 pt-6 lg:pt-14 pb-12 lg:pb-16 grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          {heroImg && (
            <div className={`relative ${st === 'blast' ? 'lg:order-first' : 'lg:order-last'}`}>
              {st === 'neon' && <div className="absolute -inset-6 rounded-full blur-3xl opacity-40 pointer-events-none" style={{ background: `radial-gradient(circle, ${P}, ${T.accent} 60%, transparent 70%)` }} />}
              <img src={heroImg} alt={plain(im.heroTitle)} className="relative w-full aspect-[4/3] object-cover" style={frame} loading="eager" fetchPriority="high" />
              {st === 'blast' && off > 0 && (
                <span
                  className={`${barlow.className} absolute -top-5 -right-3 sm:-right-6 w-[110px] h-[110px] sm:w-[130px] sm:h-[130px] flex flex-col items-center justify-center text-center font-extrabold italic uppercase leading-none rotate-[12deg]`}
                  style={{ background: '#FFD21A', color: '#C40D0D', clipPath: STAR }}
                >
                  <span className="text-[13px]">Hasta</span>
                  <span className="text-[36px] sm:text-[42px]">{off}%</span>
                  <span className="text-[11px]">de descuento</span>
                </span>
              )}
            </div>
          )}
          <div className={heroImg ? '' : 'lg:col-span-2 max-w-2xl'}>
            <Kicker />
            <h1 className={`${head} mt-4 ${titleSize}`} style={{ color: T.text, textShadow: st === 'blast' ? '4px 4px 0 #3D0505' : undefined }}>
              <Hl text={im.heroTitle} color={hl} lines />
            </h1>
            <p className="mt-4 text-[16px] sm:text-[17px] leading-relaxed" style={mutedC}>{plain(im.heroText)}</p>
            <ul className={`mt-5 ${st === 'neon' ? 'grid sm:grid-cols-2 gap-2.5' : 'space-y-2.5'}`}>
              {im.heroBullets.map((b, i) => <Bullet key={i} text={b} />)}
            </ul>
            <HeroBuy />
          </div>
        </div>
      </section>
    );
  } else {
    hero = (
      <section className="relative overflow-hidden">
        {heroImg && (
          <>
            <img src={heroImg} alt={plain(im.heroTitle)} className="absolute inset-0 h-full w-full object-cover object-center opacity-90 hidden lg:block" loading="eager" fetchPriority="high" />
            <div className="absolute inset-0 hidden lg:block" style={{ background: `linear-gradient(90deg, ${T.bg} 0%, ${T.bg}F2 38%, ${T.bg}80 60%, transparent 100%)` }} />
          </>
        )}
        <div className="absolute -top-40 -left-40 w-[520px] h-[520px] rounded-full blur-3xl opacity-30 pointer-events-none" style={{ background: P }} />
        {heroImg && (
          <div className="lg:hidden relative">
            <img src={heroImg} alt={plain(im.heroTitle)} className="w-full aspect-[16/10] object-cover" loading="eager" fetchPriority="high" />
            <div className="absolute inset-x-0 bottom-0 h-24" style={{ background: `linear-gradient(transparent, ${T.bg})` }} />
          </div>
        )}
        <div className="relative max-w-6xl mx-auto px-4 pt-4 lg:pt-14 pb-10 lg:pb-16">
          <div className="max-w-[560px]">
            <Kicker />
            <h1 className={`${head} mt-3 text-[46px] sm:text-[64px] lg:text-[72px]`}>
              <Hl text={im.heroTitle} color={P} lines />
            </h1>
            <p className="mt-4 text-[16px] sm:text-[17px] leading-relaxed" style={{ color: 'rgba(255,255,255,.8)' }}>{plain(im.heroText)}</p>
            <ul className="mt-5 space-y-2.5">
              {im.heroBullets.map((b, i) => <Bullet key={i} text={b} />)}
            </ul>
            <HeroBuy />
          </div>
        </div>
      </section>
    );
  }

  // ---------- trust strip ----------
  const trustWrap: React.CSSProperties =
    st === 'blast' ? { background: '#140707' } : st === 'noir' ? { borderTop: `1px solid ${T.line}`, borderBottom: `1px solid ${T.line}` } : st === 'neon' ? {} : st === 'clinic' ? { background: T.surface, borderTop: `1px solid ${T.line}`, borderBottom: `1px solid ${T.line}` } : { background: T.surface, borderTop: `1px solid ${T.line}`, borderBottom: `1px solid ${T.line}` };
  const trustIcon = st === 'blast' ? '#FFD21A' : P;

  // ---------- benefit cards ----------
  const benefitCard = (b: { icon: string; title: string; text: string }, i: number) => {
    const titleCls = condensed ? `${barlow.className} text-[19px] sm:text-[22px] font-extrabold uppercase italic leading-tight` : st === 'noir' ? `${cinzel.className} text-[14px] sm:text-[16px] font-bold uppercase tracking-wide` : st === 'neon' ? `${exo.className} text-[15px] sm:text-[17px] font-extrabold uppercase italic` : `${manrope.className} text-[15px] sm:text-[17px] font-extrabold`;
    if (st === 'noir')
      return (
        <div key={i} className="text-center px-2">
          <span className="mx-auto w-16 h-16 rounded-full flex items-center justify-center" style={{ border: `1px solid ${P}99` }}>
            <Ico name={b.icon} className="w-7 h-7" style={{ color: P }} />
          </span>
          <p className={`mt-4 ${titleCls}`} style={{ color: P }}>{plain(b.title)}</p>
          <p className="mt-2 text-[13px] sm:text-[14px] leading-relaxed" style={mutedC}>{plain(b.text)}</p>
        </div>
      );
    if (st === 'clinic')
      return (
        <div key={i} className="rounded-2xl p-5 sm:p-6 border bg-white transition hover:-translate-y-1" style={{ borderColor: T.line, boxShadow: '0 12px 30px -24px rgba(15,27,45,.5)' }}>
          <span className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: `${P}14` }}>
            <Ico name={b.icon} className="w-6 h-6" style={{ color: P }} />
          </span>
          <p className={`mt-4 ${titleCls}`} style={{ color: T.text }}>{plain(b.title)}</p>
          <p className="mt-1.5 text-[13px] sm:text-[14px] leading-snug" style={mutedC}>{plain(b.text)}</p>
        </div>
      );
    if (st === 'neon')
      return (
        <div key={i} className="rounded-2xl p-5 sm:p-6 border backdrop-blur transition hover:-translate-y-1" style={{ background: `${T.surface}CC`, borderColor: T.line }}>
          <span className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${P}33, ${T.accent}33)`, boxShadow: `0 0 20px -6px ${P}` }}>
            <Ico name={b.icon} className="w-6 h-6" style={{ color: P }} />
          </span>
          <p className={`mt-4 ${titleCls}`}>{plain(b.title)}</p>
          <p className="mt-1.5 text-[13px] sm:text-[14px] leading-snug" style={mutedC}>{plain(b.text)}</p>
        </div>
      );
    if (st === 'blast')
      return (
        <div key={i} className="rounded-2xl p-4 sm:p-6 text-center border-2" style={{ background: 'rgba(20,7,7,.45)', borderColor: 'rgba(255,210,26,.4)' }}>
          <Ico name={b.icon} className="w-11 h-11 sm:w-12 sm:h-12 mx-auto" style={{ color: '#FFD21A' }} />
          <p className={`mt-3 ${titleCls}`}>{plain(b.title)}</p>
          <p className="mt-1.5 text-[13px] sm:text-[14px] leading-snug" style={mutedC}>{plain(b.text)}</p>
        </div>
      );
    return (
      <div key={i} className="rounded-2xl p-4 sm:p-6 text-center border transition hover:-translate-y-1" style={{ background: T.surface, borderColor: `${P}40`, boxShadow: glow }}>
        <Ico name={b.icon} className="w-10 h-10 sm:w-12 sm:h-12 mx-auto" style={{ color: P }} />
        <p className="mt-3 text-[14px] sm:text-[16px] font-extrabold uppercase leading-tight">{plain(b.title)}</p>
        <p className="mt-1.5 text-[13px] sm:text-[14px] leading-snug" style={mutedC}>{plain(b.text)}</p>
      </div>
    );
  };

  // ---------- ingredients ----------
  const ring: React.CSSProperties =
    st === 'blast'
      ? { background: '#FFD21A', padding: 4 }
      : st === 'noir'
        ? { background: `linear-gradient(135deg, ${shade(P, 40)}, ${shade(P, -30)})`, padding: 2 }
        : st === 'clinic'
          ? { background: '#fff', padding: 4, boxShadow: '0 14px 30px -18px rgba(15,27,45,.55)', border: `1px solid ${T.line}` }
          : st === 'neon'
            ? { background: `linear-gradient(135deg, ${P}, ${T.accent})`, padding: 3, boxShadow: `0 0 30px -6px ${P}` }
            : { background: `linear-gradient(135deg, ${P}, ${shade(P, -40)})`, padding: 3, boxShadow: `0 0 36px -8px ${P}` };
  const ingredientsBg =
    st === 'blast' ? '#140707' : st === 'clinic' ? T.surface : st === 'noir' ? `radial-gradient(ellipse at center, ${P}14, transparent 70%)` : st === 'neon' ? `radial-gradient(ellipse at center, ${T.accent}22, transparent 70%)` : `radial-gradient(ellipse at center, ${P}1F, transparent 70%)`;

  // ---------- package cards ----------
  const pk =
    st === 'blast'
      ? { bg: '#FFFFFF', text: '#1A1A1A', muted: '#5B5B5B', border: '#FFFFFF', popBg: '#FFD21A', popText: '#1A1A1A', popMuted: '#4A3A00', popBorder: '#FFFFFF', price: '#E3141C', badgeBg: '#E3141C', badgeText: '#FFFFFF' }
      : st === 'noir'
        ? { bg: T.surface, text: T.text, muted: T.muted, border: T.line, popBg: `linear-gradient(160deg, ${shade(P, 45)}, ${P} 55%, ${shade(P, -25)})`, popText: '#140F08', popMuted: 'rgba(20,15,8,.72)', popBorder: shade(P, 40), price: P, badgeBg: '#000', badgeText: P }
        : st === 'clinic'
          ? { bg: '#FFFFFF', text: T.text, muted: T.muted, border: T.line, popBg: `${P}0A`, popText: T.text, popMuted: T.muted, popBorder: P, price: T.text, badgeBg: P, badgeText: '#fff' }
          : st === 'neon'
            ? { bg: `${T.surface}CC`, text: T.text, muted: T.muted, border: T.line, popBg: `${T.surface}EE`, popText: T.text, popMuted: T.muted, popBorder: P, price: P, badgeBg: `linear-gradient(90deg, ${P}, ${T.accent})`, badgeText: '#04121F' }
            : { bg: T.surface, text: T.text, muted: T.muted, border: 'rgba(255,255,255,0.1)', popBg: T.surface, popText: T.text, popMuted: T.muted, popBorder: P, price: T.text, badgeBg: P, badgeText: T.onPrimary };

  // ---------- final call to action ----------
  const finalBg =
    st === 'blast'
      ? 'radial-gradient(circle at 70% 50%, #D3140F, #7A0B0B 55%, #3D0505)'
      : st === 'noir'
        ? `radial-gradient(ellipse at 30% 50%, ${P}2E, transparent 60%), #000`
        : st === 'clinic'
          ? P
          : st === 'neon'
            ? `radial-gradient(circle at 20% 50%, ${P}40, transparent 50%), radial-gradient(circle at 85% 50%, ${T.accent}40, transparent 50%), ${T.bg}`
            : `linear-gradient(120deg, ${shade(P, -55)}, ${shade(P, -25)} 55%, ${shade(P, -60)})`;
  const finalText = st === 'clinic' ? '#fff' : T.text;

  return (
    <div
      className={`antialiased ${st === 'clinic' ? manrope.className : ''}`}
      style={{ background: T.bg, color: T.text }}
    >
      {/* ============ OFFER BAR ============ */}
      <div className="px-3 py-2 text-center" style={bar.style}>
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5">
          <p className={`${bar.text} leading-tight`}>{plain(im.topBar)}</p>
          {t && (
            <span className="inline-flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide">
              {config.countdown?.text?.trim() || 'Termina en'}: <Tile v={t.h} /> : <Tile v={t.m} /> : <Tile v={t.s} />
            </span>
          )}
        </div>
      </div>

      {/* ============ NAV ============ */}
      <header className="sticky top-0 z-30 border-b backdrop-blur" style={{ background: `${T.bg}E6`, borderColor: T.line }}>
        <div className="max-w-6xl mx-auto px-4 h-14 sm:h-16 flex items-center justify-between gap-4">
          <span className={`${head} ${st === 'noir' ? 'text-[17px]' : 'text-[22px]'} sm:text-[27px] truncate min-w-0`} style={st === 'noir' ? GOLD_TEXT(P) : { color: T.text }}>
            {brandA} {brandB.length > 0 && <span style={st === 'noir' ? undefined : { color: hl }}>{brandB.join(' ')}</span>}
          </span>
          <nav className={`hidden md:flex items-center gap-7 text-[13px] font-semibold ${st === 'noir' ? `${cinzel.className} uppercase tracking-[0.14em] text-[11.5px]` : ''}`} style={mutedC}>
            <a href="#beneficios" className="hover:opacity-100 opacity-90">Beneficios</a>
            {im.ingredients?.length > 0 && <a href="#ingredientes" className="hover:opacity-100 opacity-90">Ingredientes</a>}
            {reviews.length > 0 && <a href="#opiniones" className="hover:opacity-100 opacity-90">Opiniones</a>}
            <a href="#paquetes" className="hover:opacity-100 opacity-90">Ofertas</a>
            {config.faqs?.length > 0 && <a href="#preguntas" className="hover:opacity-100 opacity-90">Preguntas</a>}
          </nav>
          <Cta className={`shrink-0 ${condensed ? '!h-10 !px-4 !text-[15px]' : st === 'noir' ? '!h-10 !px-3 sm:!px-4 !text-[11px] sm:!text-[12.5px] !tracking-[0.08em]' : '!h-10 !px-4 !text-[12.5px]'}`} />
        </div>
      </header>

      {/* ============ HERO ============ */}
      {hero}

      {/* ============ TRUST ============ */}
      <section style={trustWrap}>
        <div className={`max-w-6xl mx-auto px-4 py-5 grid grid-cols-2 lg:grid-cols-4 ${st === 'neon' ? 'gap-3' : 'gap-y-5'}`}>
          {im.trust.map((x, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 ${st === 'neon' ? 'rounded-2xl border px-3 py-3 backdrop-blur' : `px-2 lg:px-6 ${i > 0 ? 'lg:border-l' : ''}`}`}
              style={st === 'neon' ? { background: `${T.surface}B3`, borderColor: T.line } : { borderColor: st === 'noir' ? T.line : st === 'clinic' ? T.line : 'rgba(255,255,255,.15)' }}
            >
              <Ico name={x.icon} className="w-9 h-9 shrink-0" style={{ color: trustIcon }} />
              <div className="min-w-0">
                <p className={`text-[13px] sm:text-[14px] font-extrabold leading-tight ${st === 'clinic' ? '' : 'uppercase'} ${st === 'noir' ? `${cinzel.className} tracking-wide` : ''}`} style={{ color: st === 'noir' ? P : T.text }}>
                  {plain(x.title)}
                </p>
                <p className="text-[12px] leading-tight" style={mutedC}>{plain(x.text)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ============ BENEFITS ============ */}
      <section className="relative max-w-6xl mx-auto px-4 py-14 sm:py-16">
        <Title id="beneficios" text={im.benefitsTitle} />
        <div className={`grid grid-cols-2 lg:grid-cols-4 ${st === 'noir' ? 'gap-x-4 gap-y-10' : 'gap-3 sm:gap-5'}`}>{im.benefits.map(benefitCard)}</div>
      </section>

      {/* ============ INGREDIENTS ============ */}
      {im.ingredients?.length > 0 && (
        <section className="relative py-14 sm:py-16" style={{ background: ingredientsBg }}>
          <div className="max-w-6xl mx-auto px-4">
            <Title id="ingredientes" text={im.ingredientsTitle} sub={im.ingredientsSubtitle} />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-8">
              {im.ingredients.map((x, i) => (
                <div key={i} className="text-center">
                  <div className="mx-auto w-28 h-28 sm:w-36 sm:h-36 rounded-full overflow-hidden" style={ring}>
                    {x.image ? (
                      <img src={x.image} alt={x.name} className="w-full h-full rounded-full object-cover" loading="lazy" decoding="async" />
                    ) : (
                      <span className="w-full h-full rounded-full flex items-center justify-center" style={{ background: T.surface }}>
                        <Leaf className="w-10 h-10" style={{ color: P }} />
                      </span>
                    )}
                  </div>
                  <p
                    className={`mt-3 text-[15px] sm:text-[17px] font-extrabold ${st === 'clinic' ? '' : 'uppercase'} ${condensed ? `${barlow.className} italic text-[19px] sm:text-[22px]` : st === 'noir' ? `${cinzel.className} tracking-wide` : ''}`}
                    style={{ color: st === 'noir' ? P : st === 'blast' ? '#FFD21A' : T.text }}
                  >
                    {plain(x.name)}
                  </p>
                  <p className="mt-1 text-[13px] leading-snug max-w-[220px] mx-auto" style={mutedC}>{plain(x.text)}</p>
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
              <div key={r.id} className="rounded-2xl p-5 border" style={{ background: st === 'clinic' ? '#fff' : st === 'blast' ? 'rgba(20,7,7,.45)' : T.surface, borderColor: T.line }}>
                <div className="flex items-center gap-3">
                  <span className="w-11 h-11 rounded-full flex items-center justify-center text-[16px] font-bold shrink-0" style={{ background: `${hl}26`, color: hl }}>
                    {(r.author || 'C').trim().charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[14px] font-bold truncate">{r.author}</p>
                    {r.location && <p className="text-[12px] truncate" style={mutedC}>{r.location}</p>}
                  </div>
                </div>
                {r.rating > 0 && (
                  <span className="mt-3 inline-flex gap-0.5">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <Star key={i} className={`w-4 h-4 ${i < Math.round(r.rating) ? 'fill-amber-400 text-amber-400' : 'opacity-25'}`} />
                    ))}
                  </span>
                )}
                <p className={`mt-3 text-[14px] italic leading-relaxed ${st === 'noir' ? cinzel.className : ''}`} style={{ color: T.text, opacity: 0.9 }}>
                  “{r.comment}”
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ============ PACKAGES ============ */}
      <section
        className="relative py-14 sm:py-16 scroll-mt-16"
        id="paquetes"
        style={{ background: st === 'blast' ? 'radial-gradient(circle at 50% 30%, #A80F0D, #6E0909 70%)' : st === 'clinic' ? '#fff' : `linear-gradient(180deg, transparent, ${P}12, transparent)` }}
      >
        <div className="max-w-6xl mx-auto px-4">
          <Title text={im.packagesTitle} sub={im.packagesSubtitle} />
          <div className={`grid gap-4 sm:gap-5 ${combos.length >= 3 ? 'lg:grid-cols-3' : combos.length === 2 ? 'sm:grid-cols-2 max-w-3xl mx-auto' : 'max-w-md mx-auto'}`}>
            {combos.map((c) => {
              const isPop = c.id === popular?.id && combos.length > 1;
              const selected = c.id === combo.id;
              const text = isPop ? pk.popText : pk.text;
              const muted = isPop ? pk.popMuted : pk.muted;
              const tone: Tone = st === 'blast' ? 'red' : st === 'noir' && isPop ? 'dark' : 'main';
              return (
                <div
                  key={c.id}
                  className={`relative p-5 sm:p-6 border-2 flex flex-col ${st === 'noir' ? 'rounded-md' : 'rounded-2xl'} ${isPop ? 'lg:-translate-y-3' : ''} ${st === 'neon' ? 'backdrop-blur' : ''}`}
                  style={{
                    background: isPop ? pk.popBg : pk.bg,
                    color: text,
                    borderColor: isPop ? pk.popBorder : selected ? `${P}80` : pk.border,
                    boxShadow: isPop ? (st === 'neon' ? neonGlow : st === 'blast' ? '8px 8px 0 #140707' : st === 'clinic' ? `0 24px 50px -28px ${P}` : glow) : st === 'blast' ? '6px 6px 0 #140707' : undefined,
                  }}
                >
                  {(isPop || c.badge) && (
                    <span
                      className={`absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md px-3 py-1 font-extrabold uppercase inline-flex items-center gap-1 ${condensed ? `${barlow.className} italic text-[14px] tracking-wide` : st === 'noir' ? `${cinzel.className} text-[11px] tracking-[0.14em]` : 'text-[11px] tracking-wide'}`}
                      style={{ background: pk.badgeBg, color: pk.badgeText, border: st === 'noir' ? `1px solid ${P}` : undefined }}
                    >
                      <Star className="w-3.5 h-3.5" style={{ fill: 'currentColor' }} /> {c.badge || 'Más vendido'}
                    </span>
                  )}
                  <p className={`${head} text-center ${condensed ? 'text-[26px] sm:text-[30px]' : 'text-[19px] sm:text-[22px]'}`} style={{ color: text }}>
                    {c.name}
                  </p>
                  <div className="mt-3 flex items-center gap-4">
                    <img src={packImage(c)} alt={c.name} className="w-28 h-28 sm:w-32 sm:h-32 object-cover rounded-xl shrink-0 drop-shadow-[0_10px_20px_rgba(0,0,0,0.35)]" loading="lazy" decoding="async" />
                    <ul className="space-y-1.5">
                      {packBullets(c).map((b, i) => (
                        <li key={i} className="flex items-start gap-2 text-[13px] leading-snug" style={{ color: muted }}>
                          <Check className="w-4 h-4 shrink-0 mt-0.5" style={{ color: isPop && (st === 'noir' || st === 'blast') ? text : st === 'blast' ? '#E3141C' : P }} strokeWidth={3} />
                          {plain(b)}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="mt-4 text-center">
                    {c.regularPrice > c.promoPrice && <p className="text-[14px] line-through" style={{ color: muted }}>{money(c.regularPrice)}</p>}
                    <p
                      className={`${condensed ? barlow.className : st === 'noir' ? cinzel.className : st === 'neon' ? exo.className : manrope.className} text-[32px] sm:text-[34px] font-extrabold leading-none`}
                      style={{ color: isPop && st === 'noir' ? text : pk.price }}
                    >
                      {money(c.promoPrice)}
                    </p>
                    {c.savingsText && (
                      <p className="mt-1 text-[12px] font-bold" style={{ color: isPop && st === 'noir' ? text : st === 'blast' ? '#E3141C' : P }}>
                        {c.savingsText}
                      </p>
                    )}
                  </div>
                  <Cta comboId={c.id} tone={tone} className="mt-4 w-full" />
                </div>
              );
            })}
          </div>
          <p className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[13px]" style={mutedC}>
            <span className="inline-flex items-center gap-1.5"><Wallet className="w-4 h-4" style={{ color: hl }} /> Pagas en efectivo al recibir</span>
            <span className="inline-flex items-center gap-1.5"><Truck className="w-4 h-4" style={{ color: hl }} /> {config.shippingCostText || 'Envío a todo el país'}</span>
            {config.guaranteeDays > 0 && <span className="inline-flex items-center gap-1.5"><ShieldCheck className="w-4 h-4" style={{ color: hl }} /> Garantía de {config.guaranteeDays} días</span>}
          </p>
        </div>
      </section>

      {/* ============ FAQ ============ */}
      {config.faqs?.length > 0 && (
        <section className="max-w-3xl mx-auto px-4 py-14 sm:py-16">
          <Title id="preguntas" text={im.faqTitle} />
          <div className="space-y-2.5">
            {config.faqs.map((f, i) => (
              <div key={f.id} className={`${st === 'noir' ? 'rounded-none' : 'rounded-xl'} border overflow-hidden`} style={{ background: st === 'clinic' ? T.surface : st === 'blast' ? 'rgba(20,7,7,.45)' : T.surface, borderColor: T.line }}>
                <button onClick={() => setFaq(faq === i ? null : i)} aria-expanded={faq === i} className="w-full flex items-center justify-between gap-4 px-4 sm:px-5 py-4 text-left text-[15px] font-semibold">
                  {plain(f.question)}
                  {faq === i ? <Minus className="w-5 h-5 shrink-0" style={{ color: hl }} /> : <Plus className="w-5 h-5 shrink-0" style={{ color: hl }} />}
                </button>
                {faq === i && <p className="px-4 sm:px-5 pb-4 text-[14px] leading-relaxed" style={mutedC}>{plain(f.answer)}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ============ FINAL CTA ============ */}
      <section className={`relative overflow-hidden ${st === 'clinic' ? 'mx-4 sm:mx-6 lg:mx-auto lg:max-w-6xl rounded-3xl mb-10' : ''}`} style={{ background: finalBg, color: finalText }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-12 sm:py-14 flex flex-col md:flex-row items-center gap-6 md:gap-10">
          <img src={packImage(popular || entry)} alt={config.productName} className="w-40 sm:w-52 aspect-square object-cover rounded-2xl drop-shadow-[0_20px_30px_rgba(0,0,0,0.45)]" loading="lazy" />
          <div className="flex-1 text-center md:text-left">
            <h2 className={`${head} ${condensed ? 'text-[34px] sm:text-[50px]' : 'text-[28px] sm:text-[40px]'}`} style={st === 'noir' ? GOLD_TEXT(P) : { color: finalText }}>
              <Hl text={im.finalTitle} color={st === 'blast' ? '#FFD21A' : st === 'neon' ? P : st === 'noir' ? undefined : finalText} />
            </h2>
            <p className="mt-2 text-[15px] sm:text-[16px] max-w-xl" style={{ color: finalText, opacity: 0.85 }}>{plain(im.finalText)}</p>
            <Cta big tone={st === 'clinic' ? 'light' : 'main'} className="mt-6 w-full sm:w-auto" />
          </div>
          {im.finalBadge && (
            <span
              className={`hidden md:flex rotate-[-8deg] rounded-xl px-5 py-3 font-extrabold uppercase leading-none text-center items-center gap-2 ${condensed ? `${barlow.className} italic text-[22px]` : st === 'noir' ? `${cinzel.className} text-[15px] tracking-[0.12em]` : 'text-[15px]'}`}
              style={
                st === 'blast'
                  ? { background: '#FFD21A', color: '#A30D0D', boxShadow: '6px 6px 0 #140707' }
                  : st === 'noir'
                    ? { border: `1px solid ${P}`, color: P }
                    : st === 'clinic'
                      ? { background: 'rgba(255,255,255,.14)', color: '#fff' }
                      : st === 'neon'
                        ? { border: `1px solid ${P}`, color: P, boxShadow: neonGlow }
                        : { background: P, color: T.onPrimary, boxShadow: '0 10px 30px -10px rgba(0,0,0,.6)' }
              }
            >
              <Timer className="w-7 h-7" /> {plain(im.finalBadge)}
            </span>
          )}
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="border-t" style={{ background: T.bg, borderColor: T.line }}>
        <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[12px]" style={mutedC}>
          <span className={`${head} text-[20px]`} style={st === 'noir' ? GOLD_TEXT(P) : { color: T.text }}>
            {brandA} {brandB.length > 0 && <span style={st === 'noir' ? undefined : { color: hl }}>{brandB.join(' ')}</span>}
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

// Starburst seal shape (Explosivo).
const STAR =
  'polygon(50% 0%, 61% 12%, 77% 6%, 80% 22%, 96% 25%, 90% 40%, 100% 52%, 88% 62%, 93% 78%, 77% 80%, 72% 96%, 58% 89%, 46% 100%, 37% 88%, 21% 94%, 18% 78%, 3% 73%, 10% 58%, 0% 46%, 11% 36%, 6% 20%, 22% 18%, 27% 3%, 40% 11%)';
