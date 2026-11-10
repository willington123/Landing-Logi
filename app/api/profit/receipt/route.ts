import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { downloadFile, signedUpload } from '@/lib/server/db';
import { getLedger, requireProfitAccess } from '@/lib/server/profit';
import { fail, failFrom, ok } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'application/pdf': 'pdf' };
const MAX_MB = 8;

// Step 1 of attaching a comprobante: a link the browser uploads the file to. Body: { mime, size }.
// Saved under an unguessable name and only served through GET below (owner and admins of the store).
export async function POST(req: NextRequest) {
  try {
    const org = await requireProfitAccess();
    const b = await req.json().catch(() => ({}));
    const mime = String(b.mime || '').split(';')[0].toLowerCase();
    if (!EXT[mime]) return fail('El comprobante debe ser una foto (JPG, PNG, WEBP) o un PDF.');
    if ((Number(b.size) || 0) > MAX_MB * 1024 * 1024) return fail(`El comprobante pesa más de ${MAX_MB} MB.`);
    const up = await signedUpload(`receipts/${org}/${randomUUID().replace(/-/g, '')}.${EXT[mime]}`);
    return ok(up);
  } catch (e: any) {
    return failFrom(e);
  }
}

// ?path=receipts/<org>/<file>  Only files of this store that a gasto or aporte points to.
export async function GET(req: NextRequest) {
  try {
    const org = await requireProfitAccess();
    const path = req.nextUrl.searchParams.get('path') || '';
    if (!path.startsWith(`receipts/${org}/`)) return fail('Comprobante no válido.', 404);
    const ledger = await getLedger();
    const r = [...ledger.expenses, ...ledger.contributions].map((x) => x.receipt).find((x) => x?.path === path);
    if (!r) return fail('Comprobante no encontrado.', 404);
    const data = await downloadFile(path);
    const ext = path.split('.').pop() || '';
    const type = Object.entries(EXT).find(([, e]) => e === ext)?.[0] || 'application/octet-stream';
    return new NextResponse(new Uint8Array(data), {
      headers: {
        'Content-Type': type,
        'Content-Disposition': `inline; filename="${r.name.replace(/[^\w.\- ]+/g, '_')}"`,
        'Cache-Control': 'private, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
        // Photos can't run anything; PDFs need the browser's viewer, which a sandbox would block.
        ...(type === 'application/pdf' ? {} : { 'Content-Security-Policy': "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox" }),
      },
    });
  } catch (e: any) {
    return failFrom(e);
  }
}
