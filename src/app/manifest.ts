import type { MetadataRoute } from 'next';

/** PWA: permite instalar o site na tela inicial do celular. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Consultório de Psicologia',
    short_name: 'Consultório',
    description: 'Agende e acompanhe suas sessões.',
    start_url: '/paciente',
    scope: '/',
    display: 'standalone',
    background_color: '#f8f5ef',
    theme_color: '#3f6554',
    lang: 'pt-BR',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      {
        src: '/icons/icon-512-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
