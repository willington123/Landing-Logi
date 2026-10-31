// WhatsApp message templates shared by the panel and the server.

// The order confirmation template Konnexa uses: {{1}} name, {{2}} product, {{3}} total, {{4}} city,
// with the two buttons the webhook understands.
export const CONFIRM_PRESET = {
  name: 'confirmacion_pedido',
  language: 'es',
  category: 'UTILITY' as const,
  body: 'Hola {{1}} 👋 Recibimos tu pedido de {{2}} por {{3}}, con entrega en {{4}}. Pagas al recibir. ¿Confirmas tu pedido?',
  examples: ['Laura', 'Faja moldeadora - 2 unidades', '$129.900', 'Medellín'],
  buttons: ['Confirmar pedido', 'Cancelar'],
};
