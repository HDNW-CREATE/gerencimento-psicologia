'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Field, ariaFor } from '@/components/forms/field';
import { useServerAction } from '@/components/forms/use-action';
import { changePasswordSchema } from '@/lib/schemas/auth';
import { changePasswordAction } from '@/server/actions/auth';

interface Values {
  currentPassword: string;
  password: string;
  confirmPassword: string;
}

export function PasswordForm() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(changePasswordSchema) });
  const { execute, pending, fieldErrors } = useServerAction(changePasswordAction, {
    // A troca invalida todas as sessões: voltamos ao login
    onSuccess: () => router.push('/entrar?senha=1'),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Trocar senha</CardTitle>
        <CardDescription>
          Após a troca, você precisará entrar novamente em todos os aparelhos.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit((v) => execute(v))} className="space-y-4" noValidate>
          <Field
            label="Senha atual"
            htmlFor="currentPassword"
            error={errors.currentPassword?.message ?? fieldErrors.currentPassword?.[0]}
          >
            <Input
              type="password"
              autoComplete="current-password"
              {...ariaFor('currentPassword', errors.currentPassword?.message)}
              {...register('currentPassword')}
            />
          </Field>
          <Field
            label="Nova senha"
            htmlFor="password"
            error={errors.password?.message}
            hint="Mínimo 8 caracteres, com letras e números."
          >
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
          <Button type="submit" loading={pending}>
            Trocar senha
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
