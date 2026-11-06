import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { getSite } from '@/lib/settings';
import { SiteForm } from './site-form';
import { FaqManager } from './faq-manager';

export const metadata: Metadata = { title: 'Conteúdo do site' };

export default async function SiteSettingsPage() {
  const [site, faqs] = await Promise.all([
    getSite(),
    db.faq.findMany({ orderBy: { sortOrder: 'asc' } }),
  ]);
  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <SiteForm initial={site} />
      <FaqManager
        faqs={faqs.map((f) => ({
          id: f.id,
          question: f.question,
          answer: f.answer,
          published: f.published,
        }))}
      />
    </div>
  );
}
