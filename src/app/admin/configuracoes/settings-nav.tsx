'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const tabs = [
  { href: '/admin/configuracoes/disponibilidade', label: 'Horários' },
  { href: '/admin/configuracoes/agendamento', label: 'Regras de agendamento' },
  { href: '/admin/configuracoes/profissional', label: 'Dados profissionais' },
  { href: '/admin/configuracoes/servicos', label: 'Serviços e valores' },
  { href: '/admin/configuracoes/site', label: 'Site público' },
  { href: '/admin/configuracoes/termos', label: 'Termos e privacidade' },
  { href: '/admin/configuracoes/anamnese', label: 'Anamnese' },
];

export function SettingsNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Seções de configuração" className="-mx-1 overflow-x-auto px-1">
      <ul className="flex w-max gap-1 rounded-lg bg-muted p-1">
        {tabs.map((t) => {
          const active = pathname.startsWith(t.href);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'block whitespace-nowrap rounded-md px-3.5 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
