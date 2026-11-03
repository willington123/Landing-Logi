// WhatsApp Business profile (what customers see when they open the store's number). Shared by panel and server.

export interface WaProfile {
  about: string; // short line under the name (max 139)
  description: string; // what the business does (max 512)
  address: string; // max 256
  email: string; // max 128
  websites: string[]; // max 2, each max 256
  vertical: string; // category
  profilePictureUrl: string | null; // read only
}

export const WA_VERTICALS: { id: string; label: string }[] = [
  { id: 'UNDEFINED', label: 'Sin categoría' },
  { id: 'APPAREL', label: 'Ropa y accesorios' },
  { id: 'BEAUTY', label: 'Belleza, spa y salón' },
  { id: 'HEALTH', label: 'Salud y medicina' },
  { id: 'RETAIL', label: 'Tienda y compras' },
  { id: 'GROCERY', label: 'Supermercado y alimentos' },
  { id: 'RESTAURANT', label: 'Restaurante' },
  { id: 'AUTO', label: 'Vehículos' },
  { id: 'EDU', label: 'Educación' },
  { id: 'ENTERTAIN', label: 'Entretenimiento' },
  { id: 'EVENT_PLAN', label: 'Eventos' },
  { id: 'FINANCE', label: 'Finanzas y bancos' },
  { id: 'HOTEL', label: 'Hotel y hospedaje' },
  { id: 'PROF_SERVICES', label: 'Servicios profesionales' },
  { id: 'TRAVEL', label: 'Viajes y transporte' },
  { id: 'NONPROFIT', label: 'Sin ánimo de lucro' },
  { id: 'OTHER', label: 'Otro' },
];

export const PROFILE_LIMITS = { about: 139, description: 512, address: 256, email: 128, website: 256 };

const str = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);

export function cleanProfile(input: any): Omit<WaProfile, 'profilePictureUrl'> | string {
  const about = str(input?.about, PROFILE_LIMITS.about);
  if (!about) return 'Escribe la info corta (la frase bajo el nombre).';
  const email = str(input?.email, PROFILE_LIMITS.email);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'El correo no es válido.';
  const websites = (Array.isArray(input?.websites) ? input.websites : [])
    .map((w: unknown) => str(w, PROFILE_LIMITS.website))
    .filter(Boolean)
    .slice(0, 2);
  for (const w of websites) if (!/^https?:\/\/[^\s.]+\.[^\s]+$/i.test(w)) return `El sitio web "${w}" debe empezar por https://`;
  const vertical = WA_VERTICALS.some((v) => v.id === input?.vertical) ? String(input.vertical) : 'UNDEFINED';
  return { about, description: str(input?.description, PROFILE_LIMITS.description), address: str(input?.address, PROFILE_LIMITS.address), email, websites, vertical };
}
