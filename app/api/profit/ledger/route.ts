import { NextRequest } from 'next/server';
import { cleanBudget, cleanContribution, cleanExpense, cleanPartner } from '@/lib/profit';
import { getLedger, requireProfitAccess, saveLedger } from '@/lib/server/profit';
import { sessionUserName } from '@/lib/server/profit-user';
import { fail, failFrom, ok } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

const LISTS = { expense: 'expenses', budget: 'budgets', partner: 'partners', contribution: 'contributions' } as const;
type Kind = keyof typeof LISTS;
const MAX = 5000;

// Add or change a gasto, presupuesto, socio or aporte. Body: { type, item }.
export async function POST(req: NextRequest) {
  try {
    await requireProfitAccess();
    const b = await req.json().catch(() => ({}));
    const type = b.type as Kind;
    if (!LISTS[type]) return fail('Tipo no válido.');
    const ledger = await getLedger();
    const clean =
      type === 'expense' ? cleanExpense(b.item, await sessionUserName()) : type === 'budget' ? cleanBudget(b.item) : type === 'partner' ? cleanPartner(b.item) : cleanContribution(b.item, ledger.partners);
    if (typeof clean === 'string') return fail(clean);
    const list = ledger[LISTS[type]] as { id: string }[];
    const i = list.findIndex((x) => x.id === clean.id);
    if (i >= 0) {
      // Keep who wrote it and when.
      const prev = list[i] as any;
      list[i] = { ...clean, ...(prev.createdAt ? { createdAt: prev.createdAt } : {}), ...('by' in prev ? { by: prev.by } : {}) };
    } else {
      if (list.length >= MAX) return fail('Llegaste al máximo de registros. Borra algunos antiguos.');
      list.push(clean);
    }
    await saveLedger(ledger);
    return ok({ item: i >= 0 ? list[i] : clean, ledger });
  } catch (e: any) {
    return failFrom(e);
  }
}

// ?type=…&id=…  A partner can't be deleted while it has contributions.
export async function DELETE(req: NextRequest) {
  try {
    await requireProfitAccess();
    const type = req.nextUrl.searchParams.get('type') as Kind;
    const id = req.nextUrl.searchParams.get('id') || '';
    if (!LISTS[type]) return fail('Tipo no válido.');
    const ledger = await getLedger();
    if (type === 'partner' && ledger.contributions.some((c) => c.partnerId === id)) return fail('Primero borra los aportes de este socio.');
    (ledger as any)[LISTS[type]] = (ledger[LISTS[type]] as { id: string }[]).filter((x) => x.id !== id);
    await saveLedger(ledger);
    return ok({ ledger });
  } catch (e: any) {
    return failFrom(e);
  }
}
