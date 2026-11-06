'use client';

import { Button } from '@/components/ui/button';

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Não exibimos a mensagem do erro (pode conter detalhes internos); apenas o digest vai para os logs do servidor.
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl">Algo deu errado</h1>
      <p className="max-w-md text-muted-foreground">
        Não foi possível carregar esta página. Tente novamente; se continuar, entre em contato com o
        consultório.
      </p>
      <Button onClick={reset}>Tentar novamente</Button>
    </main>
  );
}
