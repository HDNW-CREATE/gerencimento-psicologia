import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    globalSetup: ['tests/integration/global-setup.ts'],
    setupFiles: ['tests/integration/setup-env.ts'],
    fileParallelism: false, // um banco compartilhado: arquivos em sequência
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      'server-only': path.resolve(__dirname, 'tests/mocks/empty.ts'),
      'next/headers': path.resolve(__dirname, 'tests/mocks/next-headers.ts'),
      'next/cache': path.resolve(__dirname, 'tests/mocks/next-cache.ts'),
    },
  },
});
