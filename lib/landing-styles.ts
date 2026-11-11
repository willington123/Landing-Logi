// Looks of the "Impacto Premium" sales page. Same content and sections; each style changes palette, fonts,
// hero layout, cards, buttons and the AI pictures. Shared by the renderer, the wizard, the editor and the AI brief.
import type { ImpactStyle, LandingDesign } from './types';

export interface ImpactStyleInfo {
  id: ImpactStyle;
  name: string;
  text: string; // one line for the picker
  goodFor: string;
}

export const IMPACT_STYLES: ImpactStyleInfo[] = [
  { id: 'impact', name: 'Impacto Premium ⚡', text: 'Oscura, contraste fuerte y botones grandes.', goodFor: 'Suplementos, gadgets, todo lo que se vende por impulso' },
  { id: 'blast', name: 'Explosivo 🔥', text: 'Rojo y amarillo, títulos gigantes, sellos y mucha energía.', goodFor: 'Ofertas agresivas y productos de rendimiento' },
  { id: 'noir', name: 'Lujo Noir ✦', text: 'Negro y dorado, letras elegantes, se ve exclusivo.', goodFor: 'Productos premium, perfumes, belleza, regalos' },
  { id: 'clinic', name: 'Clínico Limpio', text: 'Blanco y azul, ordenado y confiable, tipo laboratorio.', goodFor: 'Salud, cuidado de la piel, bienestar, bebés' },
  { id: 'neon', name: 'Neón Futurista', text: 'Azul oscuro con brillos neón, tarjetas de vidrio, tecnológico.', goodFor: 'Tecnología, energía, enfoque, gamers' },
];

export const styleInfo = (id?: string) => IMPACT_STYLES.find((s) => s.id === id) || IMPACT_STYLES[0];

export interface ImpactTheme {
  style: ImpactStyle;
  dark: boolean;
  bg: string; // page background
  surface: string; // cards and strips
  text: string;
  muted: string;
  line: string; // borders
  primary: string; // buttons and highlighted words
  onPrimary: string; // text on primary
  accent: string; // second color (glows, gradients)
}

// The page always keeps its style's identity, whatever colors the AI or the editor send:
// a color is taken only when it fits the style (dark enough on white, bright enough on black).
export function impactTheme(style: ImpactStyle | undefined, d?: Partial<LandingDesign>): ImpactTheme {
  const p = d?.primary;
  const a = d?.accent;
  switch (style) {
    case 'clinic': {
      const primary = p && lum(p) < 0.22 && lum(p) > 0.01 ? p : '#2F4A66';
      return { style, dark: false, bg: '#FFFFFF', surface: '#F2F6FA', text: '#0F1B2D', muted: '#55657C', line: '#E1E8F0', primary, onPrimary: '#FFFFFF', accent: a && lum(a) < 0.5 ? a : '#3F8F7A' };
    }
    case 'noir': {
      const primary = p && lum(p) > 0.25 && sat(p) < 0.75 && isWarm(p) ? p : '#C9A25C';
      return { style, dark: true, bg: '#0A0907', surface: '#15120E', text: '#F3EBDD', muted: 'rgba(243,235,221,0.68)', line: 'rgba(201,162,92,0.28)', primary, onPrimary: '#140F08', accent: shade(primary, 30) };
    }
    case 'blast':
      return { style, dark: true, bg: '#7A0B0B', surface: '#140707', text: '#FFFFFF', muted: 'rgba(255,255,255,0.82)', line: 'rgba(255,255,255,0.16)', primary: '#FFD21A', onPrimary: '#A30D0D', accent: '#E3141C' };
    case 'neon': {
      const primary = p && lum(p) > 0.25 ? p : '#22D3EE';
      return { style, dark: true, bg: '#060B1A', surface: '#0D1631', text: '#EAF2FF', muted: 'rgba(234,242,255,0.7)', line: 'rgba(56,232,255,0.22)', primary, onPrimary: '#04121F', accent: a && lum(a) > 0.08 && a.toLowerCase() !== primary.toLowerCase() ? a : '#A855F7' };
    }
    default: {
      const primary = p && lum(p) > 0.08 ? p : '#E11D2A';
      const bg = d?.dark && lum(d.dark) < 0.06 ? d.dark : '#0B0B0F';
      const surface = d?.light && lum(d.light) < 0.1 ? d.light : '#16161C';
      return { style: 'impact', dark: true, bg, surface, text: '#FFFFFF', muted: 'rgba(255,255,255,0.7)', line: 'rgba(255,255,255,0.1)', primary, onPrimary: lum(primary) > 0.5 ? '#111111' : '#FFFFFF', accent: primary };
    }
  }
}

// Relative luminance 0 (black) … 1 (white).
export function lum(hex?: string): number {
  const h = (hex || '').replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(h)) return 0.5;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function rgb(hex: string) {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
}
function sat(hex: string) {
  if (!/^#?[0-9a-f]{6}$/i.test(hex)) return 0;
  const [r, g, b] = rgb(hex);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  return mx === 0 ? 0 : (mx - mn) / mx;
}
// Gold, champagne, bronze, copper: red ≥ green > blue.
function isWarm(hex: string) {
  if (!/^#?[0-9a-f]{6}$/i.test(hex)) return false;
  const [r, g, b] = rgb(hex);
  return r >= g && g > b;
}

// Lighter (+) or darker (−) version of a hex color, in percent.
export function shade(hex: string, pct: number): string {
  const h = (hex || '#000000').replace('#', '');
  if (h.length !== 6) return hex;
  const f = (i: number) => {
    const v = parseInt(h.slice(i, i + 2), 16);
    const n = pct < 0 ? v * (1 + pct / 100) : v + (255 - v) * (pct / 100);
    return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(2)}${f(4)}`;
}

// Hero picture: wide behind the text (impact, noir) or framed beside it (the others).
export const heroAspect = (style?: ImpactStyle) => (style === 'impact' || style === 'noir' || !style ? '16:9' : '4:3');
