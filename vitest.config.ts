import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    env: {
      // Chaves FIXAS apenas para testes (nunca use em produção)
      CLINICAL_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
      AUTH_SECRET: 'test-secret-test-secret-test-secret',
      DATABASE_URL: 'postgresql://x:x@localhost:5432/x',
    },
  },
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
});
