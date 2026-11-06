import { describe, expect, it } from 'vitest';
import { valorPorExtenso } from '@/lib/extenso';

describe('valorPorExtenso', () => {
  const cases: [number, string][] = [
    [0, 'zero reais'],
    [100, 'um real'],
    [200_00, 'duzentos reais'],
    [150_50, 'cento e cinquenta reais e cinquenta centavos'],
    [180_00, 'cento e oitenta reais'],
    [100_00, 'cem reais'],
    [1_000_00, 'mil reais'],
    [1_500_00, 'mil e quinhentos reais'],
    [1_050_00, 'mil e cinquenta reais'],
    [2_345_67, 'dois mil trezentos e quarenta e cinco reais e sessenta e sete centavos'],
    [1, 'um centavo'],
    [12_000_00, 'doze mil reais'],
    [1_000_000_00, 'um milhão de reais'],
  ];
  for (const [cents, words] of cases) {
    it(`${cents / 100} → ${words}`, () => expect(valorPorExtenso(cents)).toBe(words));
  }
});
