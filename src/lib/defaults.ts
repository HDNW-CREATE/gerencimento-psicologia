/**
 * Conteúdos iniciais (seed) editáveis depois pelo painel.
 * Variáveis de e-mail: {{nome}} {{data}} {{hora}} {{servico}} {{modalidade}} {{link_sessao}}
 * {{local}} {{consultorio}} {{profissional}} {{link}} {{valor}} {{motivo}}
 * Botão: uma linha no formato  [[Texto do botão|{{link}}]]
 */

export interface EmailTemplateDefault {
  key: string;
  name: string;
  subject: string;
  body: string;
}

export const EMAIL_TEMPLATE_DEFAULTS: EmailTemplateDefault[] = [
  {
    key: 'welcome_verify',
    name: 'Boas-vindas e confirmação de e-mail',
    subject: 'Bem-vindo(a)! Confirme seu e-mail – {{consultorio}}',
    body: `Olá, {{nome}}!

Seu cadastro foi realizado com sucesso. Para agendar sua primeira sessão, precisamos confirmar o seu e-mail.

[[Confirmar meu e-mail|{{link}}]]

O link vale por 24 horas. Se você não criou esta conta, pode ignorar esta mensagem.`,
  },
  {
    key: 'appointment_requested',
    name: 'Agendamento recebido (aguardando confirmação)',
    subject: 'Recebemos o seu pedido de agendamento',
    body: `Olá, {{nome}}!

Recebemos o seu pedido de sessão ({{servico}}, {{modalidade}}) para {{data}} às {{hora}}.

O horário será confirmado pela {{profissional}} em breve — você receberá um novo e-mail assim que isso acontecer.`,
  },
  {
    key: 'appointment_confirmed',
    name: 'Agendamento confirmado',
    subject: 'Sessão confirmada: {{data}} às {{hora}}',
    body: `Olá, {{nome}}!

Sua sessão está confirmada:

**{{servico}} – {{modalidade}}**
{{data}} às {{hora}}
{{local}}

Em anexo está um arquivo para adicionar o compromisso à agenda do seu celular.

Precisa remarcar ou cancelar? Faça isso pela sua área do paciente com antecedência.

[[Ver minhas sessões|{{link}}]]`,
  },
  {
    key: 'appointment_refused',
    name: 'Agendamento não aceito',
    subject: 'Não foi possível confirmar o horário solicitado',
    body: `Olá, {{nome}}.

Infelizmente não foi possível confirmar a sessão solicitada para {{data}} às {{hora}}.

{{motivo}}

Você pode escolher outro horário disponível:

[[Escolher novo horário|{{link}}]]`,
  },
  {
    key: 'appointment_rescheduled',
    name: 'Sessão remarcada',
    subject: 'Sua sessão foi remarcada para {{data}} às {{hora}}',
    body: `Olá, {{nome}}!

Sua sessão foi remarcada. O novo horário é:

**{{data}} às {{hora}}** ({{modalidade}})
{{local}}

Em anexo está o arquivo atualizado para a sua agenda.

[[Ver minhas sessões|{{link}}]]`,
  },
  {
    key: 'appointment_cancelled',
    name: 'Sessão cancelada',
    subject: 'Sessão cancelada – {{data}} às {{hora}}',
    body: `Olá, {{nome}}.

A sessão de {{data}} às {{hora}} foi cancelada.

{{motivo}}

Quando quiser, você pode agendar um novo horário:

[[Agendar nova sessão|{{link}}]]`,
  },
  {
    key: 'reminder_24h',
    name: 'Lembrete (24 horas antes)',
    subject: 'Lembrete: sua sessão é amanhã às {{hora}}',
    body: `Olá, {{nome}}!

Este é um lembrete da sua sessão:

**{{data}} às {{hora}}** – {{modalidade}}
{{local}}

{{link_sessao}}

Se não puder comparecer, avise com antecedência pela sua área do paciente.`,
  },
  {
    key: 'reminder_2h',
    name: 'Lembrete (2 horas antes)',
    subject: 'Sua sessão começa às {{hora}}',
    body: `Olá, {{nome}}!

Sua sessão começa em breve, às {{hora}}.

{{local}}

{{link_sessao}}

Até já!`,
  },
  {
    key: 'payment_pending',
    name: 'Aviso de pagamento pendente',
    subject: 'Pagamento pendente – {{consultorio}}',
    body: `Olá, {{nome}}.

Identificamos um pagamento pendente no valor de {{valor}} referente à sessão de {{data}}.

Se já realizou o pagamento, desconsidere este aviso. Em caso de dúvidas, responda este e-mail.

[[Ver meu financeiro|{{link}}]]`,
  },
  {
    key: 'password_reset',
    name: 'Recuperação de senha',
    subject: 'Redefinição de senha',
    body: `Olá, {{nome}}.

Recebemos um pedido para redefinir a sua senha. Clique no botão abaixo para criar uma nova senha:

[[Redefinir minha senha|{{link}}]]

O link é de uso único e vale por 1 hora. Se não foi você, ignore esta mensagem — sua senha continua a mesma.`,
  },
  {
    key: 'admin_new_appointment',
    name: 'Aviso à psicóloga: novo agendamento',
    subject: 'Novo agendamento: {{nome}} – {{data}} às {{hora}}',
    body: `Novo agendamento recebido.

**Paciente:** {{nome}}
**Sessão:** {{servico}} ({{modalidade}})
**Horário:** {{data}} às {{hora}}

[[Abrir na agenda|{{link}}]]`,
  },
  {
    key: 'admin_cancelled',
    name: 'Aviso à psicóloga: cancelamento/remarcação',
    subject: 'Alteração na agenda: {{nome}}',
    body: `{{motivo}}

**Paciente:** {{nome}}
**Horário:** {{data}} às {{hora}}

[[Abrir na agenda|{{link}}]]`,
  },
  {
    key: 'announcement',
    name: 'Aviso / mensagem aos pacientes',
    subject: '{{assunto}}',
    body: `Olá, {{nome}}!

{{mensagem}}

Atenciosamente,
{{profissional}}`,
  },
];

export const DEFAULT_SERVICES = [
  {
    name: 'Terapia individual',
    description: 'Atendimento individual para adultos e adolescentes, com foco nas suas demandas.',
    durationMinutes: 50,
    priceCents: 20000,
    isCouple: false,
    sortOrder: 1,
  },
  {
    name: 'Terapia de casal',
    description: 'Espaço para o casal dialogar, resolver conflitos e fortalecer o vínculo.',
    durationMinutes: 80,
    priceCents: 30000,
    isCouple: true,
    sortOrder: 2,
  },
];

export const DEFAULT_FAQS = [
  {
    question: 'Como funciona a primeira sessão?',
    answer:
      'A primeira sessão é um encontro de acolhimento: conversamos sobre o que trouxe você até aqui, esclareço como funciona o processo e combinamos juntos a frequência dos atendimentos.',
  },
  {
    question: 'As sessões online têm a mesma eficácia?',
    answer:
      'Sim. Pesquisas mostram resultados equivalentes ao presencial para a maioria das demandas. Você só precisa de internet estável e um local reservado.',
  },
  {
    question: 'Qual a duração e a frequência das sessões?',
    answer: 'As sessões individuais têm 50 minutos e, em geral, acontecem uma vez por semana.',
  },
  {
    question: 'Posso remarcar ou cancelar uma sessão?',
    answer:
      'Sim, pela sua área do paciente, com no mínimo 24 horas de antecedência. Fora desse prazo, entre em contato diretamente.',
  },
  {
    question: 'As informações da terapia são sigilosas?',
    answer:
      'Sim. O sigilo é garantido pelo Código de Ética Profissional do Psicólogo e pela LGPD. Os registros ficam criptografados e só a psicóloga tem acesso.',
  },
];

/** Textos-modelo. IMPORTANTE: devem ser revisados por um profissional do direito antes de uso real. */
export const LEGAL_DEFAULTS = {
  TERMO_CONSENTIMENTO: {
    title: 'Termo de Consentimento Livre e Esclarecido',
    content: `## 1. Natureza do serviço
Declaro que fui informado(a) de que o atendimento psicológico é realizado por psicóloga devidamente registrada no Conselho Regional de Psicologia, com finalidade de promoção de saúde mental, nos termos do Código de Ética Profissional do Psicólogo.

## 2. Sigilo profissional
As informações compartilhadas nas sessões são sigilosas. O sigilo poderá ser quebrado apenas nas hipóteses previstas em lei e no Código de Ética (por exemplo, risco grave à vida do paciente ou de terceiros), limitando-se ao estritamente necessário.

## 3. Registro documental
Estou ciente de que a psicóloga mantém registro documental do atendimento (prontuário), conforme as resoluções do Conselho Federal de Psicologia, guardado de forma segura e criptografada por, no mínimo, 5 anos.

## 4. Atendimento online
Quando realizado por meio de tecnologias de informação e comunicação, comprometo-me a participar de local reservado, a não gravar as sessões e a informar imediatamente intercorrências técnicas.

## 5. Faltas, remarcações e cancelamentos
Cancelamentos e remarcações devem ser feitos com a antecedência mínima definida pelo consultório. Faltas sem aviso prévio poderão ser cobradas.

## 6. Menores de idade
Para pacientes menores de 18 anos, o responsável legal declara ciência e concordância com este termo.

## 7. Consentimento
Declaro que li, compreendi e concordo com este termo, e que posso retirar meu consentimento a qualquer momento, ciente de que isso encerra o atendimento, preservando-se os registros que a lei obriga a manter.`,
  },
  POLITICA_PRIVACIDADE: {
    title: 'Política de Privacidade',
    content: `## 1. Quem somos
Esta política explica como o consultório trata seus dados pessoais, em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 – LGPD). O controlador dos dados é a psicóloga responsável, identificada na página inicial do site.

## 2. Dados que coletamos
Dados cadastrais (nome, e-mail, telefone, data de nascimento, CPF quando informado), dados de agendamento e financeiros e, no atendimento, dados de saúde (dados pessoais sensíveis) registrados em prontuário.

## 3. Finalidades e bases legais
Prestação do serviço de psicoterapia e tutela da saúde, execução de contrato, cumprimento de obrigações legais e regulatórias (guarda de prontuário e emissão de recibos) e consentimento, quando aplicável.

## 4. Compartilhamento
Não vendemos dados. Compartilhamos apenas com fornecedores essenciais à operação (hospedagem, banco de dados, envio de e-mails), sob obrigação de confidencialidade.

## 5. Segurança
Usamos criptografia em trânsito (HTTPS), criptografia em nível de aplicação para o prontuário, controle de acesso por perfil e registros de auditoria.

## 6. Retenção
Prontuários são mantidos por no mínimo 5 anos, conforme normas do Conselho Federal de Psicologia. Demais dados são mantidos enquanto necessários às finalidades descritas ou exigidos por lei.

## 7. Seus direitos
Você pode solicitar confirmação de tratamento, acesso, correção, portabilidade e, quando cabível, exclusão dos dados, pela área "Privacidade" da sua conta. Pedidos de exclusão respeitam a obrigação legal de guarda do prontuário.

## 8. Contato
Dúvidas sobre privacidade podem ser enviadas ao e-mail de contato do consultório.`,
  },
  TERMOS_DE_USO: {
    title: 'Termos de Uso',
    content: `## 1. Aceitação
Ao criar uma conta, você concorda com estes Termos de Uso e com a Política de Privacidade.

## 2. Uso da conta
Você é responsável por manter sua senha em sigilo e por fornecer informações verdadeiras. Não compartilhe sua conta.

## 3. Agendamentos
Os horários exibidos estão sujeitos à confirmação da psicóloga quando indicado. Respeite os prazos de remarcação e cancelamento informados no sistema.

## 4. Emergências
Este sistema NÃO é um serviço de emergência. Em situação de crise ou risco de vida, procure o SAMU (192), o CVV (188) ou o pronto-socorro mais próximo.

## 5. Alterações
Estes termos podem ser atualizados. Mudanças relevantes exigirão novo aceite.`,
  },
} as const;
