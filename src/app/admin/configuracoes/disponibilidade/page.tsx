import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { formatMinutes } from '@/lib/domain/time';
import { AvailabilityEditor } from './availability-editor';
import { BlocksManager } from './blocks-manager';

export const metadata: Metadata = { title: 'Horários de atendimento' };

export default async function AvailabilityPage() {
  const [rules, blocks] = await Promise.all([
    db.availabilityRule.findMany({ orderBy: [{ weekday: 'asc' }, { startMinute: 'asc' }] }),
    db.availabilityBlock.findMany({
      where: { endsAt: { gt: new Date() } },
      orderBy: { startsAt: 'asc' },
      take: 200,
    }),
  ]);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <AvailabilityEditor
        initial={rules.map((r) => ({
          weekday: r.weekday,
          start: formatMinutes(r.startMinute),
          end: formatMinutes(r.endMinute),
          modality: r.modality,
        }))}
      />
      <BlocksManager
        blocks={blocks.map((b) => ({
          id: b.id,
          startsAt: b.startsAt.toISOString(),
          endsAt: b.endsAt.toISOString(),
          reason: b.reason,
        }))}
      />
    </div>
  );
}
