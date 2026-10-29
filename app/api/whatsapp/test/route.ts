import { NextRequest, NextResponse } from 'next/server';
import { cloudEnabled } from '@/lib/server/db';
import { normalizePhone } from '@/lib/phone';
import { confirmTemplateEnabled, formatMoney, phoneNumberInfo, sendConfirmTemplate, sendHelloWorld, whatsappEnabled, whatsappStatus } from '@/lib/server/whatsapp';
import { TEST_ORDER_ID } from '@/lib/server/wa-actions';
import { recordOutbound } from '@/lib/server/wa-store';

export const dynamic = 'force-dynamic';

// Admin: connection check (number details straight from Meta).
export async function GET() {
  const status = whatsappStatus();
  if (!whatsappEnabled()) return NextResponse.json({ success: true, status, number: null });
  const r = await phoneNumberInfo();
  return NextResponse.json({ success: true, status, number: r.ok ? r.info : null, error: r.ok ? undefined : r.error });
}

// Admin: send a test message. Body: { phone, kind: 'hello' | 'confirm' }.
export async function POST(req: NextRequest) {
  if (!whatsappEnabled()) return NextResponse.json({ success: false, error: 'Faltan WHATSAPP_TOKEN o WHATSAPP_PHONE_NUMBER_ID.' }, { status: 503 });
  const { phone, kind } = await req.json().catch(() => ({}));
  const to = normalizePhone(String(phone || '').slice(0, 30));
  if (to.length < 10) return NextResponse.json({ success: false, error: 'Escribe tu número con indicativo, por ejemplo +57 300 123 4567.' }, { status: 400 });

  let result;
  let body: string;
  if (kind === 'confirm') {
    if (!confirmTemplateEnabled()) return NextResponse.json({ success: false, error: 'Falta WHATSAPP_CONFIRM_TEMPLATE (el nombre de tu plantilla).' }, { status: 400 });
    const vars = { name: 'Laura', product: 'Producto de prueba - 1 unidad', total: formatMoney(89900, 'COP'), city: 'Medellín' };
    result = await sendConfirmTemplate(to, vars, TEST_ORDER_ID);
    body = `Prueba de plantilla: ${vars.name}, ${vars.product}, ${vars.total}, ${vars.city}. [Confirmar pedido] [Cancelar]`;
  } else {
    result = await sendHelloWorld(to);
    body = 'Prueba: plantilla hello_world de Meta';
  }
  if (cloudEnabled()) await recordOutbound({ phone: to, type: 'template', body, result }).catch(() => {});
  if (!result.ok) return NextResponse.json({ success: false, error: `Meta respondió: ${result.error}` }, { status: 502 });
  return NextResponse.json({ success: true, messageId: result.messageId, to });
}
