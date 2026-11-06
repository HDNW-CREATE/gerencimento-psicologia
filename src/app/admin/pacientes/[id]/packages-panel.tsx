'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, NativeSelect } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useServerAction } from '@/components/forms/use-action';
import { fmtDate, formatBRL } from '@/lib/format';
import { packageBalance } from '@/lib/domain/policies';
import { parseMoneyToCents } from '@/lib/validators';
import { cancelPackageAction, createPackageAction } from '@/server/actions/finance';

interface Pkg {
  id: string;
  name: string;
  total: number;
  used: number;
  priceCents: number;
  cancelled: boolean;
  expiresAt: string | null;
  paymentStatus: string;
}

export function PackagesPanel({ patientId, packages }: { patientId: string; packages: Pkg[] }) {
  const router = useRouter();
  const [name, setName] = useState('Pacote 4 sessões');
  const [total, setTotal] = useState(4);
  const [price, setPrice] = useState('');
  const [validDays, setValidDays] = useState(90);
  const [paid, setPaid] = useState(false);
  const [method, setMethod] = useState('PIX');
  const [cancel, setCancel] = useState<Pkg | null>(null);

  const create = useServerAction(createPackageAction, { onSuccess: () => router.refresh() });
  const cancelAct = useServerAction(cancelPackageAction, {
    onSuccess: () => {
      setCancel(null);
      router.refresh();
    },
  });
  const cents = parseMoneyToCents(price);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pacotes de sessões</CardTitle>
        <CardDescription>
          Ex.: 4 sessões com desconto. As sessões consumidas do pacote não geram nova cobrança.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-2">
          {packages.length === 0 && (
            <li className="text-sm text-muted-foreground">Nenhum pacote.</li>
          )}
          {packages.map((k) => (
            <li key={k.id} className="rounded-lg border p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">
                  {k.name} · {formatBRL(k.priceCents)}
                </p>
                <div className="flex gap-1.5">
                  {k.cancelled ? (
                    <Badge variant="muted">Cancelado</Badge>
                  ) : (
                    <Badge variant="success">
                      Saldo: {packageBalance(k.total, k.used)} de {k.total}
                    </Badge>
                  )}
                  <Badge variant={k.paymentStatus === 'PAGO' ? 'success' : 'warning'}>
                    {k.paymentStatus === 'PAGO'
                      ? 'Pago'
                      : k.paymentStatus === 'ISENTO'
                        ? 'Isento'
                        : 'Pagamento pendente'}
                  </Badge>
                </div>
              </div>
              {k.expiresAt && (
                <p className="text-xs text-muted-foreground">Validade: {fmtDate(k.expiresAt)}</p>
              )}
              {!k.cancelled && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="mt-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setCancel(k)}
                >
                  Cancelar pacote
                </Button>
              )}
            </li>
          ))}
        </ul>

        <form
          className="space-y-3 rounded-lg bg-muted/50 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (cents === null) return;
            create.execute({
              patientId,
              name,
              totalSessions: total,
              priceCents: cents,
              validDays,
              paid,
              method: paid ? method : '',
            });
          }}
        >
          <p className="text-sm font-semibold">Vender novo pacote</p>
          <div className="space-y-1.5">
            <Label htmlFor="pk-name">Nome</Label>
            <Input id="pk-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pk-total">Sessões</Label>
              <Input
                id="pk-total"
                type="number"
                min={1}
                max={100}
                value={total}
                onChange={(e) => setTotal(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pk-price">Valor (R$)</Label>
              <Input
                id="pk-price"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="640,00"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pk-valid">Validade (dias)</Label>
              <Input
                id="pk-valid"
                type="number"
                min={0}
                value={validDays}
                onChange={(e) => setValidDays(Number(e.target.value))}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-[hsl(var(--primary))]"
              checked={paid}
              onChange={(e) => setPaid(e.target.checked)}
            />{' '}
            Já foi pago
          </label>
          {paid && (
            <NativeSelect
              aria-label="Forma de pagamento"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
            >
              <option value="PIX">Pix</option>
              <option value="DINHEIRO">Dinheiro</option>
              <option value="CARTAO">Cartão</option>
              <option value="TRANSFERENCIA">Transferência</option>
            </NativeSelect>
          )}
          <Button type="submit" loading={create.pending} disabled={cents === null}>
            Criar pacote
          </Button>
        </form>
      </CardContent>
      <ConfirmDialog
        open={!!cancel}
        onOpenChange={(o) => !o && setCancel(null)}
        destructive
        title="Cancelar este pacote?"
        description="Cobranças ainda pendentes do pacote ficam isentas. Valores já pagos permanecem registrados (reembolso é feito manualmente)."
        confirmLabel="Cancelar pacote"
        loading={cancelAct.pending}
        onConfirm={() => cancel && cancelAct.execute({ id: cancel.id })}
      />
    </Card>
  );
}
