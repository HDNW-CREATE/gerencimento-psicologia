'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, ariaFor } from '@/components/forms/field';
import { useServerAction } from '@/components/forms/use-action';
import { loginSchema, type LoginInput } from '@/lib/schemas/auth';
import { loginAction } from '@/server/actions/auth';

export function LoginForm({ callbackUrl, notice }: { callbackUrl?: string; notice?: string }) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema), defaultValues: { callbackUrl } });

  const { execute, pending, error } = useServerAction(loginAction, {
    successToast: false,
    onSuccess: (r) => {
      router.push(r.data?.redirectTo ?? '/paciente');
      router.refresh();
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-2xl">Entrar</CardTitle>
        <CardDescription>Acesse a sua área para agendar e acompanhar suas sessões.</CardDescription>
      </CardHeader>
      <CardContent>
        {notice && (
          <p
            role="status"
            className="mb-4 rounded-lg bg-accent px-3 py-2 text-sm text-accent-foreground"
          >
            {notice}
          </p>
        )}
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
          <Field label="Senha" htmlFor="password" error={errors.password?.message}>
            <Input
              type="password"
              autoComplete="current-password"
              {...ariaFor('password', errors.password?.message)}
              {...register('password')}
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
            Entrar
          </Button>
        </form>
        <div className="mt-5 flex flex-col gap-2 text-center text-sm">
          <Link href="/esqueci-senha" className="text-primary underline-offset-4 hover:underline">
            Esqueci minha senha
          </Link>
          <span className="text-muted-foreground">
            Ainda não tem conta?{' '}
            <Link
              href="/cadastro"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Cadastre-se
            </Link>
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
