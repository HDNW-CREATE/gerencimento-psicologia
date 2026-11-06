import Link from 'next/link';
import { getClinic } from '@/lib/settings';

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const clinic = await getClinic();
  return (
    <div className="flex min-h-dvh flex-col items-center bg-gradient-to-b from-accent/50 to-background px-4 py-8 sm:py-12">
      <Link href="/" className="mb-6 text-center">
        <span className="font-serif text-2xl text-primary">{clinic.clinicName}</span>
      </Link>
      <main id="conteudo" className="w-full max-w-md">
        {children}
      </main>
      <p className="mt-8 text-center text-xs text-muted-foreground">
        {clinic.professionalName} · {clinic.crp}
      </p>
    </div>
  );
}
