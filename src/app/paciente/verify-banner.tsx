'use client';

import { MailWarning } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useServerAction } from '@/components/forms/use-action';
import { resendVerificationAction } from '@/server/actions/auth';

export function VerifyBanner({ email }: { email: string }) {
  const { execute, pending } = useServerAction(resendVerificationAction);
  return (
    <div
      role="status"
      className="mb-6 flex flex-col gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4 sm:flex-row sm:items-center"
    >
      <MailWarning className="size-6 shrink-0 text-warning" aria-hidden />
      <p className="flex-1 text-sm">
        <strong>Confirme seu e-mail para poder agendar.</strong> Enviamos um link para{' '}
        <span className="font-medium">{email}</span>.
      </p>
      <Button size="sm" variant="outline" loading={pending} onClick={() => execute()}>
        Reenviar link
      </Button>
    </div>
  );
}
