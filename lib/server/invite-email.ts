// The team invitation by email (the same link the panel shows to copy or send by WhatsApp).
import { rawDb } from '@/lib/server/supabase';
import { emailLayout, esc, sendEmail } from '@/lib/server/email';

const ROLE_TEXT: Record<string, { name: string; can: string }> = {
  owner: { name: 'dueño', can: 'Tendrás control total de la tienda, incluido manejar a los demás dueños.' },
  admin: { name: 'administrador', can: 'Podrás conectar WhatsApp y las demás integraciones, crear plantillas, atender mensajes y pedidos, e invitar a otras personas.' },
  member: { name: 'parte del equipo', can: 'Podrás atender los mensajes de WhatsApp y manejar los pedidos.' },
};

export async function sendInviteEmail(p: { to: string; url: string; orgId: string; role: string; invitedBy: string | null; expiresAt: string }) {
  const [{ data: org }, { data: who }] = await Promise.all([
    rawDb().from('organizations').select('name').eq('id', p.orgId).maybeSingle(),
    p.invitedBy ? rawDb().from('app_users').select('name, email').eq('id', p.invitedBy).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const store = (org as any)?.name || 'una tienda';
  const by = (who as any)?.name || (who as any)?.email || 'Alguien de tu equipo';
  const r = ROLE_TEXT[p.role] || ROLE_TEXT.member;
  const until = new Date(p.expiresAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', timeZone: 'America/Bogota' });
  const { html, text } = emailLayout({
    title: `Te invitaron a ${esc(store)}`,
    paragraphs: [
      `<b>${esc(by)}</b> te invitó a la tienda <b>${esc(store)}</b> en Konnexa como <b>${esc(r.name)}</b>.`,
      esc(r.can),
      `Crea tu acceso con este correo (${esc(p.to)}). La invitación vence el ${esc(until)} y sirve una sola vez.`,
    ],
    cta: { label: 'Aceptar invitación', url: p.url },
    footer: 'Si no esperabas esta invitación, ignora este correo.',
  });
  return sendEmail({ to: p.to, subject: `${by} te invitó a ${store} en Konnexa`, html, text });
}
