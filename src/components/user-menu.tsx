'use client';

import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { logoutAction } from '@/server/actions/auth';

export function LogoutButton({ compact = false }: { compact?: boolean }) {
  return (
    <form action={logoutAction}>
      <Button type="submit" variant="ghost" size={compact ? 'icon' : 'sm'} aria-label="Sair">
        <LogOut />
        {!compact && 'Sair'}
      </Button>
    </form>
  );
}
