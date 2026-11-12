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
