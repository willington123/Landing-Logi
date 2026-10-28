'use client';

import {
  LandingPageConfig,
  OrderItem,
  VoiceAgentSettings,
  VoiceCallTask,
  CRMConversation,
  CRMMessage,
  CRMContact,
  AutomationFlow,
} from './types';
import {
  DEFAULT_LANDING_PAGES,
  DEFAULT_ORDERS,
  DEFAULT_VOICE_AGENT,
  DEFAULT_CALL_TASKS,
  DEFAULT_CRM_CONTACTS,
  DEFAULT_CRM_CONVERSATIONS,
  DEFAULT_CRM_MESSAGES,
  DEFAULT_AUTOMATIONS,
} from './storage';

const STORAGE_KEYS = {
  LANDINGS: 'logipages_landings',
  ORDERS: 'logipages_orders',
  VOICE_AGENT: 'logipages_voice_agent',
  CALL_TASKS: 'logipages_call_tasks',
  CRM_CONTACTS: 'logipages_crm_contacts',
  CRM_CONVERSATIONS: 'logipages_crm_conversations',
  CRM_MESSAGES: 'logipages_crm_messages',
  AUTOMATIONS: 'logipages_automations',
  GEMINI_API_KEY: 'logipages_gemini_api_key',
  STORE_SETTINGS: 'logipages_store_settings',
};

export interface StoreSettings {
  storeName: string;
  supportPhone: string;
  supportEmail: string;
  currency: string;
  guaranteeDays: number;
  metaPixelId: string;
}

const DEFAULT_STORE_SETTINGS: StoreSettings = {
  storeName: '',
  supportPhone: '',
  supportEmail: '',
  currency: 'COP',
  guaranteeDays: 30,
  metaPixelId: '',
};

function safeGet<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (err) {
    console.error(`Error reading ${key} from localStorage:`, err);
    return defaultValue;
  }
}

function safeSet<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error(`Error saving ${key} to localStorage:`, err);
  }
}

export const logiStore = {
  // Landings
  getLandings: (): LandingPageConfig[] => safeGet(STORAGE_KEYS.LANDINGS, DEFAULT_LANDING_PAGES),
  
  getLandingBySlug: (slug: string): LandingPageConfig | undefined => {
    const landings = logiStore.getLandings();
    return landings.find((l) => l.slug === slug || l.id === slug);
  },

  saveLanding: (landing: LandingPageConfig): LandingPageConfig => {
    const landings = logiStore.getLandings();
    const index = landings.findIndex((l) => l.id === landing.id);
    let updated: LandingPageConfig[];
    if (index >= 0) {
      updated = [...landings];
      updated[index] = { ...landing, updatedAt: new Date().toISOString() };
    } else {
      updated = [landing, ...landings];
    }
    safeSet(STORAGE_KEYS.LANDINGS, updated);
    return landing;
  },

  // Like saveLanding, but reports whether the browser had room to store it.
  trySaveLanding: (landing: LandingPageConfig): boolean => {
    if (typeof window === 'undefined') return false;
    const landings = logiStore.getLandings();
    const index = landings.findIndex((l) => l.id === landing.id);
    const next = { ...landing, updatedAt: new Date().toISOString() };
    const updated = index >= 0 ? landings.map((l, i) => (i === index ? next : l)) : [next, ...landings];
    try {
      localStorage.setItem(STORAGE_KEYS.LANDINGS, JSON.stringify(updated));
      return true;
    } catch {
      return false;
    }
  },

  deleteLanding: (id: string): void => {
    const landings = logiStore.getLandings().filter((l) => l.id !== id);
    safeSet(STORAGE_KEYS.LANDINGS, landings);
  },

  // Orders
  getOrders: (): OrderItem[] => safeGet(STORAGE_KEYS.ORDERS, DEFAULT_ORDERS),

  createOrder: (orderData: Omit<OrderItem, 'id' | 'orderNumber' | 'createdAt' | 'status'> & Partial<OrderItem>): OrderItem => {
    const orders = logiStore.getOrders();
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const newOrder: OrderItem = {
      id: `ord-${Date.now()}`,
      orderNumber: `LP-${randomSuffix}`,
      createdAt: new Date().toISOString(),
      status: 'pending_call',
      ...orderData,
    };
    const updated = [newOrder, ...orders];
    safeSet(STORAGE_KEYS.ORDERS, updated);

    // Increment landing order count
    const landings = logiStore.getLandings();
    const landing = landings.find((l) => l.id === newOrder.landingPageId);
    if (landing) {
      landing.ordersCount = (landing.ordersCount || 0) + 1;
      logiStore.saveLanding(landing);
    }

    // Automatically create a Voice Call Task for this order
    const callTask: VoiceCallTask = {
      id: `call-${Date.now()}`,
      orderId: newOrder.id,
      customerName: newOrder.customerName,
      phone: newOrder.phone,
      status: 'pending_call',
      attempts: 0,
      maxAttempts: 3,
      durationSeconds: 0,
      transcript: [],
    };
    const calls = logiStore.getCallTasks();
    safeSet(STORAGE_KEYS.CALL_TASKS, [callTask, ...calls]);

    // Create or link CRM Contact & Conversation
    logiStore.registerCRMInteraction(newOrder);

    return newOrder;
  },

  updateOrderStatus: (orderId: string, status: OrderItem['status']): void => {
    const orders = logiStore.getOrders();
    const index = orders.findIndex((o) => o.id === orderId);
    if (index >= 0) {
      orders[index].status = status;
      if (status === 'confirmed_by_voice') {
        orders[index].confirmedAt = new Date().toISOString();
      }
      safeSet(STORAGE_KEYS.ORDERS, [...orders]);
      // Mirror to Supabase when the panel runs in cloud mode (flag set by lib/cloud.ts).
      if (typeof window !== 'undefined' && (window as any).__lpCloud) {
        fetch(`/api/orders/${encodeURIComponent(orderId)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        }).catch(() => {});
      }
    }
  },

  // Voice AI
  getVoiceAgent: (): VoiceAgentSettings => safeGet(STORAGE_KEYS.VOICE_AGENT, DEFAULT_VOICE_AGENT),

  saveVoiceAgent: (settings: VoiceAgentSettings): void => {
    safeSet(STORAGE_KEYS.VOICE_AGENT, settings);
  },

  getCallTasks: (): VoiceCallTask[] => safeGet(STORAGE_KEYS.CALL_TASKS, DEFAULT_CALL_TASKS),

  updateCallTask: (task: VoiceCallTask): void => {
    const calls = logiStore.getCallTasks();
    const index = calls.findIndex((c) => c.id === task.id);
    let updated: VoiceCallTask[];
    if (index >= 0) {
      updated = [...calls];
      updated[index] = task;
    } else {
      updated = [task, ...calls];
    }
    safeSet(STORAGE_KEYS.CALL_TASKS, updated);

    // Sync order status
    logiStore.updateOrderStatus(task.orderId, task.status);
  },

  // CRM
  getContacts: (): CRMContact[] => safeGet(STORAGE_KEYS.CRM_CONTACTS, DEFAULT_CRM_CONTACTS),
  
  getConversations: (): CRMConversation[] => safeGet(STORAGE_KEYS.CRM_CONVERSATIONS, DEFAULT_CRM_CONVERSATIONS),

  getMessages: (conversationId: string): CRMMessage[] => {
    const all = safeGet<Record<string, CRMMessage[]>>(STORAGE_KEYS.CRM_MESSAGES, DEFAULT_CRM_MESSAGES);
    return all[conversationId] || [];
  },

  sendMessage: (conversationId: string, text: string, isInternal = false): CRMMessage => {
    const all = safeGet<Record<string, CRMMessage[]>>(STORAGE_KEYS.CRM_MESSAGES, DEFAULT_CRM_MESSAGES);
    const existing = all[conversationId] || [];
    const newMessage: CRMMessage = {
      id: `msg-${Date.now()}`,
      conversationId,
      sender: isInternal ? 'agent' : 'agent',
      senderName: isInternal ? 'Nota de Equipo' : 'Asesor LogiPages',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'delivered',
      isInternalNote: isInternal,
    };
    all[conversationId] = [...existing, newMessage];
    safeSet(STORAGE_KEYS.CRM_MESSAGES, all);

    // Update conversation lastMessage
    const convs = logiStore.getConversations();
    const cIdx = convs.findIndex((c) => c.id === conversationId);
    if (cIdx >= 0) {
      convs[cIdx].lastMessage = isInternal ? `[Nota] ${text}` : text;
      convs[cIdx].lastMessageAt = 'Ahora';
      safeSet(STORAGE_KEYS.CRM_CONVERSATIONS, [...convs]);
    }

    return newMessage;
  },

  updateConversation: (id: string, updates: Partial<CRMConversation>): CRMConversation | undefined => {
    const convs = logiStore.getConversations();
    const index = convs.findIndex((c) => c.id === id);
    if (index >= 0) {
      convs[index] = { ...convs[index], ...updates };
      safeSet(STORAGE_KEYS.CRM_CONVERSATIONS, [...convs]);
      return convs[index];
    }
    return undefined;
  },

  updateContact: (id: string, updates: Partial<CRMContact>): CRMContact | undefined => {
    const contacts = logiStore.getContacts();
    const index = contacts.findIndex((c) => c.id === id);
    if (index >= 0) {
      contacts[index] = { ...contacts[index], ...updates };
      safeSet(STORAGE_KEYS.CRM_CONTACTS, [...contacts]);
      return contacts[index];
    }
    return undefined;
  },

  addContactTag: (contactId: string, tag: string): void => {
    const contacts = logiStore.getContacts();
    const contact = contacts.find((c) => c.id === contactId);
    if (contact && !contact.tags.includes(tag)) {
      contact.tags.push(tag);
      safeSet(STORAGE_KEYS.CRM_CONTACTS, [...contacts]);
    }
  },

  removeContactTag: (contactId: string, tag: string): void => {
    const contacts = logiStore.getContacts();
    const contact = contacts.find((c) => c.id === contactId);
    if (contact) {
      contact.tags = contact.tags.filter((t) => t !== tag);
      safeSet(STORAGE_KEYS.CRM_CONTACTS, [...contacts]);
    }
  },

  addContactNote: (contactId: string, note: string): void => {
    const contacts = logiStore.getContacts();
    const contact = contacts.find((c) => c.id === contactId);
    if (contact) {
      contact.internalNotes = [note, ...(contact.internalNotes || [])];
      safeSet(STORAGE_KEYS.CRM_CONTACTS, [...contacts]);
    }
  },

  registerCRMInteraction: (order: OrderItem) => {
    const convs = logiStore.getConversations();
    const convId = `conv-order-${order.id}`;
    const newConv: CRMConversation = {
      id: convId,
      contactId: `ct-${order.phone.replace(/\D/g, '')}`,
      contactName: order.customerName,
      contactPhone: order.phone,
      channel: 'whatsapp',
      status: 'open',
      assignedAgent: 'Valentina IA Bot',
      lastMessage: `Nuevo pedido ${order.orderNumber} por $${order.totalAmount.toLocaleString()} recibido`,
      lastMessageAt: 'Ahora',
      unreadCount: 1,
      tags: ['Nuevo Pedido', 'WhatsApp Aut.'],
      linkedOrderId: order.id,
    };
    safeSet(STORAGE_KEYS.CRM_CONVERSATIONS, [newConv, ...convs]);

    const all = safeGet<Record<string, CRMMessage[]>>(STORAGE_KEYS.CRM_MESSAGES, DEFAULT_CRM_MESSAGES);
    all[convId] = [
      {
        id: `m-init-${order.id}`,
        conversationId: convId,
        sender: 'bot',
        senderName: 'LogiPages AI Bot',
        text: `Hola ${order.customerName}, hemos recibido tu pedido #${order.orderNumber} de ${order.productName} (${order.comboName}) con entrega en ${order.city}. Tu agente virtual te llamará en breve para confirmar el despacho.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'delivered',
      },
    ];
    safeSet(STORAGE_KEYS.CRM_MESSAGES, all);
  },

  // Automations
  getAutomations: (): AutomationFlow[] => safeGet(STORAGE_KEYS.AUTOMATIONS, DEFAULT_AUTOMATIONS),

  toggleAutomation: (id: string): void => {
    const flows = logiStore.getAutomations();
    const flow = flows.find((f) => f.id === id);
    if (flow) {
      flow.isActive = !flow.isActive;
      safeSet(STORAGE_KEYS.AUTOMATIONS, [...flows]);
    }
  },

  saveAutomation: (flow: AutomationFlow): void => {
    const flows = logiStore.getAutomations();
    const idx = flows.findIndex((f) => f.id === flow.id);
    let updated: AutomationFlow[];
    if (idx >= 0) {
      updated = [...flows];
      updated[idx] = flow;
    } else {
      updated = [flow, ...flows];
    }
    safeSet(STORAGE_KEYS.AUTOMATIONS, updated);
  },

  // Store settings (brand name, support contact, defaults for new landings)
  getStoreSettings: (): StoreSettings => ({ ...DEFAULT_STORE_SETTINGS, ...safeGet(STORAGE_KEYS.STORE_SETTINGS, {}) }),

  saveStoreSettings: (settings: StoreSettings): void => {
    safeSet(STORAGE_KEYS.STORE_SETTINGS, settings);
  },

  // Gemini API Key
  getGeminiApiKey: (): string => {
    if (typeof window === 'undefined') return '';
    try {
      return localStorage.getItem(STORAGE_KEYS.GEMINI_API_KEY) || '';
    } catch {
      return '';
    }
  },

  saveGeminiApiKey: (key: string): void => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEYS.GEMINI_API_KEY, key.trim());
    } catch (err) {
      console.error('Error saving Gemini API key:', err);
    }
  },
};
