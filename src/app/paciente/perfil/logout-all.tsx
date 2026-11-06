'use client';

import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { logoutAllAction } from '@/server/actions/auth';

export function LogoutAllButton() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <LogOut /> Sair de todos os dispositivos
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Sair de todos os dispositivos?"
        description="Você será desconectado(a) em todos os aparelhos e precisará entrar novamente."
        confirmLabel="Sair de todos"
        destructive
        loading={pending}
        onConfirm={async () => {
          setPending(true);
          await logoutAllAction();
        }}
      />
    </>
  );
}
