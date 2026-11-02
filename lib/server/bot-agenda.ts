// The WhatsApp assistant for "Negocio con citas": instructions and tools to check free slots and book,
// list, cancel or move the customer's appointments.
import type Anthropic from '@anthropic-ai/sdk';
import type { BotSettings } from '@/lib/bot';
import { addDays, formatWhen, localParts, STATUS_LABEL, type AgendaSettings, type Appointment } from '@/lib/agenda';
import { AgendaError, appointmentsForPhone, availability, bookAppointment, getAppointment, nextAvailability, rescheduleAppointment, setAppointmentStatus } from '@/lib/server/agenda';

const money = (v: number) => (v > 0 ? `$${Math.round(v).toLocaleString('es-CO')}` : 'precio a consultar');

// The next two weeks as "jueves 6 de noviembre = 2026-11-06" so the model maps "el jueves" to a date.
function calendar(a: AgendaSettings): string {
  const today = localParts(new Date(), a.timezone).date;
  const lines: string[] = [];
  for (let i = 0; i < 14; i++) {
    const d = addDays(today, i);
    const label = new Intl.DateTimeFormat('es-CO', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${d}T12:00:00Z`));
    lines.push(`- ${label} = ${d}${i === 0 ? ' (hoy)' : i === 1 ? ' (mañana)' : ''}`);
  }
  return lines.join('\n');
}

export function agendaPrompt(s: BotSettings, a: AgendaSettings, storeName: string): string {
  const services = a.services.filter((x) => x.active);
  const staff = a.staff.filter((p) => p.active);
  const serviceLines = services.length
    ? services.map((x) => `- servicio_id "${x.id}": ${x.name} · ${x.durationMin} min · ${money(x.price)}${x.description ? ` · ${x.description}` : ''}`).join('\n')
    : '(La tienda todavía no ha cargado servicios.)';
  const staffLines = staff.length
    ? staff
        .map((p) => {
          const which = p.serviceIds.length ? p.serviceIds.map((id) => services.find((x) => x.id === id)?.name).filter(Boolean).join(', ') : 'todos los servicios';
          return `- profesional_id "${p.id}": ${p.name} (${which})`;
        })
        .join('\n')
    : '(Sin profesionales cargados.)';
  return `Eres ${s.name}, quien atiende la agenda de ${storeName} por WhatsApp. Tu trabajo es resolver dudas y agendar citas.

Cómo escribes:
- En español, ${s.formal ? 'tratando al cliente de usted' : 'tuteando al cliente'}, con calidez y de forma breve: mensajes cortos como en WhatsApp (1 a 4 frases). Puedes usar algún emoji con moderación.
- Una sola respuesta por mensaje del cliente.

Cómo agendas:
1. Entiende qué servicio quiere. Si duda, recomiéndale según la lista de servicios.
2. Pregunta qué día o franja le sirve (mañana, tarde) y si prefiere a algún profesional.
3. Usa consultar_disponibilidad y ofrécele 2 o 3 horarios concretos. Nunca inventes horarios: solo ofrece los que devuelve la herramienta.
4. Pide su nombre si no lo tienes (nombre y apellido).
5. Muéstrale un resumen corto (servicio, profesional, día y hora, precio y dirección) y pregúntale si confirma.
6. Solo cuando diga que sí, usa agendar_cita con cliente_confirmo = true. Si la herramienta dice que el horario ya no está libre, ofrécele otros.
7. Cuando quede agendada, confírmale los datos y recuérdale la política de cancelación si la hay.

También puedes:
- Consultar sus citas con mis_citas.
- Cancelar (cancelar_cita) o mover (reprogramar_cita) una cita suya, siempre después de que el cliente lo confirme. Al cancelar, ofrécele reprogramar.

Reglas importantes:
- Nunca inventes precios, servicios, horarios ni políticas. Si algo no está en la información de abajo o en lo que devuelven las herramientas, dile que lo consultas con el equipo y usa pasar_a_humano.
- No des diagnósticos, tratamientos ni consejos médicos o de salud, y no pidas datos de salud. Si el cliente describe un dolor fuerte, una urgencia o algo delicado, recomiéndale buscar atención y usa pasar_a_humano.
- Usa pasar_a_humano cuando el cliente pida hablar con una persona, tenga un reclamo o esté molesto, pregunte por pagos, devoluciones o algo que no puedas resolver.
- No pidas datos sensibles (cédula, tarjetas, contraseñas). No compartas datos de otros clientes.
- No menciones que eres una inteligencia artificial salvo que te lo pregunten; si te lo preguntan, dilo con naturalidad.

# Fechas (zona horaria del negocio)
${calendar(a)}

# Servicios
${serviceLines}

# Profesionales
${staffLines}

# Dirección
${a.address || '(No indicada: si la piden, pasa a una persona.)'}

# Políticas
${a.policies || '(Sin políticas indicadas.)'}

# Información del negocio (escrita por el negocio)
${s.businessInfo || '(Sin información adicional.)'}`;
}

const yes = { type: 'boolean', description: 'true solo si el cliente confirmó explícitamente.' };

export const AGENDA_TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: 'consultar_disponibilidad',
    description: 'Devuelve los horarios libres para un servicio. Con fecha, los de ese día (y si no hay, los siguientes días con espacio). Sin fecha, los próximos días con espacio.',
    input_schema: {
      type: 'object',
      properties: {
        servicio_id: { type: 'string' },
        profesional_id: { type: 'string', description: 'Vacío si le sirve cualquier profesional.' },
        fecha: { type: 'string', description: 'YYYY-MM-DD, o vacío para buscar desde hoy.' },
      },
      required: ['servicio_id', 'profesional_id', 'fecha'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: 'agendar_cita',
    description: 'Agenda la cita del cliente en un horario libre. Úsala solo después de mostrarle el resumen y que confirme.',
    input_schema: {
      type: 'object',
      properties: {
        servicio_id: { type: 'string' },
        profesional_id: { type: 'string', description: 'El del horario elegido, o vacío si le sirve cualquiera.' },
        fecha: { type: 'string', description: 'YYYY-MM-DD' },
        hora: { type: 'string', description: 'HH:MM en formato de 24 horas, tal como la devolvió consultar_disponibilidad.' },
        nombre: { type: 'string', description: 'Nombre y apellido del cliente.' },
        notas: { type: 'string', description: 'Algo que el cliente quiera que el negocio sepa. Vacío si no hay.' },
        cliente_confirmo: yes,
      },
      required: ['servicio_id', 'profesional_id', 'fecha', 'hora', 'nombre', 'notas', 'cliente_confirmo'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: 'mis_citas',
    description: 'Devuelve las próximas citas de este cliente (por su número de WhatsApp), con su cita_id.',
    input_schema: { type: 'object', properties: {}, required: [], additionalProperties: false },
    strict: true,
  },
  {
    name: 'cancelar_cita',
    description: 'Cancela una cita del cliente. Pídele confirmación antes.',
    input_schema: {
      type: 'object',
      properties: { cita_id: { type: 'string' }, cliente_confirmo: yes },
      required: ['cita_id', 'cliente_confirmo'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: 'reprogramar_cita',
    description: 'Mueve una cita del cliente a otro horario libre del mismo servicio. Consulta la disponibilidad y pide confirmación antes.',
    input_schema: {
      type: 'object',
      properties: {
        cita_id: { type: 'string' },
        fecha: { type: 'string', description: 'YYYY-MM-DD' },
        hora: { type: 'string', description: 'HH:MM (24 h)' },
        profesional_id: { type: 'string', description: 'Vacío para cualquiera.' },
        cliente_confirmo: yes,
      },
      required: ['cita_id', 'fecha', 'hora', 'profesional_id', 'cliente_confirmo'],
      additionalProperties: false,
    },
    strict: true,
  },
];

export const AGENDA_TOOL_NAMES = new Set(AGENDA_TOOLS.map((t) => t.name));

function describe(a: AgendaSettings, x: Appointment) {
  const service = a.services.find((s) => s.id === x.serviceId);
  return {
    cita_id: x.id,
    servicio: service?.name || x.serviceId,
    profesional: a.staff.find((p) => p.id === x.staffId)?.name || '',
    cuando: formatWhen(x.start, a.timezone),
    estado: STATUS_LABEL[x.status],
    precio: service ? money(service.price) : '',
  };
}

const daySlots = (a: AgendaSettings, slots: { time: string; staffId: string }[]) =>
  slots.slice(0, 16).map((s) => ({ hora: s.time, profesional_id: s.staffId, profesional: a.staff.find((p) => p.id === s.staffId)?.name || '' }));

// Runs one agenda tool. `booked` is set when an appointment was created (for the chat note).
export async function runAgendaTool(
  name: string,
  input: any,
  ctx: { a: AgendaSettings; phone: string; dryRun: boolean },
): Promise<{ result: unknown; booked?: string }> {
  const { a, phone } = ctx;
  try {
    if (name === 'consultar_disponibilidad') {
      const staffId = String(input.profesional_id || '') || undefined;
      const fecha = String(input.fecha || '');
      if (fecha) {
        const slots = await availability(a, String(input.servicio_id), fecha, staffId);
        if (slots.length) return { result: { fecha, horarios: daySlots(a, slots) } };
        const next = await nextAvailability(a, String(input.servicio_id), { from: addDays(fecha, 1), staffId });
        return { result: { fecha, horarios: [], nota: 'Ese día no hay espacio.', siguientes: next.map((d) => ({ fecha: d.date, horarios: daySlots(a, d.slots) })) } };
      }
      const next = await nextAvailability(a, String(input.servicio_id), { staffId });
      return { result: next.length ? { dias: next.map((d) => ({ fecha: d.date, horarios: daySlots(a, d.slots) })) } : { dias: [], nota: 'No hay horarios libres en los próximos días.' } };
    }
    if (name === 'agendar_cita') {
      if (!input.cliente_confirmo) return { result: { error: 'Primero muéstrale el resumen y pídele que confirme.' } };
      if (ctx.dryRun) return { result: { ok: true, nota: 'Simulador: la cita no se guardó.', cuando: `${input.fecha} ${input.hora}` } };
      const appt = await bookAppointment({
        serviceId: String(input.servicio_id),
        staffId: String(input.profesional_id || '') || undefined,
        date: String(input.fecha),
        time: String(input.hora),
        customerName: String(input.nombre || ''),
        phone,
        notes: String(input.notas || ''),
        source: 'whatsapp_bot',
        status: 'confirmed',
      }, a);
      return { result: { ok: true, ...describe(a, appt), direccion: a.address || undefined }, booked: `${describe(a, appt).servicio} · ${formatWhen(appt.start, a.timezone)}` };
    }
    if (name === 'mis_citas') {
      const list = (await appointmentsForPhone(phone)).filter((x) => x.status === 'pending' || x.status === 'confirmed');
      return { result: list.length ? { citas: list.map((x) => describe(a, x)) } : { citas: [], nota: 'Este número no tiene citas próximas.' } };
    }
    const mine = async (id: string) => {
      const x = await getAppointment(String(id));
      return x && x.phone === phone ? x : null;
    };
    if (name === 'cancelar_cita') {
      if (!input.cliente_confirmo) return { result: { error: 'Pide confirmación antes de cancelar.' } };
      const x = await mine(input.cita_id);
      if (!x || (x.status !== 'pending' && x.status !== 'confirmed')) return { result: { error: 'No encuentro esa cita activa para este número. Usa mis_citas.' } };
      if (ctx.dryRun) return { result: { ok: true, nota: 'Simulador: no se canceló.' } };
      await setAppointmentStatus(x.id, 'cancelled');
      return { result: { ok: true, cancelada: describe(a, { ...x, status: 'cancelled' }) } };
    }
    if (name === 'reprogramar_cita') {
      if (!input.cliente_confirmo) return { result: { error: 'Pide confirmación antes de mover la cita.' } };
      const x = await mine(input.cita_id);
      if (!x) return { result: { error: 'No encuentro esa cita para este número. Usa mis_citas.' } };
      if (ctx.dryRun) return { result: { ok: true, nota: 'Simulador: no se movió.' } };
      const moved = await rescheduleAppointment(x.id, String(input.fecha), String(input.hora), String(input.profesional_id || '') || undefined);
      return { result: { ok: true, ...describe(a, moved) } };
    }
    return { result: { error: `Herramienta desconocida: ${name}` } };
  } catch (e: any) {
    if (e instanceof AgendaError) return { result: { error: e.message } };
    throw e;
  }
}
