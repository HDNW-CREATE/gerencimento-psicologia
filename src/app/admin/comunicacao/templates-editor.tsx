'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { Field } from '@/components/forms/field';
import { useServerAction } from '@/components/forms/use-action';
import { saveEmailTemplateAction } from '@/server/actions/settings';

interface Template {
  key: string;
  name: string;
  subject: string;
  body: string;
  active: boolean;
}

export function TemplatesEditor({ templates }: { templates: Template[] }) {
  const [key, setKey] = useState(templates[0]?.key ?? '');
  const current = templates.find((t) => t.key === key);
  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle>Modelos de e-mail</CardTitle>
        <CardDescription>
          Variáveis:{' '}
          {
            '{{nome}} {{data}} {{hora}} {{servico}} {{modalidade}} {{local}} {{link_sessao}} {{link}} {{valor}} {{motivo}} {{consultorio}} {{profissional}}'
          }
          . Para um botão, use uma linha: {'[[Texto do botão|{{link}}]]'}. Use **negrito** e linhas
          em branco para parágrafos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Field label="Modelo" htmlFor="tpl-key">
          <NativeSelect id="tpl-key" value={key} onChange={(e) => setKey(e.target.value)}>
            {templates.map((t) => (
              <option key={t.key} value={t.key}>
                {t.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        {current && <TemplateForm key={current.key} template={current} />}
      </CardContent>
    </Card>
  );
}

function TemplateForm({ template }: { template: Template }) {
  const [subject, setSubject] = useState(template.subject);
  const [body, setBody] = useState(template.body);
  const [active, setActive] = useState(template.active);
  const { execute, pending } = useServerAction(saveEmailTemplateAction);
  return (
    <div className="space-y-4">
      <Field label="Assunto" htmlFor="tpl-subject">
        <Input id="tpl-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
      </Field>
      <Field label="Mensagem" htmlFor="tpl-body">
        <Textarea
          id="tpl-body"
          className="min-h-72 font-mono text-sm"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-4 accent-[hsl(var(--primary))]"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
        />{' '}
        Modelo ativo (desmarque para parar de enviar este e-mail)
      </label>
      <Button
        loading={pending}
        onClick={() => execute({ key: template.key, subject, body, active })}
      >
        Salvar modelo
      </Button>
    </div>
  );
}
