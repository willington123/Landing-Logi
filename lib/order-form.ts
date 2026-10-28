// Order form rules shared by the landing (browser) and /api/public/orders (server).

// ---------- phone ----------

interface PhoneRule {
  code: string; // country calling code
  length: number; // local digits
  starts?: RegExp; // valid first digits for a mobile
  example: string;
}

const PHONE_RULES: Record<string, PhoneRule> = {
  Colombia: { code: '57', length: 10, starts: /^3/, example: '300 123 4567' },
  México: { code: '52', length: 10, example: '55 1234 5678' },
  Perú: { code: '51', length: 9, starts: /^9/, example: '912 345 678' },
  Chile: { code: '56', length: 9, starts: /^9/, example: '9 1234 5678' },
  Ecuador: { code: '593', length: 9, starts: /^9/, example: '099 123 4567' },
  Guatemala: { code: '502', length: 8, example: '5123 4567' },
  España: { code: '34', length: 9, starts: /^[67]/, example: '612 345 678' },
};

export function phoneRule(country?: string): PhoneRule {
  return PHONE_RULES[country || 'Colombia'] || PHONE_RULES.Colombia;
}

// Local digits only: drops a leading country code ("+57", "0057") or Ecuador's trunk 0.
export function localPhoneDigits(raw: string, country?: string): string {
  const r = phoneRule(country);
  let d = (raw || '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.length === r.code.length + r.length && d.startsWith(r.code)) d = d.slice(r.code.length);
  if (r.code === '593' && d.length === 10 && d.startsWith('0')) d = d.slice(1);
  return d;
}

// Groups digits for display while typing ("3001234567" -> "300 123 4567").
// A typed or pasted "+57"/"0057" prefix is dropped.
export function formatPhoneInput(raw: string, country?: string): string {
  const r = phoneRule(country);
  let d = (raw || '').replace(/\D/g, '');
  const t = (raw || '').trim();
  if (t.startsWith('00')) d = d.slice(2);
  if ((t.startsWith('+') || t.startsWith('00') || d.length > r.length + 1) && d.startsWith(r.code)) d = d.slice(r.code.length);
  d = d.slice(0, r.length + (r.code === '593' ? 1 : 0));
  if (r.length === 10) return [d.slice(0, 3), d.slice(3, 6), d.slice(6)].filter(Boolean).join(' ');
  if (r.length === 9) return [d.slice(0, 3), d.slice(3, 6), d.slice(6)].filter(Boolean).join(' ');
  return [d.slice(0, 4), d.slice(4)].filter(Boolean).join(' ');
}

export function validatePhone(raw: string, country?: string): string | null {
  const r = phoneRule(country);
  const d = localPhoneDigits(raw, country);
  if (!d) return 'Escribe tu número de celular.';
  if (d.length !== r.length) return `El celular debe tener ${r.length} números (ej. ${r.example}). Llevas ${d.length}.`;
  if (r.starts && !r.starts.test(d)) return `Escribe un número de celular válido (ej. ${r.example}).`;
  return null;
}

// ---------- name ----------

export function validateName(raw: string): string | null {
  const words = (raw || '').trim().split(/\s+/).filter((w) => /[a-zA-ZÀ-ÖØ-öø-ÿ]{2,}/.test(w));
  if (!raw.trim()) return 'Escribe tu nombre y apellido.';
  if (words.length < 2) return 'Escribe tu nombre y tu apellido.';
  return null;
}

// ---------- address (Colombia) ----------

export const STREET_TYPES = ['Calle', 'Carrera', 'Avenida', 'Avenida Calle', 'Avenida Carrera', 'Transversal', 'Diagonal', 'Circular', 'Autopista'] as const;
export const RURAL = 'Rural';

export interface AddressParts {
  type: string; // one of STREET_TYPES or RURAL
  via: string; // number of the street, e.g. "45A"
  cross: string; // "# 10"
  plate: string; // "- 20"
  rural: string; // free text when type is RURAL
  complement: string; // apto, torre, casa (optional)
  neighborhood: string; // barrio
}

export const EMPTY_ADDRESS: AddressParts = { type: '', via: '', cross: '', plate: '', rural: '', complement: '', neighborhood: '' };

// Numbers in a Colombian address: digits, letters (45A), "bis", "sur"/"este".
export const cleanAddressPiece = (v: string) => v.replace(/[^0-9a-zA-ZñÑ ]/g, '').replace(/\s+/g, ' ').toUpperCase().slice(0, 12);

// "Calle 45A # 10-20" (or the rural text).
export function streetLine(p: AddressParts): string {
  if (p.type === RURAL) return p.rural.trim();
  if (!p.type || !p.via.trim()) return '';
  let s = `${p.type} ${p.via.trim()}`;
  if (p.cross.trim()) s += ` # ${p.cross.trim()}`;
  if (p.plate.trim()) s += `-${p.plate.trim()}`;
  return s;
}

// Full address saved on the order: "Calle 45A # 10-20, Apto 301, Barrio Laureles".
export function buildAddress(p: AddressParts): string {
  const parts = [streetLine(p)];
  if (p.complement.trim()) parts.push(p.complement.trim());
  if (p.neighborhood.trim()) parts.push(/^barrio\b/i.test(p.neighborhood.trim()) ? p.neighborhood.trim() : `Barrio ${p.neighborhood.trim()}`);
  return parts.filter(Boolean).join(', ');
}

export type AddressErrors = Partial<Record<'type' | 'via' | 'cross' | 'plate' | 'rural' | 'neighborhood', string>>;

export function validateAddress(p: AddressParts): AddressErrors {
  const e: AddressErrors = {};
  if (!p.type) e.type = 'Elige si es calle, carrera, avenida…';
  else if (p.type === RURAL) {
    if (p.rural.trim().length < 8) e.rural = 'Escribe la dirección completa (vereda, finca, kilómetro, punto de referencia).';
  } else {
    if (!/\d/.test(p.via)) e.via = 'Falta el número de la vía (ej. 45).';
    if (!/\d/.test(p.cross)) e.cross = 'Falta el número después del # (ej. 10).';
    if (!/\d/.test(p.plate)) e.plate = 'Falta el número de la casa después del guion (ej. 20).';
  }
  if (p.neighborhood.trim().length < 3) e.neighborhood = 'Escribe tu barrio.';
  return e;
}

// ---------- server-side check (lenient: accepts the classic form too) ----------

export function serverOrderErrors(f: { name: string; phone: string; city: string; address: string }, country?: string): string | null {
  return (
    validateName(f.name) ||
    validatePhone(f.phone, country) ||
    (f.city.trim().length < 2 ? 'Escribe tu ciudad o municipio.' : null) ||
    (f.address.trim().length < 6 ? 'Escribe la dirección completa de entrega.' : null)
  );
}
