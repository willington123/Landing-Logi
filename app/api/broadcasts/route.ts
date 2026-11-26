import { NextRequest } from 'next/server';
import { currentOrgId } from '@/lib/server/tenant';
import { requireManager } from '@/lib/server/integrations-api';
import { createBroadcast, listBroadcasts, templateOptions } from '@/lib/server/broadcasts';
import { parseList, type VarSource } from '@/lib/broadcast';
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

// New send. Body: { name, template: { name, lang }, vars: VarSource[], image?, list (pasted text) }
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
    const parsed = parseList(String(b.list || ''));
    if (!parsed.rows.length) return fail('No encontramos números de celular en la lista.');
    const uid = sessionUserId();
    const me = uid ? await getUser(uid).catch(() => null) : null;
    const created = await createBroadcast({ name: String(b.name || ''), template: t, vars, image: t.imageHeader ? image : undefined, columns: parsed.columns, rows: parsed.rows }, me?.name || me?.email || null);
    return ok({ broadcast: created, invalid: parsed.invalid, duplicates: parsed.duplicates });
  } catch (e) {
    return failFrom(e);
  }
}
