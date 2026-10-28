import { LandingPageConfig, OrderItem, VoiceAgentSettings, VoiceCallTask, CRMConversation, CRMMessage, CRMContact, AutomationFlow } from './types';

// Pre-configured high-impact landing page example
export const DEFAULT_LANDING_PAGES: LandingPageConfig[] = [];

export const DEFAULT_ORDERS: OrderItem[] = [];

export const DEFAULT_VOICE_AGENT: VoiceAgentSettings = {
  id: 'va-default-1',
  name: 'Valentina — Confirmadora COD',
  provider: 'internal_simulator',
  phoneNumber: '',
  language: 'es-CO',
  accent: 'colombia',
  voiceName: 'Valentina Neural (Bogotá - Amable)',
  tone: 'amable_comercial',
  promptScript: `Eres Valentina, la asistente virtual oficial de LogiPages para confirmar pedidos contraentrega.
Tu objetivo es:
1. Saludar cortésmente al cliente por su nombre.
2. Indicar que llamas para confirmar su pedido del producto registrado.
3. Confirmar la dirección exacta, la ciudad y el valor exacto a pagar en efectivo al repartidor.
4. Si el cliente confirma de manera afirmativa ("Sí, confirmo", "De acuerdo"), marcas el pedido como Confirmado.
5. Si necesita cambiar dirección o cantidad, anotas la corrección.
6. Si dice que no lo pidió o desea cancelar, cancelas cortésmente sin insistir agresivamente.`,
  allowedHoursStart: '08:30',
  allowedHoursEnd: '19:30',
  maxAttempts: 3,
  retryIntervalMinutes: 45,
  operatorTransferPhone: '',
  confirmAddressStrict: true,
  askForSecondaryPhone: false,
  isActive: false,
};

export const DEFAULT_CALL_TASKS: VoiceCallTask[] = [];

export const DEFAULT_CRM_CONTACTS: CRMContact[] = [];

export const DEFAULT_CRM_CONVERSATIONS: CRMConversation[] = [];

export const DEFAULT_CRM_MESSAGES: Record<string, CRMMessage[]> = {};

export const DEFAULT_AUTOMATIONS: AutomationFlow[] = [
  {
    id: 'auto-1',
    name: 'Disparo Inmediato de Llamada IA al Recibir Pedido',
    description: 'Encola y dispara la llamada de voz con Valentina IA 2 minutos después de registrarse el pedido en la landing page.',
    triggerEvent: 'order_created',
    conditions: [
      { field: 'paymentMethod', operator: 'equals', value: 'cash_on_delivery' },
    ],
    actions: [
      { type: 'send_whatsapp_template', payload: { template: 'order_received_alert' } },
      { type: 'trigger_voice_call', payload: { agentId: 'va-default-1', delayMinutes: 2 } },
    ],
    isActive: false,
    executionsCount: 0,
  },
  {
    id: 'auto-2',
    name: 'Reintento Inteligente si No Contesta la Llamada',
    description: 'Si la llamada finaliza en No Contesta o Buzón y quedan intentos disponibles, reprograma el intento en 45 minutos.',
    triggerEvent: 'call_unanswered',
    conditions: [
      { field: 'attempts', operator: 'greater_than', value: 0 },
    ],
    actions: [
      { type: 'send_whatsapp_template', payload: { template: 'missed_call_notice' } },
      { type: 'update_order_status', payload: { status: 'retry_scheduled' } },
    ],
    isActive: false,
    executionsCount: 0,
  },
  {
    id: 'auto-3',
    name: 'Pedido Confirmado por Voz -> Generar Despacho',
    description: 'Cuando el agente de voz registra confirmación afirmativa, actualiza el pedido a Confirmado y notifica por WhatsApp.',
    triggerEvent: 'call_confirmed',
    conditions: [
      { field: 'confirmed', operator: 'equals', value: 'true' },
    ],
    actions: [
      { type: 'update_order_status', payload: { status: 'confirmed_by_voice' } },
      { type: 'send_whatsapp_template', payload: { template: 'order_confirmed_success' } },
      { type: 'trigger_webhook', payload: { endpoint: 'https://api.logipages.com/logistics/dispatch' } },
    ],
    isActive: false,
    executionsCount: 0,
  },
];
