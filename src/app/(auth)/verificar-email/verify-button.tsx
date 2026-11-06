'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useServerAction } from '@/components/forms/use-action';
import { verifyEmailAction } from '@/server/actions/auth';

export function VerifyButton({ token }: { token: string }) {
  const [done, setDone] = useState(false);
  const { execute, pending, error } = useServerAction(verifyEmailAction, {
    successToast: false,
    onSuccess: () => setDone(true),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-2xl">
          {done ? 'E-mail confirmado!' : 'Confirmar e-mail'}
        </CardTitle>
        <CardDescription>
          {done
            ? 'Tudo certo. Agora você já pode agendar sua sessão.'
            : 'Clique no botão para concluir a confirmação do seu e-mail.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!token && (
          <p role="alert" className="text-destructive">
            Link incompleto. Peça um novo link na sua área do paciente.
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive"
          >
            {error}
          </p>
        )}
        {done ? (
          <Button asChild className="w-full">
            <Link href="/paciente">Ir para minha área</Link>
          </Button>
        ) : (
          <Button
            className="w-full"
            loading={pending}
            disabled={!token}
            onClick={() => execute(token)}
          >
            Confirmar meu e-mail
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
