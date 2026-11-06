import type { MetadataRoute } from 'next';
import { appUrl } from '@/lib/env';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = appUrl();
  const now = new Date();
  return ['', '/privacidade', '/termos', '/termo-de-consentimento'].map((p) => ({
    url: `${base}${p}`,
    lastModified: now,
    changeFrequency: p === '' ? 'weekly' : 'monthly',
    priority: p === '' ? 1 : 0.4,
  }));
}
