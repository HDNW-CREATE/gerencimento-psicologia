'use client';

import { useCallback, useState, useTransition } from 'react';
import { toast } from 'sonner';
import type { ActionResult } from '@/server/action-result';

/**
 * Executa uma Server Action com estado de carregamento e toast padronizado.
 * `onSuccess` recebe o resultado (ex.: para redirecionar ou fechar um diálogo).
 */
export function useServerAction<TArgs extends unknown[], TData>(
  action: (...args: TArgs) => Promise<ActionResult<TData>>,
  opts: {
    successToast?: boolean;
    onSuccess?: (r: Extract<ActionResult<TData>, { ok: true }>) => void;
    onError?: (r: Extract<ActionResult<TData>, { ok: false }>) => void;
  } = {},
) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const { successToast = true, onSuccess, onError } = opts;

  const execute = useCallback(
    (...args: TArgs) => {
      setError(null);
      setFieldErrors({});
      startTransition(async () => {
        try {
          const r = await action(...args);
          if (r.ok) {
            if (successToast && r.message) toast.success(r.message);
            onSuccess?.(r);
          } else {
            setError(r.error);
            setFieldErrors(r.fieldErrors ?? {});
            toast.error(r.error);
            onError?.(r);
          }
        } catch {
          const msg = 'Não foi possível concluir a ação. Verifique sua conexão e tente novamente.';
          setError(msg);
          toast.error(msg);
        }
      });
    },
    [action, successToast, onSuccess, onError],
  );

  return { execute, pending, error, fieldErrors };
}
