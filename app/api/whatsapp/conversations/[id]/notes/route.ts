import { NextRequest, NextResponse } from 'next/server';
import { cloudEnabled } from '@/lib/server/db';
import { addNote, deleteNote, getNotes } from '@/lib/server/crm-store';

export const dynamic = 'force-dynamic';

const check = (id: string) =>
  !cloudEnabled()
    ? NextResponse.json({ success: false, error: 'La base de datos no está configurada.' }, { status: 503 })
    : !/^\d{6,20}$/.test(id)
      ? NextResponse.json({ success: false, error: 'Conversación no válida.' }, { status: 400 })
      : null;
const fail = (e: any) => NextResponse.json({ success: false, error: e?.message || String(e) }, { status: (e as any)?.status === 401 ? 401 : 500 });

// Admin: internal notes about a customer (never sent to them).
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const bad = check(params.id);
  if (bad) return bad;
  try {
    return NextResponse.json({ success: true, notes: await getNotes(params.id) });
  } catch (e) {
    return fail(e);
  }
}

// Body: { text }.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const bad = check(params.id);
  if (bad) return bad;
  try {
    const { text } = await req.json().catch(() => ({}));
    const clean = String(text ?? '').trim().slice(0, 1000);
    if (!clean) return NextResponse.json({ success: false, error: 'Escribe la nota.' }, { status: 400 });
    return NextResponse.json({ success: true, notes: await addNote(params.id, clean) });
  } catch (e) {
    return fail(e);
  }
}

// ?noteId=…
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const bad = check(params.id);
  if (bad) return bad;
  try {
    const noteId = req.nextUrl.searchParams.get('noteId') || '';
    return NextResponse.json({ success: true, notes: await deleteNote(params.id, noteId) });
  } catch (e) {
    return fail(e);
  }
}
