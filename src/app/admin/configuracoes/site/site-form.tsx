'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Textarea } from '@/components/ui/input';
import { Field } from '@/components/forms/field';
import { useServerAction } from '@/components/forms/use-action';
import type { SiteContent } from '@/lib/settings';
import { saveSiteAction } from '@/server/actions/settings';

export function SiteForm({ initial }: { initial: SiteContent }) {
  const [v, setV] = useState(initial);
  const [specialties, setSpecialties] = useState(initial.specialties.join('\n'));
  const { execute, pending } = useServerAction(saveSiteAction);
  const set =
    (k: keyof SiteContent) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setV({ ...v, [k]: e.target.value });

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        execute({
          ...v,
          specialties: specialties
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean),
        });
      }}
    >
      <Card>
        <CardHeader>
          <CardTitle>Página inicial</CardTitle>
          <CardDescription>
            Parágrafos são separados por uma linha em branco. A foto, o CRP e os contatos vêm de
            “Dados profissionais”.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Título principal" htmlFor="heroTitle">
            <Input id="heroTitle" value={v.heroTitle} onChange={set('heroTitle')} />
          </Field>
          <Field label="Subtítulo" htmlFor="heroSubtitle">
            <Textarea
              id="heroSubtitle"
              className="min-h-16"
              value={v.heroSubtitle}
              onChange={set('heroSubtitle')}
            />
          </Field>
          <Field label="Texto do botão" htmlFor="ctaLabel">
            <Input id="ctaLabel" value={v.ctaLabel} onChange={set('ctaLabel')} />
          </Field>
          <Field label="Título “Sobre”" htmlFor="aboutTitle">
            <Input id="aboutTitle" value={v.aboutTitle} onChange={set('aboutTitle')} />
          </Field>
          <Field label="Texto “Sobre”" htmlFor="aboutBody">
            <Textarea
              id="aboutBody"
              className="min-h-32"
              value={v.aboutBody}
              onChange={set('aboutBody')}
            />
          </Field>
          <Field label="Título da abordagem" htmlFor="approachTitle">
            <Input id="approachTitle" value={v.approachTitle} onChange={set('approachTitle')} />
          </Field>
          <Field label="Abordagem terapêutica" htmlFor="approachBody">
            <Textarea
              id="approachBody"
              className="min-h-24"
              value={v.approachBody}
              onChange={set('approachBody')}
            />
          </Field>
          <Field label="Especialidades (uma por linha)" htmlFor="specialties">
            <Textarea
              id="specialties"
              className="min-h-28"
              value={specialties}
              onChange={(e) => setSpecialties(e.target.value)}
            />
          </Field>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Serviços, valores e contato</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Introdução dos serviços" htmlFor="servicesIntro">
            <Input id="servicesIntro" value={v.servicesIntro} onChange={set('servicesIntro')} />
          </Field>
          <Field label="Observação sobre valores" htmlFor="pricingNote">
            <Input id="pricingNote" value={v.pricingNote} onChange={set('pricingNote')} />
          </Field>
          <Field label="Introdução do contato" htmlFor="contactIntro">
            <Input id="contactIntro" value={v.contactIntro} onChange={set('contactIntro')} />
          </Field>
          <Field
            label="Endereço para o mapa"
            htmlFor="mapsQuery"
            hint="Vazio = usa o endereço de “Dados profissionais”."
          >
            <Input id="mapsQuery" value={v.mapsQuery} onChange={set('mapsQuery')} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-[hsl(var(--primary))]"
              checked={v.showMap}
              onChange={(e) => setV({ ...v, showMap: e.target.checked })}
            />{' '}
            Exibir mapa
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-[hsl(var(--primary))]"
              checked={v.showFaq}
              onChange={(e) => setV({ ...v, showFaq: e.target.checked })}
            />{' '}
            Exibir perguntas frequentes
          </label>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Google (SEO)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Título da página" htmlFor="seoTitle">
            <Input id="seoTitle" value={v.seoTitle} maxLength={70} onChange={set('seoTitle')} />
          </Field>
          <Field label="Descrição" htmlFor="seoDescription" hint="Até ~160 caracteres.">
            <Textarea
              id="seoDescription"
              className="min-h-16"
              value={v.seoDescription}
              maxLength={200}
              onChange={set('seoDescription')}
            />
          </Field>
        </CardContent>
      </Card>
      <Button type="submit" size="lg" loading={pending}>
        Salvar conteúdo do site
      </Button>
    </form>
  );
}
