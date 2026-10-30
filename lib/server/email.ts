// Transactional emails (password reset, welcome, billing notices) through Resend. Server-only.
// Without RESEND_API_KEY nothing is sent and callers fall back (e.g. the admin shares a reset link by WhatsApp).

const env = (k: string) => (process.env[k] || '').trim();

export function emailConfigured() {
  return Boolean(env('RESEND_API_KEY'));
}

export const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export async function sendEmail(p: { to: string | string[]; subject: string; html: string; text: string }): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  if (!emailConfigured()) return { ok: false, skipped: true };
  const to = (Array.isArray(p.to) ? p.to : [p.to]).filter(Boolean);
  if (!to.length) return { ok: false, skipped: true };
  try {
    const res = await fetch(env('EMAIL_API_URL') || 'https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env('RESEND_API_KEY')}` },
      body: JSON.stringify({
        from: env('EMAIL_FROM') || 'LogiPages <onboarding@resend.dev>',
        to,
        subject: p.subject,
        html: p.html,
        text: p.text,
        ...(env('PLATFORM_SUPPORT_EMAIL') ? { reply_to: env('PLATFORM_SUPPORT_EMAIL') } : {}),
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      const error = `${res.status} ${d?.message || d?.name || ''}`.trim();
      console.error('Email not sent', error);
      return { ok: false, error };
    }
    return { ok: true };
  } catch (e: any) {
    console.error('Email not sent', e);
    return { ok: false, error: String(e?.message || e) };
  }
}

// Simple branded layout; every dynamic value must already be escaped with esc().
export function emailLayout(p: { title: string; paragraphs: string[]; cta?: { label: string; url: string }; footer?: string }) {
  const btn = p.cta
    ? `<p style="margin:28px 0"><a href="${esc(p.cta.url)}" style="display:inline-block;background:#FF3A20;background-image:linear-gradient(135deg,#FF252B,#FF5A16);color:#fff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:10px">${esc(p.cta.label)}</a></p>`
    : '';
  const html = `<!doctype html><html><body style="margin:0;background:#f5f7fa;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a">
<div style="max-width:520px;margin:0 auto;padding:32px 20px">
<p style="font-size:20px;font-weight:800;margin:0 0 20px"><span style="color:#FF252B">Logi</span><span style="color:#172C8A">Pages</span></p>
<div style="background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:28px">
<h1 style="font-size:20px;margin:0 0 14px">${p.title}</h1>
${p.paragraphs.map((x) => `<p style="font-size:15px;line-height:1.6;color:#334155;margin:0 0 12px">${x}</p>`).join('\n')}
${btn}
${p.cta ? `<p style="font-size:12px;color:#94a3b8;margin:0">Si el botón no funciona, copia este enlace:<br><span style="word-break:break-all">${esc(p.cta.url)}</span></p>` : ''}
</div>
<p style="font-size:12px;color:#94a3b8;margin:16px 4px 0">${p.footer || 'Recibes este correo por tu cuenta en LogiPages.'}</p>
</div></body></html>`;
  const strip = (s: string) => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  const text = [strip(p.title), '', ...p.paragraphs.map(strip), ...(p.cta ? ['', `${p.cta.label}: ${p.cta.url}`] : [])].join('\n');
  return { html, text };
}
