import { LandingPageConfig, ProductCombo, BenefitItem, FeatureItem, ReviewItem, FAQItem, LandingCreative } from './types';
import { buildDefaultCreativesForProduct } from './creative-generator';

export interface GenerationInput {
  productName: string;
  category: string;
  imageUrl: string;
  galleryUrls?: string[];
  regularPrice: number;
  promoPrice: number;
  currency?: string;
  offerType?: string;
  benefitsInput?: string;
  shippingType?: 'free' | 'calculated';
  paymentMethods?: ('cash_on_delivery' | 'card_online' | 'bank_transfer')[];
  whatsappNumber: string;
  themeStyle?: 'impact-vibrant' | 'dark-luxe' | 'dropship-fast' | 'clean-white' | 'tech-neon';
  primaryColor?: string;
}

export function generateLandingPageWithAI(input: GenerationInput): LandingPageConfig {
  const currency = input.currency || 'COP';
  const slug = input.productName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const id = `lp-${slug}-${Date.now().toString().slice(-4)}`;
  const discountPercent = Math.round(((input.regularPrice - input.promoPrice) / input.regularPrice) * 100);

  // Dynamic Combo Calculation
  const combo1Price = input.promoPrice;
  const combo2Price = Math.round(input.promoPrice * 1.68 / 100) * 100; // ~40% off on 2nd unit
  const combo3Price = Math.round(input.promoPrice * 2.25 / 100) * 100; // huge savings on 3 units

  const combos: ProductCombo[] = [
    {
      id: `c-1-${Date.now()}`,
      name: `1x ${input.productName} (Edición Individual)`,
      units: 1,
      regularPrice: input.regularPrice,
      promoPrice: combo1Price,
      savingsText: `Ahorras ${(input.regularPrice - combo1Price).toLocaleString()} ${currency}`,
      badge: 'Oferta Estándar',
      isPopular: false,
    },
    {
      id: `c-2-${Date.now()}`,
      name: `2x ${input.productName} (¡Lleva 1 y Regala 1!)`,
      units: 2,
      regularPrice: input.regularPrice * 2,
      promoPrice: combo2Price,
      savingsText: `Ahorras ${((input.regularPrice * 2) - combo2Price).toLocaleString()} ${currency} (Descuento Máximo)`,
      badge: '🔥 EL MÁS VENDIDO — RECOMENDADO',
      isPopular: true,
    },
    {
      id: `c-3-${Date.now()}`,
      name: `3x ${input.productName} (Pack Familiar Premium)`,
      units: 3,
      regularPrice: input.regularPrice * 3,
      promoPrice: combo3Price,
      savingsText: `Ahorras ${((input.regularPrice * 3) - combo3Price).toLocaleString()} ${currency} (Envío Prioritario)`,
      badge: 'MEJOR VALOR',
      isPopular: false,
    },
  ];

  // Persuasive LATAM COD copywriting (Clean, modern direct-response)
  const headline = `${input.productName} — Edición Original`;
  const subheadline = `Pide hoy con Envío Gratis a toda Colombia. Recibes en la puerta de tu casa u oficina y le pagas en efectivo al repartidor.`;

  const benefits: BenefitItem[] = [
    {
      id: `b-1-${Date.now()}`,
      icon: 'ShieldCheck',
      title: 'Materiales Certificados de Alta Durabilidad',
      description: 'Fabricado bajo estrictos controles de calidad para resistir el uso intensivo diario sin perder efectividad.',
    },
    {
      id: `b-2-${Date.now()}`,
      icon: 'Zap',
      title: 'Fácil de Usar desde el Primer Segundo',
      description: 'Sin configuraciones complejas. Listo para usar en cuanto abras el paquete con manual y soporte en español.',
    },
    {
      id: `b-3-${Date.now()}`,
      icon: 'Truck',
      title: 'Envío Express 24/48 Horas con Seguro',
      description: 'Tu paquete viaja protegido con número de seguimiento y trazabilidad continua hasta tu ciudad.',
    },
    {
      id: `b-4-${Date.now()}`,
      icon: 'Clock',
      title: 'Garantía Total de 30 Días',
      description: 'Si el producto presenta cualquier falla o defecto, lo reemplazamos inmediatamente sin trámites molestos.',
    },
  ];

  const features: FeatureItem[] = [
    {
      id: `f-1-${Date.now()}`,
      title: 'Tecnología e Ingeniería de Vanguardia',
      description: 'Optimizado para maximizar el confort y entregar resultados consistentes en cualquier situación.',
    },
    {
      id: `f-2-${Date.now()}`,
      title: 'Diseño Ergonómico y Acabado Premium',
      description: 'Ligero, moderno y construido con acabados que combinan estética profesional con practicidad extrema.',
    },
    {
      id: `f-3-${Date.now()}`,
      title: 'Probado y Calificado por Más de 1.400 Compradores',
      description: 'Uno de los productos mejor calificados de la temporada con un 98.4% de satisfacción confirmada.',
    },
  ];

  const reviews: ReviewItem[] = [
    {
      id: `rev-1-${Date.now()}`,
      author: 'Andrés Felipe M.',
      location: 'Medellín, Colombia',
      rating: 5,
      comment: `Totalmente recomendado. Llegó en dos días a mi casa y lo pagué en efectivo al repartidor. La calidad del ${input.productName} superó mis expectativas.`,
      verifiedPurchase: true,
      date: 'Hace 2 días',
    },
    {
      id: `rev-2-${Date.now()}`,
      author: 'Carolina Mendoza',
      location: 'Bogotá D.C.',
      rating: 5,
      comment: `Excelente compra. Pedí el combo de 2 unidades para aprovechar la promoción. Me llamaron por teléfono para confirmar la dirección y todo fue súper transparente.`,
      verifiedPurchase: true,
      date: 'Hace 4 días',
    },
    {
      id: `rev-3-${Date.now()}`,
      author: 'David E. Morales',
      location: 'Cali, Colombia',
      rating: 5,
      comment: `Al principio dudaba por comprar por internet, pero con la opción de pago contraentrega me sentí 100% seguro. Llegó en perfecto estado.`,
      verifiedPurchase: true,
      date: 'Hace 1 semana',
    },
  ];

  const faqs: FAQItem[] = [
    {
      id: `faq-1-${Date.now()}`,
      question: '¿Cómo funciona el Pago Contraentrega?',
      answer: 'Es el método más seguro. Llenas el formulario con tu dirección y ciudad. Nosotros despachamos el paquete y tú solo pagas el dinero en efectivo cuando el mensajero toque a tu puerta y te entregue el producto en mano.',
    },
    {
      id: `faq-2-${Date.now()}`,
      question: '¿Cuánto tiempo tarda en llegar?',
      answer: 'Para ciudades principales el tiempo promedio de entrega es de 24 a 48 horas hábiles. Para municipios intermedios o zonas especiales, entre 2 y 4 días hábiles.',
    },
    {
      id: `faq-3-${Date.now()}`,
      question: '¿Qué garantía tengo de recibir lo que pedí?',
      answer: 'Garantía 100% de satisfacción o reposición. Cada paquete es verificado e inspeccionado antes de ser empacado. Cuentas con 30 días de garantía directa por cualquier defecto de fabricación.',
    },
    {
      id: `faq-4-${Date.now()}`,
      question: '¿El envío tiene algún costo adicional?',
      answer: input.shippingType === 'calculated' ? 'El costo de envío se calcula según tu municipio y se informa claramente antes del despacho.' : '¡No! El envío es totalmente GRATIS a nivel nacional si ordenas durante la vigencia de esta promoción.',
    },
  ];

  // Smart Multi-Angle Gallery Generation if only 1 image provided
  let galleryImages = input.galleryUrls && input.galleryUrls.length > 0 ? [...input.galleryUrls] : [input.imageUrl];
  
  if (galleryImages.length === 1) {
    // Generate related high-quality contextual product shots based on category
    if (input.category.includes('Tecnología') || input.productName.toLowerCase().includes('watch') || input.productName.toLowerCase().includes('reloj')) {
      galleryImages = [
        input.imageUrl,
        'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?q=80&w=1000&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=1000&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1546868871-7041f2a55e12?q=80&w=1000&auto=format&fit=crop',
      ];
    } else if (input.category.includes('Hogar') || input.productName.toLowerCase().includes('aspiradora') || input.productName.toLowerCase().includes('clean')) {
      galleryImages = [
        input.imageUrl,
        'https://images.unsplash.com/photo-1558317374-067fb5f30001?q=80&w=1000&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?q=80&w=1000&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1581578731548-c64695cc6952?q=80&w=1000&auto=format&fit=crop',
      ];
    } else if (input.category.includes('Belleza') || input.productName.toLowerCase().includes('shaver') || input.productName.toLowerCase().includes('rasuradora')) {
      galleryImages = [
        input.imageUrl,
        'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?q=80&w=1000&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1621607512022-6aecc4fed814?q=80&w=1000&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1585751119414-ef2636f8aede?q=80&w=1000&auto=format&fit=crop',
      ];
    } else {
      galleryImages = [
        input.imageUrl,
        input.imageUrl,
      ];
    }
  }

  return {
    id,
    slug,
    title: input.productName,
    headline,
    subheadline,
    productName: input.productName,
    category: input.category || 'General E-commerce',
    mainImage: input.imageUrl,
    galleryImages,
    regularPrice: input.regularPrice,
    promoPrice: input.promoPrice,
    currency,
    discountBadge: `${discountPercent}% DE DESCUENTO — SOLO HOY`,
    urgencyText: '¡ALERTA DE ALTA DEMANDA! Pocas unidades disponibles en almacén con entrega inmediata.',
    countdownMinutes: 14,
    stockLeft: 9,
    combos,
    benefits,
    features,
    reviews,
    faqs,
    paymentMethods: input.paymentMethods || ['cash_on_delivery', 'card_online'],
    shippingCostText: input.shippingType === 'calculated' ? 'Tarifa fija calculada según destino' : 'ENVÍO GRATIS A TODO EL PAÍS',
    guaranteeText: 'Garantía Total de 30 Días: Compra 100% libre de riesgo con soporte directo en español.',
    guaranteeDays: 30,
    whatsappNumber: input.whatsappNumber,
    whatsappDirectMessage: `Hola, quiero confirmar información y ordenar el producto ${input.productName}.`,
    themeStyle: input.themeStyle || 'impact-vibrant',
    primaryColor: input.primaryColor || '#FF252B',
    accentColor: '#FF5A16',
    enableStickyBar: true,
    enableRecentSalesPopup: true,
    seoTitle: `${input.productName} — Oferta Exclusiva con Pago Contraentrega`,
    seoDescription: `Consigue ${input.productName} con hasta ${discountPercent}% de descuento y envío contraentrega. ¡Pide ahora y paga al recibir en tu puerta!`,
    isPublished: true,
    publishedUrl: `/p/${slug}`,
    viewsCount: 1,
    ordersCount: 0,
    creatives: buildDefaultCreativesForProduct({
      productName: input.productName,
      category: input.category,
      productImage: input.imageUrl,
      regularPrice: input.regularPrice,
      promoPrice: input.promoPrice,
      benefits: benefits.map((b) => b.title),
      features: features.map((f) => ({ title: f.title, description: f.description })),
    }),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
