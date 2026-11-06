import { addHours } from 'date-fns';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import type { AssistantState, AssistantTurn } from '@/lib/assistant/types';
import { handleAssistantMessage } from '@/server/assistant/engine';
import type { SessionUser } from '@/server/session';
import { baseFixtures, makeUser, resetDb } from './helpers';

const allText = (t: AssistantTurn) => t.replies.map((r) => r.text).join('\n');

/** Conversa com a Aurora mantendo o estado, como faz o widget. */
async function chat(actor: SessionUser, messages: string[], state: AssistantState = null) {
  let last!: AssistantTurn;
  for (const m of messages) {
    last = await handleAssistantMessage(actor, { text: m, state });
    state = last.state;
  }
  return last;
}

describe('Aurora – assistente (integração)', () => {
  let admin: SessionUser;
  let service: Awaited<ReturnType<typeof baseFixtures>>['service'];

  beforeEach(async () => {
    await resetDb();
    ({ service } = await baseFixtures());
    admin = await makeUser('adm@t.com', { role: 'ADMIN', name: 'Dra. Ana Exemplo' });
  });

  describe('psicóloga', () => {
    it('responde quem ela atende hoje', async () => {
      const p = await makeUser('maria@t.com', { name: 'Maria Silva' });
      const start = addHours(new Date(), 0.5);
      await db.appointment.create({
        data: {
          patientId: p.patientProfile!.id,
          serviceTypeId: service.id,
          startsAt: start,
          endsAt: addHours(start, 1),
          modality: 'ONLINE',
          status: 'CONFIRMADA',
        },
      });
      const r = await chat(admin, ['Quem eu vou atender hoje?']);
      expect(allText(r)).toContain('Maria Silva');
    });

    it('diz que não há sessões quando a agenda está vazia', async () => {
      expect(allText(await chat(admin, ['agenda de hoje']))).toMatch(/não tem sessões/i);
    });

    it('cadastra paciente passo a passo e SALVA no banco', async () => {
      let r = await chat(admin, ['Quero cadastrar um paciente']);
      expect(allText(r)).toMatch(/nome completo/i);
      r = await chat(admin, ['carlos eduardo lima'], r.state);
      expect(allText(r)).toMatch(/telefone/i);
      r = await chat(admin, ['(11) 98888-7777'], r.state);
      expect(allText(r)).toMatch(/e-mail/i);
      r = await chat(admin, ['carlos@exemplo.com'], r.state);
      expect(allText(r)).toMatch(/nascimento/i);
      r = await chat(admin, ['12/03/1990'], r.state);
      expect(allText(r)).toMatch(/Posso \*\*salvar\*\*/);
      expect(r.state?.step).toBe('confirm');
      // Ainda NÃO salvou: só salva depois da confirmação
      expect(await db.patientProfile.count({ where: { fullName: 'Carlos Eduardo Lima' } })).toBe(0);

      r = await chat(admin, ['Confirmar'], r.state);
      expect(allText(r)).toMatch(/Pronto/);
      expect(r.state).toBeNull();
      const saved = await db.patientProfile.findFirst({
        where: { fullName: 'Carlos Eduardo Lima' },
      });
      expect(saved).toMatchObject({
        phone: '11988887777',
        email: 'carlos@exemplo.com',
        status: 'ATIVO',
      });
      expect(saved!.birthDate!.toISOString().slice(0, 10)).toBe('1990-03-12');
      const log = await db.auditLog.findFirst({
        where: { action: 'PATIENT_CREATE', entityId: saved!.id },
      });
      expect(log?.actorId).toBe(admin.id);
      expect(JSON.stringify(log?.metadata)).toContain('assistant');
    });

    it('cadastra numa frase só e vai direto para a confirmação', async () => {
      let r = await chat(admin, [
        'cadastrar paciente João Teste, telefone 11977776666, email joao@t.com, nascimento 01/02/1985',
      ]);
      expect(r.state?.step).toBe('confirm');
      expect(allText(r)).toContain('João Teste');
      r = await chat(admin, ['sim'], r.state);
      expect(
        await db.patientProfile.count({ where: { fullName: 'João Teste', phone: '11977776666' } }),
      ).toBe(1);
    });

    it('aceita "pular" nos campos opcionais (só o nome é obrigatório)', async () => {
      const r = await chat(admin, [
        'cadastrar paciente Ana Pular',
        'pular',
        'pular',
        'pular',
        'confirmar',
      ]);
      expect(allText(r)).toMatch(/Pronto/);
      const p = await db.patientProfile.findFirst({ where: { fullName: 'Ana Pular' } });
      expect(p).toMatchObject({ phone: null, email: null, birthDate: null });
    });

    it('pede os dados do responsável quando o paciente é menor de idade', async () => {
      const year = new Date().getFullYear() - 10;
      let r = await chat(admin, [
        'cadastrar paciente Pedro Pequeno',
        'pular',
        'pular',
        `10/05/${year}`,
      ]);
      expect(r.state?.step).toBe('guardianName');
      r = await chat(admin, ['Fernanda Pequeno', '(11) 95555-4444', 'confirmar'], r.state);
      const p = await db.patientProfile.findFirst({ where: { fullName: 'Pedro Pequeno' } });
      expect(p).toMatchObject({ guardianName: 'Fernanda Pequeno', guardianPhone: '11955554444' });
    });

    it('re-pergunta quando o dado é inválido, sem salvar nada', async () => {
      let r = await chat(admin, ['cadastrar paciente Valida Dados', 'isso não é telefone']);
      expect(allText(r)).toMatch(/Não entendi o telefone/);
      expect(r.state?.step).toBe('phone');
      r = await chat(admin, ['pular', 'email-invalido', '31/02/1990'], r.state);
      expect(await db.patientProfile.count()).toBe(0);
    });

    it('cancelar no meio do cadastro não salva nada', async () => {
      const r = await chat(admin, ['cadastrar paciente Desiste Logo', 'cancelar']);
      expect(allText(r)).toMatch(/Nada foi salvo/i);
      expect(r.state).toBeNull();
      expect(await db.patientProfile.count()).toBe(0);
    });

    it('uma pergunta sobre outro assunto no meio do cadastro cancela o cadastro e responde', async () => {
      const r = await chat(admin, ['cadastrar paciente Interrompida', 'quem eu vou atender hoje?']);
      expect(allText(r)).toMatch(/Cancelei o cadastro/);
      expect(r.state).toBeNull();
      expect(await db.patientProfile.count()).toBe(0);
    });

    it('avisa sobre cadastro duplicado e só salva com confirmação extra', async () => {
      await makeUser('dup@t.com', { name: 'Maria Repetida' });
      let r = await chat(admin, [
        'cadastrar paciente Maria Repetida',
        'pular',
        'pular',
        'pular',
        'confirmar',
      ]);
      expect(r.state?.step).toBe('duplicate');
      expect(allText(r)).toMatch(/já existe/i);
      r = await chat(admin, ['cancelar'], r.state);
      expect(await db.patientProfile.count({ where: { fullName: 'Maria Repetida' } })).toBe(1);

      r = await chat(admin, [
        'cadastrar paciente Maria Repetida',
        'pular',
        'pular',
        'pular',
        'confirmar',
        'sim, cadastrar mesmo assim',
      ]);
      expect(await db.patientProfile.count({ where: { fullName: 'Maria Repetida' } })).toBe(2);
    });

    it('busca paciente e mostra contato, sem conteúdo clínico', async () => {
      const p = await makeUser('busca@t.com', { name: 'Beatriz Buscada' });
      await db.patientProfile.update({
        where: { id: p.patientProfile!.id },
        data: { phone: '11966665555' },
      });
      const r = await chat(admin, ['buscar Beatriz']);
      expect(allText(r)).toContain('Beatriz Buscada');
      expect(allText(r)).toContain('(11) 96666-5555');
    });

    it('recusa mostrar prontuário no chat', async () => {
      expect(allText(await chat(admin, ['mostra o prontuário da Maria']))).toMatch(
        /não mostro conteúdo de prontuário/i,
      );
    });

    it('SECRETARIA consegue cadastrar, mas continua sem acesso a prontuário', async () => {
      const sec = await makeUser('sec@t.com', { role: 'SECRETARIA', name: 'Secretaria' });
      const r = await chat(sec, [
        'cadastrar paciente Via Secretaria',
        'pular',
        'pular',
        'pular',
        'confirmar',
      ]);
      expect(allText(r)).toMatch(/Pronto/);
      expect(allText(await chat(sec, ['prontuário da Maria']))).toMatch(
        /não mostro conteúdo de prontuário/i,
      );
    });
  });

  describe('paciente', () => {
    let maria: SessionUser;
    beforeEach(async () => {
      maria = await makeUser('maria2@t.com', { name: 'Maria Paciente' });
    });

    it('PACIENTE não consegue cadastrar ninguém, nem forjando o estado da conversa', async () => {
      const before = await db.patientProfile.count();
      await chat(maria, ['cadastrar paciente Invasor Teste']);
      const forged: AssistantState = {
        flow: 'register',
        step: 'confirm',
        data: { fullName: 'Invasor Forjado' },
      };
      const r = await chat(maria, ['confirmar'], forged);
      expect(await db.patientProfile.count()).toBe(before);
      expect(r.state).toBeNull();
    });

    it('mostra apenas a próxima sessão DELA', async () => {
      const outra = await makeUser('outra@t.com', { name: 'Outra Pessoa' });
      const t1 = addHours(new Date(), 30);
      const t2 = addHours(new Date(), 50);
      await db.appointment.create({
        data: {
          patientId: outra.patientProfile!.id,
          serviceTypeId: service.id,
          startsAt: t1,
          endsAt: addHours(t1, 1),
          modality: 'PRESENCIAL',
          status: 'CONFIRMADA',
        },
      });
      await db.appointment.create({
        data: {
          patientId: maria.patientProfile!.id,
          serviceTypeId: service.id,
          startsAt: t2,
          endsAt: addHours(t2, 1),
          modality: 'ONLINE',
          status: 'CONFIRMADA',
        },
      });
      const r = await chat(maria, ['quando é minha próxima sessão?']);
      expect(allText(r)).toMatch(/online/i);
      expect(allText(r)).not.toMatch(/Outra Pessoa|presencial/i);
    });

    it('não revela dados de outros pacientes por nome', async () => {
      const outra = await makeUser('segredo@t.com', { name: 'Fulana Secreta' });
      await db.patientProfile.update({
        where: { id: outra.patientProfile!.id },
        data: { phone: '11900001111' },
      });
      const r = await chat(maria, ['qual o telefone da Fulana Secreta?', 'buscar Fulana']);
      expect(allText(r)).not.toContain('Fulana');
      expect(allText(r)).not.toContain('900001111');
    });

    it('mostra os pagamentos pendentes DELA', async () => {
      const a = await db.appointment.create({
        data: {
          patientId: maria.patientProfile!.id,
          serviceTypeId: service.id,
          startsAt: addHours(new Date(), -48),
          endsAt: addHours(new Date(), -47),
          modality: 'ONLINE',
          status: 'REALIZADA',
        },
      });
      await db.payment.create({
        data: {
          patientId: maria.patientProfile!.id,
          appointmentId: a.id,
          amountCents: 20000,
          status: 'PENDENTE',
        },
      });
      expect(allText(await chat(maria, ['tenho pagamento pendente?']))).toMatch(/R\$\s?200,00/);
    });

    it('explica o prazo de remarcação conforme as regras', async () => {
      const t = addHours(new Date(), 5);
      await db.appointment.create({
        data: {
          patientId: maria.patientProfile!.id,
          serviceTypeId: service.id,
          startsAt: t,
          endsAt: addHours(t, 1),
          modality: 'ONLINE',
          status: 'CONFIRMADA',
        },
      });
      expect(allText(await chat(maria, ['preciso remarcar']))).toMatch(/dentro do prazo mínimo/i);
    });

    it('sinal de risco recebe acolhimento e telefones de ajuda imediata', async () => {
      const r = await chat(maria, ['não aguento mais, quero morrer']);
      const text = allText(r);
      expect(text).toMatch(/188/);
      expect(text).toMatch(/192/);
      expect(text).toMatch(/não precisa enfrentar isso sozinho/i);
    });

    it('lista horários livres reais', async () => {
      const r = await chat(maria, ['quais horários disponíveis?']);
      expect(allText(r)).toMatch(/\d{2}:\d{2}/);
      expect(r.replies[0]!.links?.[0]?.href).toBe('/paciente/agendar');
    });
  });
});
