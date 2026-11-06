import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { ServicesManager } from './services-manager';

export const metadata: Metadata = { title: 'Serviços e valores' };

export default async function ServicesPage() {
  const services = await db.serviceType.findMany({
    where: { deletedAt: null },
    orderBy: { sortOrder: 'asc' },
  });
  return (
    <ServicesManager
      services={services.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description ?? '',
        durationMinutes: s.durationMinutes,
        priceCents: s.priceCents,
        allowsOnline: s.allowsOnline,
        allowsInPerson: s.allowsInPerson,
        isCouple: s.isCouple,
        showPrice: s.showPrice,
        showOnSite: s.showOnSite,
        active: s.active,
      }))}
    />
  );
}
