// Which Meta ad a chat or an order came from. Shared by the server and the panel.

export interface AdRef {
  id: string; // Meta ad id (source_id in WhatsApp's referral)
  headline?: string;
  body?: string;
  url?: string; // the ad or post link
  media?: 'image' | 'video';
  thumb?: string; // image or video thumbnail (Meta's URL, may expire)
  clid?: string; // ctwa_clid: click id for the Conversions API
  at: string; // when the customer came from the ad
}

export const AD_ID_RE = /^\d{6,25}$/;

// WhatsApp "referral" (click-to-WhatsApp ads) → AdRef. Ignores organic posts without an id.
export function adFromReferral(r: any, at: string): AdRef | null {
  if (!r || typeof r !== 'object') return null;
  const id = String(r.source_id || '').trim();
  if (!AD_ID_RE.test(id)) return null;
  const s = (v: unknown, n: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, n) : undefined);
  const media = r.media_type === 'video' ? 'video' : r.media_type === 'image' ? 'image' : undefined;
  return {
    id,
    headline: s(r.headline, 160),
    body: s(r.body, 400),
    url: s(r.source_url, 500),
    media,
    thumb: s(r.thumbnail_url || r.image_url, 1000),
    clid: s(r.ctwa_clid, 300),
    at,
  };
}

export const adLabel = (a: { id: string; headline?: string } | null | undefined) => (a ? a.headline || `Anuncio ${a.id}` : '');
