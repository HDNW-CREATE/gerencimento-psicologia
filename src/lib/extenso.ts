/** Valor monetário por extenso em português do Brasil (ex.: 150,50 → "cento e cinquenta reais e cinquenta centavos"). */

const UNIDADES = [
  'zero',
  'um',
  'dois',
  'três',
  'quatro',
  'cinco',
  'seis',
  'sete',
  'oito',
  'nove',
  'dez',
  'onze',
  'doze',
  'treze',
  'quatorze',
  'quinze',
  'dezesseis',
  'dezessete',
  'dezoito',
  'dezenove',
];
const DEZENAS = [
  '',
  '',
  'vinte',
  'trinta',
  'quarenta',
  'cinquenta',
  'sessenta',
  'setenta',
  'oitenta',
  'noventa',
];
const CENTENAS = [
  '',
  'cento',
  'duzentos',
  'trezentos',
  'quatrocentos',
  'quinhentos',
  'seiscentos',
  'setecentos',
  'oitocentos',
  'novecentos',
];

/** 0–999 por extenso (0 retorna ""). */
function ate999(n: number): string {
  if (n === 0) return '';
  if (n === 100) return 'cem';
  const parts: string[] = [];
  const c = Math.floor(n / 100);
  const resto = n % 100;
  if (c) parts.push(CENTENAS[c]!);
  if (resto) {
    if (resto < 20) parts.push(UNIDADES[resto]!);
    else {
      const d = Math.floor(resto / 10);
      const u = resto % 10;
      parts.push(u ? `${DEZENAS[d]} e ${UNIDADES[u]}` : DEZENAS[d]!);
    }
  }
  return parts.join(' e ');
}

/** Inteiro de 0 a 999.999.999 por extenso. */
export function numeroPorExtenso(n: number): string {
  if (n === 0) return 'zero';
  const milhoes = Math.floor(n / 1_000_000);
  const milhares = Math.floor((n % 1_000_000) / 1000);
  const resto = n % 1000;
  const parts: string[] = [];
  if (milhoes) parts.push(milhoes === 1 ? 'um milhão' : `${ate999(milhoes)} milhões`);
  if (milhares) parts.push(milhares === 1 ? 'mil' : `${ate999(milhares)} mil`);
  if (resto) parts.push(ate999(resto));
  // "e" antes do último bloco quando ele é < 100 ou múltiplo de 100 ("mil e quinhentos", "mil e cinquenta")
  if (parts.length > 1) {
    const last = parts[parts.length - 1]!;
    const lastValue = resto || milhares;
    if (lastValue < 100 || lastValue % 100 === 0) {
      return `${parts.slice(0, -1).join(' ')} e ${last}`;
    }
    return parts.join(' ');
  }
  return parts[0]!;
}

export function valorPorExtenso(cents: number): string {
  const reais = Math.floor(cents / 100);
  const centavos = cents % 100;
  const partes: string[] = [];
  // "um milhão DE reais" (múltiplos exatos de milhão levem "de")
  const de = reais >= 1_000_000 && reais % 1_000_000 === 0 ? ' de' : '';
  if (reais > 0) partes.push(`${numeroPorExtenso(reais)}${de} ${reais === 1 ? 'real' : 'reais'}`);
  if (centavos > 0)
    partes.push(`${numeroPorExtenso(centavos)} ${centavos === 1 ? 'centavo' : 'centavos'}`);
  return partes.length ? partes.join(' e ') : 'zero reais';
}
