import { NextRequest } from 'next/server';
import { db } from '@/lib/server/db';
import { currentOrgId } from '@/lib/server/tenant';
import { waConfig } from '@/lib/server/integrations';
import { getBotSettings } from '@/lib/server/bot';
import { failFrom, ok } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

// "Primeros pasos" on the dashboard: which setup steps this store has done.
export async function GET() {
  try {
    const orgId = await currentOrgId();
    const d = await db();
    const count = async (table: string) => {
      const { count: n } = await d.from(table).select('id', { count: 'exact', head: true });
      return n || 0;
    };
    const [landings, orders, wa, bot, saved] = await Promise.all([
      count('landings'),
      count('orders'),
      waConfig(orgId).catch(() => null),
      getBotSettings().catch(() => null),
      d.from('settings').select('data').eq('id', 'onboarding').maybeSingle(),
    ]);
    return ok({
      steps: {
        landing: landings > 0,
        whatsapp: Boolean(wa),
        confirmation: Boolean(wa?.confirmTemplate),
        assistant: Boolean(bot?.enabled),
        order: orders > 0,
      },
      dismissed: Boolean((saved.data?.data as { dismissed?: boolean } | null)?.dismissed),
    });
  } catch (e) {
    return failFrom(e);
  }
}

// Hide (or show again) the checklist. Body: { dismissed }.
export async function POST(req: NextRequest) {
  try {
    await currentOrgId();
    const { dismissed } = await req.json().catch(() => ({}));
    const { error } = await (await db()).from('settings').upsert({ id: 'onboarding', data: { dismissed: Boolean(dismissed) } });
    if (error) throw new Error(error.message);
    return ok();
  } catch (e) {
    return failFrom(e);
  }
}
