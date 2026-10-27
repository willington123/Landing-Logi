import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'LogiPages AI — Plataforma Inteligente de Ventas & Landings de Alta Conversión',
  description: 'Crea landing pages automáticamente a partir de una foto, confirma ventas con llamadas de voz con IA y gestiona clientes en un CRM omnicanal.',
  icons: {
    icon: '/brand/logipages-logo.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="antialiased min-h-screen bg-slate-50 text-slate-900 selection:bg-brand-red selection:text-white">
        {children}
      </body>
    </html>
  );
}
