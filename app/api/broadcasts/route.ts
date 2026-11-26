import { NextRequest } from 'next/server';
import { currentOrgId } from '@/lib/server/tenant';
import { requireManager } from '@/lib/server/integrations-api';
import { createBroadcast, listBroadcasts, templateOptions } from '@/lib/server/broadcasts';
import { MAX_ROWS, cleanCell, parseList, type BroadcastRow, type VarSource } from '@/lib/broadcast';
import { normalizePhone } from '@/lib/phone';
import { getUser } from '@/lib/server/accounts';
import { sessionUserId } from '@/lib/server/tenant';
import { fail, failFrom, ok } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

// Envíos masivos: the store's sends (summary) and its approved templates.
export async function GET() {
  try {
    await currentOrgId();
    const [list, templates] = await Promise.all([
      listBroadcasts(),
      templateOptions().then(
        (t) => ({ items: t, error: null as string | null }),
        (e) => ({ items: [], error: String(e?.message || e) }),
      ),
    ]);
    return ok({
      broadcasts: list.map((b) => ({
        id: b.id,
        name: b.name,
        template: b.template.name,
        createdAt: b.createdAt,
        total: b.rows.length,
        sent: b.rows.filter((r) => r.status === 'sent').length,
        failed: b.rows.filter((r) => r.status === 'failed').length,
      })),
      templates: templates.items,
      templatesError: templates.error,
    });
  } catch (e) {
    return failFrom(e);
  }
}

// New send. Body: { name, template: { name, lang }, vars: VarSource[], image?, columns + rows (reviewed in the panel) or list (pasted text) }
export async function POST(req: NextRequest) {
  try {
    await requireManager();
    const b = await req.json().catch(() => ({}));
    const options = await templateOptions();
    const t = options.find((x) => x.name === b.template?.name && x.lang === b.template?.lang) || options.find((x) => x.name === b.template?.name);
    if (!t) return fail('Elige una plantilla aprobada.');
    if (!t.supported) return fail(`Esa plantilla no se puede usar en un envío masivo: ${t.why}`);
    const vars: VarSource[] = (Array.isArray(b.vars) ? b.vars : []).slice(0, t.vars).map((v: any) =>
      v?.kind === 'col' && Number.isInteger(v.col) && v.col >= 0 ? { kind: 'col', col: v.col } : v?.kind === 'text' ? { kind: 'text', text: String(v.text || '').slice(0, 200) } : { kind: 'name' },
    );
    if (vars.length < t.vars) return fail(`La plantilla tiene ${t.vars} datos variables: elige qué va en cada uno.`);
    if (vars.some((v) => v.kind === 'text' && !v.text.trim())) return fail('Escribe el texto fijo de cada dato variable.');
    const image = String(b.image || '').trim();
    if (t.imageHeader && !/^https:\/\/\S+\.(jpe?g|png)(\?\S*)?$/i.test(image)) return fail('Esta plantilla lleva una foto arriba: pega el enlace de la imagen (https, .jpg o .png).');
    // The rows the store reviewed in the panel (from a file or a pasted list), or a pasted list as text.
    let parsed: { columns: string[]; rows: BroadcastRow[]; invalid: number; duplicates: number };
    if (Array.isArray(b.rows)) {
      const columns = (Array.isArray(b.columns) ? b.columns : []).slice(0, 12).map((c: unknown) => cleanCell(c).slice(0, 40));
      const seen = new Set<string>();
      const rows: BroadcastRow[] = [];
      let invalid = 0;
      let duplicates = 0;
      for (const r of b.rows.slice(0, MAX_ROWS)) {
        const phone = normalizePhone(String(r?.phone || ''));
        if (phone.length < 10 || phone.length > 15) {
          invalid++;
          continue;
        }
        if (seen.has(phone)) {
          duplicates++;
          continue;
        }
        seen.add(phone);
        rows.push({ phone, name: cleanCell(r?.name).slice(0, 80), cols: columns.map((_: string, j: number) => cleanCell(Array.isArray(r?.cols) ? r.cols[j] : '')), status: 'pending' });
      }
      parsed = { columns, rows, invalid, duplicates };
    } else parsed = parseList(String(b.list || ''));
    if (!parsed.rows.length) return fail('No hay clientes con celular en la lista.');
    const uid = sessionUserId();
    const me = uid ? await getUser(uid).catch(() => null) : null;
    const created = await createBroadcast({ name: String(b.name || ''), template: t, vars, image: t.imageHeader ? image : undefined, columns: parsed.columns, rows: parsed.rows }, me?.name || me?.email || null);
    return ok({ broadcast: created, invalid: parsed.invalid, duplicates: parsed.duplicates });
  } catch (e) {
    return failFrom(e);
  }
}
