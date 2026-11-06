// Executa ANTES de cada arquivo de teste: aponta o Prisma para o banco de testes.
import 'dotenv/config';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL!;
process.env.CLINICAL_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString('base64');
process.env.AUTH_SECRET = 'integration-secret-integration-secret';
process.env.E2E_MAIL_SINK = 'true'; // e-mails vão para .dev-mail/, nunca saem
