'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Textarea } from '@/components/ui/input';
import { Field } from '@/components/forms/field';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useServerAction } from '@/components/forms/use-action';
import { Badge } from '@/components/ui/badge';
import { formatBRL } from '@/lib/format';
import { parseMoneyToCents } from '@/lib/validators';
import { deleteServiceAction, saveServiceAction } from '@/server/actions/settings';

interface Service {
  id?: string;
  name: string;
  description: string;
  durationMinutes: number;
  priceCents: number;
  allowsOnline: boolean;
  allowsInPerson: boolean;
  isCouple: boolean;
  showPrice: boolean;
  showOnSite: boolean;
  active: boolean;
}

const EMPTY: Service = {
  name: '',
  description: '',
  durationMinutes: 50,
  priceCents: 20000,
  allowsOnline: true,
  allowsInPerson: true,
  isCouple: false,
  showPrice: true,
  showOnSite: true,
  active: true,
};

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        className="size-4 accent-[hsl(var(--primary))]"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}

function ServiceCard({ initial, onDone }: { initial: Service; onDone: () => void }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [price, setPrice] = useState((initial.priceCents / 100).toFixed(2).replace('.', ','));
  const [del, setDel] = useState(false);
  const save = useServerAction(saveServiceAction, {
    onSuccess: () => {
      router.refresh();
      onDone();
    },
  });
  const remove = useServerAction(deleteServiceAction, {
    onSuccess: () => {
      setDel(false);
      router.refresh();
    },
  });
  const cents = parseMoneyToCents(price);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>{initial.id ? initial.name : 'Novo serviço'}</CardTitle>
        <div className="flex gap-2">
          {!v.active && <Badge variant="muted">Inativo</Badge>}
          {initial.id && <Badge variant="secondary">{formatBRL(initial.priceCents)}</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Nome" htmlFor={`n-${initial.id ?? 'new'}`} className="sm:col-span-3">
            <Input
              id={`n-${initial.id ?? 'new'}`}
              value={v.name}
              onChange={(e) => setV({ ...v, name: e.target.value })}
            />
          </Field>
          <Field label="Duração (min)" htmlFor={`d-${initial.id ?? 'new'}`}>
            <Input
              id={`d-${initial.id ?? 'new'}`}
              type="number"
              min={10}
              max={240}
              value={v.durationMinutes}
              onChange={(e) => setV({ ...v, durationMinutes: Number(e.target.value) })}
            />
          </Field>
          <Field
            label="Valor (R$)"
            htmlFor={`p-${initial.id ?? 'new'}`}
            hint={cents === null ? 'Valor inválido' : undefined}
          >
            <Input
              id={`p-${initial.id ?? 'new'}`}
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </Field>
        </div>
        <Field label="Descrição (aparece no site)" htmlFor={`desc-${initial.id ?? 'new'}`}>
          <Textarea
            id={`desc-${initial.id ?? 'new'}`}
            value={v.description}
            maxLength={300}
            onChange={(e) => setV({ ...v, description: e.target.value })}
            className="min-h-16"
          />
        </Field>
        <div className="grid gap-2 sm:grid-cols-3">
          <Toggle
            label="Presencial"
            checked={v.allowsInPerson}
            onChange={(c) => setV({ ...v, allowsInPerson: c })}
          />
          <Toggle
            label="Online"
            checked={v.allowsOnline}
            onChange={(c) => setV({ ...v, allowsOnline: c })}
          />
          <Toggle
            label="Sessão de casal"
            checked={v.isCouple}
            onChange={(c) => setV({ ...v, isCouple: c })}
          />
          <Toggle
            label="Exibir no site"
            checked={v.showOnSite}
            onChange={(c) => setV({ ...v, showOnSite: c })}
          />
          <Toggle
            label="Exibir valor no site"
            checked={v.showPrice}
            onChange={(c) => setV({ ...v, showPrice: c })}
          />
          <Toggle
            label="Ativo para agendamento"
            checked={v.active}
            onChange={(c) => setV({ ...v, active: c })}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            loading={save.pending}
            disabled={cents === null || !v.name}
            onClick={() =>
              save.execute({
                ...v,
                id: initial.id,
                priceCents: cents ?? 0,
                description: v.description || undefined,
              })
            }
          >
            Salvar
          </Button>
          {initial.id && (
            <Button
              variant="ghost"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setDel(true)}
            >
              Remover
            </Button>
          )}
        </div>
      </CardContent>
      <ConfirmDialog
        open={del}
        onOpenChange={setDel}
        destructive
        title="Remover este serviço?"
        description="Ele deixará de aparecer para agendamento. As sessões já realizadas continuam no histórico."
        confirmLabel="Remover"
        loading={remove.pending}
        onConfirm={() => initial.id && remove.execute({ id: initial.id })}
      />
    </Card>
  );
}

export function ServicesManager({ services }: { services: (Service & { id: string })[] }) {
  const [adding, setAdding] = useState(false);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {services.map((s) => (
        <ServiceCard key={s.id} initial={s} onDone={() => undefined} />
      ))}
      {adding ? (
        <ServiceCard initial={EMPTY} onDone={() => setAdding(false)} />
      ) : (
        <Button
          variant="outline"
          className="h-auto min-h-24 border-dashed"
          onClick={() => setAdding(true)}
        >
          <Plus /> Adicionar serviço
        </Button>
      )}
    </div>
  );
}
