'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Bot,
  Sparkles,
  Save,
  PhoneCall,
  Key,
  Eye,
  EyeOff,
  Globe,
  Volume2,
  Clock,
  PhoneForwarded,
  Sliders,
  CheckCircle2,
  RotateCcw,
  Zap,
  Info,
  Layers,
  AlertTriangle,
  Play,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { VoiceAgentSettings as IVoiceAgentSettings } from '@/lib/types';
import { logiStore } from '@/lib/store';
import { VoiceCallSimulatorModal } from './VoiceCallSimulatorModal';

const PROVIDER_OPTIONS = [
  {
    id: 'internal_simulator' as const,
    name: 'LogiPages Simulator',
    badge: 'Recomendado para Pruebas',
    description: 'Motor nativo Web Speech Synthesis sin costos adicionales de API. Ideal para validación y testing en vivo.',
    icon: '⚡',
    color: 'from-blue-600 to-indigo-600',
  },
  {
    id: 'vapi' as const,
    name: 'Vapi AI',
    badge: 'Ultra Baja Latencia',
    description: 'Telefonía con latencia menor a 500ms, interrupción natural de turnos y soporte WebRTC/SIP empresarial.',
    icon: '🎙️',
    color: 'from-purple-600 to-pink-600',
  },
  {
    id: 'retell' as const,
    name: 'Retell AI',
    badge: 'Voces Ultra Realistas',
    description: 'Modelos de lenguaje y voz diseñados específicamente para ventas contraentrega y alta persuasión.',
    icon: '🗣️',
    color: 'from-emerald-600 to-teal-600',
  },
  {
    id: 'twilio_voice' as const,
    name: 'Twilio Voice + OpenAI',
    badge: 'Carrier Global',
    description: 'Telefonía PSTN estándar con enrutamiento a números celulares y fijos en más de 180 países.',
    icon: '📞',
    color: 'from-red-600 to-orange-600',
  },
];

const ACCENT_OPTIONS = [
  { id: 'colombia' as const, label: 'Colombia', flag: '🇨🇴', desc: 'Bogotá / Medellín — Cordial y respetuoso' },
  { id: 'mexico' as const, label: 'México', flag: '🇲🇽', desc: 'CDMX / Central — Dinámico y comercial' },
  { id: 'spain' as const, label: 'España', flag: '🇪🇸', desc: 'Castellano Neutro — Directo y formal' },
  { id: 'argentina' as const, label: 'Argentina', flag: '🇦🇷', desc: 'Rioplatense — Enérgico y cercano' },
  { id: 'neutral' as const, label: 'Neutro Global', flag: '🌎', desc: 'Latinoamérica neutro sin modismos locales' },
];

const TONE_OPTIONS = [
  {
    id: 'amable_comercial' as const,
    title: 'Amable Comercial',
    tag: 'Mayor Conversión Dropshipping',
    description: 'Voz cálida, empática y cordial. Disuelve dudas sobre pago en efectivo y genera alta confianza en el comprador.',
  },
  {
    id: 'formal_seguro' as const,
    title: 'Formal Seguro',
    tag: 'Para Tickets Altos',
    description: 'Tono corporativo y estricto. Confirma cada detalle de la nomenclatura domiciliaria y términos de entrega.',
  },
  {
    id: 'dinamico_urgente' as const,
    title: 'Dinámico Urgente',
    tag: 'Despachos Mismo Día',
    description: 'Ágil y entusiasta. Concluye la verificación en menos de 45 segundos para liberar guías de transporte al instante.',
  },
];

const PLACEHOLDER_TAGS = [
  { tag: '{{cliente}}', desc: 'Nombre del comprador' },
  { tag: '{{producto}}', desc: 'Nombre del producto' },
  { tag: '{{combo}}', desc: 'Variante o combo elegido' },
  { tag: '{{total}}', desc: 'Monto a pagar en efectivo' },
  { tag: '{{ciudad}}', desc: 'Ciudad de destino' },
  { tag: '{{direccion}}', desc: 'Dirección ingresada' },
  { tag: '{{telefono}}', desc: 'Teléfono del cliente' },
];

interface VoiceAgentSettingsProps {
  onOpenSimulator?: () => void;
}

export const VoiceAgentSettings: React.FC<VoiceAgentSettingsProps> = ({ onOpenSimulator }) => {
  const [settings, setSettings] = useState<IVoiceAgentSettings>(() => {
    return logiStore.getVoiceAgent();
  });

  const [showApiKey, setShowApiKey] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [currentTimeStr, setCurrentTimeStr] = useState('');
  const scriptTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Keep live time updated for operating hours badge
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTimeStr(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  // Check if current time is within operating hours
  const checkIsOperatingHours = (): boolean => {
    if (!settings.allowedHoursStart || !settings.allowedHoursEnd) return true;
    const now = new Date();
    const curMin = now.getHours() * 60 + now.getMinutes();

    const [sH, sM] = settings.allowedHoursStart.split(':').map(Number);
    const [eH, eM] = settings.allowedHoursEnd.split(':').map(Number);
    const startMin = (sH || 0) * 60 + (sM || 0);
    const endMin = (eH || 0) * 60 + (eM || 0);

    return curMin >= startMin && curMin <= endMin;
  };

  const isOperating = checkIsOperatingHours();

  const handleSave = () => {
    logiStore.saveVoiceAgent(settings);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3500);
  };

  const insertTagIntoScript = (tag: string) => {
    const textarea = scriptTextareaRef.current;
    if (!textarea) {
      setSettings((prev) => ({
        ...prev,
        promptScript: `${prev.promptScript} ${tag}`,
      }));
      return;
    }

    const startPos = textarea.selectionStart;
    const endPos = textarea.selectionEnd;
    const currentVal = settings.promptScript;
    const newVal =
      currentVal.substring(0, startPos) +
      ` ${tag} ` +
      currentVal.substring(endPos);

    setSettings((prev) => ({
      ...prev,
      promptScript: newVal,
    }));

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        startPos + tag.length + 2,
        startPos + tag.length + 2
      );
    }, 20);
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      {/* Top Banner & Main Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)] relative overflow-hidden">
        {/* Glow accent */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#FF252B]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center gap-4 relative z-10">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#FF252B] to-[#FF5A16] flex items-center justify-center shadow-lg shadow-red-500/30">
            <Bot className="w-8 h-8 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Configuración del Agente de Voz IA
              </h2>
              <span className="bg-emerald-50 text-emerald-600 border border-emerald-200 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                {settings.isActive ? 'Activo 24/7' : 'Pausado'}
              </span>
            </div>
            <p className="text-sm text-slate-600 mt-0.5">
              Automatiza la confirmación telefónica de pedidos contraentrega antes de despachar.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto relative z-10">
          <button
            type="button"
            onClick={() => setIsTestModalOpen(true)}
            className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-900 font-semibold text-xs transition border border-slate-200 flex items-center justify-center gap-2 shadow-sm"
          >
            <Play className="w-4 h-4 text-emerald-600 fill-emerald-400" />
            Simular Llamada en Vivo
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#FF252B] to-[#FF5A16] hover:opacity-95 text-white font-bold text-xs transition shadow-lg shadow-red-500/25 flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            Guardar Configuración
          </button>
        </div>
      </div>

      {/* Success Notification Alert */}
      {savedSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center gap-3 animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <div className="text-sm">
            <strong className="text-slate-900">¡Ajustes guardados con éxito!</strong> Los parámetros
            del agente de voz y las reglas de confirmación han sido actualizadas.
          </div>
        </div>
      )}

      {/* Master Toggle Card */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200/80 flex items-center justify-between">
        <div className="space-y-0.5">
          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Zap className="w-4 h-4 text-[#FF5A16]" />
            Llamadas Automáticas al Crear Pedido
          </h4>
          <p className="text-xs text-slate-500">
            Disparar llamada de voz por IA tan pronto el cliente envía el formulario en la landing
            page.
          </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={settings.isActive}
            onChange={(e) => setSettings({ ...settings, isActive: e.target.checked })}
            className="sr-only peer"
          />
          <div className="w-12 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[3px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-[#FF252B] peer-checked:to-[#FF5A16]"></div>
        </label>
      </div>

      {/* SECTION 1: Provider & Telephony Engine */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)] space-y-6">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Layers className="w-5 h-5 text-[#FF252B]" />
            1. Proveedor de Telefonía e Inteligencia de Voz
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Selecciona el motor que procesará las llamadas telefónicas hacia los clientes.
          </p>
        </div>

        {/* Provider Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {PROVIDER_OPTIONS.map((prov) => {
            const isSelected = settings.provider === prov.id;
            return (
              <div
                key={prov.id}
                onClick={() => setSettings({ ...settings, provider: prov.id })}
                className={`cursor-pointer p-4 rounded-2xl border transition-all relative flex flex-col justify-between ${
                  isSelected
                    ? 'bg-red-50/50 border-[#FF252B] ring-1 ring-[#FF252B]'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-white'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <span className="text-2xl">{prov.icon}</span>
                      <span className="text-[15px] font-semibold text-slate-900">{prov.name}</span>
                    </div>
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        isSelected
                          ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                          : 'bg-slate-50 text-slate-500'
                      }`}
                    >
                      {prov.badge}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">{prov.description}</p>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-200 flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    {isSelected ? '✓ Seleccionado' : 'Hacer clic para activar'}
                  </span>
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      isSelected
                        ? 'border-[#FF252B] bg-[#FF252B]'
                        : 'border-slate-600'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3 text-slate-900" />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* External Provider Credentials (if not internal simulator) */}
        {settings.provider !== 'internal_simulator' && (
          <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-4 animate-fadeIn">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              <Key className="w-4 h-4 text-amber-600" />
              Credenciales de Conexión ({settings.provider.toUpperCase()}):
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  API Key / Secret Token
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={settings.apiKey || ''}
                    onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
                    placeholder="sk_live_..."
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#FF252B]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                  >
                    {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Agent ID / Assistant ID
                </label>
                <input
                  type="text"
                  value={settings.agentId || ''}
                  onChange={(e) => setSettings({ ...settings, agentId: e.target.value })}
                  placeholder="asst_903820..."
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#FF252B]"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Número Telefónico Saliente (Caller ID con código de país)
                </label>
                <input
                  type="text"
                  value={settings.phoneNumber || ''}
                  onChange={(e) => setSettings({ ...settings, phoneNumber: e.target.value })}
                  placeholder="+57 601 794 8800"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#FF252B]"
                />
                <span className="text-xs text-slate-500 mt-1 block">
                  El cliente verá este número en el identificador de llamadas de su celular.
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 2: Agent Identity, Language, Accent & Tone */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)] space-y-6">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Volume2 className="w-5 h-5 text-[#FF5A16]" />
            2. Identidad del Asistente, Idioma y Personalidad
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Personaliza cómo suena tu asistente para conectar culturalmente con tu audiencia.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Nombre Público del Asistente
            </label>
            <input
              type="text"
              value={settings.name}
              onChange={(e) => setSettings({ ...settings, name: e.target.value })}
              placeholder="Valentina — Despachos LogiPages"
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#FF252B]"
            />
            <span className="text-xs text-slate-500 mt-1 block">
              Se presentará al cliente diciendo: "Hola, te habla [Nombre]..."
            </span>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Código de Idioma Base
            </label>
            <select
              value={settings.language}
              onChange={(e) => setSettings({ ...settings, language: e.target.value })}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#FF252B]"
            >
              <option value="es-CO">Español - Colombia (es-CO)</option>
              <option value="es-MX">Español - México (es-MX)</option>
              <option value="es-ES">Español - España (es-ES)</option>
              <option value="es-AR">Español - Argentina (es-AR)</option>
            </select>
          </div>
        </div>

        {/* Accent Selector with Flag Badges */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-2 flex items-center gap-1.5">
            <Globe className="w-4 h-4 text-blue-600" />
            Acento Regional y Entonación
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
            {ACCENT_OPTIONS.map((acc) => {
              const isSelected = settings.accent === acc.id;
              return (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => setSettings({ ...settings, accent: acc.id })}
                  className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between ${
                    isSelected
                      ? 'bg-blue-50/60 border-blue-500 ring-1 ring-blue-500 text-slate-900'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <div className="text-2xl mb-1">{acc.flag}</div>
                  <div className="font-bold text-xs">{acc.label}</div>
                  <div className="text-[11px] text-slate-500 mt-1 leading-tight">{acc.desc}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Voice Personality / Tone Selector */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-2">
            Personalidad y Tono de la Conversación
          </label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {TONE_OPTIONS.map((tone) => {
              const isSelected = settings.tone === tone.id;
              return (
                <div
                  key={tone.id}
                  onClick={() => setSettings({ ...settings, tone: tone.id })}
                  className={`cursor-pointer p-4 rounded-2xl border transition flex flex-col justify-between ${
                    isSelected
                      ? 'bg-orange-50/50 border-[#FF5A16] ring-1 ring-[#FF5A16]'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-xs text-slate-900">{tone.title}</span>
                      <span className="text-[10.5px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                        {tone.tag}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">{tone.description}</p>
                  </div>
                  <div className="mt-3 flex items-center justify-end">
                    <div
                      className={`w-3.5 h-3.5 rounded-full border ${
                        isSelected ? 'border-[#FF5A16] bg-[#FF5A16]' : 'border-slate-600'
                      }`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* SECTION 3: Interactive Prompt Script Editor */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-600" />
              3. Guion Conversacional e Instrucciones del Sistema (Prompt)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Haz clic en cualquier etiqueta dinámica para insertarla en la posición del cursor.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setSettings((prev) => ({
                ...prev,
                promptScript: `Eres Valentina, la asistente virtual oficial de LogiPages para confirmar pedidos contraentrega.
Tu objetivo es:
1. Saludar cortésmente a {{cliente}}.
2. Indicar que llamas para verificar el despacho de {{producto}} ({{combo}}) por un total de {{total}}.
3. Validar si la dirección en {{ciudad}} ({{direccion}}) es correcta y si habrá alguien para pagar en efectivo.
4. Si el comprador confirma ("Sí, confirmo"), marcas el pedido como confirmado.
5. Si requiere cambiar dirección o fecha, indicas que un asesor de soporte lo contactará de inmediato por WhatsApp.
6. Si dice que no lo pidió, cancelas cortésmente sin insistir.`,
              }));
            }}
            className="text-xs text-slate-500 hover:text-white flex items-center gap-1 self-start sm:self-auto"
          >
            <RotateCcw className="w-3 h-3" /> Restaurar Guion Estándar
          </button>
        </div>

        {/* Dynamic Placeholder Chips Bar */}
        <div className="flex flex-wrap items-center gap-1.5 p-3 rounded-2xl bg-white border border-slate-200">
          <span className="text-xs font-bold text-slate-500 mr-1">
            Tags Dinámicos:
          </span>
          {PLACEHOLDER_TAGS.map((item) => (
            <button
              key={item.tag}
              type="button"
              onClick={() => insertTagIntoScript(item.tag)}
              title={item.desc}
              className="px-2.5 py-1 rounded-xl bg-slate-50 hover:bg-[#FF252B]/20 border border-slate-200 hover:border-[#FF252B]/40 text-xs font-mono text-slate-700 hover:text-white transition flex items-center gap-1 group"
            >
              <span>{item.tag}</span>
              <span className="text-[11px] text-slate-500 group-hover:text-slate-300">
                ({item.desc})
              </span>
            </button>
          ))}
        </div>

        {/* Textarea Editor */}
        <div className="relative">
          <textarea
            ref={scriptTextareaRef}
            rows={9}
            value={settings.promptScript}
            onChange={(e) => setSettings({ ...settings, promptScript: e.target.value })}
            placeholder="Escribe aquí las instrucciones del agente de voz..."
            className="w-full bg-white border border-slate-200 rounded-2xl p-4 text-xs font-mono leading-relaxed text-slate-800 focus:outline-none focus:border-[#FF252B] selection:bg-[#FF252B]/40"
          />
          <div className="absolute right-3 bottom-3 text-[11px] text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
            {settings.promptScript.length} caracteres
          </div>
        </div>
      </div>

      {/* SECTION 4: Horarios Operativos y Políticas de Reintento */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)] space-y-6">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-emerald-600" />
            4. Ventana de Horario Permitido y Políticas de Llamada
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Evita molestar a tus clientes en horarios nocturnos cumpliendo las buenas prácticas de eCommerce.
          </p>
        </div>

        {/* Live Operating Status Badge */}
        <div
          className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            isOperating
              ? 'bg-emerald-950/40 border-emerald-200 text-emerald-700'
              : 'bg-amber-950/40 border-amber-200 text-amber-700'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-3.5 h-3.5 rounded-full ${
                isOperating ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            />
            <div>
              <div className="font-bold text-sm">
                {isOperating
                  ? '🟢 En horario permitido para llamadas'
                  : '🟡 Fuera de horario comercial'}
              </div>
              <div className="text-xs text-slate-600 mt-0.5">
                Hora actual del sistema: <strong>{currentTimeStr || '00:00'}</strong>.
                {isOperating
                  ? ' Las llamadas se despachan inmediatamente al registrarse órdenes.'
                  : ` Los pedidos recibidos se encolarán y se llamarán a partir de las ${settings.allowedHoursStart}.`}
              </div>
            </div>
          </div>
          <span className="text-xs font-mono px-3 py-1 rounded-xl bg-slate-100 border border-slate-200 self-start sm:self-auto">
            {settings.allowedHoursStart} - {settings.allowedHoursEnd}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Hora Inicio Permitida
            </label>
            <input
              type="time"
              value={settings.allowedHoursStart}
              onChange={(e) => setSettings({ ...settings, allowedHoursStart: e.target.value })}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#FF252B]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Hora Límite Nocturna
            </label>
            <input
              type="time"
              value={settings.allowedHoursEnd}
              onChange={(e) => setSettings({ ...settings, allowedHoursEnd: e.target.value })}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#FF252B]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Máximo de Intentos si no contesta
            </label>
            <select
              value={settings.maxAttempts}
              onChange={(e) => setSettings({ ...settings, maxAttempts: Number(e.target.value) })}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#FF252B]"
            >
              <option value={1}>1 intento único</option>
              <option value={2}>2 intentos</option>
              <option value={3}>3 intentos (Recomendado)</option>
              <option value={4}>4 intentos</option>
              <option value={5}>5 intentos</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Intervalo entre Reintentos
            </label>
            <select
              value={settings.retryIntervalMinutes}
              onChange={(e) =>
                setSettings({ ...settings, retryIntervalMinutes: Number(e.target.value) })
              }
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#FF252B]"
            >
              <option value={15}>Cada 15 minutos</option>
              <option value={30}>Cada 30 minutos</option>
              <option value={45}>Cada 45 minutos (Óptimo)</option>
              <option value={60}>Cada 1 hora</option>
              <option value={120}>Cada 2 horas</option>
            </select>
          </div>
        </div>

        {/* Human Transfer & Guardrails */}
        <div className="pt-4 border-t border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1 flex items-center gap-1.5">
              <PhoneForwarded className="w-4 h-4 text-amber-600" />
              Teléfono de Escalación a Asesor Humano
            </label>
            <input
              type="text"
              value={settings.operatorTransferPhone}
              onChange={(e) =>
                setSettings({ ...settings, operatorTransferPhone: e.target.value })
              }
              placeholder="+57 300 999 8877"
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#FF252B]"
            />
            <span className="text-xs text-slate-500 mt-1 block">
              Si el comprador solicita hablar con una persona o tiene dudas complejas, se transferirá a este número.
            </span>
          </div>

          <div className="space-y-3">
            <label className="flex items-start gap-2.5 cursor-pointer pt-2">
              <input
                type="checkbox"
                checked={settings.confirmAddressStrict}
                onChange={(e) =>
                  setSettings({ ...settings, confirmAddressStrict: e.target.checked })
                }
                className="mt-0.5 rounded border-slate-200 bg-white text-[#FF252B] focus:ring-0"
              />
              <div>
                <span className="text-xs font-semibold text-slate-900 block">
                  Exigir confirmación estricta de nomenclatura
                </span>
                <span className="text-xs text-slate-500">
                  La IA preguntará por casa, piso o apto si detecta una dirección genérica.
                </span>
              </div>
            </label>

            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.askForSecondaryPhone}
                onChange={(e) =>
                  setSettings({ ...settings, askForSecondaryPhone: e.target.checked })
                }
                className="mt-0.5 rounded border-slate-200 bg-white text-[#FF252B] focus:ring-0"
              />
              <div>
                <span className="text-xs font-semibold text-slate-900 block">
                  Solicitar teléfono alternativo o de WhatsApp
                </span>
                <span className="text-xs text-slate-500">
                  Pide un número secundario para asegurar la entrega si el principal está apagado.
                </span>
              </div>
            </label>
          </div>
        </div>
      </div>

      {/* Bottom Sticky Floating Save Bar */}
      <div className="flex items-center justify-between p-4 rounded-2xl bg-white backdrop-blur-md border border-slate-200 shadow-2xl">
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Configuración protegida y sincronizada en tiempo real</span>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsTestModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-900 font-semibold text-xs transition"
          >
            Probar Agente
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-6 py-2 rounded-xl bg-gradient-to-r from-[#FF252B] to-[#FF5A16] hover:opacity-95 text-white font-bold text-xs transition shadow-md shadow-red-500/20 flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            Guardar Cambios
          </button>
        </div>
      </div>

      {/* Simulator Modal for Live Testing */}
      <VoiceCallSimulatorModal
        isOpen={isTestModalOpen}
        onClose={() => setIsTestModalOpen(false)}
      />
    </div>
  );
};

export default VoiceAgentSettings;
