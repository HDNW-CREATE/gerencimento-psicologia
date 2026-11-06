'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  CalendarDays,
  CalendarPlus,
  ClipboardList,
  FileText,
  Home,
  MessageSquare,
  Settings,
  ShieldCheck,
  User,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const ICONS: Record<string, LucideIcon> = {
  home: Home,
  plus: CalendarPlus,
  calendar: CalendarDays,
  wallet: Wallet,
  file: FileText,
  user: User,
  users: Users,
  chart: BarChart3,
  message: MessageSquare,
  settings: Settings,
  shield: ShieldCheck,
  clipboard: ClipboardList,
};

export interface NavItem {
  href: string;
  label: string;
  icon: keyof typeof ICONS;
  exact?: boolean;
}

function isActive(pathname: string, item: NavItem) {
  return item.exact
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/** Barra inferior (celular) – a área do paciente é pensada primeiro para o celular. */
export function BottomNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="mx-auto flex max-w-lg justify-around">
        {items.map((item) => {
          const Icon = ICONS[item.icon]!;
          const active = isActive(pathname, item);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium',
                  active ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                <Icon className="size-5" aria-hidden />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Navegação horizontal (desktop) ou lateral. */
export function SideNav({ items, vertical = false }: { items: NavItem[]; vertical?: boolean }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Navegação principal">
      <ul className={cn('flex gap-1', vertical && 'flex-col')}>
        {items.map((item) => {
          const Icon = ICONS[item.icon]!;
          const active = isActive(pathname, item);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-10 items-center gap-2.5 rounded-lg px-3 text-sm font-medium transition-colors',
                  active
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <Icon className="size-4" aria-hidden />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
