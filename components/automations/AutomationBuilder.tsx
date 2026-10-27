'use client';

import React, { useState, useEffect } from 'react';
import {
  Zap,
  Sparkles,
  PhoneCall,
  MessageSquare,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  Plus,
  Play,
  Settings2,
  Activity,
  Filter,
  Server,
  UserCheck,
  RefreshCw,
  AlertCircle,
  ExternalLink,
  Copy,
  Trash2,
  Search,
  Sliders,
  ChevronRight,
  Bot,
  Truck,
  ShieldCheck,
  Check,
  Send,
  Workflow,
  History,
} from 'lucide-react';
import { logiStore } from '@/lib/store';
import { AutomationFlow } from '@/lib/types';

interface ExecutionLog {
  id: string;
  flowId: string;
  flowName: string;
  triggerEvent: string;
  orderNumber?: string;
  customerName?: string;
  actionsExecuted: string[];
  status: 'success' | 'failed' | 'in_progress';
  latencyMs: number;
  timestamp: string;
  details?: string;
}

const INITIAL_EXECUTION_LOGS: ExecutionLog[] = [
  {
    id: 'log-101',
    flowId: 'auto-1',
    flowName: 'Disparo Inmediato de Llamada IA al Recibir Pedido',
    triggerEvent: 'order_created',
    orderNumber: 'LP-9821',
    customerName: 'Santiago Rodríguez',
    actionsExecuted: ['Plantilla WhatsApp order_received_alert', 'Llamada IA encolada (2 min)'],
    status: 'success',
    latencyMs: 380,
    timestamp: 'Hace 4 minutos',
    details: 'WhatsApp entregado a +57 312 458 9120. Valentina IA programada.',
  },
  {
    id: 'log-102',
    flowId: 'auto-3',
    flowName: 'Pedido Confirmado por Voz -> Generar Despacho',
    triggerEvent: 'call_confirmed',
    orderNumber: 'LP-9821',
    customerName: 'Santiago Rodríguez',
    actionsExecuted: ['Estado actualizado a confirmed_by_voice', 'WhatsApp order_confirmed_success', 'Webhook logístico despachado'],
    status: 'success',
    latencyMs: 510,
    timestamp: 'Hace 8 minutos',
    details: 'Webhook respondió HTTP 200 con número de guía logística #GUIA-77821.',
  },
  {
    id: 'log-103',
    flowId: 'auto-2',
    flowName: 'Reintento Inteligente si No Contesta la Llamada',
    triggerEvent: 'call_unanswered',
    orderNumber: 'LP-9824',
    customerName: 'Diana Carolina Ruiz',
    actionsExecuted: ['WhatsApp missed_call_notice', 'Estado cambiado a retry_scheduled (+45 min)'],
    status: 'success',
    latencyMs: 290,
    timestamp: 'Hace 35 minutos',
    details: 'Cliente no contestó tras 5 timbres. Notificación WhatsApp enviada.',
  },
  {
    id: 'log-104',
    flowId: 'auto-1',
    flowName: 'Disparo Inmediato de Llamada IA al Recibir Pedido',
    triggerEvent: 'order_created',
    orderNumber: 'LP-9822',
    customerName: 'Camila Montoya López',
    actionsExecuted: ['Plantilla WhatsApp order_received_alert', 'Llamada IA disparada'],
    status: 'success',
    latencyMs: 410,
    timestamp: 'Hace 1 hora',
    details: 'Llamada contestada al 1er intento. Duración: 64s.',
  },
  {
    id: 'log-105',
    flowId: 'auto-3',
    flowName: 'Pedido Confirmado por Voz -> Generar Despacho',
    triggerEvent: 'call_confirmed',
    orderNumber: 'LP-9822',
    customerName: 'Camila Montoya López',
    actionsExecuted: ['Estado actualizado', 'Webhook logístico'],
    status: 'success',
    latencyMs: 460,
    timestamp: 'Hace 58 minutos',
    details: 'Generación de guía Servientrega automática.',
  },
];

const TRIGGER_LABELS: Record<string, { title: string; subtitle: string; icon: any; color: string; bg: string }> = {
  order_created: {
    title: 'Nuevo Pedido Creado',
    subtitle: 'Cliente envía formulario en Landing Page',
    icon: Sparkles,
    color: 'text-amber-500',
    bg: 'bg-amber-500/10 border-amber-500/30',
  },
  call_confirmed: {
    title: 'Llamada IA Confirmada',
    subtitle: 'El cliente confirmó dirección y valor COD',
    icon: CheckCircle2,
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10 border-emerald-500/30',
  },
  call_unanswered: {
    title: 'Llamada No Contesta / Buzón',
    subtitle: 'Llamada no atendida o rechazada',
    icon: AlertCircle,
    color: 'text-orange-500',
    bg: 'bg-orange-500/10 border-orange-500/30',
  },
  incoming_message: {
    title: 'Mensaje Entrante CRM',
    subtitle: 'Cliente escribe por WhatsApp o Messenger',
    icon: MessageSquare,
    color: 'text-blue-500',
    bg: 'bg-blue-500/10 border-blue-500/30',
  },
};

const ACTION_LABELS: Record<string, { title: string; desc: string; icon: any; badgeColor: string }> = {
  trigger_voice_call: {
    title: 'Disparar Llamada con Valentina IA',
    desc: 'Llama automáticamente al comprador para validar dirección y confirmar contraentrega',
    icon: PhoneCall,
    badgeColor: 'bg-red-50 text-brand-red border-red-200',
  },
  send_whatsapp_template: {
    title: 'Enviar WhatsApp Oficial (Meta Cloud)',
    desc: 'Mensaje con botón de confirmación directa o aviso de despacho',
    icon: Send,
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  create_agent_task: {
    title: 'Crear Tarea para Asesor Humano',
    desc: 'Asigna al equipo comercial para revisión manual de pedidos dudosos',
    icon: UserCheck,
    badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
  },
  update_order_status: {
    title: 'Actualizar Estado del Pedido',
    desc: 'Cambia el estado en LogiPages (Confirmado, Reprogramado, Cancelado)',
    icon: RefreshCw,
    badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  trigger_webhook: {
    title: 'Webhook Logístico (Coordinadora / Envia / Dropi)',
    desc: 'Envía los datos de despacho al software logístico o ERP',
    icon: Server,
    badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  },
};

export default function AutomationBuilder() {
  const [flows, setFlows] = useState<AutomationFlow[]>([]);
  const [activeTab, setActiveTab] = useState<'flows' | 'history'>('flows');
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [testingFlowId, setTestingFlowId] = useState<string | null>(null);
  const [executionLogs, setExecutionLogs] = useState<ExecutionLog[]>(INITIAL_EXECUTION_LOGS);
  const [notificationMsg, setNotificationMsg] = useState<string | null>(null);

  // Form State for New Automation
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newTrigger, setNewTrigger] = useState<AutomationFlow['triggerEvent']>('order_created');
  const [newConditionField, setNewConditionField] = useState('paymentMethod');
  const [newConditionOp, setNewConditionOp] = useState<'equals' | 'greater_than' | 'contains'>('equals');
  const [newConditionVal, setNewConditionVal] = useState('cash_on_delivery');
  const [selectedActions, setSelectedActions] = useState<string[]>([
    'send_whatsapp_template',
    'trigger_voice_call',
  ]);
  const [webhookUrl, setWebhookUrl] = useState('https://api.tu-tienda.com/webhook/orders');
  const [callDelayMinutes, setCallDelayMinutes] = useState(2);

  // Load flows from store
  useEffect(() => {
    loadFlows();
  }, []);

  const loadFlows = () => {
    const data = logiStore.getAutomations();
    setFlows(data);
  };

  const showNotification = (msg: string) => {
    setNotificationMsg(msg);
    setTimeout(() => setNotificationMsg(null), 3500);
  };

  const handleToggleFlow = (id: string) => {
    logiStore.toggleAutomation(id);
    const updated = logiStore.getAutomations();
    setFlows(updated);
    const flow = updated.find((f) => f.id === id);
    if (flow) {
      showNotification(
        flow.isActive
          ? `Automatización "${flow.name}" activada con éxito.`
          : `Automatización "${flow.name}" pausada.`
      );
    }
  };

  const handleRunTest = (flow: AutomationFlow) => {
    setTestingFlowId(flow.id);
    setTimeout(() => {
      // Simulate successful test execution
      const newLog: ExecutionLog = {
        id: `log-${Date.now()}`,
        flowId: flow.id,
        flowName: flow.name,
        triggerEvent: flow.triggerEvent,
        orderNumber: `LP-${Math.floor(1000 + Math.random() * 9000)}`,
        customerName: 'Prueba de Automatización (Simulación)',
        actionsExecuted: flow.actions.map(
          (a) => ACTION_LABELS[a.type]?.title || a.type
        ),
        status: 'success',
        latencyMs: Math.floor(280 + Math.random() * 250),
        timestamp: 'Justo ahora',
        details: 'Simulación completada en vivo sin errores.',
      };

      setExecutionLogs((prev) => [newLog, ...prev]);

      // Increment executions in store
      flow.executionsCount = (flow.executionsCount || 0) + 1;
      flow.lastTriggeredAt = new Date().toISOString();
      logiStore.saveAutomation(flow);
      setFlows([...logiStore.getAutomations()]);

      setTestingFlowId(null);
      showNotification(`¡Simulación exitosa! Se ejecutaron ${flow.actions.length} acciones.`);
    }, 1200);
  };

  const handleCreateFlow = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const actionsPayload = selectedActions.map((actionType) => {
      if (actionType === 'trigger_voice_call') {
        return {
          type: 'trigger_voice_call' as const,
          payload: { delayMinutes: callDelayMinutes, agentId: 'va-default-1' },
        };
      }
      if (actionType === 'send_whatsapp_template') {
        return {
          type: 'send_whatsapp_template' as const,
          payload: { template: 'order_received_alert' },
        };
      }
      if (actionType === 'trigger_webhook') {
        return {
          type: 'trigger_webhook' as const,
          payload: { endpoint: webhookUrl },
        };
      }
      if (actionType === 'update_order_status') {
        return {
          type: 'update_order_status' as const,
          payload: { status: 'confirmed_by_voice' },
        };
      }
      return {
        type: 'create_agent_task' as const,
        payload: { priority: 'high', note: 'Revisión manual requerida' },
      };
    });

    const newFlow: AutomationFlow = {
      id: `auto-${Date.now()}`,
      name: newName,
      description:
        newDesc ||
        'Flujo automatizado para optimización de conversiones y confirmación COD.',
      triggerEvent: newTrigger,
      conditions: [
        {
          field: newConditionField,
          operator: newConditionOp,
          value: newConditionVal,
        },
      ],
      actions: actionsPayload,
      isActive: true,
      executionsCount: 0,
      lastTriggeredAt: undefined,
    };

    logiStore.saveAutomation(newFlow);
    loadFlows();
    setIsModalOpen(false);

    // Reset Form
    setNewName('');
    setNewDesc('');
    setSelectedActions(['send_whatsapp_template', 'trigger_voice_call']);
    showNotification(`Nueva automatización "${newFlow.name}" creada y lista para operar.`);
  };

  const toggleActionSelection = (actionKey: string) => {
    setSelectedActions((prev) =>
      prev.includes(actionKey)
        ? prev.filter((k) => k !== actionKey)
        : [...prev, actionKey]
    );
  };

  const filteredFlows = flows.filter(
    (f) =>
      f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notificationMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-slate-700 animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-sm font-medium">{notificationMsg}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-[#172C8A] rounded-2xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-slate-700/50">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial-gradient opacity-10 pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-white text-xs font-semibold backdrop-blur-sm mb-3 border border-white/15">
              <Workflow className="w-3.5 h-3.5 text-brand-orange" />
              <span>Motor de Automatización de E-commerce & COD</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Automatizaciones & Workflows
            </h1>
            <p className="text-slate-300 text-sm sm:text-base mt-2 leading-relaxed">
              Conecta disparadores en tiempo real (nuevo pedido, llamada no contesta, confirmación) con llamadas automáticas por IA, mensajes oficiales de WhatsApp y sincronización con transportadoras.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-brand-gradient hover:opacity-95 text-white font-bold rounded-xl shadow-glow-orange transition transform active:scale-95 text-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Crear Nueva Automatización</span>
            </button>
          </div>
        </div>

        {/* Quick KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-6 border-t border-white/10">
          <div>
            <div className="text-xs text-slate-400 font-medium">Flujos Activos</div>
            <div className="text-2xl font-black text-white mt-0.5">
              {flows.filter((f) => f.isActive).length} / {flows.length}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">Ejecuciones Totales</div>
            <div className="text-2xl font-black text-emerald-400 mt-0.5">
              {flows.reduce((acc, f) => acc + (f.executionsCount || 0), 0).toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">Tasa de Entrega WA</div>
            <div className="text-2xl font-black text-white mt-0.5">99.4%</div>
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">Tiempo Respuesta IA</div>
            <div className="text-2xl font-black text-amber-400 mt-0.5">&lt; 2 min</div>
          </div>
        </div>
      </div>

      {/* Tabs and Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('flows')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition ${
              activeTab === 'flows'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Workflow className="w-4 h-4" />
            <span>Flujos Configurados ({flows.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition ${
              activeTab === 'history'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Historial de Ejecuciones ({executionLogs.length})</span>
          </button>
        </div>

        {activeTab === 'flows' && (
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nombre o acción..."
              className="w-full text-xs bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red"
            />
          </div>
        )}
      </div>

      {/* Tab 1: Visual Flows View */}
      {activeTab === 'flows' && (
        <div className="space-y-6">
          {filteredFlows.length === 0 ? (
            <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-12 text-center">
              <Workflow className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800">No se encontraron automatizaciones</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Crea tu primer flujo para que Valentina IA llame a tus compradores automáticamente o envía WhatsApp al momento de la venta.
              </p>
              <button
                onClick={() => setIsModalOpen(true)}
                className="mt-4 px-4 py-2 bg-brand-red text-white text-xs font-bold rounded-lg shadow"
              >
                Crear Ahora
              </button>
            </div>
          ) : (
            filteredFlows.map((flow) => {
              const triggerMeta =
                TRIGGER_LABELS[flow.triggerEvent] || TRIGGER_LABELS.order_created;
              const TriggerIcon = triggerMeta.icon;
              const isTesting = testingFlowId === flow.id;

              return (
                <div
                  key={flow.id}
                  className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden shadow-sm hover:shadow-md ${
                    flow.isActive
                      ? 'border-slate-200 ring-1 ring-slate-100'
                      : 'border-slate-200 opacity-75 bg-slate-50/50'
                  }`}
                >
                  {/* Flow Header */}
                  <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
                    <div className="flex items-start sm:items-center gap-3">
                      {/* Active Toggle Switch */}
                      <button
                        type="button"
                        onClick={() => handleToggleFlow(flow.id)}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          flow.isActive ? 'bg-emerald-500' : 'bg-slate-300'
                        }`}
                        title={flow.isActive ? 'Desactivar flujo' : 'Activar flujo'}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                            flow.isActive ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>

                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-slate-900 tracking-tight">
                            {flow.name}
                          </h3>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              flow.isActive
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-500 border border-slate-200'
                            }`}
                          >
                            {flow.isActive ? 'ACTIVO' : 'PAUSADO'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{flow.description}</p>
                      </div>
                    </div>

                    {/* Stats & Actions */}
                    <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
                      <div className="text-right hidden sm:block">
                        <span className="text-[11px] text-slate-400 block font-medium">Ejecutado</span>
                        <span className="text-xs font-bold text-slate-700">
                          {flow.executionsCount} veces
                        </span>
                      </div>

                      <button
                        onClick={() => handleRunTest(flow)}
                        disabled={isTesting}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition border ${
                          isTesting
                            ? 'bg-amber-50 text-amber-700 border-amber-300'
                            : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-sm'
                        }`}
                        title="Ejecutar una prueba simulada"
                      >
                        {isTesting ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-600" />
                            <span>Probando...</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5 text-brand-red fill-current" />
                            <span>Probar Flujo</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Flowchart Diagram (Visual Nodes) */}
                  <div className="p-6 overflow-x-auto">
                    <div className="min-w-[650px] flex items-stretch gap-4">
                      {/* Node 1: TRIGGER */}
                      <div className="flex-1 bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-between relative group hover:border-amber-400 transition">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-black tracking-wider uppercase px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                            1. Disparador
                          </span>
                          <TriggerIcon className={`w-4 h-4 ${triggerMeta.color}`} />
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 text-sm">
                            {triggerMeta.title}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {triggerMeta.subtitle}
                          </div>
                        </div>
                        <div className="mt-3 pt-2 border-t border-slate-100 text-[10px] text-slate-400 font-mono">
                          evento: {flow.triggerEvent}
                        </div>
                      </div>

                      {/* Connector Arrow */}
                      <div className="flex flex-col items-center justify-center shrink-0 px-1">
                        <div className="h-0.5 w-6 bg-slate-300 relative">
                          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 border-t-2 border-r-2 border-slate-400 rotate-45" />
                        </div>
                        <span className="text-[9px] font-bold text-slate-400 mt-1 uppercase">
                          Valida
                        </span>
                      </div>

                      {/* Node 2: CONDITION */}
                      <div className="w-56 bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-between">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-black tracking-wider uppercase px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                            2. Condición
                          </span>
                          <Filter className="w-4 h-4 text-slate-500" />
                        </div>
                        <div>
                          {flow.conditions && flow.conditions.length > 0 ? (
                            flow.conditions.map((cond, idx) => (
                              <div key={idx} className="space-y-1">
                                <div className="text-xs font-semibold text-slate-800">
                                  {cond.field}
                                </div>
                                <div className="text-[11px] font-mono bg-white px-2 py-1 rounded border border-slate-200 text-slate-600">
                                  {cond.operator === 'equals'
                                    ? '=='
                                    : cond.operator === 'greater_than'
                                    ? '>'
                                    : 'contiene'}{' '}
                                  "{cond.value}"
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="text-xs text-slate-500 italic">
                              Sin condiciones (Siempre ejecuta)
                            </div>
                          )}
                        </div>
                        <div className="mt-3 pt-2 border-t border-slate-200/60 text-[10px] text-emerald-600 font-medium flex items-center gap-1">
                          <Check className="w-3 h-3" /> Si es verdadero
                        </div>
                      </div>

                      {/* Connector Arrow */}
                      <div className="flex flex-col items-center justify-center shrink-0 px-1">
                        <div className="h-0.5 w-6 bg-slate-300 relative">
                          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 border-t-2 border-r-2 border-slate-400 rotate-45" />
                        </div>
                        <span className="text-[9px] font-bold text-slate-400 mt-1 uppercase">
                          Ejecuta
                        </span>
                      </div>

                      {/* Node 3: ACTIONS */}
                      <div className="flex-[1.5] bg-gradient-to-br from-white to-slate-50 border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-between">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-black tracking-wider uppercase px-2 py-0.5 rounded bg-brand-red/10 text-brand-red border border-brand-red/20">
                            3. Acciones ({flow.actions.length})
                          </span>
                          <Zap className="w-4 h-4 text-brand-red fill-brand-red" />
                        </div>
                        <div className="space-y-2 mt-1">
                          {flow.actions.map((act, aIdx) => {
                            const actMeta = ACTION_LABELS[act.type] || {
                              title: act.type,
                              desc: 'Acción personalizada',
                              icon: Bot,
                              badgeColor: 'bg-slate-100 text-slate-700',
                            };
                            const ActionIcon = actMeta.icon;

                            return (
                              <div
                                key={aIdx}
                                className="flex items-start gap-2.5 p-2 rounded-lg bg-white border border-slate-200/80 shadow-xs"
                              >
                                <div className="p-1 rounded bg-slate-100 text-slate-700 shrink-0 mt-0.5">
                                  <ActionIcon className="w-3.5 h-3.5" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs font-bold text-slate-800 truncate">
                                    {actMeta.title}
                                  </div>
                                  <div className="text-[10px] text-slate-500 truncate">
                                    {act.payload && Object.keys(act.payload).length > 0
                                      ? JSON.stringify(act.payload)
                                      : actMeta.desc}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <div className="mt-3 pt-2 border-t border-slate-100 text-[10px] text-slate-400 flex items-center justify-between">
                          <span>Modo: Asíncrono en Paralelo</span>
                          <span className="text-emerald-600 font-semibold">Cero latencia</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Tab 2: Execution History Log */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Registro de Ejecución en Tiempo Real
                </h3>
                <p className="text-xs text-slate-500">
                  Muestra cada evento procesado, tiempos de respuesta y códigos de respuesta de webhooks y WhatsApp.
                </p>
              </div>

              <button
                onClick={() => {
                  if (flows.length > 0) handleRunTest(flows[0]);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition shadow-sm self-start sm:self-auto"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Simular Evento Ahora</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Estado</th>
                    <th className="py-3 px-4">Flujo Disparado</th>
                    <th className="py-3 px-4">Cliente / Pedido</th>
                    <th className="py-3 px-4">Acciones Procesadas</th>
                    <th className="py-3 px-4">Latencia</th>
                    <th className="py-3 px-4">Hora</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {executionLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4">
                        {log.status === 'success' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" /> Exitoso
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
                            <XCircle className="w-3 h-3" /> Error
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        <div>{log.flowName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          evento: {log.triggerEvent}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-800">
                          {log.customerName || 'Cliente Anónimo'}
                        </div>
                        {log.orderNumber && (
                          <div className="text-[10px] text-brand-red font-semibold">
                            {log.orderNumber}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          {log.actionsExecuted.map((act, i) => (
                            <div
                              key={i}
                              className="text-[11px] text-slate-600 flex items-center gap-1"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              {act}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                        {log.latencyMs} ms
                      </td>
                      <td className="py-3 px-4 text-slate-400 text-[11px] whitespace-nowrap">
                        {log.timestamp}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Crear Nueva Automatización */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-brand-gradient text-white shadow-glow-orange">
                  <Workflow className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Crear Nueva Automatización
                  </h2>
                  <p className="text-xs text-slate-500">
                    Configura el disparador, la condición lógica y las acciones deseadas.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition"
              >
                ✕
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateFlow} className="p-6 space-y-6">
              {/* General Details */}
              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  1. Nombre de la Automatización
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ej: Confirmar Pedido COD + Despacho Inmediato"
                  className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red"
                />
                <input
                  type="text"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Descripción breve del objetivo de este flujo"
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red"
                />
              </div>

              {/* Step 2: Trigger Event */}
              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  2. ¿Qué evento dispara esta automatización?
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(
                    Object.keys(TRIGGER_LABELS) as AutomationFlow['triggerEvent'][]
                  ).map((key) => {
                    const item = TRIGGER_LABELS[key];
                    const Icon = item.icon;
                    const isSelected = newTrigger === key;

                    return (
                      <div
                        key={key}
                        onClick={() => setNewTrigger(key)}
                        className={`p-3.5 rounded-xl border cursor-pointer transition text-left flex items-start gap-3 ${
                          isSelected
                            ? 'border-brand-red bg-brand-red/5 ring-1 ring-brand-red'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <div
                          className={`p-2 rounded-lg ${
                            isSelected ? 'bg-brand-red text-white' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900">{item.title}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                            {item.subtitle}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Step 3: Condition */}
              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  3. Condición de Filtrado (Opcional)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <select
                    value={newConditionField}
                    onChange={(e) => setNewConditionField(e.target.value)}
                    className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-red/20"
                  >
                    <option value="paymentMethod">Método de Pago</option>
                    <option value="attempts">Intentos de Llamada</option>
                    <option value="city">Ciudad</option>
                    <option value="totalAmount">Monto Total</option>
                  </select>

                  <select
                    value={newConditionOp}
                    onChange={(e) => setNewConditionOp(e.target.value as any)}
                    className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-red/20"
                  >
                    <option value="equals">Es igual a</option>
                    <option value="greater_than">Es mayor que</option>
                    <option value="contains">Contiene texto</option>
                  </select>

                  <input
                    type="text"
                    value={newConditionVal}
                    onChange={(e) => setNewConditionVal(e.target.value)}
                    placeholder="Valor (ej: cash_on_delivery)"
                    className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-red/20"
                  />
                </div>
              </div>

              {/* Step 4: Actions Multi-select */}
              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  4. Acciones a Ejecutar
                </label>
                <div className="space-y-2.5">
                  {Object.entries(ACTION_LABELS).map(([actionKey, item]) => {
                    const isChecked = selectedActions.includes(actionKey);
                    const Icon = item.icon;

                    return (
                      <div
                        key={actionKey}
                        onClick={() => toggleActionSelection(actionKey)}
                        className={`p-3 rounded-xl border cursor-pointer transition flex items-start gap-3 ${
                          isChecked
                            ? 'border-emerald-500 bg-emerald-50/20 ring-1 ring-emerald-500'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5 border ${
                            isChecked
                              ? 'bg-emerald-600 border-emerald-600 text-white'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Icon className="w-3.5 h-3.5 text-slate-600" />
                            <span className="text-xs font-bold text-slate-900">{item.title}</span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">{item.desc}</p>

                          {/* Extra config fields if checked */}
                          {isChecked && actionKey === 'trigger_voice_call' && (
                            <div className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                              <span>Retardo antes de llamar:</span>
                              <input
                                type="number"
                                min={0}
                                max={60}
                                value={callDelayMinutes}
                                onChange={(e) => setCallDelayMinutes(Number(e.target.value))}
                                onClick={(e) => e.stopPropagation()}
                                className="w-16 px-2 py-1 border border-slate-200 rounded text-center text-xs font-bold"
                              />
                              <span>minutos</span>
                            </div>
                          )}

                          {isChecked && actionKey === 'trigger_webhook' && (
                            <div className="mt-2 text-xs">
                              <input
                                type="url"
                                value={webhookUrl}
                                onChange={(e) => setWebhookUrl(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                placeholder="https://api.tu-tienda.com/webhook"
                                className="w-full px-2.5 py-1.5 border border-slate-200 rounded text-xs font-mono"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Modal Actions */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-semibold transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={selectedActions.length === 0}
                  className="px-5 py-2.5 bg-brand-gradient hover:opacity-95 text-white font-bold rounded-xl text-xs shadow-glow-orange transition disabled:opacity-50"
                >
                  Guardar y Activar Automatización
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
