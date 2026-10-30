import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE, cloudConfigured, verifySession } from '@/lib/auth';
import { getPlans } from '@/lib/server/billing';
import { signupOpen } from '@/lib/server/accounts';
import { DEFAULT_PLANS } from '@/lib/plans';
import SalesPage from '@/components/marketing/SalesPage';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'LogiPages · Landings y pedidos contraentrega con IA',
  description:
    'Crea landings con IA a partir de una foto, confirma pedidos contraentrega por WhatsApp y con llamadas de IA, y vende por chat con un asistente. Prueba 7 días gratis.',
  openGraph: {
    title: 'LogiPages · Vende contraentrega sin perder pedidos',
    description: 'Landings con IA, confirmación por WhatsApp y llamadas con IA, y un asistente que vende por chat. 7 días gratis, sin tarjeta.',
    images: ['/brand/logipages-logo.png'],
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
      contactUrl={wa ? `https://wa.me/${wa}?text=${encodeURIComponent('Hola, quiero probar LogiPages')}` : null}
    />
  );
}
