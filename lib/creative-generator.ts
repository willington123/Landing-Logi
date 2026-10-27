import { LandingCreative } from './types';

export function buildDefaultCreativesForProduct(params: {
  productName: string;
  category?: string;
  productImage: string;
  regularPrice: number;
  promoPrice: number;
  benefits?: string[];
  features?: { title: string; description: string }[];
}): LandingCreative[] {
  const {
    productName,
    category = 'General',
    productImage,
    regularPrice,
    promoPrice,
    benefits = [],
    features = [],
  } = params;

  const discountPercent = Math.max(
    10,
    Math.round(((regularPrice - promoPrice) / (regularPrice || 1)) * 100)
  );

  const b1 = benefits[0] || 'Material de Grado Militar Resistente';
  const b2 = benefits[1] || 'Batería de Larga Duración Continua';
  const b3 = benefits[2] || 'Diseño Ergonómico y Cómodo';
  const b4 = benefits[3] || 'Garantía Total de Fábrica 100%';

  return [
    {
      id: `cr-hero-${Date.now()}`,
      type: 'hero',
      title: `¡Descubre el Nuevo ${productName}!`,
      subtitle: 'La solución definitiva con calidad garantizada. Paga en efectivo al recibir en tu puerta.',
      badge: `🔥 ${discountPercent}% DE DESCUENTO HOY`,
      productImage,
      theme: 'brand',
      highlightText: '🚚 ENVÍO GRATIS A TODO EL PAÍS',
      priceTag: `$${promoPrice.toLocaleString('es-CO')} COP`,
      includedInLanding: true,
    },
    {
      id: `cr-infographic-${Date.now() + 1}`,
      type: 'infographic',
      title: 'Puntos Clave y Características Principales',
      subtitle: 'Cada componente ha sido diseñado para ofrecer el máximo rendimiento.',
      badge: '✨ TECNOLOGÍA VERIFICADA',
      productImage,
      theme: 'dark',
      callouts: [
        { label: 'CALIDAD SUPERIOR', text: b1, position: 'top-left' },
        { label: 'MÁXIMA DURABILIDAD', text: b2, position: 'top-right' },
        { label: 'DISEÑO PREMIUM', text: b3, position: 'bottom-left' },
        { label: 'SEGURIDAD CERTIFICADA', text: b4, position: 'bottom-right' },
      ],
      includedInLanding: true,
    },
    {
      id: `cr-combo-${Date.now() + 2}`,
      type: 'combo',
      title: '¡Combo Especial Paga 1 y Lleva 2!',
      subtitle: 'La promoción favorita de nuestros clientes. Ahorra más del 50% en tu pedido hoy.',
      badge: '⚡ PACK MÁS VENDIDO',
      productImage,
      theme: 'emerald',
      highlightText: '🎁 REGALO ADICIONAL SORPRESA INCLUIDO',
      priceTag: `$${Math.round((promoPrice * 1.68) / 100) * 100} COP (2 Unidades)`,
      includedInLanding: true,
    },
    {
      id: `cr-guarantee-${Date.now() + 3}`,
      type: 'guarantee',
      title: 'Compra 100% Sin Riesgo con Pago Contraentrega',
      subtitle: 'No tienes que pagar nada por adelantado. Revisa tu paquete y paga al repartidor.',
      badge: '🛡️ GARANTÍA DE SATISFACCIÓN 30 DÍAS',
      productImage,
      theme: 'blue',
      highlightText: 'Despacho Exprés con Servientrega e Interrapidísimo',
      includedInLanding: true,
    },
  ];
}
