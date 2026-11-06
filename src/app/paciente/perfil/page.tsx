import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { fmtDateOnly, maskCpf } from '@/lib/format';
import { requirePatient } from '@/server/session';
import { ProfileForm } from './profile-form';
import { PasswordForm } from './password-form';
import { LogoutAllButton } from './logout-all';

export const metadata: Metadata = { title: 'Meu perfil' };

export default async function ProfilePage() {
  const user = await requirePatient();
  const p = user.patientProfile;
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-3xl">Meu perfil</h1>

      <Card>
        <CardHeader>
          <CardTitle>Dados da conta</CardTitle>
          <CardDescription>
            Para alterar nome completo, e-mail, CPF ou data de nascimento, fale com o consultório.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
          <p>
            <span className="text-muted-foreground">Nome:</span> {p.fullName}
          </p>
          <p>
            <span className="text-muted-foreground">E-mail:</span> {user.email}
          </p>
          <p>
            <span className="text-muted-foreground">CPF:</span>{' '}
            {p.cpf ? maskCpf(p.cpf) : 'não informado'}
          </p>
          <p>
            <span className="text-muted-foreground">Nascimento:</span>{' '}
            {p.birthDate ? fmtDateOnly(p.birthDate) : '—'}
          </p>
        </CardContent>
      </Card>

      <ProfileForm
        initial={{
          socialName: p.socialName ?? '',
          phone: p.phone ?? '',
          emergencyName: p.emergencyName ?? '',
          emergencyPhone: p.emergencyPhone ?? '',
          emergencyRelation: p.emergencyRelation ?? '',
          guardianName: p.guardianName ?? '',
          guardianCpf: p.guardianCpf ?? '',
          guardianPhone: p.guardianPhone ?? '',
          notifyReminders: user.notifyReminders,
          notifyPayments: user.notifyPayments,
          notifyAnnouncements: user.notifyAnnouncements,
        }}
      />

      <PasswordForm />

      <Card>
        <CardHeader>
          <CardTitle>Segurança</CardTitle>
          <CardDescription>
            Encerra o acesso em todos os aparelhos onde você entrou, inclusive este.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <LogoutAllButton />
          <Button asChild variant="outline">
            <Link href="/paciente/privacidade">Privacidade e meus dados (LGPD)</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
