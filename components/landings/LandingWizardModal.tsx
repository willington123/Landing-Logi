'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  Sparkles,
  Upload,
  ImagePlus,
  Key,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Circle,
  ExternalLink,
  PenSquare,
  RotateCcw,
  Trash2,
  Wand2,
  Eye,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { logiStore } from '@/lib/store';
import { ImpactStyle, LandingPageConfig } from '@/lib/types';
import { IMPACT_STYLES, heroAspect } from '@/lib/landing-styles';
import { buildSalesLanding, GeneratedCopy, GeneratedImages } from '@/lib/landing-ai';
import { compressImage, fileToDataUrl } from '@/lib/image-utils';
import { pushLanding } from '@/lib/cloud';

interface LandingWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerated?: (landing: LandingPageConfig) => void;
}

const COUNTRIES = [
  { name: 'Colombia', currency: 'COP' },
  { name: 'México', currency: 'MXN' },
  { name: 'Perú', currency: 'PEN' },
  { name: 'Chile', currency: 'CLP' },
  { name: 'Ecuador', currency: 'USD' },
  { name: 'Guatemala', currency: 'GTQ' },
  { name: 'España', currency: 'EUR' },
];

const TONES = [
  { id: 'persuasivo, cercano y directo', label: 'Cercano' },
  { id: 'urgente, enérgico y de alto impacto', label: 'Impacto' },
  { id: 'elegante, premium y aspiracional', label: 'Premium' },
  { id: 'experto, técnico y confiable', label: 'Experto' },
];

interface OfferDraft {
  units: string;
  price: string;
  label: string;
}

type TaskState = 'pending' | 'running' | 'done' | 'error';
interface Task {
  key: string;
  label: string;
  state: TaskState;
  preview?: string;
  error?: string;
}

async function postJSON(url: string, body: unknown) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({ success: false, error: `HTTP ${res.status}` }));
  if (!res.ok || !data.success) {
    throw Object.assign(new Error(data.error || `HTTP ${res.status}`), { code: data.code as string | undefined });
  }
  return data;
}

// Runs async jobs with a concurrency limit (free Gemini keys have low rate limits).
async function runPool<T>(jobs: (() => Promise<T>)[], limit: number) {
  const queue = [...jobs];
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length) await queue.shift()!();
  });
  await Promise.all(workers);
}

export default function LandingWizardModal({ isOpen, onClose, onGenerated }: LandingWizardModalProps) {
  const router = useRouter();
  const mainInput = useRef<HTMLInputElement>(null);
  const extraInput = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<'form' | 'generating' | 'done'>('form');
  const [error, setError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [result, setResult] = useState<LandingPageConfig | null>(null);
  const [imageNotice, setImageNotice] = useState<string | null>(null);

  // Form
  const [productImage, setProductImage] = useState('');
  const [extraImages, setExtraImages] = useState<string[]>([]);
  const [productName, setProductName] = useState('');
  const [description, setDescription] = useState('');
  const [audience, setAudience] = useState('');
  const [brandName, setBrandName] = useState('');
  const [regularPrice, setRegularPrice] = useState('');
  const [offers, setOffers] = useState<OfferDraft[]>([{ units: '1', price: '', label: '' }]);
  const [popularIdx, setPopularIdx] = useState(0);
  const [country, setCountry] = useState('Colombia');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [shippingType, setShippingType] = useState<'free' | 'calculated'>('free');
  const [guaranteeDays, setGuaranteeDays] = useState('30');
  const [tone, setTone] = useState(TONES[0].id);
  const [withImages, setWithImages] = useState(true);
  // "sections" = the page is a column of designed graphics (Claude art-directs, Nano Banana draws).
  // "impact" = "Impacto Premium": dark, high-contrast sales page made to convert (real texts, AI pictures).
  const [style] = useState<'impact' | 'sections' | 'web'>('impact');
  // Look of the page (Impacto, Explosivo, Lujo Noir, Clínico, Neón) and the sample being previewed.
  const [impactStyle, setImpactStyle] = useState<ImpactStyle>('impact');
  const [sample, setSample] = useState<ImpactStyle | null>(null);
  const [sampleView, setSampleView] = useState<'desktop' | 'phone'>('desktop');
  const [reviewsText, setReviewsText] = useState('');
  const [reviewShots, setReviewShots] = useState<string[]>([]);
  const reviewInput = useRef<HTMLInputElement>(null);
  const [apiKey, setApiKey] = useState('');
  const [serverKey, setServerKey] = useState(false);
  const [claudeWrites, setClaudeWrites] = useState(false);

  const currency = COUNTRIES.find((c) => c.name === country)?.currency || 'COP';

  useEffect(() => {
    if (!isOpen) return;
    setApiKey(logiStore.getGeminiApiKey());
    const st = logiStore.getStoreSettings();
    setBrandName((v) => v || st.storeName);
    setWhatsappNumber((v) => v || st.supportPhone);
    setGuaranteeDays((v) => (v && v !== '30' ? v : String(st.guaranteeDays || 30)));
    fetch('/api/landing/generate')
      .then((r) => r.json())
      .then((d) => {
        setServerKey(Boolean(d.serverKey));
        setClaudeWrites(Boolean(d.claude));
      })
      .catch(() => setServerKey(false));
  }, [isOpen]);

  if (!isOpen) return null;

  const updateTask = (key: string, patch: Partial<Task>) =>
    setTasks((prev) => prev.map((t) => (t.key === key ? { ...t, ...patch } : t)));

  const handleMainFile = async (file?: File) => {
    if (!file) return;
    try {
      setProductImage(await compressImage(await fileToDataUrl(file), 1280, 0.85));
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleExtraFiles = async (files: FileList | null) => {
    if (!files) return;
    const list = await Promise.all(
      Array.from(files)
        .slice(0, 3)
        .map(async (f) => compressImage(await fileToDataUrl(f), 1024, 0.8))
    );
    setExtraImages((prev) => [...prev, ...list].slice(0, 3));
  };

  const handleReviewShots = async (files: FileList | null) => {
    if (!files) return;
    const list = await Promise.all(
      Array.from(files)
        .slice(0, 4)
        .map(async (f) => compressImage(await fileToDataUrl(f), 900, 0.8))
    );
    setReviewShots((prev) => [...prev, ...list].slice(0, 4));
  };

  const handleGenerate = async () => {
    setError(null);
    if (!productImage) return setError('Sube la foto principal del producto.');
    const regularUnit = Number(regularPrice) || 0;
    const offerList = offers
      .map((o, i) => ({ units: Number(o.units) || 0, price: Number(o.price) || 0, label: o.label.trim(), popular: i === popularIdx }))
      .filter((o) => o.units > 0 && o.price > 0)
      .sort((a, b) => a.units - b.units);
    if (!offerList.length) return setError('Añade al menos una oferta con unidades y precio.');
    const promo = offerList[0].price;
    const regular = regularUnit > 0 ? regularUnit * offerList[0].units : promo;
    if (!serverKey && !apiKey.trim()) return setError('Introduce tu API Key de Google Gemini.');
    if (apiKey.trim()) logiStore.saveGeminiApiKey(apiKey);

    const baseTasks: Task[] = [{ key: 'copy', label: claudeWrites ? 'Claude está analizando la foto y escribiendo la página' : 'Analizando la foto y escribiendo la página', state: 'running' }];
    const sectionsMode = style === 'sections';
    const impactMode = style === 'impact';
    if (impactMode) {
      baseTasks.push({ key: 'ihero', label: 'Foto de portada (persona con el producto)', state: 'pending' });
      for (const o of offerList.slice(0, 3)) baseTasks.push({ key: `ipack${o.units}`, label: `Foto del paquete de ${o.units} ${o.units === 1 ? 'unidad' : 'unidades'}`, state: 'pending' });
      for (let i = 0; i < 4; i++) baseTasks.push({ key: `iing${i}`, label: `Foto de ingrediente ${i + 1}`, state: 'pending' });
    }
    if (!sectionsMode && !impactMode && withImages) {
      baseTasks.push(
        { key: 'hero', label: 'Imagen principal (banner)', state: 'pending' },
        { key: 'solution', label: 'Escena de uso con persona', state: 'pending' },
        { key: 'b0', label: 'Imagen beneficio 1', state: 'pending' },
        { key: 'b1', label: 'Imagen beneficio 2', state: 'pending' },
        { key: 'b2', label: 'Imagen beneficio 3', state: 'pending' }
      );
    }
    setTasks(baseTasks);
    setImageNotice(null);
    setPhase('generating');

    const common = { geminiApiKey: apiKey.trim() || undefined };

    // 1. Copy, structure and palette
    let copy: GeneratedCopy;
    try {
      const data = await postJSON('/api/landing/generate', {
        ...common,
        imageBase64: productImage,
        extraImages,
        productName,
        brandName: brandName.trim(),
        description,
        audience,
        regularPrice: regular,
        promoPrice: promo,
        offers: offerList,
        currency,
        country,
        shippingType,
        guaranteeDays: Number(guaranteeDays) || 30,
        tone,
        regularUnitPrice: regularUnit,
        ...(sectionsMode ? { mode: 'sections', reviews: reviewsText.trim().slice(0, 2000), reviewImagesCount: reviewShots.length } : {}),
        ...(impactMode ? { mode: 'impact', impactStyle } : {}),
      });
      copy = data.copy;
      updateTask('copy', { state: 'done', label: `${data.writer === 'claude' ? 'Claude escribió la página' : 'Textos listos'}: “${copy.headline.replace(/\*\*/g, '')}”` });
    } catch (e: any) {
      setError(`No se pudo generar la página: ${e.message}`);
      setPhase('form');
      return;
    }

    // 2. Scene images (optional, failures are not fatal)
    const images: GeneratedImages = { benefits: [] };
    if (sectionsMode && copy.sections?.length) {
      // 2b. One designed graphic per section, all with the same art direction.
      const sections = copy.sections;
      images.sections = [];
      const kindLabel: Record<string, string> = { hero: 'Portada', offer: 'Oferta', problem: 'Problema', benefits: 'Beneficios', features: 'Características', how_to: 'Cómo se usa', comparison: 'Comparación', testimonials: 'Opiniones reales', guarantee: 'Garantía', shipping: 'Envío y pago', cta: 'Llamado final' };
      setTasks((prev) => [...prev, ...sections.map((x, i) => ({ key: `s${i}`, label: `Sección ${i + 1}: ${kindLabel[x.kind] || x.kind}`, state: 'pending' as const }))]);
      const referenceImage = await compressImage(productImage, 500, 0.85);
      let noImageQuota = false;
      await runPool(
        sections.map((x, i) => async () => {
          const key = `s${i}`;
          if (noImageQuota) return updateTask(key, { state: 'error', error: 'tu plan de Gemini no incluye imágenes' });
          updateTask(key, { state: 'running' });
          try {
            const data = await postJSON('/api/landing/image', {
              ...common,
              mode: 'design',
              imageBase64: productImage,
              referenceImage,
              prompt: x.prompt,
              artDirection: copy.concept?.artDirection,
              aspectRatio: x.aspect,
              extraImages: x.useReviewImages ? reviewShots : undefined,
            });
            const small = await compressImage(data.image, 1080, 0.82);
            images.sections![i] = small;
            updateTask(key, { state: 'done', preview: small });
          } catch (e: any) {
            if (e.code === 'no_image_quota') {
              noImageQuota = true;
              setImageNotice(e.message);
            }
            updateTask(key, { state: 'error', error: e.code === 'no_image_quota' ? 'tu plan de Gemini no incluye imágenes' : e.message });
          }
        }),
        2
      );
      if (!images.sections.some(Boolean)) setImageNotice((n) => n || 'No se pudo dibujar ninguna sección; la página se armó con el diseño web.');
    } else if (impactMode && copy.impact) {
      // 2c. "Impacto Premium": cover with a person and the product, one pack shot per offer, ingredients.
      const ic = copy.impact;
      const palette = `${copy.design.primary}, ${copy.design.accent}, ${copy.design.dark}`;
      const referenceImage = await compressImage(productImage, 500, 0.85);
      images.packs = {};
      images.ingredients = [];
      const jobs: { key: string; body: Record<string, unknown>; max: number; set: (img: string) => void }[] = [
        { key: 'ihero', body: { prompt: ic.heroImagePrompt, aspectRatio: heroAspect(impactStyle) }, max: 1600, set: (i) => (images.impactHero = i) },
        ...offerList.slice(0, 3).map((o) => ({ key: `ipack${o.units}`, body: { mode: 'pack', units: o.units, prompt: ic.packImagePrompt, aspectRatio: '1:1' }, max: 700, set: (i: string) => (images.packs![String(o.units)] = i) })),
        ...(ic.ingredients || []).slice(0, 4).map((x, idx) => ({ key: `iing${idx}`, body: { mode: 'ingredient', prompt: x.imagePrompt || x.name, aspectRatio: '1:1' }, max: 400, set: (i: string) => (images.ingredients![idx] = i) })),
      ];
      let noImageQuota = false;
      await runPool(
        jobs.map((job) => async () => {
          if (noImageQuota) return updateTask(job.key, { state: 'error', error: 'tu plan de Gemini no incluye imágenes' });
          updateTask(job.key, { state: 'running' });
          try {
            const data = await postJSON('/api/landing/image', { ...common, imageBase64: productImage, referenceImage, palette, ...job.body });
            const small = await compressImage(data.image, job.max, 0.82);
            job.set(small);
            updateTask(job.key, { state: 'done', preview: small });
          } catch (e: any) {
            if (e.code === 'no_image_quota') {
              noImageQuota = true;
              setImageNotice(e.message);
            }
            updateTask(job.key, { state: 'error', error: e.code === 'no_image_quota' ? 'tu plan de Gemini no incluye imágenes' : e.message });
          }
        }),
        3
      );
    } else if (!sectionsMode && withImages) {
      const palette = `${copy.design.primary}, ${copy.design.accent}, ${copy.design.dark}`;
      // Cloudflare's FLUX.2 needs a reference under 512x512.
      const referenceImage = await compressImage(productImage, 500, 0.85);
      const jobs: { key: string; prompt: string; aspect: string; set: (img: string) => void }[] = [
        { key: 'hero', prompt: copy.heroImagePrompt, aspect: '16:9', set: (i) => (images.hero = i) },
        { key: 'solution', prompt: copy.solutionImagePrompt, aspect: '4:3', set: (i) => (images.solution = i) },
        ...copy.benefitBlocks.slice(0, 3).map((b, idx) => ({
          key: `b${idx}`,
          prompt: b.imagePrompt,
          aspect: '1:1',
          set: (i: string) => (images.benefits[idx] = i),
        })),
      ];
      let noImageQuota = false;
      await runPool(
        jobs.map((job) => async () => {
          if (noImageQuota) {
            updateTask(job.key, { state: 'error', error: 'tu plan de Gemini no incluye imágenes' });
            return;
          }
          updateTask(job.key, { state: 'running' });
          try {
            const data = await postJSON('/api/landing/image', {
              ...common,
              imageBase64: productImage,
              referenceImage,
              prompt: job.prompt,
              aspectRatio: job.aspect,
              palette,
            });
            const small = await compressImage(data.image, job.aspect === '16:9' ? 1600 : 1100, 0.8);
            job.set(small);
            updateTask(job.key, { state: 'done', preview: small });
          } catch (e: any) {
            if (e.code === 'no_image_quota') {
              noImageQuota = true;
              setImageNotice(e.message);
              updateTask(job.key, { state: 'error', error: 'tu plan de Gemini no incluye imágenes' });
            } else {
              updateTask(job.key, { state: 'error', error: e.message });
            }
          }
        }),
        2
      );
    }

    // 3. Assemble and save
    const landing = buildSalesLanding(
      copy,
      {
        productName,
        brandName: brandName.trim(),
        productImage,
        extraImages,
        regularUnitPrice: regularUnit,
        offers: offerList,
        currency,
        country,
        whatsappNumber,
        shippingType,
        guaranteeDays: Number(guaranteeDays) || 30,
      },
      images
    );
    if (impactMode) {
      // Only the seller's real reviews ("Nombre, Ciudad: texto"), without invented stars.
      landing.reviews = reviewsText
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 3)
        .slice(0, 6)
        .map((l, i) => {
          const m = /^([^:]{2,60}):\s*(.+)$/.exec(l);
          const [who, where] = (m ? m[1] : 'Cliente').split(',').map((x) => x.trim());
          return { id: `r-${i}-${Date.now()}`, author: who || 'Cliente', location: where || '', rating: 0, comment: (m ? m[2] : l).replace(/^["“]|["”]$/g, ''), verifiedPurchase: true, date: '' };
        });
      // The offer timer is on (it restarts every night); the seller can turn it off in the editor.
      landing.countdown = { enabled: true, mode: 'daily', hours: 24, text: 'Termina en' };
      if (landing.impact) landing.impact.style = impactStyle;
    }
    const pixel = logiStore.getStoreSettings().metaPixelId;
    if (pixel) landing.metaPixelId = pixel;
    logiStore.saveLanding(landing);
    if (!logiStore.getLandingBySlug(landing.slug)) {
      setError(
        'La landing se generó pero el navegador no tiene espacio para guardarla. Borra landings antiguas e inténtalo de nuevo.'
      );
      setPhase('form');
      return;
    }
    // Publish to Supabase (when configured) so the link works for everyone.
    let finalLanding = landing;
    try {
      const cloud = await pushLanding(landing);
      if (cloud) {
        finalLanding = cloud.landing;
        logiStore.saveLanding(finalLanding);
      }
    } catch (e: any) {
      setImageNotice(`La landing se guardó en este navegador, pero no se pudo publicar en la nube: ${e.message}`);
    }
    setResult(finalLanding);
    setPhase('done');
    onGenerated?.(finalLanding);
  };

  const reset = () => {
    setPhase('form');
    setTasks([]);
    setResult(null);
    setError(null);
    setImageNotice(null);
  };

  const close = () => {
    if (phase === 'generating') return;
    reset();
    onClose();
  };

  const input =
    'w-full text-sm px-3.5 py-2.5 border border-slate-300 rounded-xl bg-white focus:border-[#172C8A] focus:ring-2 focus:ring-[#172C8A]/10 outline-none';
  const label = 'block text-xs font-bold text-slate-700 mb-1';

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6">
      <div className="bg-white w-full max-w-5xl max-h-[94vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-gradient text-white flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900">Crear landing con IA</h2>
              <p className="text-xs text-slate-500">Una foto y unos datos. La IA escribe, diseña y crea las imágenes.</p>
            </div>
          </div>
          <button
            onClick={close}
            disabled={phase === 'generating'}
            className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-40"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {phase === 'form' && (
            <div className="grid md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-6 p-6">
              {/* Photos */}
              <div className="space-y-3">
                <span className={label}>Foto principal del producto *</span>
                <button
                  type="button"
                  onClick={() => mainInput.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleMainFile(e.dataTransfer.files?.[0]);
                  }}
                  className="w-full aspect-square rounded-2xl border-2 border-dashed border-slate-300 hover:border-[#0A6CF0] bg-slate-50 flex items-center justify-center overflow-hidden transition"
                >
                  {productImage ? (
                    <img src={productImage} alt="Producto" className="w-full h-full object-contain" />
                  ) : (
                    <div className="text-center px-6">
                      <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                      <p className="text-sm font-bold text-slate-700">Sube o arrastra la foto</p>
                      <p className="text-xs text-slate-500 mt-1">Mejor con fondo limpio y buena luz</p>
                    </div>
                  )}
                </button>
                <input
                  ref={mainInput}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleMainFile(e.target.files?.[0])}
                />

                <div>
                  <span className={label}>Fotos extra (opcional, hasta 3)</span>
                  <div className="flex gap-2">
                    {extraImages.map((img, i) => (
                      <div key={i} className="relative w-16 h-16 rounded-xl overflow-hidden border border-slate-200 group">
                        <img src={img} alt="" className="w-full h-full object-cover" />
                        <button
                          onClick={() => setExtraImages((p) => p.filter((_, j) => j !== i))}
                          className="absolute inset-0 bg-black/50 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center"
                          aria-label="Quitar foto"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    {extraImages.length < 3 && (
                      <button
                        onClick={() => extraInput.current?.click()}
                        className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-300 hover:border-slate-400 flex items-center justify-center text-slate-400"
                        aria-label="Añadir fotos"
                      >
                        <ImagePlus className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                  <input
                    ref={extraInput}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => handleExtraFiles(e.target.files)}
                  />
                </div>

<div>
                  <span className={label}>Estilo de la página</span>
                  <div className="space-y-2">
                    {IMPACT_STYLES.map((x) => (
                      <div
                        key={x.id}
                        className={`rounded-xl border p-2 flex items-center gap-3 text-xs ${impactStyle === x.id ? 'border-[#0A6CF0] bg-[#0A6CF0]/5 ring-2 ring-[#0A6CF0]/20' : 'border-slate-200 hover:border-slate-300'}`}
                      >
                        <button type="button" onClick={() => setImpactStyle(x.id)} className="flex-1 min-w-0 flex items-center gap-3 text-left" aria-pressed={impactStyle === x.id}>
                          <img src={`/landing-styles/${x.id}.webp`} alt={`Muestra del estilo ${x.name}`} className="w-[72px] h-[54px] sm:w-24 sm:h-[72px] rounded-lg object-cover object-top bg-slate-100 shrink-0 border border-slate-200" loading="lazy" />
                          <span className="min-w-0">
                            <strong className="text-slate-900 block text-[13px]">{x.name}</strong>
                            <span className="text-slate-600 block">{x.text}</span>
                            <span className="text-slate-400 hidden sm:block mt-0.5">Ideal: {x.goodFor}</span>
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setSample(x.id)}
                          className="shrink-0 h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-[12px] font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5"
                        >
                          <Eye className="w-3.5 h-3.5" /> Ver<span className="hidden sm:inline"> muestra</span>
                        </button>
                      </div>
                    ))}
                  </div>
                  <p className="mt-1.5 text-[11px] text-slate-500">La muestra usa un producto de ejemplo. Tu página lleva tus textos, tus precios y fotos con IA de tu producto en ese estilo.</p>
                  {sample && (
                    <div className="fixed inset-0 z-[80] bg-slate-900/70 flex flex-col" role="dialog" aria-modal="true" aria-label="Muestra del estilo">
                      <div className="bg-white px-3 sm:px-4 py-2.5 flex flex-wrap items-center gap-2 border-b border-slate-200">
                        <div className="flex gap-1 overflow-x-auto">
                          {IMPACT_STYLES.map((x) => (
                            <button
                              key={x.id}
                              type="button"
                              onClick={() => setSample(x.id)}
                              className={`h-8 px-3 rounded-lg text-[12px] font-semibold whitespace-nowrap ${sample === x.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                            >
                              {x.name}
                            </button>
                          ))}
                        </div>
                        <div className="ml-auto flex items-center gap-1.5">
                          <div className="hidden sm:flex rounded-lg bg-slate-100 p-0.5">
                            {(['desktop', 'phone'] as const).map((v) => (
                              <button key={v} type="button" onClick={() => setSampleView(v)} className={`h-7 px-2.5 rounded-md text-[12px] font-semibold ${sampleView === v ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}>
                                {v === 'desktop' ? 'Computador' : 'Celular'}
                              </button>
                            ))}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setImpactStyle(sample);
                              setSample(null);
                            }}
                            className="h-8 px-3 rounded-lg bg-[#0A6CF0] text-white text-[12px] font-bold"
                          >
                            Usar este estilo
                          </button>
                          <button type="button" onClick={() => setSample(null)} className="h-8 w-8 rounded-lg hover:bg-slate-100 flex items-center justify-center" aria-label="Cerrar muestra">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="flex-1 overflow-hidden flex justify-center bg-slate-200">
                        <iframe
                          key={sample}
                          src={`/muestra/${sample}`}
                          title="Muestra del estilo"
                          className={`h-full bg-white ${sampleView === 'phone' ? 'w-full sm:w-[390px] sm:my-3 sm:rounded-2xl sm:shadow-xl sm:h-[calc(100%-24px)]' : 'w-full'}`}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {style === 'web' && (
                  <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={withImages}
                      onChange={(e) => setWithImages(e.target.checked)}
                      className="mt-0.5 accent-[#0A6CF0]"
                    />
                    <span className="text-xs text-slate-600">
                      <strong className="text-slate-900 block">Generar 5 imágenes publicitarias con IA</strong>
                      Escenas con tu producto real: banner, persona usándolo y una por beneficio. Usa Gemini, Replicate (nano-banana) o Cloudflare (gratis), según lo que configures.
                    </span>
                  </label>
                )}

                {(style === 'sections' || style === 'impact') && (
                  <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                    <span className="block text-xs font-bold text-slate-700">Opiniones reales de clientes (opcional)</span>
                    <textarea
                      className={`${input} min-h-[72px]`}
                      value={reviewsText}
                      onChange={(e) => setReviewsText(e.target.value)}
                      placeholder={'Una por línea, tal cual te la escribieron:\nMaría G., Medellín: "Me llegó en 2 días, me encantó"'}
                    />
                    <div className={`${style === 'sections' ? 'flex' : 'hidden'} gap-2 items-center`}>
                      {reviewShots.map((img, i) => (
                        <div key={i} className="relative w-12 h-12 rounded-lg overflow-hidden border border-slate-200 group">
                          <img src={img} alt="" className="w-full h-full object-cover" />
                          <button
                            onClick={() => setReviewShots((p) => p.filter((_, j) => j !== i))}
                            className="absolute inset-0 bg-black/50 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center"
                            aria-label="Quitar captura"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                      {reviewShots.length < 4 && (
                        <button
                          type="button"
                          onClick={() => reviewInput.current?.click()}
                          className="h-12 px-3 rounded-lg border-2 border-dashed border-slate-300 hover:border-slate-400 text-[11px] text-slate-500 flex items-center gap-1"
                        >
                          <ImagePlus className="w-4 h-4" /> Capturas de chats o reseñas
                        </button>
                      )}
                      <input ref={reviewInput} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleReviewShots(e.target.files)} />
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Solo se usan opiniones que tú pongas. Si no pones ninguna, la página no lleva sección de testimonios: Konnexa no inventa clientes, caras ni resultados.
                    </p>
                  </div>
                )}
              </div>

              {/* Data */}
              <div className="space-y-4">
                <div className="grid sm:grid-cols-3 gap-3">
                  <div>
                    <label className={label}>Nombre del producto</label>
                    <input className={input} value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="Si lo dejas vacío, la IA lo deduce" />
                  </div>
                  <div>
                    <label className={label}>Tu marca o tienda</label>
                    <input className={input} value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="Aparece arriba a la izquierda" />
                  </div>
                  <div>
                    <label className={label}>Público objetivo</label>
                    <input className={input} value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="Ej. mamás, deportistas…" />
                  </div>
                </div>

                <div>
                  <label className={label}>¿Qué hace y qué quieres destacar?</label>
                  <textarea
                    className={`${input} min-h-[96px] resize-y`}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Ej. Corrector de postura ajustable, transpirable, se usa bajo la ropa, alivia dolor de espalda en oficina. Talla única."
                  />
                  <p className="text-[11px] text-slate-500 mt-1">Cuantos más datos reales des, más específica y creíble será la página.</p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className={label}>País</label>
                    <select className={input} value={country} onChange={(e) => setCountry(e.target.value)}>
                      {COUNTRIES.map((c) => (
                        <option key={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-1 sm:col-span-2">
                    <label className={label}>Precio normal por unidad ({currency}, opcional)</label>
                    <input className={input} inputMode="numeric" value={regularPrice} onChange={(e) => setRegularPrice(e.target.value.replace(/\D/g, ''))} placeholder="Se muestra tachado. Déjalo vacío si no hay descuento" />
                  </div>
                  <div>
                    <label className={label}>Envío</label>
                    <select className={input} value={shippingType} onChange={(e) => setShippingType(e.target.value as 'free' | 'calculated')}>
                      <option value="free">Gratis</option>
                      <option value="calculated">Según destino</option>
                    </select>
                  </div>
                  <div>
                    <label className={label}>Garantía (días)</label>
                    <input className={input} inputMode="numeric" value={guaranteeDays} onChange={(e) => setGuaranteeDays(e.target.value.replace(/\D/g, ''))} />
                  </div>
                  <div>
                    <label className={label}>WhatsApp</label>
                    <input className={input} value={whatsappNumber} onChange={(e) => setWhatsappNumber(e.target.value)} placeholder="+57 300 000 0000" />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className={label}>Ofertas *</span>
                    <span className="text-[11px] text-slate-500">La primera fila es la compra mínima</span>
                  </div>
                  <div className="rounded-xl border border-slate-200 divide-y divide-slate-100">
                    <div className="grid grid-cols-[64px_1fr_1fr_auto_28px] gap-2 px-3 py-2 text-[11px] font-semibold text-slate-500">
                      <span>Unidades</span>
                      <span>Precio total ({currency})</span>
                      <span>Etiqueta (opcional)</span>
                      <span title="Oferta destacada">Destacar</span>
                      <span />
                    </div>
                    {offers.map((o, i) => (
                      <div key={i} className="grid grid-cols-[64px_1fr_1fr_auto_28px] gap-2 px-3 py-2 items-center">
                        <input
                          className={`${input} px-2.5`}
                          inputMode="numeric"
                          value={o.units}
                          onChange={(e) => setOffers((p) => p.map((x, j) => (j === i ? { ...x, units: e.target.value.replace(/\D/g, '') } : x)))}
                          aria-label="Unidades"
                        />
                        <input
                          className={input}
                          inputMode="numeric"
                          value={o.price}
                          placeholder="Ej. 119900"
                          onChange={(e) => setOffers((p) => p.map((x, j) => (j === i ? { ...x, price: e.target.value.replace(/\D/g, '') } : x)))}
                          aria-label="Precio total"
                        />
                        <input
                          className={input}
                          value={o.label}
                          placeholder="Ej. Más vendido"
                          onChange={(e) => setOffers((p) => p.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                          aria-label="Etiqueta"
                        />
                        <input
                          type="radio"
                          name="popular-offer"
                          checked={popularIdx === i}
                          onChange={() => setPopularIdx(i)}
                          className="justify-self-center w-4 h-4 accent-[#0A6CF0]"
                          aria-label="Destacar esta oferta"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setOffers((p) => p.filter((_, j) => j !== i));
                            setPopularIdx((p) => (p === i ? 0 : p > i ? p - 1 : p));
                          }}
                          disabled={offers.length === 1}
                          className="w-7 h-7 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center disabled:opacity-30"
                          aria-label="Quitar oferta"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setOffers((p) => {
                        const last = Number(p[p.length - 1]?.units) || 0;
                        return [...p, { units: last ? String(last * 2) : '', price: '', label: '' }];
                      })
                    }
                    className="mt-2 text-xs font-semibold text-slate-700 hover:text-slate-900 inline-flex items-center gap-1"
                  >
                    + Añadir oferta
                  </button>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Ej. shorts: 6 unidades por $90.000 y 12 por $160.000. La IA no inventará otras ofertas ni descuentos.
                  </p>
                </div>

                <div>
                  <span className={label}>Tono</span>
                  <div className="flex flex-wrap gap-2">
                    {TONES.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setTone(t.id)}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition ${
                          tone === t.id ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {!serverKey && (
                  <div>
                    <label className={label}>
                      <Key className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
                      API Key de Google Gemini *
                    </label>
                    <input
                      type="password"
                      className={input}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="AIza…"
                      autoComplete="off"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      Gratis en{' '}
                      <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="underline">
                        Google AI Studio
                      </a>
                      . Para no pedirla aquí, ponla en <code>GEMINI_API_KEY</code> dentro de <code>.env.local</code>.
                    </p>
                  </div>
                )}

                {error && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-px" />
                    <span>{error}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {phase === 'generating' && (
            <div className="p-6 sm:p-10 max-w-2xl mx-auto">
              <div className="flex items-center gap-4 mb-6">
                {productImage && (
                  <img src={productImage} alt="" className="w-16 h-16 rounded-2xl object-cover border border-slate-200" />
                )}
                <div>
                  <h3 className="text-lg font-black text-slate-900">Creando tu landing…</h3>
                  <p className="text-xs text-slate-500">No cierres esta ventana. Puede tardar unos minutos si Google está saturado.</p>
                </div>
              </div>
              <ul className="space-y-2">
                {tasks.map((t) => (
                  <li key={t.key} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-white">
                    {t.state === 'done' && <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />}
                    {t.state === 'running' && <Loader2 className="w-5 h-5 text-[#0A6CF0] animate-spin flex-shrink-0" />}
                    {t.state === 'pending' && <Circle className="w-5 h-5 text-slate-300 flex-shrink-0" />}
                    {t.state === 'error' && <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{t.label}</p>
                      {t.error && <p className="text-[11px] text-amber-700 truncate">Se omitió: {t.error}</p>}
                    </div>
                    {t.preview && <img src={t.preview} alt="" className="w-12 h-12 rounded-lg object-cover" />}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {phase === 'done' && result && (
            <div className="p-6 sm:p-10 max-w-3xl mx-auto text-center">
              <div
                className="relative rounded-3xl overflow-hidden aspect-[16/8] mb-6 text-left"
                style={{ background: result.design?.dark || '#0F172A' }}
              >
                <img
                  src={result.impact?.heroImage || result.sales?.heroImage || result.mainImage}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover opacity-70"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute bottom-0 p-6">
                  <span
                    className="inline-block text-[11px] font-semibold px-2.5 py-1 rounded-full text-white mb-2"
                    style={{ background: result.design?.primary }}
                  >
                    {(result.impact?.heroKicker || result.sales?.eyebrow)?.replace(/\*\*/g, '')}
                  </span>
                  <h3 className="text-xl sm:text-3xl font-black text-white leading-tight">{(result.impact?.heroTitle || result.headline).replace(/\*\*/g, '').replace(/\s*\|\s*/g, ' ')}</h3>
                </div>
              </div>
              <h3 className="text-xl font-black text-slate-900">¡Tu landing está lista!</h3>
              <p className="text-sm text-slate-500 mt-1 mb-6">
                Revisa los textos y añade reseñas reales de tus clientes desde el editor.
              </p>
              {imageNotice && (
                <div className="mb-6 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 text-left flex gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-px" />
                  <span>
                    {imageNotice} Mientras tanto, la landing usa tus fotos.{' '}
                    <a href="https://aistudio.google.com/" target="_blank" rel="noreferrer" className="underline font-bold">
                      Abrir Google AI Studio
                    </a>
                  </span>
                </div>
              )}
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <a
                  href={result.publishedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-5 py-3 rounded-xl bg-brand-gradient text-white text-sm font-bold flex items-center justify-center gap-2"
                >
                  <ExternalLink className="w-4 h-4" /> Ver landing
                </a>
                <button
                  onClick={() => router.push(`/landings/editor/${result.id}`)}
                  className="px-5 py-3 rounded-xl bg-slate-900 text-white text-sm font-bold flex items-center justify-center gap-2"
                >
                  <PenSquare className="w-4 h-4" /> Editar
                </button>
                <button
                  onClick={reset}
                  className="px-5 py-3 rounded-xl border border-slate-300 text-slate-700 text-sm font-bold flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" /> Crear otra
                </button>
              </div>
            </div>
          )}
        </div>

        {phase === 'form' && (
          <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
            <p className="text-[11px] text-slate-500 hidden sm:block">
              La IA no inventa reseñas ni cifras de ventas: tu página será creíble y segura para anuncios.
            </p>
            <button
              onClick={handleGenerate}
              className="ml-auto px-6 py-3 rounded-xl bg-brand-gradient text-white text-sm font-black shadow-glow-blue flex items-center gap-2 hover:opacity-95"
            >
              <Wand2 className="w-4 h-4" /> Generar landing
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
