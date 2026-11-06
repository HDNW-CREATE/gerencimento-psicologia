import Link from 'next/link';
import { BottomNav, SideNav, type NavItem } from '@/components/nav-links';
import { LogoutButton } from '@/components/user-menu';
import { can } from '@/lib/permissions';
import { getClinic } from '@/lib/settings';
import { requirePermission } from '@/server/session';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePermission('agenda.manage');
  const clinic = await getClinic();

  const items: NavItem[] = [
    { href: '/admin', label: 'Painel', icon: 'chart', exact: true },
    { href: '/admin/agenda', label: 'Agenda', icon: 'calendar' },
    { href: '/admin/pacientes', label: 'Pacientes', icon: 'users' },
    { href: '/admin/financeiro', label: 'Financeiro', icon: 'wallet' },
    ...(can(user.role, 'communication.send')
      ? [{ href: '/admin/comunicacao', label: 'Comunicação', icon: 'message' } as NavItem]
      : []),
    ...(can(user.role, 'lgpd.manage')
      ? [{ href: '/admin/lgpd', label: 'LGPD', icon: 'shield' } as NavItem]
      : []),
    ...(can(user.role, 'audit.read')
      ? [{ href: '/admin/auditoria', label: 'Auditoria', icon: 'clipboard' } as NavItem]
      : []),
    ...(can(user.role, 'settings.manage')
      ? [{ href: '/admin/configuracoes', label: 'Configurações', icon: 'settings' } as NavItem]
      : []),
  ];
  const mobile = items.filter((i) =>
    [
      '/admin',
      '/admin/agenda',
      '/admin/pacientes',
      '/admin/financeiro',
      '/admin/configuracoes',
    ].includes(i.href),
  );

  return (
    <div className="min-h-dvh bg-background md:grid md:grid-cols-[15rem_1fr]">
      <aside className="hidden border-r bg-card md:block">
        <div className="sticky top-0 flex h-dvh flex-col gap-6 p-4">
          <Link href="/admin" className="px-2 font-serif text-lg text-primary">
            {clinic.clinicName}
          </Link>
          <SideNav items={items} vertical />
          <div className="mt-auto space-y-1 border-t pt-3">
            <p className="truncate px-2 text-sm font-medium">{user.name}</p>
            <p className="px-2 text-xs text-muted-foreground">
              {user.role === 'ADMIN' ? 'Psicóloga (admin)' : 'Secretaria'}
            </p>
            <LogoutButton />
          </div>
        </div>
      </aside>
      <div className="min-w-0 pb-20 md:pb-0">
        <header className="flex items-center justify-between border-b bg-card px-4 py-2.5 md:hidden">
          <Link href="/admin" className="font-serif text-lg text-primary">
            {clinic.clinicName}
          </Link>
          <LogoutButton />
        </header>
        <main id="conteudo" className="mx-auto max-w-7xl p-4 md:p-6">
          {children}
        </main>
      </div>
      <BottomNav items={mobile} />
    </div>
  );
}
