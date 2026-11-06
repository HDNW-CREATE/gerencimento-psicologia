'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, NativeSelect } from '@/components/ui/input';
import { useServerAction } from '@/components/forms/use-action';
import { weekdayLabels } from '@/lib/format';
import { saveAvailabilityAction } from '@/server/actions/settings';

interface Interval {
  weekday: number;
  start: string;
  end: string;
  modality: 'PRESENCIAL' | 'ONLINE' | null;
}

const ORDER = [1, 2, 3, 4, 5, 6, 0]; // segunda → domingo

export function AvailabilityEditor({ initial }: { initial: Interval[] }) {
  const [rules, setRules] = useState<Interval[]>(initial);
  const { execute, pending } = useServerAction(saveAvailabilityAction);

  const update = (idx: number, patch: Partial<Interval>) =>
    setRules((r) => r.map((x, i) => (i === idx ? { ...x, ...patch } : x)));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Horários de atendimento</CardTitle>
        <CardDescription>
          Adicione quantos intervalos quiser por dia (ex.: manhã e tarde). Dias sem intervalo não
          aceitam agendamento.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {ORDER.map((weekday) => {
          const items = rules.map((r, i) => ({ r, i })).filter(({ r }) => r.weekday === weekday);
          return (
            <div key={weekday} className="space-y-2 border-b pb-4 last:border-0">
              <div className="flex items-center justify-between">
                <h3 className="font-sans text-sm font-semibold">{weekdayLabels[weekday]}</h3>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setRules((r) => [
                      ...r,
                      { weekday, start: '09:00', end: '12:00', modality: null },
                    ])
                  }
                >
                  <Plus /> Intervalo
                </Button>
              </div>
              {items.length === 0 && (
                <p className="text-xs text-muted-foreground">Sem atendimento</p>
              )}
              {items.map(({ r, i }) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <Input
                    type="time"
                    aria-label={`${weekdayLabels[weekday]} início`}
                    className="w-28"
                    value={r.start}
                    onChange={(e) => update(i, { start: e.target.value })}
                  />
                  <span aria-hidden>até</span>
                  <Input
                    type="time"
                    aria-label={`${weekdayLabels[weekday]} fim`}
                    className="w-28"
                    value={r.end}
                    onChange={(e) => update(i, { end: e.target.value })}
                  />
                  <NativeSelect
                    aria-label="Modalidade"
                    className="w-36"
                    value={r.modality ?? ''}
                    onChange={(e) =>
                      update(i, { modality: (e.target.value || null) as Interval['modality'] })
                    }
                  >
                    <option value="">Ambas</option>
                    <option value="PRESENCIAL">Presencial</option>
                    <option value="ONLINE">Online</option>
                  </NativeSelect>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Remover intervalo"
                    onClick={() => setRules((x) => x.filter((_, j) => j !== i))}
                  >
                    <Trash2 />
                  </Button>
                </div>
              ))}
            </div>
          );
        })}
        <Button loading={pending} onClick={() => execute({ rules })}>
          Salvar horários
        </Button>
      </CardContent>
    </Card>
  );
}
