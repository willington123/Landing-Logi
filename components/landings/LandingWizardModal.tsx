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
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { logiStore } from '@/lib/store';
import { LandingPageConfig } from '@/lib/types';
import { buildSalesLanding, GeneratedCopy, GeneratedImages } from '@/lib/landing-ai';
import { compressImage, fileToDataUrl } from '@/lib/image-utils';

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
  const [regularPrice, setRegularPrice] = useState('199000');
  const [promoPrice, setPromoPrice] = useState('119900');
  const [country, setCountry] = useState('Colombia');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [shippingType, setShippingType] = useState<'free' | 'calculated'>('free');
  const [guaranteeDays, setGuaranteeDays] = useState('30');
  const [tone, setTone] = useState(TONES[0].id);
  const [withImages, setWithImages] = useState(true);
  const [apiKey, setApiKey] = useState('');
  const [serverKey, setServerKey] = useState(false);

  const currency = COUNTRIES.find((c) => c.name === country)?.currency || 'COP';

  useEffect(() => {
    if (!isOpen) return;
    setApiKey(logiStore.getGeminiApiKey());
    fetch('/api/landing/generate')
      .then((r) => r.json())
      .then((d) => setServerKey(Boolean(d.serverKey)))
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

  const handleGenerate = async () => {
    setError(null);
    if (!productImage) return setError('Sube la foto principal del producto.');
    const regular = Number(regularPrice) || 0;
    const promo = Number(promoPrice) || 0;
    if (promo <= 0) return setError('Indica el precio de oferta.');
    if (!serverKey && !apiKey.trim()) return setError('Introduce tu API Key de Google Gemini.');
    if (apiKey.trim()) logiStore.saveGeminiApiKey(apiKey);

    const baseTasks: Task[] = [{ key: 'copy', label: 'Analizando la foto y escribiendo la página', state: 'running' }];
    if (withImages) {
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
        description,
        audience,
        regularPrice: regular || promo,
        promoPrice: promo,
        currency,
        country,
        shippingType,
        guaranteeDays: Number(guaranteeDays) || 30,
        tone,
      });
      copy = data.copy;
      updateTask('copy', { state: 'done', label: `Textos listos: “${copy.headline}”` });
    } catch (e: any) {
      setError(`No se pudo generar la página: ${e.message}`);
      setPhase('form');
      return;
    }

    // 2. Scene images (optional, failures are not fatal)
    const images: GeneratedImages = { benefits: [] };
    if (withImages) {
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
        productImage,
        extraImages,
        regularPrice: regular || promo,
        promoPrice: promo,
        currency,
        country,
        whatsappNumber,
        shippingType,
        guaranteeDays: Number(guaranteeDays) || 30,
      },
      images
    );
    logiStore.saveLanding(landing);
    if (!logiStore.getLandingBySlug(landing.slug)) {
      setError(
        'La landing se generó pero el navegador no tiene espacio para guardarla. Borra landings antiguas e inténtalo de nuevo.'
      );
      setPhase('form');
      return;
    }
    setResult(landing);
    setPhase('done');
    onGenerated?.(landing);
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
                  className="w-full aspect-square rounded-2xl border-2 border-dashed border-slate-300 hover:border-[#FF252B] bg-slate-50 flex items-center justify-center overflow-hidden transition"
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

                <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={withImages}
                    onChange={(e) => setWithImages(e.target.checked)}
                    className="mt-0.5 accent-[#FF252B]"
                  />
                  <span className="text-xs text-slate-600">
                    <strong className="text-slate-900 block">Generar 5 imágenes publicitarias con IA</strong>
                    Escenas con tu producto real: banner, persona usándolo y una por beneficio. Usa Gemini (con facturación) o Cloudflare (gratis).
                  </span>
                </label>
              </div>

              {/* Data */}
              <div className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className={label}>Nombre del producto</label>
                    <input className={input} value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="Si lo dejas vacío, la IA lo deduce" />
                  </div>
                  <div>
                    <label className={label}>Público objetivo</label>
                    <input className={input} value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="Ej. mamás primerizas, gamers…" />
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
                  <div>
                    <label className={label}>Precio normal ({currency})</label>
                    <input className={input} inputMode="numeric" value={regularPrice} onChange={(e) => setRegularPrice(e.target.value.replace(/\D/g, ''))} />
                  </div>
                  <div>
                    <label className={label}>Precio oferta ({currency}) *</label>
                    <input className={input} inputMode="numeric" value={promoPrice} onChange={(e) => setPromoPrice(e.target.value.replace(/\D/g, ''))} />
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
                    {t.state === 'running' && <Loader2 className="w-5 h-5 text-[#FF252B] animate-spin flex-shrink-0" />}
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
                  src={result.sales?.heroImage || result.mainImage}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover opacity-70"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute bottom-0 p-6">
                  <span
                    className="inline-block text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full text-white mb-2"
                    style={{ background: result.design?.primary }}
                  >
                    {result.sales?.eyebrow}
                  </span>
                  <h3 className="text-xl sm:text-3xl font-black text-white leading-tight">{result.headline}</h3>
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
              className="ml-auto px-6 py-3 rounded-xl bg-brand-gradient text-white text-sm font-black shadow-glow-red flex items-center gap-2 hover:opacity-95"
            >
              <Wand2 className="w-4 h-4" /> Generar landing
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
