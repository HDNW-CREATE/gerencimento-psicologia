import type { MetadataRoute } from 'next';
import { appUrl } from '@/lib/env';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin',
          '/paciente',
          '/api',
          '/entrar',
          '/cadastro',
          '/redefinir-senha',
          '/verificar-email',
          '/aceite-termos',
        ],
      },
    ],
    sitemap: `${appUrl()}/sitemap.xml`,
  };
}
