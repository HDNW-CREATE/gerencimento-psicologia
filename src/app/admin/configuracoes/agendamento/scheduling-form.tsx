'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/forms/field';
import { useServerAction } from '@/components/forms/use-action';
import { parseMoneyToCents } from '@/lib/validators';
import { formatBRL } from '@/lib/format';
import type { SchedulingSettings } from '@/lib/settings';
import { saveSchedulingAction } from '@/server/actions/settings';

function Check({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label htmlFor={id} className="flex items-start gap-3 rounded-lg border p-3">
      <input
        id={id}
        type="checkbox"
        className="mt-1 size-5 accent-[hsl(var(--primary))]"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </span>
    </label>
  );
}

export function SchedulingForm({ initial }: { initial: SchedulingSettings }) {
  const [v, setV] = useState(initial);
  const [price, setPrice] = useState(
    (initial.defaultPriceCents / 100).toFixed(2).replace('.', ','),
  );
  const { execute, pending, fieldErrors } = useServerAction(saveSchedulingAction);
  const num = (k: keyof SchedulingSettings) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setV({ ...v, [k]: Number(e.target.value) });
  const bool = (k: keyof SchedulingSettings) => (c: boolean) => setV({ ...v, [k]: c });
  const priceCents = parseMoneyToCents(price);

  return (
    <form
      className="grid gap-6 lg:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        execute({ ...v, defaultPriceCents: priceCents ?? v.defaultPriceCents });
      }}
    >
      <Card>
        <CardHeader>
          <CardTitle>Sessões e prazos</CardTitle>
          <CardDescription>
            Regras aplicadas aos agendamentos feitos pelos pacientes.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Duração padrão (min)" htmlFor="dur">
            <Input
              id="dur"
              type="number"
              min={10}
              max={240}
              value={v.defaultDurationMinutes}
              onChange={num('defaultDurationMinutes')}
            />
          </Field>
          <Field label="Intervalo entre sessões (min)" htmlFor="gap">
            <Input
              id="gap"
              type="number"
              min={0}
              max={120}
              value={v.gapMinutes}
              onChange={num('gapMinutes')}
            />
          </Field>
          <Field
            label="Início dos horários a cada (min)"
            htmlFor="step"
            hint="Ex.: 60 = 09:00, 10:00, 11:00…"
          >
            <Input
              id="step"
              type="number"
              min={10}
              max={240}
              value={v.stepMinutes}
              onChange={num('stepMinutes')}
            />
          </Field>
          <Field label="Antecedência mínima p/ agendar (h)" htmlFor="adv">
            <Input
              id="adv"
              type="number"
              min={0}
              value={v.minAdvanceHours}
              onChange={num('minAdvanceHours')}
            />
          </Field>
          <Field label="Prazo p/ cancelar/remarcar (h)" htmlFor="canc">
            <Input
              id="canc"
              type="number"
              min={0}
              value={v.minCancelHours}
              onChange={num('minCancelHours')}
            />
          </Field>
          <Field label="Agendar até (dias à frente)" htmlFor="hor">
            <Input
              id="hor"
              type="number"
              min={1}
              max={365}
              value={v.maxAdvanceDays}
              onChange={num('maxAdvanceDays')}
            />
          </Field>
          <Field label="Sessões futuras por paciente" htmlFor="maxf" hint="0 = sem limite">
            <Input
              id="maxf"
              type="number"
              min={0}
              max={50}
              value={v.maxFutureAppointments}
              onChange={num('maxFutureAppointments')}
            />
          </Field>
          <Field label="Link aparece (min antes)" htmlFor="lnk">
            <Input
              id="lnk"
              type="number"
              min={0}
              max={120}
              value={v.meetingLinkMinutesBefore}
              onChange={num('meetingLinkMinutesBefore')}
            />
          </Field>
          <div className="sm:col-span-2">
            <Check
              id="manual"
              label="Aprovação manual dos agendamentos"
              hint="Se ligado, o paciente vê “aguardando confirmação” até você aprovar."
              checked={v.manualApproval}
              onChange={bool('manualApproval')}
            />
          </div>
          <div className="sm:col-span-2">
            <Check
              id="noshow"
              label="Cobrar falta sem aviso"
              hint="Se desligado, sessões marcadas como “falta” ficam isentas de cobrança."
              checked={v.noShowCharged}
              onChange={bool('noShowCharged')}
            />
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Atendimento online e valores</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field
              label="Link padrão de videochamada"
              htmlFor="meet"
              error={fieldErrors.defaultMeetingUrl?.[0]}
              hint="Usado quando a sessão não tem um link próprio."
            >
              <Input
                id="meet"
                type="url"
                placeholder="https://meet.google.com/…"
                value={v.defaultMeetingUrl}
                onChange={(e) => setV({ ...v, defaultMeetingUrl: e.target.value })}
              />
            </Field>
            <Field
              label="Valor padrão da sessão (R$)"
              htmlFor="price"
              hint={priceCents !== null ? formatBRL(priceCents) : 'Valor inválido'}
            >
              <Input
                id="price"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </Field>
            <Check
              id="showp"
              label="Exibir valores no site público"
              checked={v.showPricesOnSite}
              onChange={bool('showPricesOnSite')}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Lembretes automáticos por e-mail</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Check
              id="rem"
              label="Enviar lembretes"
              checked={v.remindersEnabled}
              onChange={bool('remindersEnabled')}
            />
            <Check
              id="r24"
              label="24 horas antes"
              checked={v.reminder24h}
              onChange={bool('reminder24h')}
            />
            <Check
              id="r2"
              label="2 horas antes"
              checked={v.reminder2h}
              onChange={bool('reminder2h')}
            />
            <Check
              id="rpay"
              label="Avisar sobre pagamentos pendentes"
              hint="Envia um aviso semanal para pagamentos em atraso."
              checked={v.paymentReminders}
              onChange={bool('paymentReminders')}
            />
          </CardContent>
        </Card>

        <Button type="submit" size="lg" loading={pending} className="w-full">
          Salvar configurações
        </Button>
      </div>
    </form>
  );
}
