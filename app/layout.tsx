import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-inter' });

// Favicon and Apple icon come from app/favicon.ico, app/icon.png and app/apple-icon.png.
export const metadata: Metadata = {
  title: 'LogiPages — Landings de alta conversión con IA',
  description:
    'Crea landing pages a partir de una foto, confirma pedidos contraentrega con llamadas de voz con IA y gestiona tus clientes en un CRM omnicanal.',
};

export const viewport: Viewport = {
  themeColor: '#ffffff',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={inter.variable}>
      <body className="antialiased min-h-screen bg-slate-50 text-slate-900 selection:bg-brand-red selection:text-white">
        {children}
      </body>
    </html>
  );
}
