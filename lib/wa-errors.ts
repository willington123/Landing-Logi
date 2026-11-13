// WhatsApp (Meta) send errors in plain Spanish, so the team knows what to do. Used where the error is saved
// (send result and delivery status) and where it's shown (old messages saved with Meta's English text).

const BY_CODE: Record<number, string> = {
  131026: 'WhatsApp no pudo entregarlo: ese número no tiene WhatsApp, está mal escrito, tiene la app desactualizada o es el mismo número del negocio. Revisa el teléfono del cliente.',
  131021: 'No se puede enviar al mismo número del negocio.',
  133010: 'Ese número no está registrado en WhatsApp. Revisa el teléfono del cliente.',
  131047: 'Pasaron más de 24 horas desde el último mensaje del cliente: solo se puede escribir con una plantilla.',
  131049: 'Meta no lo entregó para no saturar al cliente con mensajes de marketing. Intenta más tarde o usa una plantilla de categoría "Utilidad".',
  131050: 'El cliente pidió no recibir mensajes de marketing de empresas.',
  131051: 'Ese tipo de mensaje no se puede enviar por WhatsApp.',
  131052: 'WhatsApp no pudo descargar el archivo. Vuelve a subirlo.',
  131053: 'WhatsApp no pudo procesar el archivo (formato o tamaño no válido).',
  131056: 'Se enviaron demasiados mensajes seguidos a este cliente. Espera un momento y vuelve a intentar.',
  130429: 'Se alcanzó el límite de mensajes por segundo de WhatsApp. Vuelve a intentar en un momento.',
  131042: 'Hay un problema con el pago de la cuenta de WhatsApp Business en Meta. Revisa el método de pago en Meta Business.',
  131031: 'Meta bloqueó la cuenta de WhatsApp Business. Revisa Meta Business Suite.',
  131005: 'El acceso a WhatsApp no tiene permiso. Vuelve a conectar WhatsApp en Integraciones.',
  131008: 'Falta un dato que la plantilla necesita.',
  131009: 'Un dato del mensaje no es válido.',
  131016: 'WhatsApp no está disponible en este momento. Vuelve a intentar en unos minutos.',
  131000: 'WhatsApp tuvo un error al enviarlo. Vuelve a intentar.',
  132000: 'La plantilla no recibió la cantidad de datos que necesita. Revisa la plantilla en Integraciones.',
  132001: 'La plantilla no existe o no está aprobada en ese idioma. Revisa la plantilla en Integraciones.',
  132005: 'El texto de la plantilla quedó demasiado largo con los datos del pedido.',
  132007: 'La plantilla no cumple las políticas de Meta.',
  132012: 'Un dato de la plantilla tiene un formato que no es válido.',
  132015: 'Meta pausó la plantilla por baja calidad. Revisa la plantilla en Meta.',
  132016: 'Meta desactivó la plantilla. Crea o elige otra en Integraciones.',
  130472: 'Meta no lo entregó porque el cliente está en un experimento de marketing de Meta.',
  368: 'Meta bloqueó temporalmente el envío por políticas. Revisa la calidad del número en Meta.',
  10: 'Meta no le da permiso a la app para enviar desde este número. Suele pasar cuando el número se conectó con «Conectar con Facebook» y la app de Meta todavía no tiene el acceso avanzado a whatsapp_business_messaging, o cuando la conexión perdió el permiso. En Plantillas → «Límites de tu número» verás qué dice Meta y qué falta.',
  200: 'La conexión de WhatsApp no tiene el permiso para enviar mensajes. Vuelve a conectar WhatsApp en Integraciones con todos los permisos.',
  190: 'La conexión de WhatsApp venció o se desconectó. Vuelve a conectar WhatsApp en Integraciones.',
};

// Meta's English titles, for errors saved before the code was kept.
const BY_TITLE: [RegExp, number][] = [
  [/undeliverable/i, 131026],
  [/re-?engagement/i, 131047],
  [/healthy ecosystem|ecosystem engagement/i, 131049],
  [/stopped marketing|opted out/i, 131050],
  [/not (a )?(valid )?whatsapp (user|number)|not registered/i, 133010],
  [/rate limit|too many/i, 130429],
  [/payment/i, 131042],
  [/template.*(does not exist|not found)|template name does not exist/i, 132001],
  [/template.*paused/i, 132015],
  [/template.*disabled/i, 132016],
  [/number of (localizable_)?params|parameter.*mismatch/i, 132000],
  [/sender and recipient.*same|same as sender/i, 131021],
  [/does not have permission for this action/i, 10],
  [/session has expired|access token.*(expired|invalid)|invalid oauth access token/i, 190],
];

export function explainWaError(raw?: string | null, code?: number | null): string {
  const text = String(raw || '').trim();
  if (code && BY_CODE[code]) return BY_CODE[code];
  const m = /\b(1[3]\d{4}|368)\b/.exec(text);
  if (m && BY_CODE[Number(m[1])]) return BY_CODE[Number(m[1])];
  for (const [re, c] of BY_TITLE) if (re.test(text)) return BY_CODE[c];
  return text || 'Error desconocido de WhatsApp.';
}
