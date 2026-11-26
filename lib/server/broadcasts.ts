// Envíos masivos: the store picks an approved template, pastes a list of customers (phone, name and any extra
// columns) and sends it one by one or all in a row. Each variable of the template takes the customer's first
// name, a column of the list or a fixed text. Kept in the "settings" table (wa_broadcasts), last 20 sends.
import { db } from '@/lib/server/db';
import { recordOutbound } from '@/lib/server/wa-store';
import { listTemplates, sendTemplate, whatsappEnabled, type WaTemplate } from '@/lib/server/whatsapp';
import { MAX_ROWS, cleanCell, fillBody, rowVars, type Broadcast, type BroadcastRow, type TemplateOption, type VarSource } from '@/lib/broadcast';

export type { Broadcast, BroadcastRow, TemplateOption, VarSource };

const ROW = 'wa_broadcasts';
const MAX_BROADCASTS = 20;

async function readAll(): Promise<Broadcast[]> {
  const { data, error } = await (await db()).from('settings').select('data').eq('id', ROW).maybeSingle();
  if (error) throw new Error(error.message);
  return ((data?.data as { items?: Broadcast[] })?.items || []) as Broadcast[];
}
async function writeAll(items: Broadcast[]) {
  const { error } = await (await db()).from('settings').upsert({ id: ROW, data: { items: items.slice(0, MAX_BROADCASTS) } });
  if (error) throw new Error(error.message);
}

export const listBroadcasts = readAll;
export async function getBroadcast(id: string) {
  return (await readAll()).find((b) => b.id === id) || null;
}
export async function deleteBroadcast(id: string) {
  await writeAll((await readAll()).filter((b) => b.id !== id));
}

// ---------- templates ----------

// Approved templates and whether a mass send can fill them (body variables, optional photo on top, quick replies).
export function templateOption(t: WaTemplate): TemplateOption {
  const comps = t.components || [];
  const body = String(comps.find((x: any) => x.type === 'BODY')?.text || '');
  const nums = Array.from(body.matchAll(/\{\{(\d+)\}\}/g)).map((m) => Number(m[1]));
  const header = comps.find((x: any) => x.type === 'HEADER');
  const buttons: any[] = comps.find((x: any) => x.type === 'BUTTONS')?.buttons || [];
  let why: string | undefined;
  if (header && header.format && !['TEXT', 'IMAGE'].includes(header.format)) why = 'Lleva video o documento arriba.';
  else if (header?.format === 'TEXT' && /\{\{\d+\}\}/.test(header.text || '')) why = 'El título tiene datos variables.';
  else if (buttons.some((b) => b.type === 'URL' && /\{\{\d+\}\}/.test(b.url || ''))) why = 'Un botón lleva un enlace variable.';
  else if (buttons.some((b) => !['QUICK_REPLY', 'URL', 'PHONE_NUMBER'].includes(b.type))) why = 'Tiene botones que este envío no maneja.';
  return {
    name: t.name,
    lang: t.language || 'es',
    category: t.category,
    body,
    vars: nums.length ? Math.max(...nums) : 0,
    imageHeader: header?.format === 'IMAGE',
    buttons: buttons.map((b) => String(b.text || '')),
    supported: !why,
    why,
  };
}

export async function templateOptions(): Promise<TemplateOption[]> {
  const list = await listTemplates();
  return list.filter((t) => t.status === 'APPROVED').map(templateOption);
}

export async function createBroadcast(
  input: {
    name: string;
    template: TemplateOption;
    vars: VarSource[];
    image?: string;
    columns: string[];
    rows: BroadcastRow[];
  },
  by: string | null,
): Promise<Broadcast> {
  const b: Broadcast = {
    id: `bc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: cleanCell(input.name) || `Envío ${new Date().toLocaleDateString('es-CO')}`,
    template: {
      name: input.template.name,
      lang: input.template.lang,
      category: input.template.category,
      body: input.template.body,
      vars: input.template.vars,
      imageHeader: input.template.imageHeader,
    },
    vars: input.vars,
    image: input.image,
    columns: input.columns,
    rows: input.rows.slice(0, MAX_ROWS),
    createdAt: new Date().toISOString(),
    by,
  };
  await writeAll([b, ...(await readAll())]);
  return b;
}

// Sends one row (pending or failed) and saves what happened.
export async function sendRow(id: string, index: number, by?: { uid: string; name: string }): Promise<BroadcastRow> {
  const all = await readAll();
  const b = all.find((x) => x.id === id);
  if (!b) throw new Error('Ese envío ya no existe.');
  const r = b.rows[index];
  if (!r) throw new Error('Ese contacto no está en la lista.');
  if (r.status === 'sent') return r;
  if (!(await whatsappEnabled())) throw new Error('WhatsApp no está conectado.');
  const vars = rowVars(b, r);
  const result = await sendTemplate(r.phone, { name: b.template.name, lang: b.template.lang }, vars, b.template.imageHeader ? b.image : undefined);
  const text = fillBody(b.template.body, vars);
  await recordOutbound({
    phone: r.phone,
    name: r.name || undefined,
    type: 'template',
    body: b.template.imageHeader ? `📷 ${text}` : text,
    result,
    by,
    ...(b.template.imageHeader && b.image ? { payload: { type: 'image', image: { link: b.image } } } : {}),
  });
  const row: BroadcastRow = result.ok
    ? {
        ...r,
        status: 'sent',
        sentAt: new Date().toISOString(),
        error: undefined,
      }
    : { ...r, status: 'failed', error: result.error || 'Error de WhatsApp' };
  // Re-read: another tab may be sending other rows of the same list.
  const fresh = await readAll();
  const fb = fresh.find((x) => x.id === id);
  if (fb && fb.rows[index]) {
    fb.rows[index] = row;
    await writeAll(fresh);
  }
  return row;
}
