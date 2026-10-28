'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  MessageSquare,
  Send,
  Phone,
  PhoneCall,
  Check,
  CheckCheck,
  Clock,
  Search,
  Filter,
  User,
  Tag,
  Plus,
  X,
  Lock,
  Unlock,
  Sparkles,
  Bot,
  ChevronDown,
  ShoppingBag,
  Package,
  ShieldCheck,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Copy,
  Calendar,
  MapPin,
  Mail,
  DollarSign,
  Flame,
  FileText,
  Volume2,
  ChevronRight,
  Headphones,
  Info,
  CheckSquare,
} from 'lucide-react';
import {
  CRMConversation,
  CRMMessage,
  CRMContact,
  OrderItem,
  VoiceCallTask,
} from '@/lib/types';
import { logiStore } from '@/lib/store';
import { VoiceCallSimulatorModal } from '@/components/voice/VoiceCallSimulatorModal';

// --- Official Channel Icons ---
function WhatsAppIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0012.04 2zm.01 1.67c4.55 0 8.24 3.7 8.24 8.24 0 2.2-.86 4.28-2.42 5.84a8.17 8.17 0 01-5.83 2.41c-1.47 0-2.92-.39-4.18-1.14l-.3-.18-3.11.82.83-3.03-.2-.31a8.192 8.192 0 01-1.26-4.41c0-4.54 3.7-8.24 8.23-8.24zm4.52 11.66c-.25-.13-1.47-.72-1.7-.81-.23-.08-.39-.13-.56.13-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.13-1.06-.39-2.02-1.25-.75-.67-1.26-1.5-1.41-1.75-.15-.25-.02-.39.11-.51.11-.11.25-.29.37-.44.12-.14.17-.25.25-.42.08-.17.04-.31-.02-.44-.06-.13-.56-1.34-.76-1.84-.2-.49-.4-.42-.56-.43h-.47c-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.1 0 1.24.9 2.44 1.03 2.61.13.17 1.78 2.71 4.3 3.8 2.53 1.09 2.53.73 2.99.69.45-.04 1.47-.6 1.68-1.18.21-.58.21-1.07.15-1.18-.06-.11-.23-.17-.48-.3z" />
    </svg>
  );
}

function InstagramIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  );
}

function MessengerIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.145 2 11.258c0 2.91 1.455 5.518 3.736 7.202V22l3.382-1.856c.92.254 1.888.393 2.882.393 5.523 0 10-4.145 10-9.258C22 6.145 17.523 2 12 2zm1.002 12.441l-2.556-2.727-4.992 2.727 5.489-5.83 2.617 2.727 4.93-2.727-5.488 5.83z" />
    </svg>
  );
}

function WebchatIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z" />
    </svg>
  );
}

// Quick reply templates
interface QuickReply {
  code: string;
  label: string;
  text: string;
  category: string;
}

const QUICK_REPLIES: QuickReply[] = [
  {
    code: '/garantía',
    label: 'Garantía 90 Días',
    text: '¡Hola! Todos nuestros productos cuentan con 90 días de garantía total por defectos de fabricación y soporte directo con nuestro equipo. Además, cuentas con cambio inmediato si presentas alguna inconformidad al recibir.',
    category: 'Soporte',
  },
  {
    code: '/guía-despacho',
    label: 'Guía y Despacho',
    text: '¡Hola! Tu pedido ya está preparado en nuestra bodega. El paquete será entregado a la transportadora (Servientrega / Interrapidísimo) hoy mismo y te compartiremos el número de guía para rastreo en tiempo real.',
    category: 'Logística',
  },
  {
    code: '/datos-confirmados',
    label: 'Confirmación Contraentrega',
    text: '¡Perfecto! Hemos validado con éxito tus datos y dirección de despacho con pago contraentrega. Tu paquete saldrá en la siguiente ruta. Recuerda tener listo el efectivo al momento de la entrega.',
    category: 'Ventas',
  },
  {
    code: '/datos-transferencia',
    label: 'Datos de Pago Anticipado',
    text: 'Si deseas pago anticipado por Bancolombia o Nequi, nuestra cuenta de ahorros autorizada es: Ahorros Bancolombia 458-912033-14 a nombre de LogiPages SAS (NIT 901.442.110). Por favor envíanos comprobante al realizarla.',
    category: 'Pagos',
  },
  {
    code: '/horario-entrega',
    label: 'Horario y Ruta de Entrega',
    text: 'Las transportadoras entregan de lunes a sábado entre las 8:00 AM y las 6:00 PM. El repartidor se comunicará al número registrado antes de llegar a la dirección indicada.',
    category: 'Logística',
  },
];

// WhatsApp HSM Templates
interface WhatsAppTemplate {
  id: string;
  name: string;
  category: 'Utility' | 'Marketing';
  description: string;
  generateText: (contact: CRMContact, order?: OrderItem) => string;
}

const WHATSAPP_TEMPLATES: WhatsAppTemplate[] = [
  {
    id: 'order_confirmation_cod',
    name: 'Confirmación de Pedido (Contraentrega)',
    category: 'Utility',
    description: 'Plantilla oficial de confirmación de despacho y validación de dirección.',
    generateText: (contact, order) => {
      const orderNum = order ? order.orderNumber : 'LP-9821';
      const prod = order ? `${order.productName} (${order.comboName})` : 'SmartWatch Ultra Titan Pro';
      const amount = order ? `$${order.totalAmount.toLocaleString()} COP` : '$189.900 COP';
      const city = order ? order.city : contact.city;
      return `¡Hola ${contact.name}! 👋\n\nHemos recibido tu orden *#${orderNum}* de *${prod}* por valor total de *${amount}* con método de *Pago Contraentrega* en ${city}.\n\nPara garantizar un despacho express, ¿nos confirmas que tu dirección registrada es correcta?\n\nResponde *SÍ CONFIRMO* para despachar de inmediato hoy mismo. 📦✨`;
    },
  },
  {
    id: 'shipping_tracking_alert',
    name: 'Guía de Envío Generada',
    category: 'Utility',
    description: 'Notifica al cliente que el paquete va en camino con el transportador.',
    generateText: (contact, order) => {
      const orderNum = order ? order.orderNumber : 'LP-9821';
      const carrier = 'Servientrega Express';
      const tracking = `ENV-${Math.floor(100000000 + Math.random() * 900000000)}`;
      const amount = order ? `$${order.totalAmount.toLocaleString()} COP` : '$189.900 COP';
      return `¡Hola ${contact.name}! 🚚\n\nTu pedido *#${orderNum}* ya fue entregado a *${carrier}* y va en camino a tu domicilio.\n\n📌 *Número de Guía:* ${tracking}\n💵 *Monto a pagar al repartidor:* ${amount}\n\nPor favor ten listo el dinero en efectivo. Te notificaremos apenas entre a reparto urbano.`;
    },
  },
  {
    id: 'out_for_delivery_today',
    name: 'Alerta de Entrega Hoy',
    category: 'Utility',
    description: 'Avisa al cliente que el mensajero pasará hoy a cobrar y entregar.',
    generateText: (contact, order) => {
      const amount = order ? `$${order.totalAmount.toLocaleString()} COP` : '$189.900 COP';
      return `⚠️ *ALERTA DE ENTREGA HOY* ⚠️\n\nHola ${contact.name}, el repartidor ya tiene asignado tu paquete en la ruta de hoy.\n\nRecuerda tener a la mano el efectivo exacto de *${amount}* o autorizar a portería/familiar para recibir.\n\n¡Gracias por tu compra en LogiPages!`;
    },
  },
  {
    id: 'satisfaction_survey',
    name: 'Encuesta de Satisfacción y Cupón',
    category: 'Marketing',
    description: 'Fidelización post-entrega con invitación a calificar el producto.',
    generateText: (contact) => {
      return `¡Hola ${contact.name}! Esperamos que estés disfrutando tu compra al máximo. 🌟\n\n¿Cómo calificarías tu experiencia del 1 al 5?\n\nResponde a este mensaje con tu calificación y te obsequiaremos un cupón del *15% OFF* en tu próxima compra.`;
    },
  },
];

const AVAILABLE_AGENTS = ['Sin asignar', 'Yo', 'Asistente IA'];

interface OmnichannelInboxProps {
  initialConversationId?: string;
  onSelectOrder?: (orderId: string) => void;
}

export default function OmnichannelInbox({
  initialConversationId,
  onSelectOrder,
}: OmnichannelInboxProps) {
  // Store-backed state
  const [conversations, setConversations] = useState<CRMConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string>('');
  const [messages, setMessages] = useState<CRMMessage[]>([]);
  const [contacts, setContacts] = useState<CRMContact[]>([]);
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [callTasks, setCallTasks] = useState<VoiceCallTask[]>([]);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChannel, setSelectedChannel] = useState<'all' | 'whatsapp' | 'instagram' | 'messenger' | 'webchat'>('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'open' | 'pending' | 'resolved'>('all');
  const [selectedAgentFilter, setSelectedAgentFilter] = useState<string>('all');

  // Input & Chat Interaction state
  const [inputText, setInputText] = useState('');
  const [isInternalNoteMode, setIsInternalNoteMode] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<WhatsAppTemplate | null>(null);

  // Tags & Notes state in Dossier
  const [newTagInput, setNewTagInput] = useState('');
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newDossierNote, setNewDossierNote] = useState('');
  const [isDossierOpen, setIsDossierOpen] = useState(false);

  // Simulator Modal state
  const [simulatorOpen, setSimulatorOpen] = useState(false);
  const [simTask, setSimTask] = useState<VoiceCallTask | null>(null);
  const [simOrder, setSimOrder] = useState<OrderItem | null>(null);

  // Audio / Voice Call Transcript Modal state
  const [viewTranscriptCall, setViewTranscriptCall] = useState<VoiceCallTask | null>(null);

  // Toast / feedback notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Messages auto-scroll ref
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // 1. Initial Load from logiStore
  const reloadData = () => {
    const convs = logiStore.getConversations();
    const cts = logiStore.getContacts();
    const ords = logiStore.getOrders();
    const calls = logiStore.getCallTasks();

    setConversations(convs);
    setContacts(cts);
    setOrders(ords);
    setCallTasks(calls);

    return { convs, cts, ords, calls };
  };

  useEffect(() => {
    const data = reloadData();
    if (data.convs.length > 0) {
      if (initialConversationId && data.convs.some((c) => c.id === initialConversationId)) {
        setActiveConversationId(initialConversationId);
      } else {
        setActiveConversationId(data.convs[0].id);
      }
    }
  }, [initialConversationId]);

  // 2. Load Messages when Active Conversation Changes
  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return;
    }
    const msgs = logiStore.getMessages(activeConversationId);
    setMessages(msgs);

    // If conversation had unread count, reset it
    const conv = conversations.find((c) => c.id === activeConversationId);
    if (conv && conv.unreadCount > 0) {
      logiStore.updateConversation(activeConversationId, { unreadCount: 0 });
      setConversations((prev) =>
        prev.map((c) => (c.id === activeConversationId ? { ...c, unreadCount: 0 } : c))
      );
    }
  }, [activeConversationId]);

  // 3. Scroll to bottom of message thread
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Active Conversation and Contact Memo
  const activeConversation = useMemo(() => {
    return conversations.find((c) => c.id === activeConversationId);
  }, [conversations, activeConversationId]);

  const activeContact = useMemo(() => {
    if (!activeConversation) return null;
    let contact = contacts.find(
      (c) => c.id === activeConversation.contactId || c.phone === activeConversation.contactPhone
    );
    if (!contact) {
      // Fallback virtual contact
      contact = {
        id: activeConversation.contactId || `ct-${Date.now()}`,
        name: activeConversation.contactName,
        phone: activeConversation.contactPhone,
        city: 'Colombia',
        lifetimeValue: 120000,
        ordersCount: 1,
        lastInteractionAt: new Date().toISOString(),
        tags: activeConversation.tags || ['Nuevo'],
        internalNotes: [],
      };
    }
    return contact;
  }, [activeConversation, contacts]);

  const linkedOrder = useMemo(() => {
    if (!activeConversation) return null;
    if (activeConversation.linkedOrderId) {
      const found = orders.find((o) => o.id === activeConversation.linkedOrderId);
      if (found) return found;
    }
    // Search by customer name or phone
    return orders.find(
      (o) =>
        o.phone.replace(/\D/g, '') === activeConversation.contactPhone.replace(/\D/g, '') ||
        o.customerName.toLowerCase() === activeConversation.contactName.toLowerCase()
    ) || null;
  }, [activeConversation, orders]);

  const linkedVoiceCalls = useMemo(() => {
    if (!activeConversation) return [];
    return callTasks.filter((ct) => {
      if (linkedOrder && ct.orderId === linkedOrder.id) return true;
      if (ct.phone && activeConversation.contactPhone) {
        return ct.phone.replace(/\D/g, '') === activeConversation.contactPhone.replace(/\D/g, '');
      }
      return ct.customerName.toLowerCase() === activeConversation.contactName.toLowerCase();
    });
  }, [activeConversation, linkedOrder, callTasks]);

  // Filtered Conversations List
  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      // Channel filter
      if (selectedChannel !== 'all' && c.channel !== selectedChannel) return false;
      // Status filter
      if (selectedStatus !== 'all' && c.status !== selectedStatus) return false;
      // Agent filter
      if (selectedAgentFilter !== 'all' && c.assignedAgent !== selectedAgentFilter) return false;
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = c.contactName.toLowerCase().includes(q);
        const matchesPhone = c.contactPhone.toLowerCase().includes(q);
        const matchesMsg = c.lastMessage?.toLowerCase().includes(q);
        const matchesTags = c.tags?.some((t) => t.toLowerCase().includes(q));
        if (!matchesName && !matchesPhone && !matchesMsg && !matchesTags) return false;
      }
      return true;
    });
  }, [conversations, selectedChannel, selectedStatus, selectedAgentFilter, searchQuery]);

  // Counts for Channel filter badges
  const channelCounts = useMemo(() => {
    return {
      all: conversations.length,
      whatsapp: conversations.filter((c) => c.channel === 'whatsapp').length,
      instagram: conversations.filter((c) => c.channel === 'instagram').length,
      messenger: conversations.filter((c) => c.channel === 'messenger').length,
      webchat: conversations.filter((c) => c.channel === 'webchat').length,
    };
  }, [conversations]);

  // Handler: Send Message or Internal Note
  const handleSendMessage = () => {
    if (!inputText.trim() || !activeConversationId) return;

    const isInternal = isInternalNoteMode;
    const sentMsg = logiStore.sendMessage(activeConversationId, inputText.trim(), isInternal);

    // Update state
    setMessages((prev) => [...prev, sentMsg]);
    setInputText('');

    if (isInternal && activeContact) {
      logiStore.addContactNote(activeContact.id, inputText.trim());
      setContacts((prev) =>
        prev.map((ct) =>
          ct.id === activeContact.id
            ? { ...ct, internalNotes: [inputText.trim(), ...(ct.internalNotes || [])] }
            : ct
        )
      );
      showToast('Nota interna guardada en el expediente');
    }

    // Refresh conversation last message
    const updatedConvs = logiStore.getConversations();
    setConversations(updatedConvs);

    // Simulate realistic 2-way conversation reply from customer
    if (!isInternal) {
      setTimeout(() => {
        const replies = [
          'Listo, muchas gracias por la respuesta. Quedo muy atento.',
          'Perfecto, ya tengo el dinero listo en efectivo para cuando llegue el repartidor.',
          'Excelente atención, por favor avisar al repartidor que timbre al apartamento.',
          'De acuerdo, quedo pendiente del número de guía por acá.',
        ];
        const randomReply = replies[Math.floor(Math.random() * replies.length)];
        const incoming = logiStore.sendMessage(activeConversationId, randomReply, false);
        incoming.sender = 'contact';
        incoming.senderName = activeConversation?.contactName || 'Cliente';
        setMessages((prev) => [...prev, incoming]);
        setConversations(logiStore.getConversations());
      }, 2000);
    }
  };

  // Keyboard shortcut: Enter to send
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Toggle Resolved status
  const handleToggleResolved = () => {
    if (!activeConversation) return;
    const newStatus = activeConversation.status === 'resolved' ? 'open' : 'resolved';
    const updated = logiStore.updateConversation(activeConversation.id, { status: newStatus });
    if (updated) {
      setConversations((prev) =>
        prev.map((c) => (c.id === activeConversation.id ? { ...c, status: newStatus } : c))
      );
      showToast(newStatus === 'resolved' ? 'Conversación marcada como Resuelta ✅' : 'Conversación reabierta');
    }
  };

  // Assign agent
  const handleAssignAgent = (agentName: string) => {
    if (!activeConversation) return;
    const updated = logiStore.updateConversation(activeConversation.id, { assignedAgent: agentName });
    if (updated) {
      setConversations((prev) =>
        prev.map((c) => (c.id === activeConversation.id ? { ...c, assignedAgent: agentName } : c))
      );
      showToast(`Asignado a: ${agentName}`);
    }
  };

  // Add Tag to active contact
  const handleAddTag = (tagToAdd: string) => {
    if (!activeContact || !tagToAdd.trim()) return;
    const cleaned = tagToAdd.trim();
    if (activeContact.tags.includes(cleaned)) return;

    logiStore.addContactTag(activeContact.id, cleaned);
    setContacts((prev) =>
      prev.map((ct) =>
        ct.id === activeContact.id ? { ...ct, tags: [...ct.tags, cleaned] } : ct
      )
    );
    // Also add to conversation tags if active
    if (activeConversation) {
      const updatedTags = Array.from(new Set([...(activeConversation.tags || []), cleaned]));
      logiStore.updateConversation(activeConversation.id, { tags: updatedTags });
      setConversations((prev) =>
        prev.map((c) => (c.id === activeConversation.id ? { ...c, tags: updatedTags } : c))
      );
    }
    setNewTagInput('');
    setIsAddingTag(false);
    showToast(`Etiqueta "${cleaned}" añadida`);
  };

  // Remove Tag from active contact
  const handleRemoveTag = (tagToRemove: string) => {
    if (!activeContact) return;
    logiStore.removeContactTag(activeContact.id, tagToRemove);
    setContacts((prev) =>
      prev.map((ct) =>
        ct.id === activeContact.id
          ? { ...ct, tags: ct.tags.filter((t) => t !== tagToRemove) }
          : ct
      )
    );
    if (activeConversation) {
      const updatedTags = (activeConversation.tags || []).filter((t) => t !== tagToRemove);
      logiStore.updateConversation(activeConversation.id, { tags: updatedTags });
      setConversations((prev) =>
        prev.map((c) => (c.id === activeConversation.id ? { ...c, tags: updatedTags } : c))
      );
    }
    showToast(`Etiqueta eliminada`);
  };

  // Add internal note from Dossier
  const handleAddDossierNote = () => {
    if (!newDossierNote.trim() || !activeContact || !activeConversationId) return;
    const text = newDossierNote.trim();

    // Save as message in thread
    const msg = logiStore.sendMessage(activeConversationId, text, true);
    setMessages((prev) => [...prev, msg]);

    // Save in contact internalNotes
    logiStore.addContactNote(activeContact.id, text);
    setContacts((prev) =>
      prev.map((ct) =>
        ct.id === activeContact.id
          ? { ...ct, internalNotes: [text, ...(ct.internalNotes || [])] }
          : ct
      )
    );

    setNewDossierNote('');
    showToast('Nota añadida al expediente');
  };

  // Insert Quick Reply into input
  const handleSelectQuickReply = (reply: QuickReply) => {
    setInputText((prev) => (prev ? `${prev}\n${reply.text}` : reply.text));
    setShowQuickReplies(false);
    showToast(`Respuesta rápida "${reply.label}" insertada`);
  };

  // Send WhatsApp HSM Template
  const handleSendWhatsAppTemplate = (template: WhatsAppTemplate) => {
    if (!activeConversation || !activeContact) return;
    const renderedText = template.generateText(activeContact, linkedOrder || undefined);

    const sent = logiStore.sendMessage(activeConversation.id, renderedText, false);
    setMessages((prev) => [...prev, sent]);

    const updatedConvs = logiStore.getConversations();
    setConversations(updatedConvs);

    setShowTemplatesModal(false);
    setSelectedTemplate(null);
    showToast(`Plantilla WhatsApp "${template.name}" enviada`);
  };

  // Launch Simulator for voice task
  const handleOpenSimulator = (task?: VoiceCallTask | null) => {
    if (task) {
      setSimTask(task);
      const foundOrder = orders.find((o) => o.id === task.orderId) || linkedOrder;
      setSimOrder(foundOrder || null);
    } else if (linkedOrder) {
      setSimTask({
        id: `call-sim-${Date.now()}`,
        orderId: linkedOrder.id,
        customerName: linkedOrder.customerName,
        phone: linkedOrder.phone,
        status: linkedOrder.status,
        attempts: 1,
        maxAttempts: 3,
        durationSeconds: 0,
        transcript: [],
      });
      setSimOrder(linkedOrder);
    }
    setSimulatorOpen(true);
  };

  // Channel helper badges
  const renderChannelIcon = (channel: CRMConversation['channel'], sizeClass = 'w-4 h-4') => {
    switch (channel) {
      case 'whatsapp':
        return <WhatsAppIcon className={`${sizeClass} text-[#25D366]`} />;
      case 'instagram':
        return <InstagramIcon className={`${sizeClass} text-[#E1306C]`} />;
      case 'messenger':
        return <MessengerIcon className={`${sizeClass} text-[#0084FF]`} />;
      case 'webchat':
        return <WebchatIcon className={`${sizeClass} text-[#0EA5E9]`} />;
      default:
        return <MessageSquare className={`${sizeClass} text-slate-400`} />;
    }
  };

  // Channel title & color helper
  const getChannelPillInfo = (channel: CRMConversation['channel']) => {
    switch (channel) {
      case 'whatsapp':
        return {
          label: 'WhatsApp Cloud API Oficial',
          bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
          dot: 'bg-emerald-500',
        };
      case 'instagram':
        return {
          label: 'Instagram Direct API Conectado',
          bg: 'bg-pink-50 text-pink-800 border-pink-200',
          dot: 'bg-pink-500',
        };
      case 'messenger':
        return {
          label: 'Facebook Messenger API Conectado',
          bg: 'bg-blue-50 text-blue-800 border-blue-200',
          dot: 'bg-blue-500',
        };
      case 'webchat':
        return {
          label: 'Web Chat Widget En Vivo',
          bg: 'bg-sky-50 text-sky-800 border-sky-200',
          dot: 'bg-sky-500',
        };
    }
  };

  // Order status badge helper
  const renderOrderStatusBadge = (status: OrderItem['status']) => {
    switch (status) {
      case 'confirmed_by_voice':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Confirmado por voz
          </span>
        );
      case 'calling':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
            <PhoneCall className="w-3 h-3 text-indigo-600 animate-pulse" /> En llamada
          </span>
        );
      case 'pending_call':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
            <Clock className="w-3 h-3 text-amber-600" /> Pendiente llamada
          </span>
        );
      case 'shipped':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-sky-100 text-sky-800 border border-sky-200">
            <Package className="w-3 h-3 text-sky-600" /> En camino
          </span>
        );
      case 'delivered':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-800 border border-green-200">
            <Check className="w-3 h-3 text-green-600" /> Entregado
          </span>
        );
      case 'unanswered':
      case 'retry_scheduled':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-800 border border-orange-200">
            <RotateCcw className="w-3 h-3 text-orange-600" /> Reintento en cola
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden text-slate-800">
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed top-6 right-8 z-50 flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-lg shadow-xl animate-fade-in border border-slate-700">
          <Sparkles className="w-4 h-4 text-amber-300" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main 3-Column Container */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        
        {/* ========================================================================= */}
        {/* COLUMN 1: LEFT INBOX DIRECTORY & FILTERS (288px - 320px)                 */}
        {/* ========================================================================= */}
        <div className="w-72 xl:w-80 flex-shrink-0 border-r border-slate-200 bg-white flex flex-col">
          {/* Header & Title */}
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-[#FF252B]" />
                Bandeja Omnicanal
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                {filteredConversations.length} conversaciones activas
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600" title="La bandeja se conectará a WhatsApp Business próximamente">
                Próximamente WhatsApp
              </span>
            </div>
          </div>

          {/* Search Bar */}
          <div className="px-3 pt-3 pb-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por cliente, teléfono o mensaje..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 rounded-lg pl-9 pr-8 py-2 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#FF252B]/20 focus:border-[#FF252B] transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Channels Filter Tabs */}
          <div className="px-3 py-2 border-b border-slate-100">
            <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none text-xs [&>button]:shrink-0">
              <button
                onClick={() => setSelectedChannel('all')}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all ${
                  selectedChannel === 'all'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span>Todos</span>
                <span className={`text-[11px] px-1.5 py-0.2 rounded-full ${
                  selectedChannel === 'all' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                }`}>
                  {channelCounts.all}
                </span>
              </button>

              <button
                onClick={() => setSelectedChannel('whatsapp')}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all ${
                  selectedChannel === 'whatsapp'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'
                }`}
              >
                <WhatsAppIcon className="w-3.5 h-3.5" />
                <span>WhatsApp</span>
                <span className={`text-[11px] px-1.5 py-0.2 rounded-full ${
                  selectedChannel === 'whatsapp' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {channelCounts.whatsapp}
                </span>
              </button>

              <button
                onClick={() => setSelectedChannel('instagram')}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all ${
                  selectedChannel === 'instagram'
                    ? 'bg-pink-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-pink-50 hover:text-pink-700'
                }`}
              >
                <InstagramIcon className="w-3.5 h-3.5" />
                <span>Instagram</span>
              </button>

              <button
                onClick={() => setSelectedChannel('messenger')}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all ${
                  selectedChannel === 'messenger'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-blue-50 hover:text-blue-700'
                }`}
              >
                <MessengerIcon className="w-3.5 h-3.5" />
                <span>Messenger</span>
              </button>

              <button
                onClick={() => setSelectedChannel('webchat')}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all ${
                  selectedChannel === 'webchat'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-sky-50 hover:text-sky-700'
                }`}
              >
                <WebchatIcon className="w-3.5 h-3.5" />
                <span>Webchat</span>
              </button>
            </div>
          </div>

          {/* Subfilters: Status & Agent */}
          <div className="px-3 py-2 bg-slate-50/70 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
            {/* Status Tabs */}
            <div className="flex items-center gap-1">
              {(['all', 'open', 'pending', 'resolved'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setSelectedStatus(st)}
                  className={`px-2 py-1 rounded text-xs font-semibold capitalize transition ${
                    selectedStatus === st
                      ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {st === 'all'
                    ? 'Todos'
                    : st === 'open'
                    ? 'Abiertos'
                    : st === 'pending'
                    ? 'Pendientes'
                    : 'Resueltos'}
                </button>
              ))}
            </div>

            {/* Agent Select */}
            <div className="relative">
              <select
                value={selectedAgentFilter}
                onChange={(e) => setSelectedAgentFilter(e.target.value)}
                className="text-xs bg-white border border-slate-200 rounded px-2 py-1 text-slate-700 font-medium focus:outline-none focus:border-[#FF252B]"
              >
                <option value="all">Todos los agentes</option>
                {AVAILABLE_AGENTS.map((agent) => (
                  <option key={agent} value={agent}>
                    {agent}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Conversations Scrollable List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs font-semibold text-slate-600">No se encontraron conversaciones</p>
                <p className="text-xs mt-1 text-slate-400">Prueba ajustando los filtros o la búsqueda</p>
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const isSelected = conv.id === activeConversationId;
                const initials = conv.contactName
                  .split(' ')
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase();

                return (
                  <button
                    key={conv.id}
                    onClick={() => setActiveConversationId(conv.id)}
                    className={`w-full text-left p-3.5 flex items-start gap-3 transition-colors relative ${
                      isSelected
                        ? 'bg-red-50/50 hover:bg-red-50/70 border-l-4 border-[#FF252B]'
                        : 'hover:bg-slate-50 border-l-4 border-transparent'
                    }`}
                  >
                    {/* Avatar with Channel Badge */}
                    <div className="relative flex-shrink-0">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                        {initials}
                      </div>
                      <div className="absolute -bottom-1 -right-1 bg-white p-0.5 rounded-full shadow-xs border border-slate-200">
                        {renderChannelIcon(conv.channel, 'w-3.5 h-3.5')}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <h4 className={`text-xs font-bold truncate ${
                          isSelected ? 'text-[#FF252B]' : 'text-slate-900'
                        }`}>
                          {conv.contactName}
                        </h4>
                        <span className="text-[11px] text-slate-400 font-medium whitespace-nowrap">
                          {conv.lastMessageAt}
                        </span>
                      </div>

                      {/* Last message preview */}
                      <p className="text-xs text-slate-500 line-clamp-1 font-normal mb-1.5">
                        {conv.lastMessage.startsWith('[Nota]') ? (
                          <span className="text-amber-700 font-medium inline-flex items-center gap-1">
                            <Lock className="w-2.5 h-2.5" />
                            {conv.lastMessage}
                          </span>
                        ) : (
                          conv.lastMessage
                        )}
                      </p>

                      {/* Meta badges: Agent, Tags, Unread counter */}
                      <div className="flex items-center justify-between gap-2 mt-1">
                        <div className="flex items-center gap-1.5 flex-wrap truncate">
                          {conv.assignedAgent.includes('IA') ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                              <Sparkles className="w-2.5 h-2.5 text-indigo-600" />
                              IA
                            </span>
                          ) : (
                            <span className="text-[11px] font-medium text-slate-500 truncate max-w-[90px]">
                              {conv.assignedAgent.split(' ')[0]}
                            </span>
                          )}

                          {conv.tags && conv.tags[0] && (
                            <span className="text-[11px] font-medium px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 truncate max-w-[85px]">
                              {conv.tags[0]}
                            </span>
                          )}
                        </div>

                        {/* Status / Unread Badge */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {conv.status === 'resolved' ? (
                            <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-0.5">
                              <CheckCircle2 className="w-3 h-3" />
                            </span>
                          ) : conv.unreadCount > 0 ? (
                            <span className="w-4 h-4 rounded-full bg-[#FF252B] text-white text-[11px] font-bold flex items-center justify-center animate-pulse">
                              {conv.unreadCount}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* COLUMN 2: ACTIVE CONVERSATION THREAD & INTERACTIVE FOOTER                 */}
        {/* ========================================================================= */}
        <div className="flex-1 flex flex-col bg-slate-50/60 min-w-0 border-r border-slate-200">
          {activeConversation ? (
            <>
              {/* Middle Header - Clean Responsive Layout */}
              <div className="bg-white border-b border-slate-200 shadow-xs">
                <div className="px-4 py-3 flex items-center justify-between gap-3">
                  {/* Left: Contact Info and Channel Status */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative flex-shrink-0">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#172C8A] to-[#FF5A16] text-white font-bold text-xs flex items-center justify-center shadow-xs">
                        {activeConversation.contactName.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="absolute -bottom-0.5 -right-0.5 bg-white p-0.5 rounded-full border border-slate-200">
                        {renderChannelIcon(activeConversation.channel, 'w-3 h-3')}
                      </div>
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-900 truncate max-w-[150px] sm:max-w-[220px] md:max-w-xs">
                          {activeConversation.contactName}
                        </h3>
                        {/* Channel status pill */}
                        {(() => {
                          const pill = getChannelPillInfo(activeConversation.channel);
                          return (
                            <div className={`hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${pill.bg}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${pill.dot} animate-pulse`} />
                              <span>{pill.label}</span>
                            </div>
                          );
                        })()}
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium truncate mt-0.5">
                        <span className="font-semibold text-slate-700">{activeConversation.contactPhone}</span>
                        <span>•</span>
                        <span className="capitalize">{activeContact?.city || 'Colombia'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right Header Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Assigned Agent dropdown */}
                    <div className="hidden lg:flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200/80 px-2.5 py-1.5 rounded-lg transition border border-slate-200">
                      <User className="w-3.5 h-3.5 text-slate-500" />
                      <select
                        value={activeConversation.assignedAgent}
                        onChange={(e) => handleAssignAgent(e.target.value)}
                        className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
                      >
                        {AVAILABLE_AGENTS.map((agent) => (
                          <option key={agent} value={agent}>
                            {agent}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Mark Resolved Button */}
                    <button
                      onClick={handleToggleResolved}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition shadow-xs ${
                        activeConversation.status === 'resolved'
                          ? 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                          : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300'
                      }`}
                    >
                      {activeConversation.status === 'resolved' ? (
                        <>
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Reabrir</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="hidden sm:inline">Resolver</span>
                        </>
                      )}
                    </button>

                    {/* Quick Voice Call Launcher */}
                    <button
                      onClick={() => handleOpenSimulator(linkedVoiceCalls[0] || null)}
                      title="Llamada IA Valentina"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-brand-gradient hover:opacity-95 text-white shadow-xs transition"
                    >
                      <PhoneCall className="w-3.5 h-3.5" />
                      <span className="hidden md:inline">Llamar con IA</span>
                    </button>

                    {/* Ficha 360° Dossier Toggle Button */}
                    <button
                      onClick={() => setIsDossierOpen(!isDossierOpen)}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition shadow-xs ${
                        isDossierOpen
                          ? 'bg-slate-900 text-white border-brand-navy'
                          : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                      title={isDossierOpen ? 'Ocultar expediente 360°' : 'Ver expediente 360°'}
                    >
                      <User className="w-3.5 h-3.5" />
                      <span className="hidden xl:inline">Ficha 360°</span>
                      <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isDossierOpen ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Message Thread */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                {/* Channel banner info */}
                <div className="text-center my-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 bg-white px-3 py-1 rounded-full border border-slate-200 shadow-xs">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    Conversación cifrada de extremo a extremo vía {activeConversation.channel.toUpperCase()} Oficial
                  </span>
                </div>

                {messages.length === 0 ? (
                  <div className="py-12 text-center text-slate-400">
                    <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-30 text-slate-500" />
                    <p className="text-xs font-medium">No hay mensajes previos en esta conversación.</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Envía un mensaje o plantilla de WhatsApp para iniciar.
                    </p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    // 1. Internal Note Style
                    if (msg.isInternalNote) {
                      return (
                        <div
                          key={msg.id}
                          className="mx-auto max-w-xl my-2 p-3.5 rounded-xl bg-amber-50 border border-amber-300/80 shadow-xs text-amber-900 text-xs"
                        >
                          <div className="flex items-center justify-between border-b border-amber-200 pb-1.5 mb-1.5 font-bold">
                            <span className="flex items-center gap-1.5 text-amber-800">
                              <Lock className="w-3.5 h-3.5 text-amber-600" />
                              Nota Interna del Equipo (Solo visible para asesores)
                            </span>
                            <span className="text-[11px] text-amber-600 font-normal">
                              {msg.senderName} • {msg.timestamp}
                            </span>
                          </div>
                          <p className="whitespace-pre-wrap font-medium">{msg.text}</p>
                        </div>
                      );
                    }

                    // 2. AI Bot Automated Message
                    if (msg.sender === 'bot') {
                      return (
                        <div key={msg.id} className="flex flex-col items-start max-w-lg">
                          <div className="flex items-center gap-1.5 mb-1 px-1">
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                              <Sparkles className="w-3 h-3 text-indigo-500" />
                              Valentina IA Bot (Automático)
                            </span>
                            <span className="text-[11px] text-slate-400">{msg.timestamp}</span>
                          </div>
                          <div className="bg-white border border-indigo-200 text-slate-800 p-3.5 rounded-2xl rounded-tl-sm shadow-xs text-xs whitespace-pre-wrap leading-relaxed">
                            {msg.text}
                          </div>
                        </div>
                      );
                    }

                    // 3. Human Agent Message
                    if (msg.sender === 'agent') {
                      return (
                        <div key={msg.id} className="flex flex-col items-end ml-auto max-w-lg">
                          <div className="flex items-center gap-1.5 mb-1 px-1">
                            <span className="text-[11px] font-semibold text-slate-600">{msg.senderName}</span>
                            <span className="text-[11px] text-slate-400">{msg.timestamp}</span>
                          </div>
                          <div className="bg-slate-900 text-white p-3.5 rounded-2xl rounded-tr-sm shadow-sm text-xs whitespace-pre-wrap leading-relaxed">
                            {msg.text}
                          </div>
                          <div className="flex items-center gap-1 mt-1 pr-1 text-[11px] text-slate-400">
                            <span>Entregado</span>
                            <CheckCheck className="w-3 h-3 text-emerald-600" />
                          </div>
                        </div>
                      );
                    }

                    // 4. Customer Message
                    return (
                      <div key={msg.id} className="flex flex-col items-start max-w-lg">
                        <div className="flex items-center gap-1.5 mb-1 px-1">
                          <span className="text-[11px] font-bold text-slate-800">{msg.senderName}</span>
                          <span className="text-[11px] text-slate-400">{msg.timestamp}</span>
                        </div>
                        <div className="bg-white border border-slate-200/90 text-slate-900 p-3.5 rounded-2xl rounded-tl-sm shadow-xs text-xs whitespace-pre-wrap leading-relaxed">
                          {msg.text}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Rich Interactive Footer */}
              <div className="bg-white border-t border-slate-200 p-3.5">
                {/* Notice banner if Internal Note Mode is ON */}
                {isInternalNoteMode && (
                  <div className="mb-2 px-3 py-1.5 rounded-lg bg-amber-100 border border-amber-300 text-amber-900 text-xs font-semibold flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-amber-700" />
                      Modo Nota Interna activado — Esta nota solo será visible para tu equipo.
                    </span>
                    <button
                      onClick={() => setIsInternalNoteMode(false)}
                      className="text-amber-700 hover:text-amber-900 underline text-xs"
                    >
                      Desactivar
                    </button>
                  </div>
                )}

                {/* Toolbar: Quick Replies, WhatsApp Templates, Toggle Internal Note */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Toggle Internal Note Button */}
                    <button
                      type="button"
                      onClick={() => setIsInternalNoteMode(!isInternalNoteMode)}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${
                        isInternalNoteMode
                          ? 'bg-amber-500 text-white shadow-xs'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Nota Interna</span>
                    </button>

                    {/* Quick Replies Picker */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowQuickReplies(!showQuickReplies)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                      >
                        <FileText className="w-3.5 h-3.5 text-[#FF5A16]" />
                        <span>Respuestas Rápidas (/)</span>
                        <ChevronDown className="w-3 h-3 text-slate-400" />
                      </button>

                      {showQuickReplies && (
                        <div className="absolute bottom-full left-0 mb-2 w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-30 p-2 text-xs">
                          <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-100 px-2">
                            <span className="font-bold text-slate-800">Atajos de Respuesta</span>
                            <button
                              onClick={() => setShowQuickReplies(false)}
                              className="text-slate-400 hover:text-slate-600"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="max-h-60 overflow-y-auto space-y-1">
                            {QUICK_REPLIES.map((qr) => (
                              <button
                                key={qr.code}
                                onClick={() => handleSelectQuickReply(qr)}
                                className="w-full text-left p-2 rounded-lg hover:bg-slate-50 transition flex flex-col gap-0.5"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-[#FF252B]">{qr.code}</span>
                                  <span className="text-[11px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                                    {qr.category}
                                  </span>
                                </div>
                                <span className="font-medium text-slate-700 text-xs truncate">
                                  {qr.label}
                                </span>
                                <span className="text-slate-400 text-[11px] line-clamp-1">
                                  {qr.text}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* WhatsApp Official Templates Button */}
                    <button
                      type="button"
                      onClick={() => setShowTemplatesModal(true)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition"
                    >
                      <WhatsAppIcon className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Plantillas Meta HSM</span>
                    </button>
                  </div>

                  <span className="text-xs text-slate-400 hidden sm:inline">
                    Enter para enviar • Shift+Enter nueva línea
                  </span>
                </div>

                {/* Textarea Input and Send Action */}
                <div className="flex items-end gap-2">
                  <textarea
                    rows={2}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={
                      isInternalNoteMode
                        ? 'Escribe una nota interna para el equipo (no visible para el cliente)...'
                        : `Escribe un mensaje por ${activeConversation.channel.toUpperCase()} a ${
                            activeConversation.contactName
                          }...`
                    }
                    className={`flex-1 text-xs p-2.5 rounded-xl border transition-all resize-none focus:outline-none ${
                      isInternalNoteMode
                        ? 'bg-amber-50/60 border-amber-300 text-amber-950 placeholder-amber-700/60 focus:ring-2 focus:ring-amber-400'
                        : 'bg-slate-50 hover:bg-slate-100/60 focus:bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-[#FF252B]/20 focus:border-[#FF252B]'
                    }`}
                  />

                  <button
                    onClick={handleSendMessage}
                    disabled={!inputText.trim()}
                    className={`h-11 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition disabled:opacity-40 disabled:cursor-not-allowed ${
                      isInternalNoteMode
                        ? 'bg-amber-600 hover:bg-amber-700 text-white'
                        : 'bg-brand-gradient hover:opacity-95 text-white'
                    }`}
                  >
                    {isInternalNoteMode ? (
                      <>
                        <Lock className="w-3.5 h-3.5" />
                        <span>Guardar Nota</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Enviar</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
              <MessageSquare className="w-12 h-12 opacity-30 mb-3" />
              <h3 className="text-sm font-bold text-slate-700">Selecciona una conversación</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                Escoge cualquier cliente del panel izquierdo para ver el hilo multicanal y gestionar pedidos.
              </p>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* COLUMN 3: RIGHT CUSTOMER 360 DOSSIER                                     */}
        {/* ========================================================================= */}
        {isDossierOpen && (
          <div className="w-80 xl:w-88 flex-shrink-0 bg-white border-l border-slate-200 flex flex-col overflow-y-auto divide-y divide-slate-100 animate-fade-in shadow-lg xl:shadow-none z-10">
            {activeContact && activeConversation ? (
              <>
                {/* Dossier Header & Profile Overview */}
                <div className="p-4 text-center relative">
                  <button
                    onClick={() => setIsDossierOpen(false)}
                    className="absolute top-3 right-3 p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                    title="Cerrar Ficha 360°"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <div className="relative inline-block mb-2">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-[#172C8A] via-[#FF5A16] to-[#FF252B] text-white font-bold text-lg flex items-center justify-center shadow-md mx-auto">
                      {activeContact.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="absolute -bottom-1 -right-1 bg-white p-0.5 rounded-full border border-slate-200 shadow-xs">
                      {renderChannelIcon(activeConversation.channel, 'w-3.5 h-3.5')}
                    </div>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                    {activeContact.name}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    {activeContact.city} • Cliente COD
                  </p>

                {/* Quick contact buttons */}
                <div className="flex items-center justify-center gap-2 mt-3">
                  <a
                    href={`tel:${activeContact.phone}`}
                    className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                    title="Llamar teléfono"
                  >
                    <Phone className="w-3.5 h-3.5" />
                  </a>
                  <a
                    href={`https://wa.me/${activeContact.phone.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition"
                    title="Abrir WhatsApp Web"
                  >
                    <WhatsAppIcon className="w-3.5 h-3.5" />
                  </a>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`${activeContact.name} - ${activeContact.phone}`);
                      showToast('Datos del cliente copiados');
                    }}
                    className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                    title="Copiar datos"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Key Metrics Cards */}
                <div className="grid grid-cols-2 gap-2 mt-4 text-left">
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-[11px] font-bold text-slate-400 block">
                      LTV Total Comprado
                    </span>
                    <span className="text-xs font-bold text-[#172C8A] mt-0.5 block">
                      ${activeContact.lifetimeValue.toLocaleString()} COP
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-[11px] font-bold text-slate-400 block">
                      Historial Pedidos
                    </span>
                    <span className="text-xs font-bold text-slate-800 mt-0.5 block">
                      {activeContact.ordersCount} pedido(s)
                    </span>
                  </div>
                </div>
              </div>

              {/* Linked Orders Section */}
              <div className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <ShoppingBag className="w-3.5 h-3.5 text-[#FF252B]" />
                    Pedido Vinculado
                  </h4>
                  {linkedOrder && (
                    <span className="text-[11px] font-bold text-slate-500 font-mono">
                      #{linkedOrder.orderNumber}
                    </span>
                  )}
                </div>

                {linkedOrder ? (
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/90 text-xs space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-bold text-slate-900 block">
                          {linkedOrder.productName}
                        </span>
                        <span className="text-slate-500 text-xs">
                          {linkedOrder.comboName} ({linkedOrder.units} un.)
                        </span>
                      </div>
                      <span className="font-bold text-[#FF252B] whitespace-nowrap">
                        ${linkedOrder.totalAmount.toLocaleString()}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-xs">
                      <span className="text-slate-500">Estado de Envío:</span>
                      {renderOrderStatusBadge(linkedOrder.status)}
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-white p-2 rounded-lg border border-slate-200/60">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span className="truncate">
                        {linkedOrder.address}, {linkedOrder.city}
                      </span>
                    </div>

                    {onSelectOrder && (
                      <button
                        onClick={() => onSelectOrder(linkedOrder.id)}
                        className="w-full text-center py-1.5 rounded-lg text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 transition"
                      >
                        Ver Detalle del Pedido →
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-center text-xs text-slate-400">
                    No hay un pedido directamente vinculado a este chat.
                  </div>
                )}
              </div>

              {/* Voice AI Call History Section */}
              <div className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Headphones className="w-3.5 h-3.5 text-indigo-600" />
                    Llamadas de Valentina IA
                  </h4>
                  <button
                    onClick={() => handleOpenSimulator(linkedVoiceCalls[0] || null)}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 underline"
                  >
                    Simular
                  </button>
                </div>

                {linkedVoiceCalls.length > 0 ? (
                  <div className="space-y-2">
                    {linkedVoiceCalls.map((call) => (
                      <div
                        key={call.id}
                        className="p-3 rounded-xl bg-indigo-50/50 border border-indigo-100 text-xs space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800 flex items-center gap-1">
                            <PhoneCall className="w-3 h-3 text-indigo-600" />
                            Llamada Saliente IA
                          </span>
                          <span className="text-[11px] font-semibold text-slate-500">
                            {call.durationSeconds > 0 ? `${call.durationSeconds}s` : 'Sin duración'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500">
                            Intentos: {call.attempts}/{call.maxAttempts}
                          </span>
                          {renderOrderStatusBadge(call.status)}
                        </div>

                        {call.structuredResult?.customerSentiment && (
                          <div className="text-[11px] text-slate-600 bg-white p-1.5 rounded border border-indigo-100/60 flex items-center justify-between">
                            <span>Sentimiento:</span>
                            <span className="font-bold text-emerald-700 capitalize">
                              {call.structuredResult.customerSentiment}
                            </span>
                          </div>
                        )}

                        <button
                          onClick={() => setViewTranscriptCall(call)}
                          className="w-full text-center py-1 rounded bg-white hover:bg-indigo-100/60 text-indigo-700 font-bold text-[11px] transition border border-indigo-200"
                        >
                          Ver Transcripción Completa ({call.transcript?.length || 0} mensajes)
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-center text-xs text-slate-400">
                    <p>No se registran llamadas con IA aún.</p>
                    <button
                      onClick={() => handleOpenSimulator(null)}
                      className="mt-2 px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg font-bold text-xs transition inline-flex items-center gap-1"
                    >
                      <Sparkles className="w-3 h-3 text-indigo-600" />
                      Disparar Prueba con Valentina
                    </button>
                  </div>
                )}
              </div>

              {/* Tags Manager Section */}
              <div className="p-5">
                <div className="flex items-center justify-between mb-2.5">
                  <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-slate-600" />
                    Etiquetas del Cliente
                  </h4>
                  <button
                    onClick={() => setIsAddingTag(!isAddingTag)}
                    className="text-xs font-bold text-[#FF252B] hover:opacity-80 flex items-center gap-0.5"
                  >
                    <Plus className="w-3 h-3" />
                    Nueva
                  </button>
                </div>

                {/* Active tags pills */}
                <div className="flex flex-wrap gap-1.5 mb-2.5">
                  {activeContact.tags?.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200"
                    >
                      <span>{tag}</span>
                      <button
                        onClick={() => handleRemoveTag(tag)}
                        className="text-slate-400 hover:text-red-600 ml-0.5"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  ))}
                </div>

                {/* Add Tag Field */}
                {isAddingTag && (
                  <div className="flex items-center gap-1.5 mb-2">
                    <input
                      type="text"
                      placeholder="Nueva etiqueta..."
                      value={newTagInput}
                      onChange={(e) => setNewTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddTag(newTagInput);
                        }
                      }}
                      className="flex-1 text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#FF252B]"
                    />
                    <button
                      onClick={() => handleAddTag(newTagInput)}
                      className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold"
                    >
                      Añadir
                    </button>
                  </div>
                )}

                {/* Suggested Quick Tags */}
                <div className="flex flex-wrap gap-1">
                  {['VIP', 'COD Verificado', 'Dirección Corregida', 'Urgente', 'Cliente Recurrente'].map(
                    (suggested) => {
                      if (activeContact.tags?.includes(suggested)) return null;
                      return (
                        <button
                          key={suggested}
                          onClick={() => handleAddTag(suggested)}
                          className="text-[11px] font-medium px-2 py-0.5 rounded bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/80 transition"
                        >
                          + {suggested}
                        </button>
                      );
                    }
                  )}
                </div>
              </div>

              {/* Internal Notes Timeline Section */}
              <div className="p-5">
                <div className="flex items-center justify-between mb-2.5">
                  <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-amber-600" />
                    Notas Internas del Expediente
                  </h4>
                  <span className="text-[11px] text-slate-400">
                    {activeContact.internalNotes?.length || 0}
                  </span>
                </div>

                {/* Add Quick Dossier Note */}
                <div className="flex items-center gap-1.5 mb-3">
                  <input
                    type="text"
                    placeholder="Añadir nota al expediente..."
                    value={newDossierNote}
                    onChange={(e) => setNewDossierNote(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddDossierNote();
                      }
                    }}
                    className="flex-1 text-xs px-2.5 py-1.5 bg-amber-50/40 border border-amber-200 rounded-lg placeholder-amber-800/50 focus:outline-none focus:ring-1 focus:ring-amber-400"
                  />
                  <button
                    onClick={handleAddDossierNote}
                    disabled={!newDossierNote.trim()}
                    className="p-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white rounded-lg transition"
                    title="Guardar nota"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Notes List */}
                <div className="space-y-2">
                  {activeContact.internalNotes && activeContact.internalNotes.length > 0 ? (
                    activeContact.internalNotes.map((note, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-lg bg-amber-50/70 border border-amber-200 text-xs text-amber-950 space-y-1"
                      >
                        <div className="flex items-center justify-between text-[11px] text-amber-700 font-semibold">
                          <span>Nota de Equipo</span>
                          <span>Hace poco</span>
                        </div>
                        <p className="font-medium whitespace-pre-wrap">{note}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400 italic">No hay notas registradas para este cliente.</p>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="p-8 text-center text-slate-400">
              <User className="w-10 h-10 opacity-30 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-600">Expediente 360°</p>
              <p className="text-xs text-slate-400 mt-1">
                Selecciona una conversación para cargar la ficha del cliente y sus órdenes.
              </p>
            </div>
          )}
        </div>
        )}

      </div>

      {/* ========================================================================= */}
      {/* MODAL: OFFICIAL WHATSAPP HSM TEMPLATES PICKER                             */}
      {/* ========================================================================= */}
      {showTemplatesModal && activeContact && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-fade-in">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <WhatsAppIcon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold text-slate-900">
                    Plantillas Oficiales WhatsApp (Meta HSM)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Mensajes pre-aprobados para contactar a {activeContact.name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowTemplatesModal(false);
                  setSelectedTemplate(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-3 flex-1">
              <p className="text-xs text-slate-600 mb-2">
                Selecciona una plantilla oficial para previsualizar cómo se enviará con los datos del pedido y del cliente:
              </p>

              {WHATSAPP_TEMPLATES.map((tmpl) => {
                const isSelected = selectedTemplate?.id === tmpl.id;
                const previewText = tmpl.generateText(activeContact, linkedOrder || undefined);

                return (
                  <div
                    key={tmpl.id}
                    onClick={() => setSelectedTemplate(tmpl)}
                    className={`p-4 rounded-xl border cursor-pointer transition ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs text-slate-900">{tmpl.name}</span>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        {tmpl.category}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mb-2">{tmpl.description}</p>

                    {/* Preview box */}
                    <div className="p-3 rounded-lg bg-white border border-slate-200 text-slate-800 text-xs font-mono whitespace-pre-wrap leading-relaxed">
                      {previewText}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Se enviará a través de Meta Cloud API al número {activeContact.phone}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setShowTemplatesModal(false);
                    setSelectedTemplate(null);
                  }}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition"
                >
                  Cancelar
                </button>
                <button
                  disabled={!selectedTemplate}
                  onClick={() => selectedTemplate && handleSendWhatsAppTemplate(selectedTemplate)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Enviar Plantilla Ahora</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CALL TRANSCRIPT VIEWER                                             */}
      {/* ========================================================================= */}
      {viewTranscriptCall && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <Headphones className="w-4 h-4 text-indigo-600" />
                <h3 className="text-[15px] font-semibold text-slate-900">
                  Transcripción de Llamada IA Valentina
                </h3>
              </div>
              <button
                onClick={() => setViewTranscriptCall(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3 flex-1 text-xs">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-400 block">Cliente:</span>
                  <span className="font-bold text-slate-800">{viewTranscriptCall.customerName}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Teléfono:</span>
                  <span className="font-bold text-slate-800">{viewTranscriptCall.phone}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Duración:</span>
                  <span className="font-bold text-slate-800">
                    {viewTranscriptCall.durationSeconds} segundos
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Resultado:</span>
                  <span className="font-bold text-emerald-700 capitalize">
                    {viewTranscriptCall.status}
                  </span>
                </div>
              </div>

              <div className="space-y-2 mt-3">
                <span className="text-xs font-bold text-slate-500 block">
                  Diálogo Registrado en Tiempo Real
                </span>
                {viewTranscriptCall.transcript && viewTranscriptCall.transcript.length > 0 ? (
                  viewTranscriptCall.transcript.map((line, i) => (
                    <div
                      key={i}
                      className={`p-2.5 rounded-xl text-xs ${
                        line.speaker === 'agent'
                          ? 'bg-indigo-50 border border-indigo-100 text-indigo-950 ml-4'
                          : line.speaker === 'customer'
                          ? 'bg-slate-100 border border-slate-200 text-slate-900 mr-4'
                          : 'bg-amber-50 text-amber-800 text-[11px] text-center'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px] font-bold opacity-70 mb-0.5">
                        <span>
                          {line.speaker === 'agent'
                            ? 'Valentina (Voz IA)'
                            : line.speaker === 'customer'
                            ? 'Cliente'
                            : 'Sistema'}
                        </span>
                        <span>{line.timestamp}</span>
                      </div>
                      <p>{line.text}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-400 italic text-center py-4">
                    No hay líneas de diálogo guardadas para este registro.
                  </p>
                )}
              </div>
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-100 text-right">
              <button
                onClick={() => setViewTranscriptCall(null)}
                className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: INTERACTIVE VOICE CALL SIMULATOR                                   */}
      {/* ========================================================================= */}
      {simulatorOpen && (
        <VoiceCallSimulatorModal
          isOpen={simulatorOpen}
          onClose={() => {
            setSimulatorOpen(false);
            reloadData();
          }}
          task={simTask}
          order={simOrder}
          onCompleted={(completedTask) => {
            reloadData();
            showToast('Llamada IA finalizada y registrada');
          }}
        />
      )}
    </div>
  );
}
