// Emails to store owners: welcome, password reset, payments and plan reminders.
import { rawDb } from '@/lib/server/supabase';
import { emailLayout, esc, sendEmail } from '@/lib/server/email';
import { publicBaseUrl } from '@/lib/server/vapi';
import { cop } from '@/lib/plans';

const date = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Bogota' }) : '');
const base = () => publicBaseUrl();

export async function ownerEmails(orgId: string): Promise<string[]> {
  const { data: owners } = await rawDb().from('memberships').select('user_id').eq('org_id', orgId).eq('role', 'owner');
  const ids = (owners || []).map((o) => o.user_id);
  if (!ids.length) return [];
  const { data: users } = await rawDb().from('app_users').select('email').in('id', ids);
  return Array.from(new Set((users || []).map((u) => String(u.email || '')).filter(Boolean)));
}

async function orgName(orgId: string) {
  const { data } = await rawDb().from('organizations').select('name').eq('id', orgId).maybeSingle();
  return String(data?.name || 'tu tienda');
}

async function toOwners(orgId: string, build: (store: string) => { subject: string; title: string; paragraphs: string[]; cta?: { label: string; url: string } }) {
  const [to, store] = await Promise.all([ownerEmails(orgId), orgName(orgId)]);
  if (!to.length) return { ok: false, skipped: true };
  const m = build(esc(store));
  const { html, text } = emailLayout(m);
  return sendEmail({ to, subject: m.subject, html, text });
}

export function sendPasswordReset(p: { email: string; name: string | null; url: string }) {
  const { html, text } = emailLayout({
    title: 'Cambia tu contraseña',
    paragraphs: [
      `Hola${p.name ? ` ${esc(p.name)}` : ''}, recibimos una solicitud para cambiar la contraseña de tu cuenta en Konnexa.`,
      'El enlace sirve una sola vez y vence en 1 hora. Si no fuiste tú, ignora este correo: tu contraseña sigue igual.',
    ],
    cta: { label: 'Crear nueva contraseña', url: p.url },
  });
  return sendEmail({ to: p.email, subject: 'Cambia tu contraseña de Konnexa', html, text });
}

export function sendWelcome(p: { email: string; name: string; store: string; trialEndsAt: string | null }) {
  const { html, text } = emailLayout({
    title: `¡Bienvenido a Konnexa, ${esc(p.name)}!`,
    paragraphs: [
      `Tu tienda <b>${esc(p.store)}</b> ya está lista. Tienes prueba gratis con todo lo del plan Pro${p.trialEndsAt ? ` hasta el <b>${date(p.trialEndsAt)}</b>` : ''}, sin tarjeta.`,
      'Para empezar: <b>1.</b> crea tu primera landing subiendo la foto del producto, <b>2.</b> conecta tu WhatsApp en Integraciones para confirmar pedidos y <b>3.</b> activa el asistente con IA en Mensajes.',
    ],
    cta: { label: 'Ir a mi panel', url: `${base()}/dashboard` },
  });
  return sendEmail({ to: p.email, subject: `Tu tienda ${p.store} está lista`, html, text });
}

export function notifyPaymentApproved(orgId: string, p: { planName: string; amountCents: number; periodEnd: string | null; method?: string | null }) {
  return toOwners(orgId, (store) => ({
    subject: `Pago recibido: plan ${p.planName}`,
    title: '¡Pago recibido!',
    paragraphs: [
      `Recibimos el pago de <b>${cop(p.amountCents / 100)}</b> por el plan <b>${esc(p.planName)}</b> de ${store}.`,
      p.periodEnd ? `Tu plan está activo hasta el <b>${date(p.periodEnd)}</b>.` : 'Tu plan está activo.',
      'Puedes ver el historial de pagos en Plan y pagos.',
    ],
    cta: { label: 'Ver Plan y pagos', url: `${base()}/plan` },
  }));
}

export function notifyRenewalFailed(orgId: string, p: { planName: string; reason: string | null; lastTry: boolean; periodEnd: string | null }) {
  return toOwners(orgId, (store) => ({
    subject: 'No pudimos cobrar tu plan de Konnexa',
    title: 'No pudimos cobrar tu plan',
    paragraphs: [
      `El cobro automático del plan <b>${esc(p.planName)}</b> de ${store} fue rechazado${p.reason ? ` (${esc(p.reason)})` : ''}.`,
      p.lastTry
        ? 'Fue el último intento, así que apagamos el cobro automático. Paga desde Plan y pagos con otra tarjeta, PSE o Nequi para no perder el servicio.'
        : 'Lo intentaremos de nuevo mañana. Si quieres, paga ahora desde Plan y pagos con otra tarjeta, PSE o Nequi.',
      p.periodEnd ? `Tu plan sigue activo hasta el <b>${date(p.periodEnd)}</b>.` : '',
    ].filter(Boolean),
    cta: { label: 'Pagar ahora', url: `${base()}/plan` },
  }));
}

export function notifyTrialEnding(orgId: string, p: { endsAt: string; daysLeft: number }) {
  return toOwners(orgId, (store) => ({
    subject: p.daysLeft <= 1 ? 'Tu prueba gratis de Konnexa termina mañana' : `Tu prueba gratis termina en ${p.daysLeft} días`,
    title: 'Tu prueba gratis está por terminar',
    paragraphs: [
      `La prueba de ${store} termina el <b>${date(p.endsAt)}</b>.`,
      'Elige un plan para que tu panel, tus landings y tus confirmaciones sigan funcionando sin pausa. Si pagas antes, tu mes empieza cuando termine la prueba: no pierdes días.',
    ],
    cta: { label: 'Elegir mi plan', url: `${base()}/plan` },
  }));
}

export function notifyPlanEnding(orgId: string, p: { planName: string; endsAt: string; daysLeft: number }) {
  return toOwners(orgId, (store) => ({
    subject: `Tu plan ${p.planName} vence en ${p.daysLeft} ${p.daysLeft === 1 ? 'día' : 'días'}`,
    title: 'Tu plan está por vencer',
    paragraphs: [`El plan <b>${esc(p.planName)}</b> de ${store} vence el <b>${date(p.endsAt)}</b> y no tiene cobro automático.`, 'Renuévalo desde Plan y pagos para no perder el servicio.'],
    cta: { label: 'Renovar', url: `${base()}/plan` },
  }));
}

export function notifyPlanExpired(orgId: string, p: { graceUntil: string }) {
  return toOwners(orgId, (store) => ({
    subject: 'Tu plan de Konnexa venció',
    title: 'Tu plan venció',
    paragraphs: [
      `El panel de ${store} quedó en pausa. Tus landings siguen recibiendo pedidos hasta el <b>${date(p.graceUntil)}</b>; después se pausan.`,
      'No se borra nada: apenas elijas un plan, todo vuelve a funcionar.',
    ],
    cta: { label: 'Elegir un plan', url: `${base()}/plan` },
  }));
}
