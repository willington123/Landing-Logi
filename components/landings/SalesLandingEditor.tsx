'use client';

// Editor for AI-generated landings (layout "sales-v2"): every section is editable,
// changes autosave to the browser and show live in the preview iframe.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Monitor,
  Smartphone,
  ExternalLink,
  Copy,
  Check,
  ChevronDown,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Upload,
  Wand2,
  Loader2,
  AlertCircle,
  Star,
  Tag,
  Image as ImageIcon,
  Type,
  MessageSquareQuote,
  HelpCircle,
  Palette,
  Search as SearchIcon,
} from 'lucide-react';
import { logiStore } from '@/lib/store';
import { LandingPageConfig, LandingDesign, SalesPageContent, ReviewItem, FAQItem, BenefitItem } from '@/lib/types';
import { buildCombos, ICON_NAMES } from '@/lib/landing-ai';
import { DEFAULT_COUNTDOWN } from '@/lib/offer-countdown';
import { compressImage, fileToDataUrl } from '@/lib/image-utils';
import { isCloud, pushLanding, swapStrings } from '@/lib/cloud';

// ---------- small form primitives ----------
const inputCls =
  'w-full text-sm px-3 py-2 rounded-lg border border-slate-300 bg-white outline-none focus:border-slate-900 focus:ring-4 focus:ring-slate-900/5 transition';

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-slate-700 mb-1">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-slate-500 mt-1">{hint}</span>}
    </label>
  );
}

function Text({ label, value, onChange, multiline, hint, placeholder }: { label: string; value?: string; onChange: (v: string) => void; multiline?: boolean; hint?: string; placeholder?: string }) {
  return (
    <Field label={label} hint={hint}>
      {multiline ? (
        <textarea className={`${inputCls} min-h-[72px] resize-y`} value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      ) : (
        <input className={inputCls} value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      )}
    </Field>
  );
}

function IconSelect({ value, onChange }: { value?: string; onChange: (v: string) => void }) {
  return (
    <select className={`${inputCls} w-auto`} value={value || 'Sparkles'} onChange={(e) => onChange(e.target.value)} aria-label="Icono">
      {ICON_NAMES.map((n) => (
        <option key={n} value={n}>
          {n}
        </option>
      ))}
    </select>
  );
}

function RowTools({ onUp, onDown, onRemove }: { onUp?: () => void; onDown?: () => void; onRemove?: () => void }) {
  const b = 'w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30';
  return (
    <div className="flex items-center gap-0.5">
      <button type="button" className={b} onClick={onUp} disabled={!onUp} aria-label="Subir"><ArrowUp className="w-3.5 h-3.5" /></button>
      <button type="button" className={b} onClick={onDown} disabled={!onDown} aria-label="Bajar"><ArrowDown className="w-3.5 h-3.5" /></button>
      <button type="button" className={`${b} hover:text-red-600 hover:bg-red-50`} onClick={onRemove} disabled={!onRemove} aria-label="Quitar"><Trash2 className="w-3.5 h-3.5" /></button>
    </div>
  );
}

function Group({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <details className="group rounded-xl border border-slate-200 bg-white" open={defaultOpen}>
      <summary className="flex items-center justify-between px-4 py-3 cursor-pointer list-none text-sm font-semibold text-slate-900">
        {title}
        <ChevronDown className="w-4 h-4 text-slate-400 transition group-open:rotate-180" />
      </summary>
      <div className="px-4 pb-4 space-y-3">{children}</div>
    </details>
  );
}

const move = <T,>(arr: T[], i: number, dir: -1 | 1): T[] => {
  const j = i + dir;
  if (j < 0 || j >= arr.length) return arr;
  const next = [...arr];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
};
const uid = (p: string) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

const PALETTES: { name: string; d: LandingDesign }[] = [
  { name: 'Cálido', d: { primary: '#FFC83D', accent: '#E2611B', dark: '#2B2118', light: '#FFF7E6', vibe: 'warm' } },
  { name: 'Rosa', d: { primary: '#F43F7A', accent: '#8B5CF6', dark: '#2A1020', light: '#FFF1F5', vibe: 'fresh' } },
  { name: 'Verde', d: { primary: '#22C55E', accent: '#0F766E', dark: '#0F2A1D', light: '#F0FDF4', vibe: 'fresh' } },
  { name: 'Azul', d: { primary: '#2563EB', accent: '#0D9488', dark: '#0F172A', light: '#F1F5FF', vibe: 'tech' } },
  { name: 'Elegante', d: { primary: '#C8A15A', accent: '#111827', dark: '#1C1917', light: '#FAF7F2', vibe: 'luxury' } },
];

type Tab = 'content' | 'offers' | 'images' | 'reviews' | 'faq' | 'design' | 'seo';
const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'content', label: 'Textos', icon: Type },
  { id: 'offers', label: 'Ofertas', icon: Tag },
  { id: 'images', label: 'Imágenes', icon: ImageIcon },
  { id: 'reviews', label: 'Reseñas', icon: MessageSquareQuote },
  { id: 'faq', label: 'Preguntas', icon: HelpCircle },
  { id: 'design', label: 'Diseño', icon: Palette },
  { id: 'seo', label: 'Píxel y SEO', icon: SearchIcon },
];

// ---------- image slot (upload / remove / regenerate with AI) ----------
function ImageSlot({
  label,
  src,
  onChange,
  aiPrompt,
  aspect,
  generate,
}: {
  label: string;
  src?: string;
  onChange: (v: string | undefined) => void;
  aiPrompt?: string;
  aspect?: string;
  generate?: (prompt: string, aspect: string) => Promise<string>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [prompt, setPrompt] = useState(aiPrompt || '');
  const [showPrompt, setShowPrompt] = useState(false);

  const upload = async (file?: File) => {
    if (!file) return;
    setErr(null);
    try {
      onChange(await compressImage(await fileToDataUrl(file), 1280, 0.82));
    } catch (e: any) {
      setErr(e.message);
    }
  };
  const regen = async () => {
    if (!generate || !prompt.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      onChange(await generate(prompt.trim(), aspect || '1:1'));
      setShowPrompt(false);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <div className="flex gap-3">
        <div className="w-20 h-20 rounded-lg bg-slate-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
          {busy ? <Loader2 className="w-5 h-5 animate-spin text-slate-400" /> : src ? <img src={src} alt="" className="w-full h-full object-cover" /> : <ImageIcon className="w-5 h-5 text-slate-300" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-slate-800 mb-2">{label}</div>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => fileRef.current?.click()} className="h-8 px-2.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:border-slate-300 inline-flex items-center gap-1">
              <Upload className="w-3.5 h-3.5" /> Subir
            </button>
            {generate && (
              <button type="button" onClick={() => setShowPrompt((v) => !v)} disabled={busy} className="h-8 px-2.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:border-slate-300 inline-flex items-center gap-1 disabled:opacity-50">
                <Wand2 className="w-3.5 h-3.5" /> Generar con IA
              </button>
            )}
            {src && (
              <button type="button" onClick={() => onChange(undefined)} className="h-8 px-2.5 rounded-lg text-xs font-medium text-slate-500 hover:text-red-600 hover:bg-red-50 inline-flex items-center gap-1">
                <Trash2 className="w-3.5 h-3.5" /> Quitar
              </button>
            )}
          </div>
        </div>
      </div>
      {showPrompt && generate && (
        <div className="mt-3 space-y-2">
          <textarea className={`${inputCls} min-h-[64px] text-xs`} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Describe la escena (en inglés funciona mejor). Ej: the product on a wooden table, soft morning light" />
          <button type="button" onClick={regen} disabled={busy || !prompt.trim()} className="h-8 px-3 rounded-lg bg-slate-900 text-white text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50">
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />} Generar imagen
          </button>
        </div>
      )}
      {err && <p className="mt-2 text-[11px] text-red-600">{err}</p>}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
    </div>
  );
}

// =====================================================================
export default function SalesLandingEditor({ initial }: { initial: LandingPageConfig }) {
  const [config, setConfig] = useState<LandingPageConfig>(initial);
  const [tab, setTab] = useState<Tab>('content');
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'full' | 'cloud-error'>('saved');
  const [cloudOn, setCloudOn] = useState(false);
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const firstRender = useRef(true);

  const s = config.sales!;
  const d = config.design!;

  // ----- updates -----
  const update = useCallback((patch: Partial<LandingPageConfig>) => setConfig((c) => ({ ...c, ...patch })), []);
  const updateSales = useCallback((patch: Partial<SalesPageContent>) => setConfig((c) => ({ ...c, sales: { ...c.sales!, ...patch } })), []);
  const updateDesign = (patch: Partial<LandingDesign>) => setConfig((c) => ({ ...c, design: { ...c.design!, ...patch } }));

  // ----- live preview -----
  const postPreview = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage({ type: 'lp-preview', config }, window.location.origin);
  }, [config]);
  useEffect(() => {
    const t = setTimeout(postPreview, 120);
    return () => clearTimeout(t);
  }, [postPreview]);
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin === window.location.origin && e.data?.type === 'lp-preview-ready') postPreview();
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [postPreview]);

  // ----- autosave (browser + Supabase) -----
  useEffect(() => {
    isCloud().then(setCloudOn);
  }, []);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setSaveState('saving');
    const t = setTimeout(async () => {
      const localOk = logiStore.trySaveLanding(config);
      if (!(await isCloud())) {
        setSaveState(localOk ? 'saved' : 'full');
        return;
      }
      try {
        const res = await pushLanding(config);
        setCloudError(null);
        setSaveState('saved');
        // Uploaded images come back as URLs: swap them in so they aren't sent again.
        if (res && Object.keys(res.replaced).length) setConfig((c) => swapStrings(c, res.replaced));
      } catch (e: any) {
        setCloudError(e.message);
        setSaveState('cloud-error');
      }
    }, 1200);
    return () => clearTimeout(t);
  }, [config]);

  // ----- offers -----
  const countdown = { ...DEFAULT_COUNTDOWN, ...(config.countdown || {}) };
  const regularUnit = (() => {
    const c = config.combos[0];
    return c && c.regularPrice > c.promoPrice ? Math.round(c.regularPrice / c.units) : 0;
  })();
  const offers = config.combos.map((c) => ({ units: c.units, price: c.promoPrice, label: c.badge || '', popular: !!c.isPopular, selected: !!c.isDefault }));
  const applyOffers = (next: { units: number; price: number; label: string; popular: boolean; selected: boolean }[], unit = regularUnit) => {
    const sorted = [...next].sort((a, b) => a.units - b.units);
    const combos = buildCombos(sorted, unit, config.currency);
    const entry = combos[0];
    const promoPrice = entry?.promoPrice || 0;
    const regularPrice = entry?.regularPrice || promoPrice;
    const discount = Math.max(0, Math.round(((regularPrice - promoPrice) / (regularPrice || 1)) * 100));
    update({ combos, promoPrice, regularPrice, discountBadge: discount > 0 ? `-${discount}%` : '' });
  };
  // Keep empty/incomplete rows editable while typing: store drafts locally.
  const [offerDrafts, setOfferDrafts] = useState(() => offers.map((o) => ({ units: String(o.units), price: String(o.price), label: o.label, popular: o.popular, selected: o.selected })));
  const [unitDraft, setUnitDraft] = useState(regularUnit ? String(regularUnit) : '');
  const commitOffers = (drafts: typeof offerDrafts, unit = unitDraft) => {
    setOfferDrafts(drafts);
    const valid = drafts.map((o) => ({ units: Number(o.units) || 0, price: Number(o.price) || 0, label: o.label, popular: o.popular, selected: o.selected })).filter((o) => o.units > 0 && o.price > 0);
    if (valid.length) applyOffers(valid, Number(unit) || 0);
  };

  // ----- AI image generation (uses the configured image provider) -----
  const generateImage = useCallback(
    async (prompt: string, aspect: string) => {
      const ref = await compressImage(config.mainImage, 1024, 0.85);
      const small = await compressImage(config.mainImage, 500, 0.85);
      const res = await fetch('/api/landing/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: ref,
          referenceImage: small,
          prompt,
          aspectRatio: aspect,
          palette: `${d.primary}, ${d.accent}, ${d.dark}`,
          geminiApiKey: logiStore.getGeminiApiKey() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || `HTTP ${res.status}`);
      return compressImage(data.image, aspect === '16:9' ? 1600 : 1100, 0.8);
    },
    [config.mainImage, d.primary, d.accent, d.dark]
  );

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.origin + config.publishedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  // ---------------------------------------------------------------
  return (
    <div className="h-screen flex flex-col bg-slate-100">
      {/* Top bar */}
      <header className="h-14 flex-shrink-0 bg-white border-b border-slate-200 flex items-center gap-3 px-3 sm:px-4">
        <Link href="/landings" className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100" aria-label="Volver">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900 truncate">{config.productName}</div>
          <div className="text-[11px] text-slate-500 flex items-center gap-1">
            {saveState === 'saving' && (<><Loader2 className="w-3 h-3 animate-spin" /> Guardando…</>)}
            {saveState === 'saved' && (<><Check className="w-3 h-3 text-emerald-600" /> {cloudOn ? 'Guardado y publicado' : 'Guardado en este navegador'}</>)}
            {saveState === 'cloud-error' && (<span className="text-red-600 flex items-center gap-1" title={cloudError || ''}><AlertCircle className="w-3 h-3" /> No se pudo publicar en la nube</span>)}
            {saveState === 'full' && (<span className="text-red-600 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Sin espacio en el navegador: quita imágenes o borra landings antiguas</span>)}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <div className="hidden sm:flex items-center rounded-lg border border-slate-200 p-0.5">
            {(['desktop', 'mobile'] as const).map((dv) => (
              <button key={dv} onClick={() => setDevice(dv)} className={`h-8 w-9 rounded-md flex items-center justify-center ${device === dv ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900'}`} aria-label={dv === 'desktop' ? 'Vista escritorio' : 'Vista móvil'}>
                {dv === 'desktop' ? <Monitor className="w-4 h-4" /> : <Smartphone className="w-4 h-4" />}
              </button>
            ))}
          </div>
          <button onClick={copyLink} className="h-9 px-3 rounded-lg border border-slate-200 text-[13px] font-medium text-slate-700 hover:border-slate-300 inline-flex items-center gap-1.5">
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            <span className="hidden md:inline">{copied ? 'Copiado' : 'Copiar enlace'}</span>
          </button>
          <a href={config.publishedUrl} target="_blank" rel="noreferrer" className="h-9 px-3 rounded-lg bg-slate-900 text-white text-[13px] font-semibold inline-flex items-center gap-1.5 hover:bg-slate-800">
            <ExternalLink className="w-4 h-4" />
            <span className="hidden md:inline">Ver landing</span>
          </a>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        {/* Side panel */}
        <aside className="w-full sm:w-[400px] flex-shrink-0 bg-slate-50 border-r border-slate-200 flex flex-col min-h-0">
          <nav className="flex flex-wrap gap-1 p-2 border-b border-slate-200 bg-white">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-shrink-0 h-9 px-2.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 ${tab === t.id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                <t.icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            ))}
          </nav>

          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {tab === 'content' && (
              <>
                <p className="text-[11px] text-slate-500 px-1">Consejo: escribe <code>**palabra**</code> en un título para destacarla.</p>
                <Group title="Encabezado y caja de compra" defaultOpen>
                  <Text label="Marca o tienda (arriba a la izquierda)" value={s.brandName} onChange={(v) => updateSales({ brandName: v })} />
                  <Text label="Nombre del producto" value={config.productName} onChange={(v) => update({ productName: v, title: v })} />
                  <Text label="Etiqueta bajo el nombre" value={s.eyebrow} onChange={(v) => updateSales({ eyebrow: v })} />
                  <Text label="Descripción corta" value={config.subheadline} onChange={(v) => update({ subheadline: v })} multiline />
                  <Text label="Texto del botón" value={s.ctaText} onChange={(v) => updateSales({ ctaText: v })} />
                  <Text label="Barra superior" value={config.urgencyText} onChange={(v) => update({ urgencyText: v })} />
                  <div>
                    <span className="block text-xs font-semibold text-slate-700 mb-1">Ventajas en chips</span>
                    <div className="space-y-2">
                      {(s.featureChips || []).map((c, i, arr) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <IconSelect value={c.icon} onChange={(v) => updateSales({ featureChips: arr.map((x, j) => (j === i ? { ...x, icon: v } : x)) })} />
                          <input className={inputCls} value={c.text} onChange={(e) => updateSales({ featureChips: arr.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })} />
                          <RowTools onRemove={() => updateSales({ featureChips: arr.filter((_, j) => j !== i) })} />
                        </div>
                      ))}
                      {(s.featureChips || []).length < 4 && (
                        <button type="button" onClick={() => updateSales({ featureChips: [...(s.featureChips || []), { icon: 'Sparkles', text: '' }] })} className="text-xs font-semibold text-slate-700 inline-flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Añadir</button>
                      )}
                    </div>
                  </div>
                  <Text label="Detalles del producto (desplegable)" value={s.productDetails} onChange={(v) => updateSales({ productDetails: v })} multiline />
                  <Text label="Envío y pago (desplegable)" value={s.shippingInfo} onChange={(v) => updateSales({ shippingInfo: v })} multiline />
                  <Text label="WhatsApp" value={config.whatsappNumber} onChange={(v) => update({ whatsappNumber: v })} placeholder="+57 300 000 0000" />
                  <label className="text-sm text-slate-700 flex items-start gap-2">
                    <input type="checkbox" className="mt-1" checked={config.whatsappRedirect !== false} onChange={(e) => update({ whatsappRedirect: e.target.checked })} />
                    <span>
                      Al terminar el pedido, llevar al cliente a WhatsApp con sus datos
                      <span className="block text-xs text-slate-500">Se abre un chat con este número y el mensaje del pedido ya escrito.</span>
                    </span>
                  </label>
                </Group>

                <Group title="Pasos">
                  <Text label="Título de la sección" value={config.headline} onChange={(v) => update({ headline: v })} />
                  <Text label="Subtítulo" value={s.solutionText} onChange={(v) => updateSales({ solutionText: v })} multiline />
                  <Text label="Texto sobre la imagen" value={s.howItWorksTitle} onChange={(v) => updateSales({ howItWorksTitle: v })} />
                  {s.howItWorks.map((st, i, arr) => (
                    <div key={i} className="rounded-lg border border-slate-200 p-3 space-y-2 bg-slate-50/60">
                      <div className="flex items-center justify-between"><span className="text-xs font-semibold">Paso {i + 1}</span><RowTools onUp={i ? () => updateSales({ howItWorks: move(arr, i, -1) }) : undefined} onDown={i < arr.length - 1 ? () => updateSales({ howItWorks: move(arr, i, 1) }) : undefined} onRemove={() => updateSales({ howItWorks: arr.filter((_, j) => j !== i) })} /></div>
                      <input className={inputCls} value={st.title} onChange={(e) => updateSales({ howItWorks: arr.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })} placeholder="Título" />
                      <textarea className={`${inputCls} min-h-[56px]`} value={st.text} onChange={(e) => updateSales({ howItWorks: arr.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })} placeholder="Texto" />
                    </div>
                  ))}
                  <button type="button" onClick={() => updateSales({ howItWorks: [...s.howItWorks, { title: '', text: '' }] })} className="text-xs font-semibold text-slate-700 inline-flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Añadir paso</button>
                </Group>

                <Group title="Problema y solución">
                  <Text label="Pregunta (sobre la imagen)" value={s.painTitle} onChange={(v) => updateSales({ painTitle: v })} />
                  <Text label="Etiquetas de problema (separadas por coma)" value={(s.painTags || []).join(', ')} onChange={(v) => updateSales({ painTags: v.split(',').map((x) => x.trim()).filter(Boolean).slice(0, 3) })} />
                  <Text label="Problemas (uno por línea)" multiline value={s.painPoints.map((p) => p.title).join('\n')} onChange={(v) => updateSales({ painPoints: v.split('\n').map((t, i) => ({ icon: s.painPoints[i]?.icon || 'AlertTriangle', title: t, text: s.painPoints[i]?.text || '' })) })} />
                  {s.benefitBlocks[0] && (
                    <>
                      <Text label="Título de la solución" value={s.benefitBlocks[0].title} onChange={(v) => updateSales({ benefitBlocks: s.benefitBlocks.map((b, j) => (j === 0 ? { ...b, title: v } : b)) })} />
                      <Text label="Texto de la solución" multiline value={s.benefitBlocks[0].text} onChange={(v) => updateSales({ benefitBlocks: s.benefitBlocks.map((b, j) => (j === 0 ? { ...b, text: v } : b)) })} />
                      <Text label="Puntos (uno por línea)" multiline value={s.benefitBlocks[0].bullets.join('\n')} onChange={(v) => updateSales({ benefitBlocks: s.benefitBlocks.map((b, j) => (j === 0 ? { ...b, bullets: v.split('\n') } : b)) })} />
                    </>
                  )}
                </Group>

                <Group title="Franja de datos">
                  <Text label="Título" value={s.solutionTitle} onChange={(v) => updateSales({ solutionTitle: v })} />
                  {s.stats.map((st, i, arr) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <input className={`${inputCls} w-28`} value={st.value} onChange={(e) => updateSales({ stats: arr.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)) })} placeholder="30 días" />
                      <input className={inputCls} value={st.label} onChange={(e) => updateSales({ stats: arr.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} placeholder="de garantía" />
                      <RowTools onRemove={() => updateSales({ stats: arr.filter((_, j) => j !== i) })} />
                    </div>
                  ))}
                  <button type="button" onClick={() => updateSales({ stats: [...s.stats, { value: '', label: '' }] })} className="text-xs font-semibold text-slate-700 inline-flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Añadir dato</button>
                  <p className="text-[11px] text-slate-500">Usa datos reales de tu oferta (garantía, tiempo de entrega). No pongas cifras de clientes que no puedas demostrar.</p>
                </Group>

                <Group title="Bloques de beneficio">
                  {s.benefitBlocks.slice(1).map((b, k) => {
                    const i = k + 1;
                    const set = (patch: Partial<typeof b>) => updateSales({ benefitBlocks: s.benefitBlocks.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
                    return (
                      <div key={i} className="rounded-lg border border-slate-200 p-3 space-y-2 bg-slate-50/60">
                        <div className="flex items-center justify-between"><span className="text-xs font-semibold">Bloque {k + 1}</span><RowTools onRemove={() => updateSales({ benefitBlocks: s.benefitBlocks.filter((_, j) => j !== i) })} /></div>
                        <input className={inputCls} value={b.title} onChange={(e) => set({ title: e.target.value })} placeholder="Título" />
                        <textarea className={`${inputCls} min-h-[56px]`} value={b.text} onChange={(e) => set({ text: e.target.value })} placeholder="Texto" />
                        <textarea className={`${inputCls} min-h-[56px]`} value={b.bullets.join('\n')} onChange={(e) => set({ bullets: e.target.value.split('\n') })} placeholder="Puntos (uno por línea)" />
                      </div>
                    );
                  })}
                  <button type="button" onClick={() => updateSales({ benefitBlocks: [...s.benefitBlocks, { title: '', text: '', bullets: [] }] })} className="text-xs font-semibold text-slate-700 inline-flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Añadir bloque</button>
                </Group>

                <Group title="Producto en el centro (4 ventajas)">
                  {config.benefits.map((b, i, arr) => {
                    const set = (patch: Partial<BenefitItem>) => update({ benefits: arr.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
                    return (
                      <div key={b.id} className="rounded-lg border border-slate-200 p-3 space-y-2 bg-slate-50/60">
                        <div className="flex items-center gap-1.5">
                          <IconSelect value={b.icon} onChange={(v) => set({ icon: v })} />
                          <input className={inputCls} value={b.title} onChange={(e) => set({ title: e.target.value })} placeholder="Título" />
                          <RowTools onRemove={() => update({ benefits: arr.filter((_, j) => j !== i) })} />
                        </div>
                        <textarea className={`${inputCls} min-h-[48px]`} value={b.description} onChange={(e) => set({ description: e.target.value })} placeholder="Descripción" />
                      </div>
                    );
                  })}
                  {config.benefits.length < 4 && (
                    <button type="button" onClick={() => update({ benefits: [...config.benefits, { id: uid('b'), icon: 'Sparkles', title: '', description: '' }] })} className="text-xs font-semibold text-slate-700 inline-flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Añadir ventaja</button>
                  )}
                </Group>

                <Group title="Comparación">
                  <Text label="Título" value={s.comparisonTitle} onChange={(v) => updateSales({ comparisonTitle: v })} />
                  {s.comparison.map((r, i, arr) => (
                    <div key={i} className="rounded-lg border border-slate-200 p-2 space-y-1.5 bg-slate-50/60">
                      <div className="flex items-center gap-1.5">
                        <input className={inputCls} value={r.feature} onChange={(e) => updateSales({ comparison: arr.map((x, j) => (j === i ? { ...x, feature: e.target.value } : x)) })} placeholder="Característica" />
                        <RowTools onRemove={() => updateSales({ comparison: arr.filter((_, j) => j !== i) })} />
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <input className={inputCls} value={r.us} onChange={(e) => updateSales({ comparison: arr.map((x, j) => (j === i ? { ...x, us: e.target.value } : x)) })} placeholder="Nosotros" />
                        <input className={inputCls} value={r.others} onChange={(e) => updateSales({ comparison: arr.map((x, j) => (j === i ? { ...x, others: e.target.value } : x)) })} placeholder="Otros" />
                      </div>
                    </div>
                  ))}
                  <button type="button" onClick={() => updateSales({ comparison: [...s.comparison, { feature: '', us: '', others: '' }] })} className="text-xs font-semibold text-slate-700 inline-flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Añadir fila</button>
                </Group>

                <Group title="Cierre">
                  <Text label="Título final" value={s.finalCtaTitle} onChange={(v) => updateSales({ finalCtaTitle: v })} />
                  <Text label="Texto final" value={s.finalCtaText} onChange={(v) => updateSales({ finalCtaText: v })} multiline />
                </Group>
              </>
            )}

            {tab === 'offers' && (
              <>
                <Group title="Ofertas" defaultOpen>
                  <Field label={`Precio normal por unidad (${config.currency}, opcional)`} hint="Se muestra tachado. Déjalo vacío si no hay descuento.">
                    <input className={inputCls} inputMode="numeric" value={unitDraft} onChange={(e) => { const v = e.target.value.replace(/\D/g, ''); setUnitDraft(v); commitOffers(offerDrafts, v); }} />
                  </Field>
                  <div className="space-y-2">
                    {offerDrafts.map((o, i) => (
                      <div key={i} className="rounded-lg border border-slate-200 p-3 bg-slate-50/60 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                            <label className="text-xs font-semibold inline-flex items-center gap-1.5" title="Lleva la etiqueta resaltada con el color principal">
                              <input type="radio" name="popular" checked={o.popular} onChange={() => commitOffers(offerDrafts.map((x, j) => ({ ...x, popular: j === i })))} className="accent-slate-900" />
                              Destacada
                            </label>
                            <label className="text-xs font-semibold inline-flex items-center gap-1.5" title="Esta oferta aparece marcada cuando el cliente abre la página">
                              <input type="radio" name="selected" checked={o.selected} onChange={() => commitOffers(offerDrafts.map((x, j) => ({ ...x, selected: j === i })))} className="accent-slate-900" />
                              Seleccionada al abrir
                            </label>
                          </div>
                          <RowTools onRemove={offerDrafts.length > 1 ? () => commitOffers(offerDrafts.filter((_, j) => j !== i)) : undefined} />
                        </div>
                        <div className="grid grid-cols-[80px_1fr] gap-2">
                          <Field label="Unidades"><input className={inputCls} inputMode="numeric" value={o.units} onChange={(e) => commitOffers(offerDrafts.map((x, j) => (j === i ? { ...x, units: e.target.value.replace(/\D/g, '') } : x)))} /></Field>
                          <Field label={`Precio total (${config.currency})`}><input className={inputCls} inputMode="numeric" value={o.price} onChange={(e) => commitOffers(offerDrafts.map((x, j) => (j === i ? { ...x, price: e.target.value.replace(/\D/g, '') } : x)))} /></Field>
                        </div>
                        <Field label="Etiqueta (opcional)"><input className={inputCls} value={o.label} placeholder="Ej. Más vendido" onChange={(e) => commitOffers(offerDrafts.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} /></Field>
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={() => { const last = Number(offerDrafts[offerDrafts.length - 1]?.units) || 0; setOfferDrafts([...offerDrafts, { units: last ? String(last * 2) : '', price: '', label: '', popular: false, selected: false }]); }} className="text-xs font-semibold text-slate-700 inline-flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Añadir oferta</button>
                  <p className="text-[11px] text-slate-500">
                    La oferta con menos unidades es la compra mínima y su precio aparece arriba. Si no marcas ninguna como &quot;Seleccionada al abrir&quot;, se selecciona la destacada.
                  </p>
                </Group>
                <Group title="Contador de oferta" defaultOpen>
                  <label className="text-sm text-slate-700 flex items-center gap-2">
                    <input type="checkbox" checked={countdown.enabled} onChange={(e) => update({ countdown: { ...countdown, enabled: e.target.checked } })} />
                    Mostrar contador regresivo
                  </label>
                  {countdown.enabled && (
                    <>
                      <Field label="Cómo funciona">
                        <select className={inputCls} value={countdown.mode} onChange={(e) => update({ countdown: { ...countdown, mode: e.target.value as 'daily' | 'visitor' } })}>
                          <option value="daily">Termina cada día a medianoche y vuelve a empezar</option>
                          <option value="visitor">Dura unas horas por visitante y vuelve a empezar</option>
                        </select>
                      </Field>
                      {countdown.mode === 'visitor' && (
                        <Field label="Horas" hint="Se cuenta desde la primera visita de cada persona. Recargar la página no lo reinicia; al terminar, empieza otra vez.">
                          <input className={inputCls} inputMode="numeric" value={String(countdown.hours || '')} onChange={(e) => update({ countdown: { ...countdown, hours: Math.min(168, Number(e.target.value.replace(/\D/g, '')) || 0) } })} />
                        </Field>
                      )}
                      <Text label="Texto sobre el contador" value={countdown.text} onChange={(v) => update({ countdown: { ...countdown, text: v } })} placeholder="🔥 Oferta por tiempo limitado. Termina en:" />
                      <p className="text-[11px] text-slate-500">Aparece junto a las ofertas y en el formulario de pedido.</p>
                    </>
                  )}
                </Group>
                <Group title="Envío y garantía" defaultOpen>
                  <Text label="Texto de envío" value={config.shippingCostText} onChange={(v) => update({ shippingCostText: v })} placeholder="Envío gratis" />
                  <Field label="Días de garantía"><input className={inputCls} inputMode="numeric" value={String(config.guaranteeDays || '')} onChange={(e) => update({ guaranteeDays: Number(e.target.value.replace(/\D/g, '')) || 0 })} /></Field>
                  <Text label="Texto de la garantía" value={config.guaranteeText} onChange={(v) => update({ guaranteeText: v })} multiline />
                </Group>
              </>
            )}

            {tab === 'images' && (
              <>
                <p className="text-[11px] text-slate-500 px-1">“Generar con IA” usa tu proveedor de imágenes configurado (ahora nano-banana) con la foto principal como referencia.</p>
                <Group title="Foto principal y galería" defaultOpen>
                  <ImageSlot label="Foto principal del producto" src={config.mainImage} onChange={(v) => v && update({ mainImage: v })} />
                  {(config.galleryImages || []).map((g, i, arr) => (
                    <div key={i} className="flex items-center gap-2">
                      <img src={g} alt="" className="w-14 h-14 rounded-lg object-cover bg-slate-100" />
                      <span className="flex-1 text-xs text-slate-600">Galería {i + 1}</span>
                      <RowTools onUp={i ? () => update({ galleryImages: move(arr, i, -1) }) : undefined} onDown={i < arr.length - 1 ? () => update({ galleryImages: move(arr, i, 1) }) : undefined} onRemove={() => update({ galleryImages: arr.filter((_, j) => j !== i) })} />
                    </div>
                  ))}
                  <ImageSlot label="Añadir a la galería" onChange={(v) => v && update({ galleryImages: [...(config.galleryImages || []), v] })} aspect="1:1" aiPrompt="the product on a clean surface, soft natural light, premium e-commerce photo" generate={generateImage} />
                </Group>
                <Group title="Imágenes de las secciones" defaultOpen>
                  <ImageSlot label="Sección de pasos" src={s.solutionImage} onChange={(v) => updateSales({ solutionImage: v })} aspect="4:3" aiPrompt="a person using the product in an everyday moment, warm realistic lifestyle photo" generate={generateImage} />
                  <ImageSlot label="Tarjeta de problema" src={s.painImage} onChange={(v) => updateSales({ painImage: v })} aspect="3:4" aiPrompt="close-up of the product in use, natural light" generate={generateImage} />
                  {s.benefitBlocks.slice(1).map((b, k) => (
                    <ImageSlot
                      key={k}
                      label={`Bloque de beneficio ${k + 1}`}
                      src={b.image}
                      onChange={(v) => updateSales({ benefitBlocks: s.benefitBlocks.map((x, j) => (j === k + 1 ? { ...x, image: v } : x)) })}
                      aspect="4:3"
                      aiPrompt={`scene that shows: ${b.title.replace(/\*\*/g, '')}`}
                      generate={generateImage}
                    />
                  ))}
                </Group>
              </>
            )}

            {tab === 'reviews' && (
              <Group title="Reseñas de clientes" defaultOpen>
                <p className="text-[11px] text-slate-500">Añade solo reseñas reales. Las estrellas de arriba se calculan con estas reseñas; si no hay ninguna, no se muestran.</p>
                {config.reviews.map((r, i, arr) => {
                  const set = (patch: Partial<ReviewItem>) => update({ reviews: arr.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
                  return (
                    <div key={r.id} className="rounded-lg border border-slate-200 p-3 space-y-2 bg-slate-50/60">
                      <div className="flex items-center gap-1.5">
                        <input className={inputCls} value={r.author} onChange={(e) => set({ author: e.target.value })} placeholder="Nombre" />
                        <RowTools onRemove={() => update({ reviews: arr.filter((_, j) => j !== i) })} />
                      </div>
                      <div className="flex items-center gap-2">
                        <input className={inputCls} value={r.location} onChange={(e) => set({ location: e.target.value })} placeholder="Ciudad" />
                        <div className="flex">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <button key={n} type="button" onClick={() => set({ rating: n })} aria-label={`${n} estrellas`}>
                              <Star className={`w-5 h-5 ${n <= r.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
                            </button>
                          ))}
                        </div>
                      </div>
                      <textarea className={`${inputCls} min-h-[64px]`} value={r.comment} onChange={(e) => set({ comment: e.target.value })} placeholder="Comentario del cliente" />
                      <label className="text-xs text-slate-600 inline-flex items-center gap-1.5">
                        <input type="checkbox" checked={r.verifiedPurchase} onChange={(e) => set({ verifiedPurchase: e.target.checked })} /> Compra verificada
                      </label>
                    </div>
                  );
                })}
                <button type="button" onClick={() => update({ reviews: [...config.reviews, { id: uid('rev'), author: '', location: '', rating: 5, comment: '', verifiedPurchase: true, date: new Date().toISOString().slice(0, 10) }] })} className="text-xs font-semibold text-slate-700 inline-flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Añadir reseña</button>
              </Group>
            )}

            {tab === 'faq' && (
              <Group title="Preguntas frecuentes" defaultOpen>
                {config.faqs.map((f, i, arr) => {
                  const set = (patch: Partial<FAQItem>) => update({ faqs: arr.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
                  return (
                    <div key={f.id} className="rounded-lg border border-slate-200 p-3 space-y-2 bg-slate-50/60">
                      <div className="flex items-center gap-1.5">
                        <input className={inputCls} value={f.question} onChange={(e) => set({ question: e.target.value })} placeholder="Pregunta" />
                        <RowTools onUp={i ? () => update({ faqs: move(arr, i, -1) }) : undefined} onDown={i < arr.length - 1 ? () => update({ faqs: move(arr, i, 1) }) : undefined} onRemove={() => update({ faqs: arr.filter((_, j) => j !== i) })} />
                      </div>
                      <textarea className={`${inputCls} min-h-[64px]`} value={f.answer} onChange={(e) => set({ answer: e.target.value })} placeholder="Respuesta" />
                    </div>
                  );
                })}
                <button type="button" onClick={() => update({ faqs: [...config.faqs, { id: uid('faq'), question: '', answer: '' }] })} className="text-xs font-semibold text-slate-700 inline-flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Añadir pregunta</button>
              </Group>
            )}

            {tab === 'design' && (
              <>
                <Group title="Paletas rápidas" defaultOpen>
                  <div className="grid grid-cols-5 gap-2">
                    {PALETTES.map((p) => (
                      <button key={p.name} type="button" onClick={() => updateDesign(p.d)} className="rounded-lg border border-slate-200 p-1.5 hover:border-slate-400 text-[10.5px] font-medium text-slate-600">
                        <span className="flex h-6 rounded overflow-hidden mb-1">
                          {[p.d.primary, p.d.accent, p.d.dark, p.d.light].map((c) => (<span key={c} className="flex-1" style={{ background: c }} />))}
                        </span>
                        {p.name}
                      </button>
                    ))}
                  </div>
                </Group>
                <Group title="Colores" defaultOpen>
                  {([
                    ['primary', 'Botón principal'],
                    ['accent', 'Acento (etiquetas)'],
                    ['dark', 'Texto y franja oscura'],
                    ['light', 'Fondo suave'],
                  ] as const).map(([k, l]) => (
                    <Field key={k} label={l}>
                      <div className="flex items-center gap-2">
                        <input type="color" value={d[k]} onChange={(e) => updateDesign({ [k]: e.target.value } as Partial<LandingDesign>)} className="w-10 h-10 rounded-lg border border-slate-300 bg-white p-0.5" />
                        <input className={inputCls} value={d[k]} onChange={(e) => /^#[0-9a-f]{0,6}$/i.test(e.target.value) && updateDesign({ [k]: e.target.value } as Partial<LandingDesign>)} />
                      </div>
                    </Field>
                  ))}
                  <Field label="Estilo de los títulos">
                    <select className={inputCls} value={d.vibe} onChange={(e) => updateDesign({ vibe: e.target.value as LandingDesign['vibe'] })}>
                      <option value="bold">Moderno</option>
                      <option value="fresh">Fresco</option>
                      <option value="tech">Tecnológico</option>
                      <option value="warm">Cálido (serif)</option>
                      <option value="luxury">Elegante (serif)</option>
                    </select>
                  </Field>
                </Group>
                <Group title="Opciones">
                  <label className="text-sm text-slate-700 flex items-center gap-2">
                    <input type="checkbox" checked={config.enableStickyBar !== false} onChange={(e) => update({ enableStickyBar: e.target.checked })} /> Barra fija de compra en móvil
                  </label>
                </Group>
              </>
            )}

            {tab === 'seo' && (
              <>
              <Group title="Píxel de Meta (Facebook / Instagram Ads)" defaultOpen>
                <Field
                  label="ID del píxel"
                  hint="Envía PageView y ViewContent al abrir la landing, InitiateCheckout al abrir el formulario y Purchase (con valor y moneda) al confirmar el pedido. En el editor no se envía nada."
                >
                  <input className={inputCls} inputMode="numeric" value={config.metaPixelId || ''} placeholder="Ej. 123456789012345" onChange={(e) => update({ metaPixelId: e.target.value.replace(/\D/g, '') })} />
                </Field>
                {config.metaPixelId && !/^\d{10,20}$/.test(config.metaPixelId) && (
                  <p className="text-[11px] text-red-600">El ID del píxel suele tener 15 o 16 números.</p>
                )}
              </Group>
              <Group title="Buscadores y enlace" defaultOpen>
                <Text label="Título para Google" value={config.seoTitle} onChange={(v) => update({ seoTitle: v })} />
                <Text label="Descripción para Google" value={config.seoDescription} onChange={(v) => update({ seoDescription: v })} multiline />
                <Field label="Enlace público">
                  <div className="text-xs text-slate-600 bg-white border border-slate-200 rounded-lg px-3 py-2 break-all">{config.publishedUrl}</div>
                </Field>
              </Group>
              </>
            )}

            <div className="h-6" />
          </div>
        </aside>

        {/* Live preview */}
        <main className="hidden sm:flex flex-1 min-w-0 items-start justify-center overflow-hidden p-4">
          <div
            className={`h-full bg-white shadow-xl overflow-hidden transition-all ${device === 'mobile' ? 'w-[390px] rounded-[2rem] border-[10px] border-slate-900' : 'w-full rounded-xl border border-slate-200'}`}
          >
            <iframe ref={iframeRef} src={`/landings/preview/${config.id}`} title="Vista previa" className="w-full h-full" onLoad={postPreview} />
          </div>
        </main>
      </div>
    </div>
  );
}

