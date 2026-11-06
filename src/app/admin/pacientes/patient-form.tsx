'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { Field } from '@/components/forms/field';
import { useServerAction } from '@/components/forms/use-action';
import { createPatientAction, updatePatientAction } from '@/server/actions/patients';

export interface PatientFormValues {
  fullName: string;
  socialName: string;
  email: string;
  phone: string;
  birthDate: string;
  cpf: string;
  status: 'ATIVO' | 'INATIVO' | 'ALTA';
  guardianName: string;
  guardianCpf: string;
  guardianPhone: string;
  guardianEmail: string;
  guardianRelation: string;
  emergencyName: string;
  emergencyPhone: string;
  emergencyRelation: string;
  partnerName: string;
  partnerPhone: string;
  partnerEmail: string;
  adminNotes: string;
  tags: string;
  customPrice: string;
}

export const EMPTY_PATIENT: PatientFormValues = {
  fullName: '',
  socialName: '',
  email: '',
  phone: '',
  birthDate: '',
  cpf: '',
  status: 'ATIVO',
  guardianName: '',
  guardianCpf: '',
  guardianPhone: '',
  guardianEmail: '',
  guardianRelation: '',
  emergencyName: '',
  emergencyPhone: '',
  emergencyRelation: '',
  partnerName: '',
  partnerPhone: '',
  partnerEmail: '',
  adminNotes: '',
  tags: '',
  customPrice: '',
};

export function PatientForm({
  patientId,
  initial,
}: {
  patientId?: string;
  initial: PatientFormValues;
}) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const create = useServerAction(createPatientAction, {
    onSuccess: (r) => router.push(`/admin/pacientes/${r.data?.id ?? ''}`),
  });
  const update = useServerAction(updatePatientAction, { onSuccess: () => router.refresh() });
  const action = patientId ? update : create;
  const err = (k: string) => action.fieldErrors[k]?.[0];
  const set =
    (k: keyof PatientFormValues) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setV({ ...v, [k]: e.target.value });

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (patientId) update.execute({ ...v, id: patientId });
        else create.execute(v);
      }}
    >
      <Card>
        <CardHeader>
          <CardTitle>Dados cadastrais</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Nome completo"
            htmlFor="fullName"
            required
            error={err('fullName')}
            className="sm:col-span-2"
          >
            <Input id="fullName" value={v.fullName} onChange={set('fullName')} required />
          </Field>
          <Field label="Nome social" htmlFor="socialName">
            <Input id="socialName" value={v.socialName} onChange={set('socialName')} />
          </Field>
          <Field label="Situação" htmlFor="status">
            <NativeSelect id="status" value={v.status} onChange={set('status')}>
              <option value="ATIVO">Ativo</option>
              <option value="INATIVO">Inativo</option>
              <option value="ALTA">Alta</option>
            </NativeSelect>
          </Field>
          <Field label="E-mail" htmlFor="email" error={err('email')}>
            <Input id="email" type="email" value={v.email} onChange={set('email')} />
          </Field>
          <Field label="Telefone / WhatsApp" htmlFor="phone" error={err('phone')}>
            <Input id="phone" type="tel" value={v.phone} onChange={set('phone')} />
          </Field>
          <Field label="Data de nascimento" htmlFor="birthDate" error={err('birthDate')}>
            <Input id="birthDate" type="date" value={v.birthDate} onChange={set('birthDate')} />
          </Field>
          <Field label="CPF" htmlFor="cpf" error={err('cpf')}>
            <Input id="cpf" inputMode="numeric" value={v.cpf} onChange={set('cpf')} />
          </Field>
          <Field
            label="Valor personalizado por sessão (R$)"
            htmlFor="customPrice"
            error={err('customPrice')}
            hint="Vazio = usa o valor do serviço."
            className="sm:col-span-2"
          >
            <Input
              id="customPrice"
              inputMode="decimal"
              value={v.customPrice}
              onChange={set('customPrice')}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Responsável legal</CardTitle>
          <CardDescription>Obrigatório para menores de 18 anos.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome" htmlFor="guardianName">
            <Input id="guardianName" value={v.guardianName} onChange={set('guardianName')} />
          </Field>
          <Field label="Parentesco" htmlFor="guardianRelation">
            <Input
              id="guardianRelation"
              value={v.guardianRelation}
              onChange={set('guardianRelation')}
            />
          </Field>
          <Field label="CPF" htmlFor="guardianCpf" error={err('guardianCpf')}>
            <Input
              id="guardianCpf"
              inputMode="numeric"
              value={v.guardianCpf}
              onChange={set('guardianCpf')}
            />
          </Field>
          <Field label="Telefone" htmlFor="guardianPhone" error={err('guardianPhone')}>
            <Input
              id="guardianPhone"
              type="tel"
              value={v.guardianPhone}
              onChange={set('guardianPhone')}
            />
          </Field>
          <Field
            label="E-mail"
            htmlFor="guardianEmail"
            error={err('guardianEmail')}
            className="sm:col-span-2"
          >
            <Input
              id="guardianEmail"
              type="email"
              value={v.guardianEmail}
              onChange={set('guardianEmail')}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contato de emergência</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Field label="Nome" htmlFor="emergencyName">
            <Input id="emergencyName" value={v.emergencyName} onChange={set('emergencyName')} />
          </Field>
          <Field label="Telefone" htmlFor="emergencyPhone" error={err('emergencyPhone')}>
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
          <CardTitle>Terapia de casal</CardTitle>
          <CardDescription>Dados do(a) parceiro(a), quando houver.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Field label="Nome" htmlFor="partnerName">
            <Input id="partnerName" value={v.partnerName} onChange={set('partnerName')} />
          </Field>
          <Field label="Telefone" htmlFor="partnerPhone" error={err('partnerPhone')}>
            <Input
              id="partnerPhone"
              type="tel"
              value={v.partnerPhone}
              onChange={set('partnerPhone')}
            />
          </Field>
          <Field label="E-mail" htmlFor="partnerEmail" error={err('partnerEmail')}>
            <Input
              id="partnerEmail"
              type="email"
              value={v.partnerEmail}
              onChange={set('partnerEmail')}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Observações administrativas</CardTitle>
          <CardDescription>
            Uso administrativo (ex.: preferência de horário).{' '}
            <strong>Não escreva conteúdo clínico aqui</strong> – isso vai no prontuário, que é
            criptografado.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Tags (separadas por vírgula)" htmlFor="tags">
            <Input
              id="tags"
              value={v.tags}
              onChange={set('tags')}
              placeholder="indicação, convênio"
            />
          </Field>
          <Field label="Observações" htmlFor="adminNotes">
            <Textarea
              id="adminNotes"
              value={v.adminNotes}
              onChange={set('adminNotes')}
              maxLength={2000}
            />
          </Field>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button type="submit" size="lg" loading={action.pending}>
          {patientId ? 'Salvar alterações' : 'Cadastrar paciente'}
        </Button>
      </div>
    </form>
  );
}
