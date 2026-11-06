import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/lib/db';
import { can, ForbiddenError } from '@/lib/permissions';
import type { SessionUser } from '@/server/session';
import { makeUser, resetDb } from './helpers';

// "Usuário logado" controlado pelo teste (o módulo real lê o cookie de sessão do Next).
let current: SessionUser | null = null;
vi.mock('@/server/session', () => ({
  requirePermissionOrThrow: async (permission: Parameters<typeof can>[1]) => {
    if (!current) throw new ForbiddenError();
    if (!can(current.role, permission)) throw new ForbiddenError();
    return current;
  },
}));

const clinical = await import('@/server/clinical');

describe('prontuário (integração com PostgreSQL)', () => {
  let admin: SessionUser;
  let patientId: string;

  beforeEach(async () => {
    await resetDb();
    admin = await makeUser('adm@t.com', { role: 'ADMIN' });
    const p = await makeUser('pac@t.com');
    patientId = p.patientProfile!.id;
    current = admin;
  });

  it('grava criptografado: o texto claro NUNCA aparece no banco', async () => {
    const id = await clinical.createRecord({
      patientId,
      title: 'Sessão 1',
      html: '<p>Segredo clínico ÚNICO-12345</p>',
    });
    const raw = await db.$queryRaw<
      { contentEnc: string }[]
    >`SELECT "contentEnc" FROM "ClinicalRecord" WHERE id = ${id}`;
    expect(raw[0]!.contentEnc.startsWith('v1:')).toBe(true);
    expect(raw[0]!.contentEnc).not.toContain('ÚNICO-12345');
    const versions = await db.$queryRaw<
      { contentEnc: string }[]
    >`SELECT "contentEnc" FROM "ClinicalRecordVersion"`;
    expect(versions.every((v) => !v.contentEnc.includes('ÚNICO'))).toBe(true);
    // e a ADMIN consegue ler de volta
    const list = await clinical.listRecords(patientId);
    expect(list[0]!.html).toContain('Segredo clínico ÚNICO-12345');
    expect(list[0]!.title).toBe('Sessão 1');
  });

  it('SECRETARIA e PACIENTE não conseguem ler nem escrever o prontuário', async () => {
    const id = await clinical.createRecord({ patientId, html: '<p>conteúdo</p>' });
    for (const role of ['SECRETARIA', 'PACIENTE'] as const) {
      current = await makeUser(`${role}@t.com`, { role });
      await expect(clinical.listRecords(patientId)).rejects.toBeInstanceOf(ForbiddenError);
      await expect(clinical.getRecordVersions(id)).rejects.toBeInstanceOf(ForbiddenError);
      await expect(clinical.createRecord({ patientId, html: '<p>x</p>' })).rejects.toBeInstanceOf(
        ForbiddenError,
      );
      await expect(clinical.getAnamnesis(patientId)).rejects.toBeInstanceOf(ForbiddenError);
      await expect(
        clinical.retractRecord({ recordId: id, reason: 'tentativa' }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    }
  });

  it('retificar cria nova versão e preserva a anterior; exige motivo', async () => {
    const id = await clinical.createRecord({ patientId, html: '<p>versão original</p>' });
    await expect(
      clinical.amendRecord({ recordId: id, html: '<p>nova</p>', reason: '' }),
    ).rejects.toThrow(/motivo/i);
    await clinical.amendRecord({
      recordId: id,
      html: '<p>versão corrigida</p>',
      reason: 'erro de digitação',
    });
    const versions = await clinical.getRecordVersions(id);
    expect(versions.map((v) => v.version)).toEqual([2, 1]);
    expect(versions[1]!.html).toContain('versão original');
    expect(versions[0]!.reason).toBe('erro de digitação');
    expect((await clinical.listRecords(patientId))[0]!.html).toContain('corrigida');
  });

  it('invalidar não apaga, e registro invalidado não pode ser alterado', async () => {
    const id = await clinical.createRecord({ patientId, html: '<p>x registro</p>' });
    await clinical.retractRecord({ recordId: id, reason: 'lançado no paciente errado' });
    const rec = await db.clinicalRecord.findUnique({ where: { id } });
    expect(rec?.retractedAt).not.toBeNull();
    await expect(
      clinical.amendRecord({ recordId: id, html: '<p>y</p>', reason: 'tentativa' }),
    ).rejects.toThrow(/invalidado/i);
  });

  it('o banco impede apagar registros e versões (gatilho de proteção)', async () => {
    const id = await clinical.createRecord({ patientId, html: '<p>não apagar</p>' });
    await expect(db.clinicalRecord.delete({ where: { id } })).rejects.toThrow();
    await expect(
      db.clinicalRecordVersion.deleteMany({ where: { recordId: id } }),
    ).rejects.toThrow();
    // versões antigas também são imutáveis
    await expect(
      db.clinicalRecordVersion.updateMany({
        where: { recordId: id },
        data: { reason: 'alterado' },
      }),
    ).rejects.toThrow();
    expect(await db.clinicalRecord.count({ where: { id } })).toBe(1);
  });

  it('sanitiza HTML malicioso (XSS) antes de gravar', async () => {
    await clinical.createRecord({
      patientId,
      html: '<p>ok</p><script>alert(1)</script><img src=x onerror=alert(1)><a href="javascript:alert(1)">x</a>',
    });
    const [r] = await clinical.listRecords(patientId);
    expect(r!.html).not.toMatch(/script|onerror|javascript:|<img|<a /i);
    expect(r!.html).toContain('<p>ok</p>');
  });

  it('o conteúdo de um paciente não decifra em outra ficha (AAD)', async () => {
    const id = await clinical.createRecord({ patientId, html: '<p>do paciente A</p>' });
    const other = await makeUser('outro@t.com');
    // Simula um ataque/erro: copiar o texto cifrado para a ficha de outro paciente
    await db.$executeRaw`UPDATE "ClinicalRecord" SET "patientId" = ${other.patientProfile!.id} WHERE id = ${id}`;
    await expect(clinical.listRecords(other.patientProfile!.id)).rejects.toThrow();
  });

  it('anamnese é versionada e criptografada; auditoria não guarda conteúdo', async () => {
    await clinical.saveAnamnesis(patientId, { queixa_principal: 'texto sigiloso ANAM-999' });
    await clinical.saveAnamnesis(patientId, {
      queixa_principal: 'texto sigiloso ANAM-999 atualizado',
    });
    const a = await clinical.getAnamnesis(patientId);
    expect(a!.version).toBe(2);
    expect(a!.data.queixa_principal).toContain('atualizado');
    const raw = await db.$queryRaw<{ dataEnc: string }[]>`SELECT "dataEnc" FROM "Anamnesis"`;
    expect(raw[0]!.dataEnc).not.toContain('ANAM-999');
    const logs = await db.auditLog.findMany();
    expect(JSON.stringify(logs)).not.toContain('ANAM-999');
    expect(logs.some((l) => l.action === 'ANAMNESIS_UPDATE')).toBe(true);
    expect(logs.some((l) => l.action === 'ANAMNESIS_READ')).toBe(true);
  });

  it('toda leitura do prontuário gera log de auditoria sem conteúdo', async () => {
    await clinical.createRecord({ patientId, html: '<p>AUD-777 conteúdo</p>' });
    await clinical.listRecords(patientId);
    const logs = await db.auditLog.findMany({ orderBy: { createdAt: 'asc' } });
    expect(logs.map((l) => l.action)).toEqual(
      expect.arrayContaining(['CLINICAL_RECORD_CREATE', 'CLINICAL_RECORD_READ']),
    );
    expect(JSON.stringify(logs)).not.toContain('AUD-777');
  });
});
