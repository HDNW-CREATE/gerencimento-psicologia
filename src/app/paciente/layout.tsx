import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getPendingConsents } from '@/server/consents';
import { BottomNav, SideNav, type NavItem } from '@/components/nav-links';
import { LogoutButton } from '@/components/user-menu';
import { getClinic } from '@/lib/settings';
import { requirePatient } from '@/server/session';
import { VerifyBanner } from './verify-banner';

const items: NavItem[] = [
  { href: '/paciente', label: 'Início', icon: 'home', exact: true },
  { href: '/paciente/agendar', label: 'Agendar', icon: 'plus' },
  { href: '/paciente/sessoes', label: 'Sessões', icon: 'calendar' },
  { href: '/paciente/financeiro', label: 'Financeiro', icon: 'wallet' },
  { href: '/paciente/documentos', label: 'Documentos', icon: 'file' },
  { href: '/paciente/perfil', label: 'Perfil', icon: 'user' },
];

// Mobile: 5 itens na barra inferior (Documentos fica acessível pelo Início/Perfil)
const mobileItems = items.filter((i) => i.href !== '/paciente/documentos');

export default async function PatientLayout({ children }: { children: React.ReactNode }) {
  const [user, clinic] = await Promise.all([requirePatient(), getClinic()]);
  // Nova versão de termo/política publicada? Exige novo aceite antes de continuar.
  if ((await getPendingConsents(user.id)).length > 0) redirect('/aceite-termos');
  return (
    <div className="min-h-dvh bg-background pb-24 md:pb-8">
      <header className="sticky top-0 z-30 border-b bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2.5">
          <Link href="/paciente" className="font-serif text-lg text-primary">
            {clinic.clinicName}
          </Link>
          <div className="hidden md:block">
            <SideNav items={items} />
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-muted-foreground lg:inline">{user.name}</span>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main id="conteudo" className="mx-auto max-w-5xl px-4 py-6">
        {!user.emailVerifiedAt && <VerifyBanner email={user.email} />}
        {children}
      </main>
      <BottomNav items={mobileItems} />
    </div>
  );
}
