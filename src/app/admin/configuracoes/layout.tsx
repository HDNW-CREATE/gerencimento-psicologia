import { requirePermission } from '@/server/session';
import { SettingsNav } from './settings-nav';

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  await requirePermission('settings.manage');
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl">Configurações</h1>
        <p className="text-muted-foreground">
          Ajuste horários, regras de agendamento, dados profissionais e o conteúdo do site.
        </p>
      </div>
      <SettingsNav />
      {children}
    </div>
  );
}
