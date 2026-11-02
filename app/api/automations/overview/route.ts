import { cloudEnabled, db } from '@/lib/server/db';
import { fail, failFrom, ok } from '@/lib/server/http';
import { whatsappStatus } from '@/lib/server/whatsapp';
import { getWaSettings } from '@/lib/server/wa-store';
import { getVoiceConfig } from '@/lib/server/voice-store';
import { vapiStatus } from '@/lib/server/vapi';
import { getBotSettings } from '@/lib/server/bot';
import { getAutoSettings } from '@/lib/server/crm-store';
import { followUpStats } from '@/lib/server/followup';
import { getConversionSettings } from '@/lib/server/conversions';
import { capiConfig } from '@/lib/server/integrations';
import { getAgenda } from '@/lib/server/agenda';
import { getSchedulerInfo } from '@/lib/server/scheduled';

export const dynamic = 'force-dynamic';

export type AutoState = 'on' | 'off' | 'warn';
export interface AutomationItem {
  id: string;
  when: string; // what starts it
  does: string; // what Konnexa does
  state: AutoState;
  detail: string; // current setup, or what's missing
  count?: string; // what it did in the last 30 days
  href: string; // where it's set up
}

const DAYS = 30;

// Paged read of the last 30 days (Supabase returns at most 1000 rows per request).
async function recent<T>(table: string, columns: string, filter?: (q: any) => any): Promise<T[]> {
  const since = new Date(Date.now() - DAYS * 86400000).toISOString();
  const out: T[] = [];
  for (let from = 0; from < 50000; from += 1000) {
    let q = (await db()).from(table).select(columns).gte('created_at', since);
    if (filter) q = filter(q);
    const { data, error } = await q.order('created_at', { ascending: true }).range(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...((data || []) as T[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

const n = (v: number, one: string, many: string) => `${v.toLocaleString('es-CO')} ${v === 1 ? one : many}`;

// Everything this store has running on its own, with its state and what it did in the last 30 days.
export async function GET() {
  if (!cloudEnabled()) return fail('La base de datos no está configurada.', 503);
  try {
    const [wa, waSet, voice, vapi, bot, auto, conv, capi, agenda, sched, msgs] = await Promise.all([
      whatsappStatus(),
      getWaSettings().catch(() => ({ mode: 'template' as const, fallbackMinutes: 0 })),
      getVoiceConfig().catch(() => null),
      vapiStatus().catch(() => ({ ready: false })),
      getBotSettings(),
      getAutoSettings(),
      getConversionSettings(),
      capiConfig().catch(() => null),
      getAgenda().catch(() => null),
      getSchedulerInfo().catch(() => ({}) as Record<string, any>),
      recent<{ type: string }>('wa_messages', 'type', (q) => q.eq('direction', 'out')).catch(() => []),
    ]);
    const sent = (t: string[]) => msgs.filter((m) => t.includes(m.type)).length;
    const appointments = agenda?.businessType === 'appointments';
    const connected = Boolean(wa.connected);
    const noWa = 'Primero conecta tu WhatsApp en Integraciones.';
    const items: AutomationItem[] = [];

    // The assistant: used by both kinds of business.
    const botItem: AutomationItem = {
      id: 'bot',
      when: 'Un cliente escribe por WhatsApp',
      does: appointments ? 'El asistente responde, busca un horario libre y agenda la cita' : 'El asistente responde, vende y toma el pedido',
      state: bot.enabled ? (connected ? 'on' : 'warn') : 'off',
      detail: bot.enabled ? (connected ? (bot.mode === 'away' ? 'Responde solo fuera de horario.' : 'Responde siempre.') : noWa) : 'Apagado: los chats los responde tu equipo.',
      count: n(sent(['bot']), 'respuesta', 'respuestas'),
      href: '#asistente',
    };
    const activeRules = auto.rules.filter((r) => r.enabled).length;
    const autoOn = auto.away.enabled || activeRules > 0;
    const autoItem: AutomationItem = {
      id: 'auto',
      when: 'Un cliente escribe una palabra clave o fuera de horario',
      does: 'Responde con el mensaje que tú escribiste',
      state: autoOn ? (connected ? 'on' : 'warn') : 'off',
      detail: autoOn
        ? connected
          ? [activeRules ? n(activeRules, 'palabra clave', 'palabras clave') : '', auto.away.enabled ? 'mensaje fuera de horario' : ''].filter(Boolean).join(' y ') + '.'
          : noWa
        : 'Sin respuestas automáticas.',
      count: n(sent(['auto']), 'respuesta', 'respuestas'),
      href: '#whatsapp',
    };
    const fu = bot.followUp.enabled ? await followUpStats().catch(() => null) : null;
    const followItem: AutomationItem = {
      id: 'followup',
      when: appointments ? 'Un cliente deja de responder sin agendar' : 'Un cliente deja de responder sin comprar',
      does: 'El asistente le escribe una vez para retomar la conversación',
      state: bot.followUp.enabled ? (bot.enabled && connected ? 'on' : 'warn') : 'off',
      detail: bot.followUp.enabled
        ? !connected
          ? noWa
          : bot.enabled
            ? `A las ${bot.followUp.afterHours} h de silencio${bot.followUp.onlyAds ? ', solo chats de anuncios' : ''}.`
            : 'Prende el asistente: el seguimiento lo escribe él.'
        : 'Apagado.',
      count: fu ? `${n(fu.sent, 'enviado', 'enviados')} · ${n(fu.recovered, appointments ? 'agendó' : 'compró', appointments ? 'agendaron' : 'compraron')}` : undefined,
      href: '#asistente',
    };

    if (appointments && agenda) {
      const rem = agenda.reminder24h || agenda.reminder2h;
      const when = [agenda.reminder24h ? '24 h' : '', agenda.reminder2h ? '2 h' : ''].filter(Boolean).join(' y ');
      items.push(botItem, {
        id: 'reminders',
        when: 'Se acerca una cita',
        does: 'Le manda al cliente un recordatorio con botones Confirmar y Cancelar',
        state: rem ? (connected ? 'on' : 'warn') : 'off',
        detail: rem ? (connected ? `${when} antes, con la plantilla "${agenda.reminderTemplate}".` : noWa) : 'Sin recordatorios.',
        count: n(sent(['reminder', 'template']), 'mensaje', 'mensajes'),
        href: '/agenda?tab=settings',
      }, {
        id: 'comeback',
        when: 'Pasa el tiempo de volver de un servicio',
        does: 'Invita al cliente a agendar de nuevo ("vuelve pronto")',
        state: agenda.comeBackEnabled ? (connected ? 'on' : 'warn') : 'off',
        detail: agenda.comeBackEnabled ? (connected ? `Con la plantilla "${agenda.comeBackTemplate}".` : noWa) : 'Apagado.',
        href: '/agenda?tab=settings',
      }, followItem, autoItem);
    } else {
      // New order → confirmation on WhatsApp.
      let confirm: Pick<AutomationItem, 'state' | 'detail'>;
      if (!connected) confirm = { state: 'off', detail: noWa };
      else if (waSet.mode === 'customer_first')
        confirm = {
          state: 'on',
          detail:
            waSet.fallbackMinutes > 0
              ? wa.confirmTemplate
                ? `La landing lleva al cliente a WhatsApp. Si no escribe en ${waSet.fallbackMinutes} min, le llega la plantilla.`
                : 'La landing lleva al cliente a WhatsApp. Falta elegir la plantilla para quien no escribe.'
              : 'La landing lleva al cliente a WhatsApp con el pedido escrito.',
        };
      else confirm = wa.confirmTemplate ? { state: 'on', detail: 'Le llega la plantilla de confirmación apenas compra.' } : { state: 'warn', detail: 'Falta elegir la plantilla de confirmación.' };
      if (confirm.state === 'on' && waSet.mode === 'customer_first' && waSet.fallbackMinutes > 0 && !wa.confirmTemplate) confirm.state = 'warn';
      const orders = await recent<{ wa: any; sale: any }>('orders', 'wa:data->whatsapp, sale:data->capiSale').catch(() => []);
      const calls = voice?.autoCall ? (await recent<{ id: string }>('calls', 'id').catch(() => [])).length : 0;
      items.push(
        { id: 'confirm', when: 'Entra un pedido', does: 'Pide al cliente confirmar el pedido por WhatsApp', ...confirm, count: n(orders.filter((o) => o.wa?.ok).length, 'plantilla enviada', 'plantillas enviadas'), href: '/integrations' },
        {
          id: 'call',
          when: 'Entra un pedido',
          does: 'Lo llama una IA para confirmar dirección y pago',
          state: voice?.autoCall ? (vapi.ready ? 'on' : 'warn') : 'off',
          detail: voice?.autoCall ? (vapi.ready ? 'Llama a cada pedido nuevo y reintenta si no contesta.' : 'Falta conectar el proveedor de llamadas.') : 'Apagado: las llamadas se hacen a mano desde Pedidos.',
          count: voice?.autoCall ? n(calls, 'llamada', 'llamadas') : undefined,
          href: '/voice-ai',
        },
        botItem,
        followItem,
        autoItem,
        {
          id: 'meta',
          when: conv.saleEvent === 'delivered' ? 'Un pedido se entrega' : conv.saleEvent === 'submit' ? 'Entra un pedido' : 'Un pedido se confirma',
          does: 'Le reporta la venta a Meta para que tus anuncios encuentren más compradores',
          state: capi ? 'on' : 'off',
          detail: capi ? `Ventas de landings${conv.whatsapp ? ' y de chats de anuncios' : ''}.` : 'Falta conectar Meta (token de conversiones) en Integraciones.',
          count: capi ? n(orders.filter((o) => o.sale?.ok).length, 'venta reportada', 'ventas reportadas') : undefined,
          href: '/integrations',
        },
      );
    }

    // Reminders, follow-ups, call retries and the confirmation fallback need the 5-minute check.
    const needsCheck = items.some((i) => i.state === 'on' && ['reminders', 'comeback', 'followup', 'call'].includes(i.id)) || (waSet.mode === 'customer_first' && waSet.fallbackMinutes > 0);
    // Only the scheduled task counts (opening the panel also runs the checks, but nobody is there at night).
    const last = (sched as any).lastCronAt as string | undefined;
    const checkOk = Boolean(last && Date.now() - new Date(last).getTime() < 15 * 60000);
    return ok({ businessType: appointments ? 'appointments' : 'orders', items, check: { needed: needsCheck, ok: checkOk, lastRunAt: last || null } });
  } catch (e) {
    return failFrom(e);
  }
}
