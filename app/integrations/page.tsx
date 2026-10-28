'use client';

import React, { useEffect, useState } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import LandingWizardModal from '@/components/landings/LandingWizardModal';
import {
  Plug,
  CheckCircle2,
  AlertCircle,
  Key,
  ShieldCheck,
  ExternalLink,
  MessageSquare,
  PhoneCall,
  BarChart3,
  Truck,
  Globe,
  Lock,
  Eye,
  EyeOff,
  RefreshCw,
  Sparkles,
} from 'lucide-react';

interface IntegrationItem {
  id: string;
  name: string;
  category: 'voice' | 'crm' | 'tracking' | 'logistics';
  description: string;
  iconBg: string;
  status: 'connected' | 'configured_simulator' | 'requires_keys' | 'coming_soon';
  requiresKeysText: string;
  keyFields: { name: string; label: string; placeholder: string; isSecret?: boolean }[];
  docUrl: string;
}

const INTEGRATIONS: IntegrationItem[] = [
  {
    id: 'whatsapp_cloud',
    name: 'WhatsApp Business Cloud API (Oficial)',
    category: 'crm',
    description: 'Envía una plantilla de confirmación a cada pedido nuevo, recibe las respuestas en Mensajes y actualiza el estado del pedido cuando el cliente toca "Confirmar pedido" o "Cancelar".',
    iconBg: 'bg-emerald-500',
    status: 'coming_soon',
    requiresKeysText: 'Token permanente y WABA ID configurables.',
    keyFields: [
      { name: 'waba_id', label: 'WhatsApp Business Account ID', placeholder: '1098234718293' },
      { name: 'phone_id', label: 'Phone Number ID', placeholder: '1029384756102' },
      { name: 'access_token', label: 'Meta System User Access Token', placeholder: 'EAABw...', isSecret: true },
    ],
    docUrl: 'https://developers.facebook.com/docs/whatsapp/cloud-api',
  },
  {
    id: 'vapi_ai',
    name: 'Vapi AI (Voice Agents Ultra-Rápidos)',
    category: 'voice',
    description: 'Motor de voz en tiempo real con latencia inferior a 500ms para llamadas de confirmación ultra-humanas.',
    iconBg: 'bg-brand-navy',
    status: 'coming_soon',
    requiresKeysText: 'Actualmente activo en modo simulador local. Ingresa tu API Key de Vapi para marcar teléfonos reales.',
    keyFields: [
      { name: 'vapi_key', label: 'Vapi Private API Key', placeholder: 'vapi_sec_...', isSecret: true },
      { name: 'vapi_assistant_id', label: 'Assistant ID preconfigurado', placeholder: 'asst_...' },
    ],
    docUrl: 'https://vapi.ai',
  },
  {
    id: 'retell_ai',
    name: 'Retell AI (Telefonía Inteligente)',
    category: 'voice',
    description: 'Llamadas conversacionales en español neutro y latinoamericano con detección avanzada de buzón de voz.',
    iconBg: 'bg-indigo-600',
    status: 'coming_soon',
    requiresKeysText: 'Requiere credenciales de Retell AI para llamadas salientes.',
    keyFields: [
      { name: 'retell_key', label: 'Retell API Key', placeholder: 'retell_key_...', isSecret: true },
    ],
    docUrl: 'https://retellai.com',
  },
  {
    id: 'twilio_voice',
    name: 'Twilio Voice + Troncal SIP',
    category: 'voice',
    description: 'Telefonía tradicional para Colombia (+57), México (+52) y España (+34) con Caller ID de empresa verificado.',
    iconBg: 'bg-red-600',
    status: 'coming_soon',
    requiresKeysText: 'Account SID y Auth Token de Twilio.',
    keyFields: [
      { name: 'twilio_sid', label: 'Account SID', placeholder: 'AC...' },
      { name: 'twilio_token', label: 'Auth Token', placeholder: '••••••••', isSecret: true },
      { name: 'twilio_phone', label: 'Número Telefónico Saliente', placeholder: '+576017948800' },
    ],
    docUrl: 'https://twilio.com',
  },
  {
    id: 'meta_capi',
    name: 'Meta Conversions API (CAPI) & Pixel',
    category: 'tracking',
    description: 'Envía eventos del lado del servidor (Purchase, Lead, InitiateCheckout) para eludir bloqueadores y maximizar ROAS en Facebook Ads.',
    iconBg: 'bg-blue-600',
    status: 'coming_soon',
    requiresKeysText: 'Conexión activa con deduplicación de eventos browser + servidor.',
    keyFields: [
      { name: 'pixel_id', label: 'Dataset / Pixel ID', placeholder: '8942109823192' },
      { name: 'capi_token', label: 'Conversions API Access Token', placeholder: 'EAAG...', isSecret: true },
      { name: 'test_code', label: 'Test Event Code (Opcional)', placeholder: 'TEST48291' },
    ],
    docUrl: 'https://developers.facebook.com/docs/marketing-api/conversions-api',
  },
  {
    id: 'dropi_logistics',
    name: 'Dropi / Servientrega / Interrapidísimo',
    category: 'logistics',
    description: 'Generación automática de guías de despacho y liquidación de dinero contraentrega directo a tu cuenta.',
    iconBg: 'bg-amber-600',
    status: 'coming_soon',
    requiresKeysText: 'Integrado vía webhook de despacho.',
    keyFields: [
      { name: 'dropi_token', label: 'Token de Integración Dropi / Transportadora', placeholder: 'dropi_token_...', isSecret: true },
    ],
    docUrl: 'https://dropi.co',
  },
];

interface WaStatus {
  sending: boolean;
  confirmTemplate: boolean;
  webhook: boolean;
  missing: string[];
}

const WA_VARS: { name: string; hint: string }[] = [
  { name: 'WHATSAPP_TOKEN', hint: 'Token permanente de un usuario del sistema' },
  { name: 'WHATSAPP_PHONE_NUMBER_ID', hint: 'Identificador del número (WhatsApp Manager)' },
  { name: 'WHATSAPP_VERIFY_TOKEN', hint: 'Texto que inventas y pegas también en Meta' },
  { name: 'WHATSAPP_APP_SECRET', hint: 'Clave secreta de tu app de Meta' },
  { name: 'WHATSAPP_CONFIRM_TEMPLATE', hint: 'Nombre de la plantilla, p. ej. confirmacion_pedido' },
];

// WhatsApp card: real status from the server; credentials live in env vars, never in the browser.
function WhatsAppCard({ status }: { status: WaStatus | null | undefined }) {
  const ready = status && status.sending && status.confirmTemplate && status.webhook;
  const partial = status && !ready && status.missing.length < WA_VARS.length;
  const [webhookUrl, setWebhookUrl] = useState('https://<tu-dominio>/api/whatsapp/webhook');
  useEffect(() => setWebhookUrl(`${window.location.origin}/api/whatsapp/webhook`), []);
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col space-y-4 md:col-span-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-md">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-slate-900">WhatsApp Business Cloud API (Oficial)</h3>
            <span className="text-[11px] text-slate-400">Confirmación de pedidos y bandeja de Mensajes</span>
          </div>
        </div>
        {status === undefined ? (
          <span className="text-[11px] text-slate-400">Comprobando…</span>
        ) : status === null ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">No se pudo comprobar</span>
        ) : ready ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Configurado
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
            <Key className="w-3 h-3 text-amber-600" /> {partial ? 'Configuración incompleta' : 'No configurado'}
          </span>
        )}
      </div>

      <p className="text-xs text-slate-600 leading-relaxed">
        Envía una plantilla de confirmación a cada pedido nuevo, recibe las respuestas en Mensajes y actualiza el pedido a
        &quot;Confirmado&quot; o &quot;Cancelado&quot; cuando el cliente toca un botón. Las credenciales se guardan como variables de entorno en Vercel
        (nunca en el navegador) y después hay que volver a desplegar.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-100">
        {WA_VARS.map((v) => {
          const missing = !status || status.missing.includes(v.name);
          return (
            <div key={v.name} className="flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2">
              {missing ? <AlertCircle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" /> : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />}
              <div className="min-w-0">
                <code className="text-[11px] font-mono font-semibold text-slate-800 break-all">{v.name}</code>
                <p className="text-[11px] text-slate-500">{v.hint}</p>
              </div>
            </div>
          );
        })}
        <div className="flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2">
          <Globe className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
          <div className="min-w-0">
            <code className="text-[11px] font-mono font-semibold text-slate-800">WHATSAPP_TEMPLATE_LANG</code>
            <p className="text-[11px] text-slate-500">Opcional. Idioma de la plantilla (por defecto es)</p>
          </div>
        </div>
      </div>

      <div className="text-xs text-slate-600 space-y-1">
        <p>
          URL del webhook en Meta (campo <code className="font-mono">messages</code>):{' '}
          <code className="font-mono text-[11px] bg-slate-100 px-1.5 py-0.5 rounded break-all">{webhookUrl}</code>
        </p>
        <p>Los pasos completos y el texto exacto de la plantilla están en el README, sección &quot;WhatsApp&quot;.</p>
      </div>

      <div className="pt-3 border-t border-slate-100">
        <a
          href="https://developers.facebook.com/docs/whatsapp/cloud-api"
          target="_blank"
          rel="noreferrer"
          className="text-xs font-semibold text-brand-navy hover:underline inline-flex items-center gap-1"
        >
          <span>Ver documentación de Meta</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}

interface VapiStatus {
  ready: boolean;
  webhookSecret: boolean;
  cron: boolean;
  missing: string[];
}

// Vapi card: real status; settings and history live in Llamadas IA.
function VapiCard({ status }: { status: VapiStatus | null | undefined }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-brand-navy text-white flex items-center justify-center shadow-md">
            <PhoneCall className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-slate-900">Vapi AI (llamadas de confirmación)</h3>
            <span className="text-[11px] text-slate-400">Agente de voz con IA</span>
          </div>
        </div>
        {status === undefined ? (
          <span className="text-[11px] text-slate-400">Comprobando…</span>
        ) : status?.ready ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Configurado
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
            <Key className="w-3 h-3 text-amber-600" /> No configurado
          </span>
        )}
      </div>
      <p className="text-xs text-slate-600 leading-relaxed">
        Llama a cada cliente, confirma producto, total y dirección, y actualiza el pedido a Confirmado, Cancelado o Revisar. Reintenta si no contesta, dentro
        de tu horario.
      </p>
      <div className="space-y-1.5 pt-2 border-t border-slate-100 text-[11px]">
        {[
          ['VAPI_API_KEY', !status?.missing.includes('VAPI_API_KEY')],
          ['VAPI_PHONE_NUMBER_ID', !status?.missing.includes('VAPI_PHONE_NUMBER_ID')],
          ['VAPI_WEBHOOK_SECRET', Boolean(status?.webhookSecret)],
          ['CRON_SECRET', Boolean(status?.cron)],
        ].map(([name, ok]) => (
          <div key={name as string} className="flex items-center gap-2">
            {ok ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <AlertCircle className="w-3.5 h-3.5 text-amber-500" />}
            <code className="font-mono font-semibold text-slate-700">{name}</code>
          </div>
        ))}
      </div>
      <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
        <a href="https://docs.vapi.ai" target="_blank" rel="noreferrer" className="text-xs font-semibold text-brand-navy hover:underline inline-flex items-center gap-1">
          <span>Documentación de Vapi</span>
          <ExternalLink className="w-3 h-3" />
        </a>
        <a href="/voice-ai" className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition">
          Abrir Llamadas IA
        </a>
      </div>
    </div>
  );
}

export default function IntegrationsPage() {
  const [vapiStatus, setVapiStatus] = useState<VapiStatus | null | undefined>(undefined);
  const [waStatus, setWaStatus] = useState<WaStatus | null | undefined>(undefined);
  useEffect(() => {
    fetch('/api/status', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        setWaStatus(d.whatsapp || null);
        setVapiStatus(d.vapi || null);
      })
      .catch(() => {
        setWaStatus(null);
        setVapiStatus(null);
      });
  }, []);

  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [savedFeedback, setSavedFeedback] = useState<string | null>(null);

  const filtered = INTEGRATIONS.filter(
    (item) => selectedCategory === 'all' || item.category === selectedCategory
  );

  const toggleShowSecret = (fieldKey: string) => {
    setShowSecrets((prev) => ({ ...prev, [fieldKey]: !prev[fieldKey] }));
  };

  const handleSaveIntegration = (id: string) => {
    setSavedFeedback(id);
    setTimeout(() => setSavedFeedback(null), 2500);
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar onOpenWizard={() => setIsWizardOpen(true)} />

      <div className="flex-1 flex flex-col min-w-0">
        <Header onOpenWizard={() => setIsWizardOpen(true)} title="Integraciones" />

        <main className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8 space-y-6 max-w-[1280px] mx-auto w-full">
          {/* Header Description */}
          <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-900 tracking-tight">
                Integraciones
              </h2>
              <p className="text-sm text-slate-500 mt-0.5">
                WhatsApp y Vapi ya funcionan cuando configuras sus variables de entorno. El resto de conexiones están en desarrollo. El píxel de Meta se configura en Configuración.
              </p>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 bg-slate-200/60 p-1 rounded-xl text-[13px] font-medium text-slate-600 overflow-x-auto max-w-full whitespace-nowrap">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  selectedCategory === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-900'
                }`}
              >
                Todas
              </button>
              <button
                onClick={() => setSelectedCategory('voice')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  selectedCategory === 'voice' ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-900'
                }`}
              >
                Voz IA & Telefonía
              </button>
              <button
                onClick={() => setSelectedCategory('crm')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  selectedCategory === 'crm' ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-900'
                }`}
              >
                WhatsApp Oficial
              </button>
              <button
                onClick={() => setSelectedCategory('tracking')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  selectedCategory === 'tracking' ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-900'
                }`}
              >
                Meta CAPI & Píxeles
              </button>
              <button
                onClick={() => setSelectedCategory('logistics')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  selectedCategory === 'logistics' ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-900'
                }`}
              >
                Logística & Dropi
              </button>
            </div>
          </div>

          {/* Integrations Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filtered.map((item) => item.id === 'whatsapp_cloud' ? (
              <WhatsAppCard key={item.id} status={waStatus} />
            ) : item.id === 'vapi_ai' ? (
              <VapiCard key={item.id} status={vapiStatus} />
            ) : (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition flex flex-col justify-between space-y-5"
              >
                <div className="space-y-4">
                  {/* Top Row: Icon + Title + Status */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-xl ${item.iconBg} text-white flex items-center justify-center font-bold shadow-md`}>
                        {item.category === 'voice' && <PhoneCall className="w-5 h-5" />}
                        {item.category === 'crm' && <MessageSquare className="w-5 h-5" />}
                        {item.category === 'tracking' && <BarChart3 className="w-5 h-5" />}
                        {item.category === 'logistics' && <Truck className="w-5 h-5" />}
                      </div>
                      <div>
                        <h3 className="text-[15px] font-semibold text-slate-900">{item.name}</h3>
                        <span className="text-[11px] text-slate-400 capitalize">{item.category}</span>
                      </div>
                    </div>

                    <div>
                      {item.status === 'connected' && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Conectado</span>
                        </span>
                      )}
                      {item.status === 'configured_simulator' && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-brand-navy border border-blue-200">
                          <Sparkles className="w-3 h-3 text-brand-navy" />
                          <span>Simulador Activo</span>
                        </span>
                      )}
                      {item.status === 'coming_soon' && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-500/15">
                          Próximamente
                        </span>
                      )}
                      {item.status === 'requires_keys' && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                          <Key className="w-3 h-3 text-amber-600" />
                          <span>Faltan Credenciales</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    {item.description}
                  </p>

                  {/* Key inputs */}
                  <div className="space-y-2.5 pt-2 border-t border-slate-100">
                    {item.keyFields.map((field) => {
                      const fieldKey = `${item.id}_${field.name}`;
                      const isRevealed = showSecrets[fieldKey];

                      return (
                        <div key={field.name}>
                          <label className="block text-[11px] font-bold text-slate-500 mb-1">
                            {field.label}:
                          </label>
                          <div className="relative">
                            <input
                              type={field.isSecret && !isRevealed ? 'password' : 'text'}
                              placeholder={field.placeholder}
                              disabled={item.status === 'coming_soon'}
                              defaultValue={item.status === 'connected' ? '••••••••••••••••' : ''}
                              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 font-mono focus:ring-1 focus:ring-brand-red focus:bg-white"
                            />
                            {field.isSecret && (
                              <button
                                type="button"
                                onClick={() => toggleShowSecret(fieldKey)}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                              >
                                {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <a
                    href={item.docUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold text-brand-navy hover:underline flex items-center gap-1"
                  >
                    <span>Ver documentación</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>

                  <button
                    onClick={() => handleSaveIntegration(item.id)}
                    disabled={item.status === 'coming_soon'}
                    title={item.status === 'coming_soon' ? 'Esta integración todavía no está disponible' : undefined}
                    className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {savedFeedback === item.id ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                        <span>¡Guardado!</span>
                      </>
                    ) : (
                      <>
                        <Key className="w-3.5 h-3.5" />
                        <span>Guardar Credenciales</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>

      <LandingWizardModal
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
      />
    </div>
  );
}
