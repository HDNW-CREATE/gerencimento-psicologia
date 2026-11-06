'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, ariaFor } from '@/components/forms/field';
import { useServerAction } from '@/components/forms/use-action';
import { forgotPasswordSchema } from '@/lib/schemas/auth';
import { requestPasswordResetAction } from '@/server/actions/auth';

export function ForgotForm() {
  const [sent, setSent] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<{ email: string }>({ resolver: zodResolver(forgotPasswordSchema) });
  const { execute, pending, error } = useServerAction(requestPasswordResetAction, {
    successToast: false,
    onSuccess: (r) => setSent(r.message ?? 'Pronto!'),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-2xl">Esqueci minha senha</CardTitle>
        <CardDescription>
          Informe seu e-mail e enviaremos um link para criar uma nova senha.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sent ? (
          <div className="space-y-4">
            <p role="status">{sent}</p>
            <Button asChild variant="outline" className="w-full">
              <Link href="/entrar">Voltar ao login</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit((v) => execute(v))} className="space-y-4" noValidate>
            <Field label="E-mail" htmlFor="email" error={errors.email?.message}>
              <Input
                type="email"
                autoComplete="email"
                inputMode="email"
                {...ariaFor('email', errors.email?.message)}
                {...register('email')}
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
              Enviar link
            </Button>
            <Link href="/entrar" className="block text-center text-sm text-primary hover:underline">
              Voltar ao login
            </Link>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
