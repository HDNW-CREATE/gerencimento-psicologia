import { describe, expect, it } from 'vitest';
import { decrypt, encrypt, generateToken, hashToken, safeEqual } from '@/lib/crypto';
import { sealRecord, openRecord } from '@/lib/clinical-crypto';
import { ageOn, isMinor, isValidCpf, parseMoneyToCents, passwordSchema } from '@/lib/validators';

describe('criptografia AES-256-GCM', () => {
  it('cifra e decifra', () => {
    const enc = encrypt('texto sigiloso ção');
    expect(enc.startsWith('v1:')).toBe(true);
    expect(enc).not.toContain('sigiloso');
    expect(decrypt(enc)).toBe('texto sigiloso ção');
  });
  it('IV aleatório: mesma entrada gera cifrados diferentes', () => {
    expect(encrypt('a')).not.toBe(encrypt('a'));
  });
  it('detecta adulteração (GCM)', () => {
    const parts = encrypt('abc').split(':');
    const ct = Buffer.from(parts[3]!, 'base64');
    ct[0] = ct[0]! ^ 1;
    parts[3] = ct.toString('base64');
    expect(() => decrypt(parts.join(':'))).toThrow();
  });
  it('AAD: conteúdo de um paciente não abre em outro', () => {
    const enc = sealRecord('paciente-A', { html: '<p>x</p>' });
    expect(openRecord('paciente-A', enc).html).toBe('<p>x</p>');
    expect(() => openRecord('paciente-B', enc)).toThrow();
  });
  it('rejeita formato inválido', () => {
    expect(() => decrypt('lixo')).toThrow();
  });
});

describe('tokens', () => {
  it('gera token e hash estáveis', () => {
    const { token, hash } = generateToken();
    expect(token.length).toBeGreaterThan(30);
    expect(hashToken(token)).toBe(hash);
  });
  it('safeEqual', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });
});

describe('validações brasileiras', () => {
  it('CPF', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true);
    expect(isValidCpf('52998224726')).toBe(false);
    expect(isValidCpf('111.111.111-11')).toBe(false);
    expect(isValidCpf('123')).toBe(false);
  });
  it('senha forte', () => {
    expect(passwordSchema.safeParse('abc12345').success).toBe(true);
    expect(passwordSchema.safeParse('abcdefgh').success).toBe(false);
    expect(passwordSchema.safeParse('12345678').success).toBe(false);
    expect(passwordSchema.safeParse('a1').success).toBe(false);
  });
  it('menoridade', () => {
    const ref = new Date('2026-03-10T12:00:00Z');
    expect(isMinor('2010-03-11', ref)).toBe(true); // faz 16 amanhã
    expect(isMinor('2008-03-10', ref)).toBe(false); // faz 18 hoje
    expect(ageOn('2000-12-31', ref)).toBe(25);
  });
  it('dinheiro', () => {
    expect(parseMoneyToCents('R$ 1.234,56')).toBe(123456);
    expect(parseMoneyToCents('200')).toBe(20000);
    expect(parseMoneyToCents('150,5')).toBe(15050);
    expect(parseMoneyToCents('abc')).toBeNull();
  });
});
