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
import { registerSchema, type RegisterInput } from '@/lib/schemas/auth';
import { isMinor } from '@/lib/validators';
import { registerAction } from '@/server/actions/auth';

export function RegisterForm({
  termoVersion,
  politicaVersion,
}: {
  termoVersion: number;
  politicaVersion: number;
}) {
  const [done, setDone] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { acceptTerms: undefined as never },
  });

  const birth = watch('birthDate');
  const minor = !!birth && /^\d{4}-\d{2}-\d{2}$/.test(birth) && isMinor(birth);

  const { execute, pending, error } = useServerAction(registerAction, {
    successToast: false,
    onSuccess: (r) => setDone(r.message ?? 'Cadastro realizado!'),
    onError: (r) => {
      for (const [k, msgs] of Object.entries(r.fieldErrors ?? {})) {
        setError(k as keyof RegisterInput, { message: msgs[0] });
      }
    },
  });

  if (done) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-2xl">Verifique seu e-mail</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p role="status">{done}</p>
          <Button asChild variant="outline" className="w-full">
            <Link href="/entrar">Ir para o login</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-2xl">Criar conta</CardTitle>
        <CardDescription>
          Leva menos de 2 minutos. Seus dados são protegidos pela LGPD.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit((v) => execute(v))} className="space-y-4" noValidate>
          <Field label="Nome completo" htmlFor="fullName" required error={errors.fullName?.message}>
            <Input
              autoComplete="name"
              {...ariaFor('fullName', errors.fullName?.message)}
              {...register('fullName')}
            />
          </Field>
          <Field
            label="Nome social (opcional)"
            htmlFor="socialName"
            error={errors.socialName?.message}
          >
            <Input
              {...ariaFor('socialName', errors.socialName?.message)}
              {...register('socialName')}
            />
          </Field>
          <Field label="E-mail" htmlFor="email" required error={errors.email?.message}>
            <Input
              type="email"
              autoComplete="email"
              inputMode="email"
              {...ariaFor('email', errors.email?.message)}
              {...register('email')}
            />
          </Field>
          <Field
            label="Telefone / WhatsApp"
            htmlFor="phone"
            required
            error={errors.phone?.message}
            hint="Com DDD. Ex.: (11) 91234-5678"
          >
            <Input
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              {...ariaFor('phone', errors.phone?.message)}
              {...register('phone')}
            />
          </Field>
          <Field
            label="Data de nascimento"
            htmlFor="birthDate"
            required
            error={errors.birthDate?.message}
          >
            <Input
              type="date"
              autoComplete="bday"
              {...ariaFor('birthDate', errors.birthDate?.message)}
              {...register('birthDate')}
            />
          </Field>
          <Field
            label="CPF (opcional)"
            htmlFor="cpf"
            error={errors.cpf?.message}
            hint="Usado apenas para emitir recibos."
          >
            <Input
              inputMode="numeric"
              placeholder="000.000.000-00"
              {...ariaFor('cpf', errors.cpf?.message)}
              {...register('cpf')}
            />
          </Field>

          {minor && (
            <fieldset className="space-y-4 rounded-lg border border-dashed border-primary/40 bg-accent/40 p-4">
              <legend className="px-1 text-sm font-semibold">Responsável legal</legend>
              <p className="text-xs text-muted-foreground">
                Para menores de 18 anos, os dados do responsável são obrigatórios.
              </p>
              <Field
                label="Nome do responsável"
                htmlFor="guardianName"
                required
                error={errors.guardianName?.message}
              >
                <Input
                  {...ariaFor('guardianName', errors.guardianName?.message)}
                  {...register('guardianName')}
                />
              </Field>
              <Field
                label="CPF do responsável"
                htmlFor="guardianCpf"
                required
                error={errors.guardianCpf?.message}
              >
                <Input
                  inputMode="numeric"
                  {...ariaFor('guardianCpf', errors.guardianCpf?.message)}
                  {...register('guardianCpf')}
                />
              </Field>
              <Field
                label="Telefone do responsável"
                htmlFor="guardianPhone"
                required
                error={errors.guardianPhone?.message}
              >
                <Input
                  type="tel"
                  inputMode="tel"
                  {...ariaFor('guardianPhone', errors.guardianPhone?.message)}
                  {...register('guardianPhone')}
                />
              </Field>
              <Field
                label="E-mail do responsável (opcional)"
                htmlFor="guardianEmail"
                error={errors.guardianEmail?.message}
              >
                <Input
                  type="email"
                  {...ariaFor('guardianEmail', errors.guardianEmail?.message)}
                  {...register('guardianEmail')}
                />
              </Field>
            </fieldset>
          )}

          <Field
            label="Senha"
            htmlFor="password"
            required
            error={errors.password?.message}
            hint="Mínimo de 8 caracteres, com letras e números."
          >
            <Input
              type="password"
              autoComplete="new-password"
              {...ariaFor('password', errors.password?.message)}
              {...register('password')}
            />
          </Field>
          <Field
            label="Confirme a senha"
            htmlFor="confirmPassword"
            required
            error={errors.confirmPassword?.message}
          >
            <Input
              type="password"
              autoComplete="new-password"
              {...ariaFor('confirmPassword', errors.confirmPassword?.message)}
              {...register('confirmPassword')}
            />
          </Field>

          <div className="space-y-1.5">
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-1 size-5 shrink-0 accent-[hsl(var(--primary))]"
                aria-invalid={errors.acceptTerms ? true : undefined}
                aria-describedby={errors.acceptTerms ? 'acceptTerms-error' : undefined}
                {...register('acceptTerms')}
              />
              <span>
                Li e aceito o{' '}
                <Link
                  href="/termo-de-consentimento"
                  target="_blank"
                  className="font-medium text-primary underline"
                >
                  Termo de Consentimento (v{termoVersion})
                </Link>{' '}
                e a{' '}
                <Link
                  href="/privacidade"
                  target="_blank"
                  className="font-medium text-primary underline"
                >
                  Política de Privacidade (v{politicaVersion})
                </Link>
                .
              </span>
            </label>
            {errors.acceptTerms && (
              <p
                id="acceptTerms-error"
                role="alert"
                className="text-xs font-medium text-destructive"
              >
                {errors.acceptTerms.message}
              </p>
            )}
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive"
            >
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" loading={pending}>
            Criar minha conta
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Já tem conta?{' '}
            <Link href="/entrar" className="font-medium text-primary hover:underline">
              Entrar
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
