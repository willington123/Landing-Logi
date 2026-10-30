import { NextRequest } from 'next/server';
import { createTemplate, deleteTemplate, listTemplates } from '@/lib/server/whatsapp';
import { updateIntegrations, waConfig } from '@/lib/server/integrations';
import { currentOrgId } from '@/lib/server/tenant';
import { Forbidden, requireManager } from '@/lib/server/integrations-api';
import { fail, failFrom, ok } from '@/lib/server/http';
import { CONFIRM_PRESET } from '@/lib/wa-templates';

export const dynamic = 'force-dynamic';

const userError = (e: any) => (e instanceof Forbidden ? fail(e.message, 403) : e?.status === 401 ? failFrom(e) : fail(e?.message || String(e), 400));

// List the store's WhatsApp templates (with Meta's review status).
export async function GET() {
  try {
    await currentOrgId();
    const c = await waConfig();
    return ok({ templates: await listTemplates(), confirmTemplate: c?.confirmTemplate || null, preset: CONFIRM_PRESET });
  } catch (e) {
    return userError(e);
  }
}

// Create a template. Body: { preset: 'confirm' } or { name, language, category, body, examples[], buttons[] }.
export async function POST(req: NextRequest) {
  try {
    await requireManager();
    const b = await req.json().catch(() => ({}));
    const t =
      b.preset === 'confirm'
        ? CONFIRM_PRESET
        : {
            name: String(b.name || '').trim().toLowerCase(),
            language: String(b.language || 'es').trim(),
            category: b.category === 'MARKETING' ? ('MARKETING' as const) : ('UTILITY' as const),
            body: String(b.body || '').trim(),
            examples: (Array.isArray(b.examples) ? b.examples : []).map((x: unknown) => String(x ?? '').trim()).slice(0, 10),
            buttons: (Array.isArray(b.buttons) ? b.buttons : []).map((x: unknown) => String(x ?? '').trim()).filter(Boolean).slice(0, 3),
          };
    if (!/^[a-z0-9_]{1,512}$/.test(t.name)) return fail('El nombre solo puede tener minúsculas, números y guion bajo (ej. confirmacion_pedido).');
    if (!/^[a-z]{2}(_[A-Z]{2})?$/.test(t.language)) return fail('Idioma no válido (ej. es o es_CO).');
    if (t.body.length < 5 || t.body.length > 1024) return fail('El texto debe tener entre 5 y 1024 caracteres.');
    const vars = Array.from(new Set((t.body.match(/\{\{(\d+)\}\}/g) || []).map((v) => v)));
    if (vars.length && t.examples.filter(Boolean).length < vars.length) return fail(`Escribe un ejemplo para cada variable ({{1}}…{{${vars.length}}}): Meta los pide para revisar la plantilla.`);
    if (t.buttons.some((x: string) => x.length > 25)) return fail('Cada botón puede tener máximo 25 caracteres.');
    const created = await createTemplate({ ...t, examples: t.examples.slice(0, vars.length) });
    // The preset becomes the store's confirmation template right away (it can be sent once Meta approves it).
    if (b.preset === 'confirm') {
      const c = await waConfig();
      if (c?.source === 'store') await updateIntegrations((s) => ({ ...s, whatsapp: { ...s.whatsapp!, confirmTemplate: t.name, templateLang: t.language } }));
    }
    return ok({ template: created });
  } catch (e) {
    return userError(e);
  }
}

// Delete a template by name (?name=).
export async function DELETE(req: NextRequest) {
  try {
    await requireManager();
    const name = req.nextUrl.searchParams.get('name') || '';
    if (!/^[a-z0-9_]{1,512}$/.test(name)) return fail('Nombre no válido.');
    await deleteTemplate(name);
    return ok();
  } catch (e) {
    return userError(e);
  }
}
