import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { getClinic } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const clinic = await getClinic();
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
        <div className="container flex items-center justify-between gap-3 py-3">
          <Link href="/" className="font-serif text-xl text-primary">
            {clinic.clinicName}
          </Link>
          <nav
            aria-label="Seções do site"
            className="hidden items-center gap-6 text-sm font-medium md:flex"
          >
            <Link href="/#sobre" className="hover:text-primary">
              Sobre
            </Link>
            <Link href="/#servicos" className="hover:text-primary">
              Serviços
            </Link>
            <Link href="/#contato" className="hover:text-primary">
              Contato
            </Link>
            <Link href="/#duvidas" className="hover:text-primary">
              Dúvidas
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link href="/entrar">Entrar</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/cadastro">Agendar sessão</Link>
            </Button>
          </div>
        </div>
      </header>
      <main id="conteudo" className="flex-1">
        {children}
      </main>
      <footer className="border-t bg-secondary/50">
        <div className="container grid gap-6 py-10 text-sm md:grid-cols-3">
          <div>
            <p className="font-serif text-lg text-primary">{clinic.clinicName}</p>
            <p className="text-muted-foreground">
              {clinic.professionalName} · {clinic.crp}
            </p>
          </div>
          <nav aria-label="Documentos legais" className="space-y-1">
            <Link href="/privacidade" className="block hover:underline">
              Política de Privacidade
            </Link>
            <Link href="/termos" className="block hover:underline">
              Termos de Uso
            </Link>
            <Link href="/termo-de-consentimento" className="block hover:underline">
              Termo de Consentimento
            </Link>
          </nav>
          <p className="text-muted-foreground">
            Em situação de crise, ligue 188 (CVV) ou 192 (SAMU). Este site não é um serviço de
            emergência.
          </p>
        </div>
      </footer>
    </div>
  );
}
