import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ResetForm } from './reset-form';

export const metadata: Metadata = { title: 'Redefinir senha', robots: { index: false } };

export default async function ResetPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (!token) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-2xl">Link inválido</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>O link de redefinição está incompleto. Solicite um novo.</p>
          <Button asChild className="w-full">
            <Link href="/esqueci-senha">Solicitar novo link</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }
  return <ResetForm token={token} />;
}
