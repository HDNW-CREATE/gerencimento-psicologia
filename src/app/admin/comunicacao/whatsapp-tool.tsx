'use client';

import { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { NativeSelect, Textarea } from '@/components/ui/input';
import { Field } from '@/components/forms/field';
import { whatsappLink } from '@/lib/format';

const PRESETS = [
  {
    label: 'Lembrete de sessão',
    text: 'Olá, {nome}! Passando para lembrar da nossa sessão. Posso confirmar o seu horário?',
  },
  {
    label: 'Pagamento pendente',
    text: 'Olá, {nome}! Identifiquei um pagamento pendente referente à sua última sessão. Qualquer dúvida estou à disposição.',
  },
  {
    label: 'Remarcação',
    text: 'Olá, {nome}! Preciso conversar com você sobre uma remarcação. Quando puder, me responda por aqui.',
  },
];

/** Gera um link wa.me com mensagem pré-preenchida (nada é enviado automaticamente). */
export function WhatsAppTool({
  patients,
}: {
  patients: { id: string; name: string; phone: string }[];
}) {
  const [id, setId] = useState('');
  const [text, setText] = useState(PRESETS[0]!.text);
  const patient = patients.find((p) => p.id === id);
  const href = patient
    ? whatsappLink(patient.phone, text.replaceAll('{nome}', patient.name.split(' ')[0]!))
    : undefined;

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Lembrete manual por WhatsApp</CardTitle>
        <CardDescription>
          Abre o WhatsApp com a mensagem pronta. Você revisa e envia.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Field label="Paciente" htmlFor="wa-patient">
          <NativeSelect id="wa-patient" value={id} onChange={(e) => setId(e.target.value)}>
            <option value="">Selecione…</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Modelo" htmlFor="wa-preset">
          <NativeSelect
            id="wa-preset"
            onChange={(e) => setText(PRESETS[Number(e.target.value)]!.text)}
          >
            {PRESETS.map((p, i) => (
              <option key={p.label} value={i}>
                {p.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field
          label="Mensagem"
          htmlFor="wa-text"
          hint="{nome} é substituído pelo primeiro nome do paciente."
        >
          <Textarea
            id="wa-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="min-h-28"
          />
        </Field>
        <Button asChild disabled={!href}>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={!href}
            onClick={(e) => !href && e.preventDefault()}
          >
            <MessageCircle /> Abrir no WhatsApp
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
