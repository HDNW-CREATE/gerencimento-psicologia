import type { Metadata } from 'next';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { db } from '@/lib/db';
import { requirePermission } from '@/server/session';
import { AnnouncementForm } from './announcement-form';
import { TemplatesEditor } from './templates-editor';
import { WhatsAppTool } from './whatsapp-tool';

export const metadata: Metadata = { title: 'Comunicação' };

export default async function CommunicationPage() {
  await requirePermission('communication.send');
  const [patients, templates, count] = await Promise.all([
    db.patientProfile.findMany({
      where: { deletedAt: null },
      select: { id: true, fullName: true, socialName: true, phone: true },
      orderBy: { fullName: 'asc' },
      take: 2000,
    }),
    db.emailTemplate.findMany({ orderBy: { name: 'asc' } }),
    db.patientProfile.count({ where: { status: 'ATIVO', deletedAt: null } }),
  ]);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl">Comunicação</h1>
        <p className="text-muted-foreground">Avisos, modelos de e-mail e lembretes por WhatsApp.</p>
      </div>
      <Tabs defaultValue="avisos">
        <TabsList>
          <TabsTrigger value="avisos">Enviar aviso</TabsTrigger>
          <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
          <TabsTrigger value="modelos">Modelos de e-mail</TabsTrigger>
        </TabsList>
        <TabsContent value="avisos">
          <AnnouncementForm
            patients={patients.map((p) => ({ id: p.id, name: p.socialName ?? p.fullName }))}
            activeCount={count}
          />
        </TabsContent>
        <TabsContent value="whatsapp">
          <WhatsAppTool
            patients={patients
              .filter((p) => p.phone)
              .map((p) => ({ id: p.id, name: p.socialName ?? p.fullName, phone: p.phone! }))}
          />
        </TabsContent>
        <TabsContent value="modelos">
          <TemplatesEditor
            templates={templates.map((t) => ({
              key: t.key,
              name: t.name,
              subject: t.subject,
              body: t.body,
              active: t.active,
            }))}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
