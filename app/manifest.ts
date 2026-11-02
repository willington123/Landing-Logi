import type { MetadataRoute } from 'next';

// Lets phones install the panel as an app ("Agregar a pantalla de inicio"): own icon, full screen.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Konnexa',
    short_name: 'Konnexa',
    description: 'Tus pedidos, citas, mensajes de WhatsApp y anuncios en un solo lugar.',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f8fafc',
    theme_color: '#ffffff',
    lang: 'es',
    icons: [
      { src: '/pwa/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/pwa/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/pwa/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/pwa/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
