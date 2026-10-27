export type PaymentMethodType = 'cash_on_delivery' | 'card_online' | 'bank_transfer' | 'whatsapp_order';

export type OrderStatus =
  | 'pending_call'
  | 'calling'
  | 'confirmed_by_voice'
  | 'needs_review'
  | 'unanswered'
  | 'retry_scheduled'
  | 'cancelled'
  | 'shipped'
  | 'delivered';

export interface ProductCombo {
  id: string;
  name: string;
  units: number;
  regularPrice: number;
  promoPrice: number;
  savingsText: string;
  badge?: string;
  isPopular?: boolean;
  image?: string;
}

export interface BenefitItem {
  id: string;
  icon: string;
  title: string;
  description: string;
}

export interface FeatureItem {
  id: string;
  title: string;
  description: string;
  image?: string;
}

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

export interface ReviewItem {
  id: string;
  author: string;
  location: string;
  rating: number;
  comment: string;
  verifiedPurchase: boolean;
  date: string;
  avatar?: string;
}

export interface CreativeCallout {
  label: string;
  text: string;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

export interface LandingCreative {
  id: string;
  type: 'hero' | 'infographic' | 'combo' | 'guarantee';
  title: string;
  subtitle: string;
  badge: string;
  productImage: string;
  theme: 'brand' | 'dark' | 'emerald' | 'blue' | 'minimal';
  callouts?: CreativeCallout[];
  highlightText?: string;
  priceTag?: string;
  includedInLanding: boolean;
}

export interface LandingPageConfig {
  id: string;
  slug: string;
  title: string;
  headline: string;
  subheadline: string;
  productName: string;
  category: string;
  mainImage: string;
  galleryImages: string[];
  regularPrice: number;
  promoPrice: number;
  currency: string;
  discountBadge: string;
  urgencyText: string;
  countdownMinutes: number;
  stockLeft: number;
  combos: ProductCombo[];
  benefits: BenefitItem[];
  features: FeatureItem[];
  reviews: ReviewItem[];
  faqs: FAQItem[];
  paymentMethods: PaymentMethodType[];
  shippingCostText: string;
  guaranteeText: string;
  guaranteeDays: number;
  whatsappNumber: string;
  whatsappDirectMessage: string;
  themeStyle: 'impact-vibrant' | 'dark-luxe' | 'dropship-fast' | 'clean-white' | 'tech-neon';
  primaryColor: string;
  accentColor: string;
  enableStickyBar: boolean;
  enableRecentSalesPopup: boolean;
  seoTitle: string;
  seoDescription: string;
  metaPixelId?: string;
  tiktokPixelId?: string;
  ga4Id?: string;
  isPublished: boolean;
  publishedUrl: string;
  viewsCount: number;
  ordersCount: number;
  creatives?: LandingCreative[];
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  id: string;
  orderNumber: string;
  landingPageId: string;
  productName: string;
  comboName: string;
  units: number;
  totalAmount: number;
  customerName: string;
  phone: string;
  email?: string;
  department: string;
  city: string;
  address: string;
  notes?: string;
  paymentMethod: PaymentMethodType;
  status: OrderStatus;
  utmSource?: string;
  utmCampaign?: string;
  callTaskId?: string;
  createdAt: string;
  confirmedAt?: string;
}

export interface VoiceAgentSettings {
  id: string;
  name: string;
  provider: 'vapi' | 'retell' | 'twilio_voice' | 'internal_simulator';
  apiKey?: string;
  agentId?: string;
  phoneNumber?: string;
  language: string;
  accent: 'colombia' | 'mexico' | 'spain' | 'argentina' | 'neutral';
  voiceName: string;
  tone: 'amable_comercial' | 'formal_seguro' | 'dinamico_urgente';
  promptScript: string;
  allowedHoursStart: string; // e.g. "08:00"
  allowedHoursEnd: string;   // e.g. "20:00"
  maxAttempts: number;
  retryIntervalMinutes: number;
  operatorTransferPhone: string;
  confirmAddressStrict: boolean;
  askForSecondaryPhone: boolean;
  isActive: boolean;
}

export interface CallLogMessage {
  speaker: 'agent' | 'customer' | 'system';
  text: string;
  timestamp: string;
}

export interface VoiceCallTask {
  id: string;
  orderId: string;
  customerName: string;
  phone: string;
  status: OrderStatus;
  attempts: number;
  maxAttempts: number;
  durationSeconds: number;
  startedAt?: string;
  completedAt?: string;
  transcript: CallLogMessage[];
  structuredResult?: {
    confirmed: boolean;
    verifiedAddress?: string;
    verifiedQuantity?: number;
    notes?: string;
    customerSentiment: 'positive' | 'neutral' | 'skeptical' | 'rejected';
    cancellationReason?: string;
  };
  audioUrl?: string;
}

export interface CRMContact {
  id: string;
  name: string;
  phone: string;
  email?: string;
  city: string;
  lifetimeValue: number;
  ordersCount: number;
  lastInteractionAt: string;
  tags: string[];
  internalNotes: string[];
}

export interface CRMMessage {
  id: string;
  conversationId: string;
  sender: 'contact' | 'agent' | 'bot';
  senderName: string;
  text: string;
  timestamp: string;
  status: 'sent' | 'delivered' | 'read';
  isInternalNote?: boolean;
}

export interface CRMConversation {
  id: string;
  contactId: string;
  contactName: string;
  contactPhone: string;
  channel: 'whatsapp' | 'instagram' | 'messenger' | 'webchat';
  status: 'unread' | 'open' | 'pending' | 'resolved';
  assignedAgent: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  tags: string[];
  linkedOrderId?: string;
}

export interface AutomationFlow {
  id: string;
  name: string;
  description: string;
  triggerEvent: 'order_created' | 'call_confirmed' | 'call_unanswered' | 'incoming_message';
  conditions: {
    field: string;
    operator: 'equals' | 'greater_than' | 'contains';
    value: string | number;
  }[];
  actions: {
    type: 'trigger_voice_call' | 'send_whatsapp_template' | 'create_agent_task' | 'update_order_status' | 'trigger_webhook';
    payload: Record<string, any>;
  }[];
  isActive: boolean;
  executionsCount: number;
  lastTriggeredAt?: string;
}
