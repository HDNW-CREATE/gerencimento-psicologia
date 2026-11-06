/* eslint-disable no-console */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient, type AppointmentStatus, type Modality } from '@prisma/client';
import {
  DEFAULT_FAQS,
  DEFAULT_SERVICES,
  EMAIL_TEMPLATE_DEFAULTS,
  LEGAL_DEFAULTS,
} from '../src/lib/defaults';
import { sealAnamnesis, sealRecord } from '../src/lib/clinical-crypto';
import { addDaysYmd, localToUtc, utcToLocalYmd } from '../src/lib/domain/time';
import { addMinutes } from 'date-fns';

const db = new PrismaClient();

async function seedBase() {
  // ── Conta ADMIN (nunca criada por cadastro público) ──
  const email = (process.env.SEED_ADMIN_EMAIL ?? 'admin@consultorio.local').toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'Troque123senha';
  const existing = await db.user.findUnique({ where: { email } });
  if (!existing) {
    await db.user.create({
      data: {
        email,
        name: process.env.SEED_ADMIN_NAME ?? 'Dra. Ana Exemplo',
        role: 'ADMIN',
        passwordHash: await bcrypt.hash(password, 12),
        emailVerifiedAt: new Date(),
      },
    });
    console.log(`✔ ADMIN criada: ${email}`);
  } else {
    console.log(`• ADMIN já existe: ${email} (senha preservada)`);
  }

  // ── Documentos legais v1 ──
  for (const [type, doc] of Object.entries(LEGAL_DEFAULTS)) {
    await db.legalDocument.upsert({
      where: { type_version: { type: type as keyof typeof LEGAL_DEFAULTS, version: 1 } },
      create: {
        type: type as keyof typeof LEGAL_DEFAULTS,
        version: 1,
        title: doc.title,
        content: doc.content,
      },
      update: {},
    });
  }

  // ── Templates de e-mail (não sobrescreve edições da psicóloga) ──
  for (const t of EMAIL_TEMPLATE_DEFAULTS) {
    await db.emailTemplate.upsert({ where: { key: t.key }, create: t, update: {} });
  }

  // ── Serviços ──
  if ((await db.serviceType.count()) === 0) {
    await db.serviceType.createMany({ data: DEFAULT_SERVICES });
  }

  // ── Disponibilidade: seg–sex, 9–12 e 14–18 ──
  if ((await db.availabilityRule.count()) === 0) {
    const rules = [];
    for (const weekday of [1, 2, 3, 4, 5]) {
      rules.push({ weekday, startMinute: 9 * 60, endMinute: 12 * 60 });
      rules.push({ weekday, startMinute: 14 * 60, endMinute: 18 * 60 });
    }
    await db.availabilityRule.createMany({ data: rules });
  }

  // ── FAQ ──
  if ((await db.faq.count()) === 0) {
    await db.faq.createMany({ data: DEFAULT_FAQS.map((f, i) => ({ ...f, sortOrder: i })) });
  }

  // ── Configurações padrão (defaults vêm dos schemas zod no primeiro acesso) ──
  await db.setting.upsert({
    where: { key: 'clinic' },
    create: { key: 'clinic', value: {} },
    update: {},
  });
  await db.setting.upsert({
    where: { key: 'scheduling' },
    create: { key: 'scheduling', value: {} },
    update: {},
  });
  await db.siteContent.upsert({
    where: { key: 'main' },
    create: { key: 'main', value: {} },
    update: {},
  });
  console.log('✔ Dados base (termos, e-mails, serviços, horários, FAQ) prontos');
}

async function seedDemo() {
  if ((await db.patientProfile.count()) > 0) {
    console.log('• Dados de demonstração já existem – pulando');
    return;
  }
  const admin = await db.user.findFirstOrThrow({ where: { role: 'ADMIN' } });
  const individual = await db.serviceType.findFirstOrThrow({ where: { isCouple: false } });
  const couple = await db.serviceType.findFirstOrThrow({ where: { isCouple: true } });
  const passwordHash = await bcrypt.hash('Paciente123', 12);
  const termo = await db.legalDocument.findFirstOrThrow({
    where: { type: 'TERMO_CONSENTIMENTO', version: 1 },
  });
  const politica = await db.legalDocument.findFirstOrThrow({
    where: { type: 'POLITICA_PRIVACIDADE', version: 1 },
  });
  const usoDoc = await db.legalDocument.findFirstOrThrow({
    where: { type: 'TERMOS_DE_USO', version: 1 },
  });

  async function patientWithAccount(name: string, email: string, extra: object = {}) {
    const user = await db.user.create({
      data: { name, email, role: 'PACIENTE', passwordHash, emailVerifiedAt: new Date() },
    });
    await db.consentAcceptance.createMany({
      data: [
        { userId: user.id, legalDocumentId: termo.id, ip: '127.0.0.1' },
        { userId: user.id, legalDocumentId: politica.id, ip: '127.0.0.1' },
        { userId: user.id, legalDocumentId: usoDoc.id, ip: '127.0.0.1' },
      ],
    });
    return db.patientProfile.create({
      data: {
        userId: user.id,
        fullName: name,
        email,
        phone: '11988887777',
        birthDate: new Date('1990-05-14'),
        ...extra,
      },
    });
  }

  const maria = await patientWithAccount('Maria Silva', 'maria@exemplo.com', {
    cpf: '52998224725',
    emergencyName: 'José Silva',
    emergencyPhone: '11977776666',
    emergencyRelation: 'Esposo',
    tags: ['indicação'],
  });
  const joao = await patientWithAccount('João Pereira', 'joao@exemplo.com', {
    customPriceCents: 17000,
    birthDate: new Date('1985-11-02'),
  });
  const carla = await patientWithAccount('Carla Mendes', 'carla@exemplo.com', {
    partnerName: 'Pedro Mendes',
    partnerPhone: '11966665555',
    partnerEmail: 'pedro@exemplo.com',
  });
  const ana = await db.patientProfile.create({
    data: {
      fullName: 'Ana Souza',
      email: 'ana@exemplo.com',
      phone: '11955554444',
      birthDate: new Date('1998-02-20'),
      tags: ['cadastro rápido'],
    },
  });
  const lucas = await db.patientProfile.create({
    data: {
      fullName: 'Lucas Almeida',
      phone: '11944443333',
      birthDate: new Date('2012-08-09'),
      guardianName: 'Fernanda Almeida',
      guardianCpf: '11144477735',
      guardianPhone: '11944443333',
      guardianEmail: 'fernanda@exemplo.com',
      guardianRelation: 'Mãe',
    },
  });
  await db.patientProfile.create({
    data: {
      fullName: 'Roberto Lima',
      email: 'roberto@exemplo.com',
      status: 'ALTA',
      birthDate: new Date('1979-03-30'),
    },
  });

  // ── Sessões ──
  const today = utcToLocalYmd(new Date());
  const slotKeys = new Set<string>();
  async function appt(
    patientId: string,
    serviceId: string,
    dayOffset: number,
    hour: number,
    status: AppointmentStatus,
    opts: { modality?: Modality; price?: number; duration?: number } = {},
  ) {
    const ymd = addDaysYmd(today, dayOffset);
    const key = `${ymd}-${hour}`;
    if (slotKeys.has(key)) throw new Error(`Seed: conflito ${key}`);
    slotKeys.add(key);
    const startsAt = localToUtc(ymd, hour * 60);
    const modality = opts.modality ?? 'PRESENCIAL';
    return db.appointment.create({
      data: {
        patientId,
        serviceTypeId: serviceId,
        startsAt,
        endsAt: addMinutes(startsAt, opts.duration ?? 50),
        modality,
        status,
        priceCents: opts.price ?? 20000,
        meetingUrl: modality === 'ONLINE' ? 'https://meet.google.com/abc-defg-hij' : null,
        createdByRole: 'ADMIN',
        createdById: admin.id,
        confirmedAt: ['AGENDADA', 'PENDENTE'].includes(status) ? null : new Date(),
      },
    });
  }

  const past = [
    await appt(maria.id, individual.id, -35, 10, 'REALIZADA'),
    await appt(maria.id, individual.id, -28, 10, 'REALIZADA'),
    await appt(maria.id, individual.id, -21, 10, 'REALIZADA', { modality: 'ONLINE' }),
    await appt(maria.id, individual.id, -14, 10, 'FALTA'),
    await appt(maria.id, individual.id, -7, 10, 'REALIZADA'),
    await appt(joao.id, individual.id, -20, 15, 'REALIZADA', { price: 17000 }),
    await appt(joao.id, individual.id, -6, 15, 'REALIZADA', { price: 17000 }),
    await appt(carla.id, couple.id, -10, 16, 'REALIZADA', { price: 30000, duration: 80 }),
    await appt(ana.id, individual.id, -12, 11, 'CANCELADA_PACIENTE'),
  ];

  // Financeiro: mistura de pago e pendente
  const paid = new Set([0, 1, 2, 3, 5, 7]);
  for (const [i, a] of past.entries()) {
    if (a.status === 'CANCELADA_PACIENTE') continue;
    await db.payment.create({
      data: {
        patientId: a.patientId,
        appointmentId: a.id,
        amountCents: a.priceCents,
        status: paid.has(i) ? 'PAGO' : 'PENDENTE',
        method: paid.has(i) ? (i % 2 ? 'PIX' : 'DINHEIRO') : null,
        paidAt: paid.has(i) ? a.startsAt : null,
        dueDate: new Date(a.startsAt.toISOString().slice(0, 10)),
      },
    });
  }

  // Próximas sessões
  await appt(maria.id, individual.id, 2, 10, 'CONFIRMADA', { modality: 'ONLINE' });
  await appt(joao.id, individual.id, 3, 15, 'AGENDADA', { price: 17000 });
  await appt(carla.id, couple.id, 4, 16, 'CONFIRMADA', { price: 30000, duration: 80 });
  await appt(ana.id, individual.id, 5, 11, 'PENDENTE', { modality: 'ONLINE' });
  await appt(lucas.id, individual.id, 6, 14, 'AGENDADA');
  await appt(maria.id, individual.id, 9, 10, 'AGENDADA');

  // Pacote de exemplo
  await db.sessionPackage.create({
    data: {
      patientId: joao.id,
      name: 'Pacote 4 sessões',
      totalSessions: 4,
      priceCents: 64000,
    },
  });

  // Bloqueio de exemplo (compromisso)
  await db.availabilityBlock.create({
    data: {
      startsAt: localToUtc(addDaysYmd(today, 12), 0),
      endsAt: localToUtc(addDaysYmd(today, 16), 0),
      reason: 'Congresso (exemplo)',
    },
  });

  // Prontuário de exemplo (CRIPTOGRAFADO) – conteúdo fictício
  const first = past[0]!;
  const rec = await db.clinicalRecord.create({
    data: {
      patientId: maria.id,
      appointmentId: first.id,
      authorId: admin.id,
      contentEnc: sealRecord(maria.id, {
        title: 'Evolução – sessão inicial',
        html: '<p>Paciente chegou pontualmente. <strong>Registro fictício de demonstração.</strong> Combinada frequência semanal.</p>',
      }),
    },
  });
  await db.clinicalRecordVersion.create({
    data: { recordId: rec.id, version: 1, contentEnc: rec.contentEnc, editedById: admin.id },
  });
  const anam = await db.anamnesis.create({
    data: {
      patientId: maria.id,
      dataEnc: sealAnamnesis(maria.id, {
        queixa_principal: 'Ansiedade no trabalho (exemplo fictício).',
      }),
    },
  });
  await db.anamnesisVersion.create({
    data: { anamnesisId: anam.id, version: 1, dataEnc: anam.dataEnc, editedById: admin.id },
  });

  console.log('✔ Dados de demonstração criados (pacientes: senha "Paciente123")');
  console.log('  maria@exemplo.com · joao@exemplo.com · carla@exemplo.com');
}

async function main() {
  await seedBase();
  if (process.env.SEED_DEMO_DATA === 'true') await seedDemo();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
