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

// Delivery problem notice (utility), with the carrier's data as the store sees it in the carrier's portal:
// {{1}} first name, {{2}} what happened, {{3}} name on the shipment, {{4}} where (office / address), {{5}} phone,
// {{6}} tracking number, {{7}} the carrier's novelty, {{8}} carrier.
// Sent from the order detail ("Avisar novedad"); inside the 24 h window the same text goes as a normal message.
export const NOVELTY_PRESET = {
  name: 'aviso_novedad',
  language: 'es',
  category: 'UTILITY' as const,
  body: 'Hola {{1}} 👋 Tu pedido está en novedad: {{2}}.\n\n👤 Nombre: {{3}}\n📍 Dirección: {{4}}\n📞 Tel: {{5}}\n📦 Guía: {{6}}\n⚠️ Novedad: {{7}} ({{8}})\n\nPor favor respóndenos por aquí para ayudarte a recibirlo y que no se devuelva.',
  examples: ['Cristina', 'es para recoger en la oficina', 'Cristina Tejada', 'Reclama en la oficina principal de Envía en Pitalito, PITALITO-HUILA', '3223641371', '014165704173', 'COORDINAR LA ENTREGA', 'Envía'],
  buttons: [] as string[],
};

export interface NoveltyFields {
  summary: string; // "es para recoger en la oficina"
  name: string;
  where: string;
  phone: string;
  guide: string;
  novelty: string; // the carrier's novelty, e.g. "COORDINAR LA ENTREGA"
  carrier: string;
}

// Quick choices for "what happened" ({{2}}).
export const NOVELTY_REASONS = [
  { id: 'oficina', label: 'Recoger en oficina', summary: 'es para recoger en la oficina' },
  { id: 'coordinar', label: 'Coordinar la entrega', summary: 'hay que coordinar la entrega' },
  { id: 'direccion', label: 'Dirección incompleta', summary: 'la dirección está incompleta o no la encuentran' },
  { id: 'ausente', label: 'No había nadie', summary: 'fueron a entregarlo y no encontraron a nadie' },
] as const;

// Template values can't have line breaks, tabs or long runs of spaces; empty ones aren't allowed either.
export const oneLine = (v: string) =>
  String(v || '')
    .replace(/[\r\n\t]+/g, ', ')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+,/g, ',')
    .replace(/,{2,}/g, ',')
    .replace(/^[\s,.;:]+|[\s,.;:]+$/g, '')
    .trim();

export function noveltyVars(firstName: string, f: NoveltyFields): string[] {
  return [firstName, f.summary, f.name, f.where, f.phone, f.guide, f.novelty, f.carrier].map((v) => oneLine(v).slice(0, 200) || '—');
}

// The template text filled in (what the customer reads).
export const noveltyTemplateText = (firstName: string, f: NoveltyFields) => {
  const v = noveltyVars(firstName, f);
  return NOVELTY_PRESET.body.replace(/\{\{(\d)\}\}/g, (_, i) => v[Number(i) - 1]);
};

// The same message as free text (24 h window open): lines without data are left out.
export function noveltyMessage(firstName: string, f: NoveltyFields): string {
  const c = (v: string) => oneLine(v);
  const lines = [
    c(f.name) && `👤 Nombre: ${c(f.name)}`,
    c(f.where) && `📍 Dirección: ${c(f.where)}`,
    c(f.phone) && `📞 Tel: ${c(f.phone)}`,
    c(f.guide) && `📦 Guía: ${c(f.guide)}`,
    (c(f.novelty) || c(f.carrier)) && `⚠️ Novedad: ${[c(f.novelty), c(f.carrier) && (c(f.novelty) ? `(${c(f.carrier)})` : c(f.carrier))].filter(Boolean).join(' ')}`,
  ].filter(Boolean);
  return `Hola ${firstName} 👋 Tu pedido está en novedad${c(f.summary) ? `: ${c(f.summary)}` : ''}.\n\n${lines.join('\n')}${lines.length ? '\n\n' : ''}Por favor respóndenos por aquí para ayudarte a recibirlo y que no se devuelva.`;
}

const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

// What the carrier's portal shows, pasted as is:
//   Cristina Tejada / Reclama en la oficina principal de envía en Pitali... , PITALITO-HUILA / Tel: 3223641371 /
//   014165704173 / COORDINAR LA ENTREGA <tab> ENVIA
// → each field. Lines it can't place are added to the address.
export function readCarrierText(raw: string, carriers: readonly string[]): Partial<NoveltyFields> {
  const out: Partial<NoveltyFields> = {};
  const rest: string[] = [];
  const lines = raw
    .split(/[\r\n]+/)
    .map((l) => l.trim())
    .filter(Boolean);
  for (const line of lines) {
    // "COORDINAR LA ENTREGA <tab> ENVIA": novelty and carrier on one line.
    const cells = line.split(/\t+|\s{3,}/).map((x) => x.trim()).filter(Boolean);
    const carrierCell = cells.find((x) => carriers.some((c) => fold(c) === fold(x)) || /^(envia|servientrega|interrapidisimo|inter rapidisimo|coordinadora|tcc|deprisa|99 ?minutos)$/.test(fold(x)));
    if (carrierCell) {
      out.carrier = carriers.find((c) => fold(c) === fold(carrierCell)) || carrierCell;
      const nov = cells.filter((x) => x !== carrierCell).join(' ');
      if (nov) out.novelty = nov;
      continue;
    }
    if (/^(tel[eé]fono|tel|celular|cel|m[oó]vil)\b/i.test(line)) {
      out.phone = line.replace(/^(tel[eé]fono|tel|celular|cel|m[oó]vil)\.?\s*:?\s*/i, '').trim();
      continue;
    }
    if (/^[\d\s-]{8,}$/.test(line)) {
      out.guide = line.replace(/\s+/g, '');
      continue;
    }
    if (/reclam|oficina|recoger|direcci|calle|carrera|cra\b|cl\b|barrio|#/i.test(line)) {
      rest.push(line);
      continue;
    }
    if (!out.name && /^[a-záéíóúñü .'-]{3,60}$/i.test(line) && line.split(/\s+/).length <= 5) {
      out.name = line;
      continue;
    }
    if (!out.novelty && /^[A-ZÁÉÍÓÚÑ ]{6,}$/.test(line)) {
      out.novelty = line;
      continue;
    }
    rest.push(line);
  }
  if (rest.length) out.where = rest.join(', ');
  if (/reclam|oficina|recoger/i.test(out.where || '')) out.summary = NOVELTY_REASONS[0].summary;
  else if (/coordinar/i.test(out.novelty || '')) out.summary = NOVELTY_REASONS[1].summary;
  else if (/direcci|nomenclatura/i.test(out.novelty || '')) out.summary = NOVELTY_REASONS[2].summary;
  else if (/ausente|cerrado|nadie/i.test(out.novelty || '')) out.summary = NOVELTY_REASONS[3].summary;
  return out;
}

// Shopify abandoned cart (marketing: Meta counts cart reminders as marketing): {{1}} name, {{2}} products,
// {{3}} total, {{4}} city. Buttons carry the checkout: "Confirmar pedido" creates the order in Konnexa.
export const CART_PRESET = {
  name: 'recuperar_carrito',
  language: 'es',
  category: 'MARKETING' as const,
  body: 'Hola {{1}} 👋 Vimos que dejaste tu pedido de {{2}} por {{3}} sin terminar. Te lo podemos enviar a {{4}} y pagas al recibir 🚚 ¿Confirmas tu pedido?',
  examples: ['Laura', 'Bálsamo Rosa', '$79.900', 'Medellín'],
  buttons: ['Confirmar pedido', 'No, gracias'],
};
