import { describe, expect, it } from 'vitest';
import {
  cleanName,
  detectPatientIntent,
  detectStaffIntent,
  extractSearchTerm,
  isCancel,
  isCrisis,
  isNo,
  isSkip,
  isYes,
  normalize,
  parseBirth,
  parsePatientDetails,
  parsePhone,
} from '@/lib/assistant/nlu';

describe('normalize', () => {
  it('remove acentos e pontuação', () => {
    expect(normalize('  Quem eu vou ATENDER hoje?  ')).toBe('quem eu vou atender hoje');
    expect(normalize('Amanhã, é São João!')).toBe('amanha e sao joao');
  });
});

describe('intenções da psicóloga', () => {
  const cases: [string, string][] = [
    ['Quem eu vou atender hoje?', 'today'],
    ['qual minha agenda', 'today'],
    ['sessões de hoje', 'today'],
    ['e amanhã?', 'tomorrow'],
    ['como está a semana', 'week'],
    ['qual a próxima sessão', 'next'],
    ['quero cadastrar um paciente', 'register'],
    ['Cadastrar paciente João Silva', 'register'],
    ['novo paciente', 'register'],
    ['buscar Maria Souza', 'search'],
    ['telefone da Ana', 'search'],
    ['quais pagamentos estão pendentes?', 'payments'],
    ['quem está devendo', 'payments'],
    ['tem pedido de agendamento aguardando?', 'approvals'],
    ['resumo do mês', 'summary'],
    ['quanto faturei', 'summary'],
    ['me mostra o prontuário da Maria', 'clinical'],
    ['ajuda', 'help'],
    ['bom dia', 'greeting'],
    ['obrigada!', 'thanks'],
    ['blablabla qualquer coisa', 'unknown'],
  ];
  for (const [text, intent] of cases) {
    it(`"${text}" → ${intent}`, () => expect(detectStaffIntent(text)).toBe(intent));
  }

  it('extrai o termo de busca', () => {
    expect(extractSearchTerm('buscar Maria Souza')).toBe('Maria Souza');
    expect(extractSearchTerm('telefone da Ana')).toBe('Ana');
    expect(extractSearchTerm('ficha do paciente João Pedro por favor')).toBe('João Pedro');
  });
});

describe('intenções do paciente', () => {
  const cases: [string, string][] = [
    ['quando é minha próxima sessão?', 'next_session'],
    ['quero marcar uma sessão', 'book'],
    ['quais horários disponíveis?', 'availability'],
    ['preciso remarcar', 'reschedule'],
    ['quero cancelar', 'cancel'],
    ['tenho algum pagamento pendente?', 'payments'],
    ['preciso do recibo para o reembolso', 'receipt'],
    ['quanto custa a sessão?', 'price'],
    ['onde fica o consultório?', 'contact'],
    ['cadê o link da sessão online', 'online_link'],
    ['tenho algum atestado?', 'documents'],
    ['quero apagar meus dados', 'privacy'],
    ['esqueci minha senha', 'account'],
    ['oi', 'greeting'],
    ['xyz', 'unknown'],
  ];
  for (const [text, intent] of cases) {
    it(`"${text}" → ${intent}`, () => expect(detectPatientIntent(text)).toBe(intent));
  }

  it('sinais de risco têm prioridade sobre qualquer outra intenção', () => {
    for (const t of [
      'quero morrer',
      'estou pensando em suicídio',
      'não quero mais viver',
      'vou me machucar',
      'quero cancelar tudo, quero me matar',
    ]) {
      expect(isCrisis(t)).toBe(true);
      expect(detectPatientIntent(t)).toBe('crisis');
    }
    expect(isCrisis('quero remarcar a sessão')).toBe(false);
    expect(isCrisis('estou morrendo de sono')).toBe(false);
  });
});

describe('respostas curtas', () => {
  it('sim/não/pular/cancelar', () => {
    expect(isYes('Sim')).toBe(true);
    expect(isYes('confirmar')).toBe(true);
    expect(isYes('sim, pode salvar')).toBe(true);
    expect(isNo('não')).toBe(true);
    expect(isSkip('pular')).toBe(true);
    expect(isSkip('não tem')).toBe(true);
    expect(isCancel('cancelar')).toBe(true);
    expect(isYes('talvez')).toBe(false);
  });
});

describe('extração de dados', () => {
  it('telefone', () => {
    expect(parsePhone('(11) 98888-7777')).toBe('11988887777');
    expect(parsePhone('+55 11 98888-7777')).toBe('11988887777');
    expect(parsePhone('1133334444')).toBe('1133334444');
    expect(parsePhone('sem telefone')).toBeNull();
  });
  it('nascimento', () => {
    expect(parseBirth('12/03/1990')).toBe('1990-03-12');
    expect(parseBirth('nasceu em 5-1-2001')).toBe('2001-01-05');
    expect(parseBirth('1985-11-02')).toBe('1985-11-02');
    expect(parseBirth('31/02/1990')).toBe('invalid');
    expect(parseBirth('12/03/2999')).toBe('invalid');
    expect(parseBirth('oi')).toBeNull();
  });
  it('nome', () => {
    expect(cleanName('maria da silva')).toBe('Maria da Silva');
    expect(cleanName('João Pedro')).toBe('João Pedro');
    expect(cleanName('123')).toBeNull();
    expect(cleanName('a')).toBeNull();
  });
  it('frase completa de cadastro', () => {
    const d = parsePatientDetails(
      'Cadastrar paciente Maria Souza, telefone (11) 98888-7777, e-mail Maria@Exemplo.com, nascimento 12/03/1990',
    );
    expect(d).toMatchObject({
      fullName: 'Maria Souza',
      phone: '11988887777',
      email: 'maria@exemplo.com',
      birthDate: '1990-03-12',
    });
  });
  it('só o nome', () => {
    expect(parsePatientDetails('cadastrar o paciente Carlos Eduardo Lima').fullName).toBe(
      'Carlos Eduardo Lima',
    );
    expect(parsePatientDetails('quero cadastrar uma paciente chamada Ana Paula').fullName).toBe(
      'Ana Paula',
    );
  });
  it('sem nome', () => {
    expect(parsePatientDetails('quero cadastrar um paciente').fullName).toBeUndefined();
    expect(parsePatientDetails('novo paciente').fullName).toBeUndefined();
  });
  it('CPF válido é reconhecido; inválido é ignorado', () => {
    expect(parsePatientDetails('cadastrar Ana Lima cpf 529.982.247-25').cpf).toBe('52998224725');
    expect(parsePatientDetails('cadastrar Ana Lima cpf 111.111.111-11').cpf).toBeUndefined();
  });
});
