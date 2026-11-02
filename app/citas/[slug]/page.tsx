import type { Metadata } from 'next';
import BookingPage from '@/components/agenda/BookingPage';
import { cloudEnabled, getSettings } from '@/lib/server/db';
import { findBookingPage } from '@/lib/server/agenda';
import { runWithOrg } from '@/lib/server/tenant';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  try {
    if (!cloudEnabled()) return { title: 'Reserva tu cita' };
    const page = await findBookingPage(params.slug);
    if (!page) return { title: 'Reserva tu cita' };
    const name = (await runWithOrg(page.orgId, () => getSettings<{ storeName?: string }>()))?.storeName?.trim();
    const title = name ? `Reserva tu cita · ${name}` : 'Reserva tu cita';
    return { title, description: 'Elige el servicio, el día y la hora. Te confirmamos por WhatsApp.', openGraph: { title, type: 'website' } };
  } catch {
    return { title: 'Reserva tu cita' };
  }
}

// Public booking page of a business with appointments.
export default function Page({ params }: { params: { slug: string } }) {
  return <BookingPage slug={params.slug} />;
}
