import { ZodError } from 'zod';
import { ForbiddenError, UnauthorizedError } from '@/lib/permissions';

export type ActionResult<T = undefined> =
  | { ok: true; message?: string; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export class UserError extends Error {
  constructor(
    message: string,
    public fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'UserError';
  }
}

export const ok = <T = undefined>(message?: string, data?: T): ActionResult<T> => ({
  ok: true,
  message,
  data,
});
export const fail = (
  error: string,
  fieldErrors?: Record<string, string[]>,
): ActionResult<never> => ({
  ok: false,
  error,
  fieldErrors,
});

/**
 * Executa o corpo de uma Server Action convertendo erros esperados em mensagens amigáveis.
 * Erros inesperados NÃO vazam detalhes ao cliente (apenas mensagem genérica; detalhe vai ao log do servidor).
 */
export async function run<T>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch (err) {
    // redirect() do Next lança um erro especial que precisa continuar subindo
    if (
      err &&
      typeof err === 'object' &&
      'digest' in err &&
      String((err as { digest: unknown }).digest).startsWith('NEXT_')
    ) {
      throw err;
    }
    if (err instanceof UserError) return fail(err.message, err.fieldErrors);
    if (err instanceof ZodError) {
      return fail(
        'Confira os campos destacados.',
        err.flatten().fieldErrors as Record<string, string[]>,
      );
    }
    if (err instanceof ForbiddenError) return fail(err.message);
    if (err instanceof UnauthorizedError) return fail(err.message);
    console.error('[action] erro inesperado:', (err as Error).message);
    return fail('Ocorreu um erro inesperado. Tente novamente em instantes.');
  }
}
