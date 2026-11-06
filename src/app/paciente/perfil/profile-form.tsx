'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/forms/field';
import { useServerAction } from '@/components/forms/use-action';
import { updateMyProfileAction } from '@/server/actions/profile';

interface Values {
  socialName: string;
  phone: string;
  emergencyName: string;
  emergencyPhone: string;
  emergencyRelation: string;
  guardianName: string;
  guardianCpf: string;
  guardianPhone: string;
  notifyReminders: boolean;
  notifyPayments: boolean;
  notifyAnnouncements: boolean;
}

export function ProfileForm({ initial }: { initial: Values }) {
  const [v, setV] = useState(initial);
  const { execute, pending, fieldErrors } = useServerAction(updateMyProfileAction);
  const set = (k: keyof Values) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setV({ ...v, [k]: e.target.value });
  const chk =
    (k: 'notifyReminders' | 'notifyPayments' | 'notifyAnnouncements') =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setV({ ...v, [k]: e.target.checked });

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        execute(v);
      }}
    >
      <Card>
        <CardHeader>
          <CardTitle>Contato</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome social" htmlFor="socialName">
            <Input id="socialName" value={v.socialName} onChange={set('socialName')} />
          </Field>
          <Field label="Telefone / WhatsApp" htmlFor="phone" error={fieldErrors.phone?.[0]}>
            <Input id="phone" type="tel" value={v.phone} onChange={set('phone')} />
          </Field>
          <Field label="Contato de emergência" htmlFor="emergencyName">
            <Input id="emergencyName" value={v.emergencyName} onChange={set('emergencyName')} />
          </Field>
          <Field
            label="Telefone do contato"
            htmlFor="emergencyPhone"
            error={fieldErrors.emergencyPhone?.[0]}
          >
            <Input
              id="emergencyPhone"
              type="tel"
              value={v.emergencyPhone}
              onChange={set('emergencyPhone')}
            />
          </Field>
          <Field label="Parentesco" htmlFor="emergencyRelation">
            <Input
              id="emergencyRelation"
              value={v.emergencyRelation}
              onChange={set('emergencyRelation')}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Responsável legal (menores de idade)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome" htmlFor="guardianName">
            <Input id="guardianName" value={v.guardianName} onChange={set('guardianName')} />
          </Field>
          <Field label="CPF" htmlFor="guardianCpf" error={fieldErrors.guardianCpf?.[0]}>
            <Input
              id="guardianCpf"
              inputMode="numeric"
              value={v.guardianCpf}
              onChange={set('guardianCpf')}
            />
          </Field>
          <Field label="Telefone" htmlFor="guardianPhone" error={fieldErrors.guardianPhone?.[0]}>
            <Input
              id="guardianPhone"
              type="tel"
              value={v.guardianPhone}
              onChange={set('guardianPhone')}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notificações por e-mail</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Mensagens essenciais (confirmação, remarcação, cancelamento e senha) sempre são
            enviadas.
          </p>
          {(
            [
              ['notifyReminders', 'Lembretes de sessão (24h e 2h antes)'],
              ['notifyPayments', 'Avisos de pagamento pendente'],
              ['notifyAnnouncements', 'Avisos e comunicados do consultório'],
            ] as const
          ).map(([k, label]) => (
            <label key={k} className="flex items-center gap-3">
              <input
                type="checkbox"
                className="size-5 accent-[hsl(var(--primary))]"
                checked={v[k]}
                onChange={chk(k)}
              />
              {label}
            </label>
          ))}
        </CardContent>
      </Card>

      <Button type="submit" size="lg" loading={pending}>
        Salvar perfil
      </Button>
    </form>
  );
}
