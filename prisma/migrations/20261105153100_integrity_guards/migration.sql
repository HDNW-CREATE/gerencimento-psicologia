-- Garantias de integridade que o Prisma não consegue modelar.

-- 1) Anti-duplo-agendamento: duas sessões que "ocupam" o horário não podem se sobrepor.
--    O intervalo é semiaberto [início, fim), então 10:00–10:50 e 10:50–11:40 não conflitam.
--    Sessões canceladas/recusadas/apagadas (soft delete) não ocupam horário.
--    Mesmo que a aplicação tenha um bug de concorrência, o banco recusa (erro 23P01).
ALTER TABLE "Appointment"
  ADD CONSTRAINT "Appointment_no_overlap"
  EXCLUDE USING gist (tstzrange("startsAt", "endsAt", '[)') WITH &&)
  WHERE ("deletedAt" IS NULL AND "status" IN ('PENDENTE', 'AGENDADA', 'CONFIRMADA', 'REALIZADA', 'FALTA'));

ALTER TABLE "Appointment"
  ADD CONSTRAINT "Appointment_time_order" CHECK ("endsAt" > "startsAt");

-- 2) Disponibilidade semanal coerente.
ALTER TABLE "AvailabilityRule"
  ADD CONSTRAINT "AvailabilityRule_valid"
  CHECK ("weekday" BETWEEN 0 AND 6 AND "startMinute" >= 0 AND "endMinute" <= 1440 AND "endMinute" > "startMinute");

ALTER TABLE "AvailabilityBlock"
  ADD CONSTRAINT "AvailabilityBlock_time_order" CHECK ("endsAt" > "startsAt");

-- 3) Valores financeiros nunca negativos.
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_amount_nonneg" CHECK ("amountCents" >= 0);
ALTER TABLE "SessionPackage"
  ADD CONSTRAINT "SessionPackage_valid" CHECK ("priceCents" >= 0 AND "totalSessions" > 0);
ALTER TABLE "ServiceType"
  ADD CONSTRAINT "ServiceType_valid" CHECK ("priceCents" >= 0 AND "durationMinutes" > 0);

-- 4) Prontuário: nunca apagar definitivamente por engano. O registro e as versões
--    só podem ser removidos se alguém desabilitar este gatilho de propósito.
CREATE OR REPLACE FUNCTION prevent_clinical_delete() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Registros clínicos não podem ser apagados (use retificação/invalidação).';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ClinicalRecord_no_delete"
  BEFORE DELETE ON "ClinicalRecord"
  FOR EACH ROW EXECUTE FUNCTION prevent_clinical_delete();

CREATE TRIGGER "ClinicalRecordVersion_no_delete"
  BEFORE DELETE ON "ClinicalRecordVersion"
  FOR EACH ROW EXECUTE FUNCTION prevent_clinical_delete();

-- Versões antigas são imutáveis (histórico de alterações confiável).
CREATE OR REPLACE FUNCTION prevent_version_update() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Versões do prontuário são imutáveis.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ClinicalRecordVersion_no_update"
  BEFORE UPDATE ON "ClinicalRecordVersion"
  FOR EACH ROW EXECUTE FUNCTION prevent_version_update();

CREATE TRIGGER "AnamnesisVersion_no_update"
  BEFORE UPDATE ON "AnamnesisVersion"
  FOR EACH ROW EXECUTE FUNCTION prevent_version_update();
