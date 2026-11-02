// Comments on Facebook and Instagram posts and ads: answer in public and write to the person in private
// (with a button to continue on WhatsApp). Shared by the panel and the server.

export type SocialChannel = 'facebook' | 'instagram';

export interface SocialRule {
  id: string;
  name: string;
  enabled: boolean;
  channels: SocialChannel[];
  keywords: string[]; // any of them; empty = every comment
  postIds: string[]; // only these posts/ads (empty = all)
  publicReplies: string[]; // one is picked at random; empty = no public reply
  dm: string; // private message ('' = none). May use {nombre}
  whatsapp: boolean; // add the WhatsApp link to the private message
  waText: string; // text already written when they open WhatsApp
}

export interface SocialSettings {
  waNumber: string; // WhatsApp number for the link ('' = the store's connected number)
  rules: SocialRule[];
  ai: {
    answer: boolean; // comments no rule caught: answer questions in public with the store's info
    hide: boolean; // hide insults, spam and scams
    dm: boolean; // someone shows interest (info, price, how to buy): also write in private with the WhatsApp link
    dmText: string;
    waText: string;
  };
}

export const DEFAULT_AI_DM = 'Hola {nombre} 👋 Gracias por escribirnos. Te atendemos por WhatsApp: ahí te damos precios, envío y tomamos tu pedido.';
export const DEFAULT_AI_WA = 'Hola, vi su publicación y quiero información';
export const DEFAULT_SOCIAL: SocialSettings = { waNumber: '', rules: [], ai: { answer: false, hide: false, dm: true, dmText: DEFAULT_AI_DM, waText: DEFAULT_AI_WA } };

export const SOCIAL_RECIPES: { title: string; hint: string; rule: Omit<SocialRule, 'id'> }[] = [
  {
    title: 'Comentan "INFO" → les escribo al privado',
    hint: 'El clásico de los anuncios: responde en público y manda el enlace a WhatsApp por privado.',
    rule: {
      name: 'Palabra INFO',
      enabled: true,
      channels: ['facebook', 'instagram'],
      keywords: ['info', 'información', 'informacion'],
      postIds: [],
      publicReplies: ['¡Hola {nombre}! Te escribimos al privado 📩', '¡Listo {nombre}! Revisa tus mensajes 💬', 'Te enviamos la info por interno, {nombre} 🙌'],
      dm: 'Hola {nombre} 👋 Gracias por tu interés. Te dejamos todo por WhatsApp: precios, envío gratis y pago contraentrega.',
      whatsapp: true,
      waText: 'Hola, vi su anuncio y quiero información',
    },
  },
  {
    title: 'Preguntan el precio → privado',
    hint: 'Para quienes escriben "precio", "cuánto vale" o "valor" sin palabra clave.',
    rule: {
      name: 'Precio',
      enabled: true,
      channels: ['facebook', 'instagram'],
      keywords: ['precio', 'cuanto vale', 'cuánto vale', 'valor', 'cuanto cuesta', 'cuánto cuesta', 'costo'],
      postIds: [],
      publicReplies: ['¡Hola {nombre}! Te enviamos el precio al privado 📩', 'Revisa tu bandeja, {nombre}: ahí va el precio 💬'],
      dm: 'Hola {nombre} 👋 Te cuento el precio y las promociones por WhatsApp, y ahí mismo puedes hacer tu pedido con pago al recibir.',
      whatsapp: true,
      waText: 'Hola, quiero saber el precio',
    },
  },
  {
    title: 'Comentan "LO QUIERO" → directo a comprar',
    hint: 'Para campañas donde pides comentar una palabra para comprar.',
    rule: {
      name: 'Lo quiero',
      enabled: true,
      channels: ['facebook', 'instagram'],
      keywords: ['lo quiero', 'quiero', 'me interesa', 'pedido'],
      postIds: [],
      publicReplies: ['¡Genial {nombre}! Te escribimos para tomar tu pedido 📦'],
      dm: '¡Hola {nombre}! 🙌 Toma tu pedido en 1 minuto por WhatsApp. Pagas al recibir.',
      whatsapp: true,
      waText: 'Hola, quiero hacer un pedido',
    },
  },
];

const str = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);
const list = (v: unknown, max: number, each: number) =>
  (Array.isArray(v) ? v : String(v ?? '').split(/[,\n]/))
    .map((x) => str(x, each))
    .filter(Boolean)
    .slice(0, max);

// A post or ad: its id, or a link that contains it.
export function postIdFrom(v: string): string {
  const s = v.trim();
  const fbid = /(?:fbid=|story_fbid=|posts\/|videos\/|reel\/)(\d{6,})/.exec(s);
  if (fbid) return fbid[1];
  return /^[\d_]{6,40}$/.test(s) ? s : '';
}

export function cleanSocial(input: any): SocialSettings | string {
  const rules: SocialRule[] = [];
  for (const r of Array.isArray(input?.rules) ? input.rules.slice(0, 20) : []) {
    const name = str(r?.name, 60);
    if (!name) return 'Ponle un nombre a cada regla.';
    const channels = (Array.isArray(r?.channels) ? r.channels : []).filter((c: unknown): c is SocialChannel => c === 'facebook' || c === 'instagram');
    if (!channels.length) return `${name}: elige Facebook, Instagram o ambos.`;
    const publicReplies = list(r?.publicReplies, 5, 300);
    const dm = str(r?.dm, 900);
    const whatsapp = Boolean(r?.whatsapp);
    if (!publicReplies.length && !dm && !whatsapp) return `${name}: escribe la respuesta pública o el mensaje privado.`;
    rules.push({
      id: /^[\w-]{1,40}$/.test(String(r?.id ?? '')) ? String(r.id) : `r_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
      name,
      enabled: r?.enabled !== false,
      channels,
      keywords: list(r?.keywords, 20, 40).map((k) => k.toLowerCase()),
      postIds: list(r?.postIds, 30, 300).map(postIdFrom).filter(Boolean),
      publicReplies,
      dm,
      whatsapp,
      waText: str(r?.waText, 200) || 'Hola, vi su publicación y quiero información',
    });
  }
  return {
    waNumber: String(input?.waNumber ?? '').replace(/\D/g, '').slice(0, 15),
    rules,
    ai: {
      answer: Boolean(input?.ai?.answer),
      hide: Boolean(input?.ai?.hide),
      dm: input?.ai?.dm !== false,
      dmText: str(input?.ai?.dmText, 900) || DEFAULT_AI_DM,
      waText: str(input?.ai?.waText, 200) || DEFAULT_AI_WA,
    },
  };
}

const norm = (s: string) =>
  ` ${s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9ñ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()} `;

// First rule that catches this comment.
export function matchRule(rules: SocialRule[], c: { channel: SocialChannel; text: string; postId: string }): SocialRule | null {
  const text = norm(c.text);
  for (const r of rules) {
    if (!r.enabled || !r.channels.includes(c.channel)) continue;
    if (r.postIds.length && !r.postIds.some((p) => c.postId === p || c.postId.endsWith(`_${p}`) || c.postId.startsWith(`${p}_`))) continue;
    if (!r.keywords.length || r.keywords.some((k) => text.includes(norm(k)))) return r;
  }
  return null;
}

export const fillName = (t: string, name: string) => t.replace(/\{nombre\}/g, (name || '').trim().split(/\s+/)[0] || '').replace(/\s+([!,.?])/g, '$1').replace(/¡\s*([,!])/g, '¡').trim();

export function waLink(phone: string, text: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}` : '';
}
