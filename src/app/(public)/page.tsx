import type { Metadata } from 'next';
import Link from 'next/link';
import { AtSign, Mail, MapPin, MessageCircle, Phone, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/db';
import { appUrl } from '@/lib/env';
import { formatBRL, maskPhone, whatsappLink } from '@/lib/format';
import { getClinic, getScheduling, getSite } from '@/lib/settings';

export async function generateMetadata(): Promise<Metadata> {
  const [site, clinic] = await Promise.all([getSite(), getClinic()]);
  const image = clinic.photoKey ? `/api/public/${clinic.photoKey}` : undefined;
  return {
    title: { absolute: site.seoTitle },
    description: site.seoDescription,
    alternates: { canonical: '/' },
    openGraph: {
      title: site.seoTitle,
      description: site.seoDescription,
      type: 'website',
      locale: 'pt_BR',
      url: '/',
      images: image ? [image] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: site.seoTitle,
      description: site.seoDescription,
    },
  };
}

const paragraphs = (t: string) =>
  t
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

export default async function HomePage() {
  const [site, clinic, scheduling, services, faqs] = await Promise.all([
    getSite(),
    getClinic(),
    getScheduling(),
    db.serviceType.findMany({
      where: { active: true, deletedAt: null, showOnSite: true },
      orderBy: { sortOrder: 'asc' },
    }),
    db.faq.findMany({ where: { published: true }, orderBy: { sortOrder: 'asc' } }),
  ]);

  const address = [
    clinic.addressLine,
    [clinic.city, clinic.state].filter(Boolean).join(' - '),
    clinic.zip,
  ]
    .filter(Boolean)
    .join(', ');
  const mapQuery = encodeURIComponent(site.mapsQuery || address);
  const photo = clinic.photoKey ? `/api/public/${clinic.photoKey}` : null;
  const instagramUser = clinic.instagram
    .replace(/^@/, '')
    .replace(/^https?:\/\/(www\.)?instagram\.com\//, '')
    .replace(/\/$/, '');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Psychologist',
    name: clinic.professionalName,
    description: site.seoDescription,
    url: appUrl(),
    image: photo ? `${appUrl()}${photo}` : undefined,
    telephone: clinic.phone || clinic.whatsapp || undefined,
    email: clinic.email || undefined,
    address: {
      '@type': 'PostalAddress',
      streetAddress: clinic.addressLine,
      addressLocality: clinic.city,
      addressRegion: clinic.state,
      postalCode: clinic.zip,
      addressCountry: 'BR',
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />

      {/* Hero */}
      <section className="bg-gradient-to-b from-accent/60 to-background">
        <div className="container grid items-center gap-10 py-12 md:grid-cols-[1.2fr_1fr] md:py-20">
          <div className="space-y-6">
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">
              {clinic.professionalName} · {clinic.crp}
            </p>
            <h1 className="text-4xl leading-tight md:text-5xl">{site.heroTitle}</h1>
            <p className="max-w-xl text-lg text-muted-foreground">{site.heroSubtitle}</p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/cadastro">{site.ctaLabel}</Link>
              </Button>
              {clinic.whatsapp && (
                <Button asChild size="lg" variant="outline">
                  <a
                    href={whatsappLink(
                      clinic.whatsapp,
                      'Olá! Gostaria de saber mais sobre o atendimento.',
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MessageCircle /> WhatsApp
                  </a>
                </Button>
              )}
            </div>
          </div>
          {photo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo}
              alt={`Foto de ${clinic.professionalName}`}
              className="mx-auto aspect-[4/5] w-full max-w-sm rounded-[2rem] object-cover shadow-lg"
              width={480}
              height={600}
            />
          )}
        </div>
      </section>

      {/* Sobre */}
      <section id="sobre" className="container scroll-mt-20 py-14">
        <div className="grid gap-10 md:grid-cols-2">
          <div>
            <h2 className="mb-4 text-3xl">{site.aboutTitle}</h2>
            <div className="prose-soft">
              {paragraphs(site.aboutBody).map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </div>
          <div className="space-y-6">
            <div>
              <h2 className="mb-3 text-2xl">{site.approachTitle}</h2>
              <div className="prose-soft">
                {paragraphs(site.approachBody).map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </div>
            {site.specialties.length > 0 && (
              <div>
                <h3 className="mb-2 text-lg">Especialidades</h3>
                <ul className="flex flex-wrap gap-2">
                  {site.specialties.map((s) => (
                    <li
                      key={s}
                      className="rounded-full bg-accent px-3.5 py-1.5 text-sm font-medium text-accent-foreground"
                    >
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Serviços */}
      <section id="servicos" className="scroll-mt-20 bg-secondary/40 py-14">
        <div className="container">
          <h2 className="mb-2 text-3xl">Serviços</h2>
          <p className="mb-8 text-muted-foreground">{site.servicesIntro}</p>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {services.map((s) => (
              <article
                key={s.id}
                className="flex flex-col rounded-2xl border bg-card p-6 shadow-sm"
              >
                <h3 className="text-xl">{s.name}</h3>
                {s.description && (
                  <p className="mt-2 flex-1 text-muted-foreground">{s.description}</p>
                )}
                <ul className="mt-4 flex flex-wrap gap-2 text-xs font-medium">
                  <li className="rounded-full bg-muted px-2.5 py-1">{s.durationMinutes} min</li>
                  {s.allowsInPerson && (
                    <li className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1">
                      <MapPin className="size-3" aria-hidden /> Presencial
                    </li>
                  )}
                  {s.allowsOnline && (
                    <li className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1">
                      <Video className="size-3" aria-hidden /> Online
                    </li>
                  )}
                </ul>
                {scheduling.showPricesOnSite && s.showPrice && s.priceCents > 0 && (
                  <p className="mt-4 font-serif text-2xl text-primary">
                    {formatBRL(s.priceCents)}{' '}
                    <span className="font-sans text-sm text-muted-foreground">por sessão</span>
                  </p>
                )}
              </article>
            ))}
          </div>
          {scheduling.showPricesOnSite && (
            <p className="mt-4 text-sm text-muted-foreground">{site.pricingNote}</p>
          )}
        </div>
      </section>

      {/* Contato */}
      <section id="contato" className="container scroll-mt-20 py-14">
        <h2 className="mb-2 text-3xl">Contato e localização</h2>
        <p className="mb-8 text-muted-foreground">{site.contactIntro}</p>
        <div className="grid gap-8 md:grid-cols-2">
          <ul className="space-y-4">
            {address && (
              <li className="flex gap-3">
                <MapPin className="mt-1 size-5 shrink-0 text-primary" aria-hidden />
                <span>{address}</span>
              </li>
            )}
            {clinic.whatsapp && (
              <li className="flex gap-3">
                <MessageCircle className="mt-1 size-5 shrink-0 text-primary" aria-hidden />
                <a
                  className="hover:underline"
                  href={whatsappLink(clinic.whatsapp)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  WhatsApp {maskPhone(clinic.whatsapp)}
                </a>
              </li>
            )}
            {clinic.phone && (
              <li className="flex gap-3">
                <Phone className="mt-1 size-5 shrink-0 text-primary" aria-hidden />
                <a className="hover:underline" href={`tel:+55${clinic.phone.replace(/\D/g, '')}`}>
                  {maskPhone(clinic.phone)}
                </a>
              </li>
            )}
            {clinic.email && (
              <li className="flex gap-3">
                <Mail className="mt-1 size-5 shrink-0 text-primary" aria-hidden />
                <a className="hover:underline" href={`mailto:${clinic.email}`}>
                  {clinic.email}
                </a>
              </li>
            )}
            {instagramUser && (
              <li className="flex gap-3">
                <AtSign className="mt-1 size-5 shrink-0 text-primary" aria-hidden />
                <a
                  className="hover:underline"
                  href={`https://instagram.com/${instagramUser}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  @{instagramUser}
                </a>
              </li>
            )}
          </ul>
          {site.showMap && mapQuery && (
            <iframe
              title="Mapa com a localização do consultório"
              className="aspect-video w-full rounded-2xl border"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              src={`https://www.google.com/maps?q=${mapQuery}&output=embed`}
            />
          )}
        </div>
      </section>

      {/* FAQ */}
      {site.showFaq && faqs.length > 0 && (
        <section id="duvidas" className="scroll-mt-20 bg-secondary/40 py-14">
          <div className="container max-w-3xl">
            <h2 className="mb-6 text-3xl">Perguntas frequentes</h2>
            <div className="space-y-3">
              {faqs.map((f) => (
                <details key={f.id} className="group rounded-xl border bg-card p-4">
                  <summary className="cursor-pointer list-none font-medium marker:hidden">
                    <span className="mr-2 text-primary group-open:hidden" aria-hidden>
                      +
                    </span>
                    <span className="mr-2 hidden text-primary group-open:inline" aria-hidden>
                      −
                    </span>
                    {f.question}
                  </summary>
                  <p className="mt-3 text-muted-foreground">{f.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA final */}
      <section className="container py-14 text-center">
        <h2 className="mb-3 text-3xl">Pronto(a) para começar?</h2>
        <p className="mb-6 text-muted-foreground">
          Crie sua conta e escolha o melhor horário para você.
        </p>
        <Button asChild size="lg">
          <Link href="/cadastro">{site.ctaLabel}</Link>
        </Button>
      </section>
    </>
  );
}
