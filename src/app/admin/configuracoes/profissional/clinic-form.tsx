'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Textarea } from '@/components/ui/input';
import { Field } from '@/components/forms/field';
import { useServerAction } from '@/components/forms/use-action';
import type { ClinicSettings } from '@/lib/settings';
import { saveClinicAction } from '@/server/actions/settings';
import { uploadClinicImageAction } from '@/server/actions/uploads';

function ImageUpload({
  kind,
  currentKey,
  label,
}: {
  kind: 'photo' | 'signature';
  currentKey: string;
  label: string;
}) {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const { execute, pending } = useServerAction(uploadClinicImageAction, {
    onSuccess: () => router.refresh(),
  });
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      {currentKey && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/public/${currentKey}`}
          alt={label}
          className="max-h-32 rounded-lg border bg-white object-contain p-1"
        />
      )}
      <input
        ref={ref}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        aria-label={`Selecionar ${label}`}
        className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-4 file:py-2.5 file:text-sm file:font-medium"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const fd = new FormData();
          fd.set('kind', kind);
          fd.set('file', file);
          execute(fd);
          if (ref.current) ref.current.value = '';
        }}
        disabled={pending}
      />
      <p className="text-xs text-muted-foreground">PNG, JPG ou WebP, até 2 MB.</p>
    </div>
  );
}

export function ClinicForm({ initial }: { initial: ClinicSettings }) {
  const [v, setV] = useState(initial);
  const { execute, pending } = useServerAction(saveClinicAction);
  const set =
    (k: keyof ClinicSettings) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setV({ ...v, [k]: e.target.value });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          execute(v);
        }}
      >
        <Card>
          <CardHeader>
            <CardTitle>Identificação</CardTitle>
            <CardDescription>Aparece no site, nos e-mails e nos recibos.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome do consultório" htmlFor="clinicName" className="sm:col-span-2">
              <Input id="clinicName" value={v.clinicName} onChange={set('clinicName')} />
            </Field>
            <Field label="Nome da psicóloga" htmlFor="professionalName">
              <Input
                id="professionalName"
                value={v.professionalName}
                onChange={set('professionalName')}
              />
            </Field>
            <Field label="CRP" htmlFor="crp">
              <Input id="crp" value={v.crp} onChange={set('crp')} placeholder="CRP 06/123456" />
            </Field>
            <Field label="CPF ou CNPJ (recibos)" htmlFor="document" className="sm:col-span-2">
              <Input id="document" value={v.document} onChange={set('document')} />
            </Field>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Contatos e endereço</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="E-mail de contato" htmlFor="email">
              <Input id="email" type="email" value={v.email} onChange={set('email')} />
            </Field>
            <Field label="Telefone" htmlFor="phone">
              <Input id="phone" value={v.phone} onChange={set('phone')} />
            </Field>
            <Field label="WhatsApp" htmlFor="whatsapp" hint="Com DDD, só números.">
              <Input id="whatsapp" value={v.whatsapp} onChange={set('whatsapp')} />
            </Field>
            <Field label="Instagram" htmlFor="instagram" hint="Ex.: @seuperfil">
              <Input id="instagram" value={v.instagram} onChange={set('instagram')} />
            </Field>
            <Field label="Endereço" htmlFor="addressLine" className="sm:col-span-2">
              <Input id="addressLine" value={v.addressLine} onChange={set('addressLine')} />
            </Field>
            <Field label="Cidade" htmlFor="city">
              <Input id="city" value={v.city} onChange={set('city')} />
            </Field>
            <Field label="UF" htmlFor="state">
              <Input id="state" maxLength={2} value={v.state} onChange={set('state')} />
            </Field>
            <Field label="CEP" htmlFor="zip">
              <Input id="zip" value={v.zip} onChange={set('zip')} />
            </Field>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recibo</CardTitle>
          </CardHeader>
          <CardContent>
            <Field label="Texto no rodapé do recibo" htmlFor="receiptFooter">
              <Textarea
                id="receiptFooter"
                value={v.receiptFooter}
                onChange={set('receiptFooter')}
                maxLength={400}
              />
            </Field>
          </CardContent>
        </Card>
        <Button type="submit" size="lg" loading={pending}>
          Salvar dados
        </Button>
      </form>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Imagens</CardTitle>
          <CardDescription>Salvas imediatamente ao selecionar o arquivo.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <ImageUpload
            kind="photo"
            currentKey={initial.photoKey}
            label="Foto da psicóloga (site)"
          />
          <ImageUpload
            kind="signature"
            currentKey={initial.signatureKey}
            label="Assinatura (recibos)"
          />
        </CardContent>
      </Card>
    </div>
  );
}
