'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, ariaFor } from '@/components/forms/field';
import { useServerAction } from '@/components/forms/use-action';
import { resetPasswordSchema } from '@/lib/schemas/auth';
import { resetPasswordAction } from '@/server/actions/auth';

interface Values {
  token: string;
  password: string;
  confirmPassword: string;
}

export function ResetForm({ token }: { token: string }) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(resetPasswordSchema), defaultValues: { token } });
  const { execute, pending, error } = useServerAction(resetPasswordAction, {
    onSuccess: () => router.push('/entrar?senha=1'),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-2xl">Criar nova senha</CardTitle>
        <CardDescription>
          Escolha uma senha com no mínimo 8 caracteres, com letras e números.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit((v) => execute(v))} className="space-y-4" noValidate>
          <input type="hidden" {...register('token')} />
          <Field label="Nova senha" htmlFor="password" error={errors.password?.message}>
            <Input
              type="password"
              autoComplete="new-password"
              {...ariaFor('password', errors.password?.message)}
              {...register('password')}
            />
          </Field>
          <Field
            label="Confirme a nova senha"
            htmlFor="confirmPassword"
            error={errors.confirmPassword?.message}
          >
            <Input
              type="password"
              autoComplete="new-password"
              {...ariaFor('confirmPassword', errors.confirmPassword?.message)}
              {...register('confirmPassword')}
            />
          </Field>
          {error && (
            <p
              role="alert"
              className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive"
            >
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" loading={pending}>
            Salvar nova senha
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
