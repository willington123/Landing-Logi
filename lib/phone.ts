// Phone helpers shared by the server (Meta, WhatsApp API) and the browser (wa.me links).

export const CALLING_CODES: Record<string, { code: string; iso: string; localLength: number }> = {
  Colombia: { code: '57', iso: 'co', localLength: 10 },
  México: { code: '52', iso: 'mx', localLength: 10 },
  Perú: { code: '51', iso: 'pe', localLength: 9 },
  Chile: { code: '56', iso: 'cl', localLength: 9 },
  Ecuador: { code: '593', iso: 'ec', localLength: 9 },
  Guatemala: { code: '502', iso: 'gt', localLength: 8 },
  España: { code: '34', iso: 'es', localLength: 9 },
};

// Country code + digits, no "+" (e.g. 573001234567). Meta and wa.me both use this format.
export function normalizePhone(phone: string, country?: string): string {
  let digits = (phone || '').replace(/\D/g, '');
  const cc = CALLING_CODES[country || 'Colombia'] || CALLING_CODES.Colombia;
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length === cc.localLength) digits = cc.code + digits;
  if (cc.code === '593' && digits.length === 10 && digits.startsWith('0')) digits = cc.code + digits.slice(1);
  return digits;
}
