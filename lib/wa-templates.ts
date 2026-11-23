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

// Appointment reminder: {{1}} name, {{2}} service, {{3}} when, {{4}} with whom / where.
// Its buttons carry the appointment id (see sendAppointmentTemplate).
export const APPOINTMENT_PRESET = {
  name: 'recordatorio_cita',
  language: 'es',
  category: 'UTILITY' as const,
  body: 'Hola {{1}} 👋 Te recordamos tu cita de {{2}} el {{3}} {{4}}. ¿Confirmas que asistes?',
  examples: ['Laura', 'Corte + barba', 'martes 4 de noviembre, 3:00 p. m.', 'con Juan en Calle 10 # 20-30'],
  buttons: ['Confirmar cita', 'Cancelar cita'],
};

// "Vuelve pronto" (marketing): {{1}} name, {{2}} time since the last visit, {{3}} service, {{4}} business.
// The buttons have no payload: the customer's tap reaches the assistant, which offers free times.
export const COME_BACK_PRESET = {
  name: 'volver_cita',
  language: 'es',
  category: 'MARKETING' as const,
  body: 'Hola {{1}} 👋 Ya pasaron {{2}} desde tu última cita de {{3}} en {{4}}. ¿Te agendamos la próxima?',
  examples: ['Laura', '4 semanas', 'Corte + barba', 'Barbería El Parche'],
  buttons: ['Agendar cita', 'Ahora no'],
};

// Tracking number notice (utility): {{1}} name, {{2}} product, {{3}} carrier, {{4}} tracking number.
// Sent instead of the free-text "guía" message when the customer hasn't written in 24 hours.
export const GUIDE_PRESET = {
  name: 'aviso_guia',
  language: 'es',
  category: 'UTILITY' as const,
  body: 'Hola {{1}} 🚚 Tu pedido de {{2}} ya va en camino con {{3}}. Tu número de guía es {{4}}. Recuerda tener el pago listo cuando te llegue.',
  examples: ['Laura', 'Faja moldeadora - 2 unidades', 'Servientrega', '700123456789'],
  buttons: [] as string[],
};

// The same notice with the photo of the shipping label on top (template header image).
export const GUIDE_PHOTO_PRESET = { ...GUIDE_PRESET, name: 'aviso_guia_foto' };

// "Your order is in process" (utility): {{1}} name, {{2}} product, {{3}} city, {{4}} total.
// Sent by the "Pedido en proceso" automation after the order is confirmed.
export const PROCESS_PRESET = {
  name: 'pedido_en_proceso',
  language: 'es',
  category: 'UTILITY' as const,
  body: 'Hola {{1}} 👋 Tu pedido de {{2}} ya se encuentra en proceso ✅ Lo estamos preparando para enviarlo a {{3}}. Apenas salga te compartimos el número de guía. Recuerda tener {{4}} listos para pagar al recibir.',
  examples: ['Laura', 'Faja moldeadora · 2 unidades', 'Medellín', '$129.900'],
  buttons: [] as string[],
};

// Delivery problem notice (utility): {{1}} name, {{2}} product, {{3}} carrier, {{4}} tracking number,
// {{5}} what happened ("está disponible para reclamar en la oficina principal de Envía en Pitalito, Huila").
// Sent from the order detail ("Avisar novedad") when the customer hasn't written in 24 hours.
export const NOVELTY_PRESET = {
  name: 'novedad_envio',
  language: 'es',
  category: 'UTILITY' as const,
  body: 'Hola {{1}} 👋 Tu pedido de {{2}} tiene una novedad con la transportadora {{3}} (guía {{4}}): {{5}}. Por favor respóndenos por aquí para ayudarte a recibirlo y que no se devuelva.',
  examples: ['Cristina', 'Bálsamo Rosa', 'Envía', '014165704173', 'está disponible para reclamar en la oficina principal de Envía en Pitalito, Huila'],
  buttons: [] as string[],
};

// The usual delivery problems. `text` + the store's detail becomes {{5}}.
export const NOVELTY_REASONS = [
  { id: 'oficina', label: 'Reclamar en oficina', text: 'está disponible para reclamar en', detail: 'Oficina principal de Envía en Pitalito, Huila' },
  { id: 'coordinar', label: 'Coordinar la entrega', text: 'la transportadora necesita coordinar la entrega contigo', detail: 'Ej.: llamar al 3223641371' },
  { id: 'direccion', label: 'Dirección incompleta', text: 'la dirección está incompleta o no la encuentran', detail: 'Ej.: falta el barrio o el número de la casa' },
  { id: 'ausente', label: 'No había nadie', text: 'fueron a entregarlo y no encontraron a nadie', detail: 'Ej.: vuelven a pasar mañana' },
  { id: 'otro', label: 'Otra novedad', text: '', detail: 'Escribe la novedad' },
] as const;
export type NoveltyReason = (typeof NOVELTY_REASONS)[number]['id'];

// {{5}} for a reason + detail. Template values can't have line breaks, tabs or long runs of spaces.
export function noveltyText(reason: string, detail: string): string {
  const r = NOVELTY_REASONS.find((x) => x.id === reason) || NOVELTY_REASONS[NOVELTY_REASONS.length - 1];
  const d = String(detail || '')
    .replace(/[\r\n\t]+/g, ', ')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+,/g, ',')
    .replace(/[\s,.;:]+$/, '')
    .trim();
  if (!r.text) return d;
  if (!d) return r.text;
  return r.id === 'oficina' ? `${r.text} ${d.replace(/^(en|la)\s+/i, (m) => (/^en/i.test(m) ? '' : m))}` : `${r.text} (${d})`;
}
