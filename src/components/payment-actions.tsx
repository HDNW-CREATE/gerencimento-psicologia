'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useServerAction } from '@/components/forms/use-action';
import { formatBRL } from '@/lib/format';
import { setPaymentAction } from '@/server/actions/finance';

interface Props {
  payment: {
    id: string;
    status: string;
    amountCents: number;
    method: string | null;
    notes: string | null;
  };
  label?: string;
  receiptHref?: string;
}

/** Botão + diálogo para registrar/alterar o pagamento manualmente. */
export function PaymentActions({ payment, label }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(payment.status);
  const [method, setMethod] = useState(payment.method ?? 'PIX');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState(payment.notes ?? '');
  const [amount, setAmount] = useState((payment.amountCents / 100).toFixed(2).replace('.', ','));
  const { execute, pending } = useServerAction(setPaymentAction, {
    onSuccess: () => {
      setOpen(false);
      router.refresh();
    },
  });

  const submit = () => {
    const cents = Math.round(Number(amount.replace(/\./g, '').replace(',', '.')) * 100);
    execute({
      id: payment.id,
      status,
      method: status === 'PAGO' ? method : '',
      paidYmd: status === 'PAGO' ? date : '',
      amountCents: Number.isFinite(cents) ? cents : undefined,
      notes,
    });
  };

  return (
    <>
      <Button
        size="sm"
        variant={payment.status === 'PENDENTE' ? 'default' : 'outline'}
        onClick={() => setOpen(true)}
      >
        {label ?? (payment.status === 'PENDENTE' ? 'Registrar pagamento' : 'Editar')}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pagamento – {formatBRL(payment.amountCents)}</DialogTitle>
            <DialogDescription>Controle manual de pagamentos.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`ps-${payment.id}`}>Situação</Label>
              <NativeSelect
                id={`ps-${payment.id}`}
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="PENDENTE">Pendente</option>
                <option value="PAGO">Pago</option>
                <option value="ISENTO">Isento</option>
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`pa-${payment.id}`}>Valor (R$)</Label>
              <Input
                id={`pa-${payment.id}`}
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            {status === 'PAGO' && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor={`pm-${payment.id}`}>Forma de pagamento</Label>
                  <NativeSelect
                    id={`pm-${payment.id}`}
                    value={method}
                    onChange={(e) => setMethod(e.target.value)}
                  >
                    <option value="PIX">Pix</option>
                    <option value="DINHEIRO">Dinheiro</option>
                    <option value="CARTAO">Cartão</option>
                    <option value="TRANSFERENCIA">Transferência</option>
                  </NativeSelect>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`pd-${payment.id}`}>Data do pagamento</Label>
                  <Input
                    id={`pd-${payment.id}`}
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>
              </>
            )}
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor={`pn-${payment.id}`}>Observação</Label>
              <Textarea
                id={`pn-${payment.id}`}
                value={notes}
                maxLength={300}
                className="min-h-16"
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button loading={pending} onClick={submit}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
