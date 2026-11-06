// Simula `next/headers` nos testes de integração (sem requisição HTTP).
export async function headers() {
  return new Headers({ 'x-forwarded-for': '203.0.113.9', 'user-agent': 'vitest' });
}
export async function cookies() {
  return { get: () => undefined, set: () => undefined, delete: () => undefined };
}
