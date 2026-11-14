import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE, cloudConfigured, verifySession } from '@/lib/auth';
import { getPlans } from '@/lib/server/billing';
import { signupOpen } from '@/lib/server/accounts';
import { DEFAULT_PLANS } from '@/lib/plans';
import SalesPage from '@/components/marketing/SalesPage';
import { operatorLine } from '@/lib/platform';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Konnexa · Landings y pedidos contraentrega con IA',
  description:
    'Landings con IA, un asistente que vende por WhatsApp, Messenger e Instagram, pedidos confirmados y listos para despachar, y la rentabilidad real de tus anuncios. Prueba 7 días gratis.',
  openGraph: {
    title: 'Konnexa · Vende contraentrega sin perder pedidos',
    description: 'Landings con IA, un asistente que vende por chat, pedidos confirmados y la rentabilidad de tus anuncios. 7 días gratis, sin tarjeta.',
    images: ['/brand/konnexa-logo.png'],
    locale: 'es_CO',
    type: 'website',
  },
};

// Signed-in people go straight to the panel; everyone else sees the sales page.
export default async function Home() {
  if (!cloudConfigured()) redirect('/dashboard'); // local demo without a database
  if (await verifySession(cookies().get(SESSION_COOKIE)?.value)) redirect('/dashboard');
  const plans = await getPlans().catch(() => DEFAULT_PLANS);
  const wa = (process.env.PLATFORM_WHATSAPP || '').replace(/\D/g, '');
  return (
    <SalesPage
      plans={plans}
      signupOpen={signupOpen()}
      contactUrl={wa ? `https://wa.me/${wa}?text=${encodeURIComponent('Hola, quiero probar Konnexa')}` : null}
      operator={operatorLine()}
    />
  );
}
