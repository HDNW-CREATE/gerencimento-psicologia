import type { EmailBlock } from '@/emails/layout';

/** Substitui {{variavel}}. Variáveis ausentes viram string vazia. Valores NÃO são interpretados como HTML. */
export function interpolate(template: string, vars: Record<string, string | undefined>): string {
  return template.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_, k: string) => vars[k] ?? '');
}

const BUTTON_RE = /^\[\[(.+?)\|(.+?)\]\]$/;

/** Converte o corpo do template (texto simples) em blocos: parágrafos e botões. */
export function parseBody(body: string, vars: Record<string, string | undefined>): EmailBlock[] {
  const filled = interpolate(body, vars).replace(/\r\n/g, '\n');
  const blocks: EmailBlock[] = [];
  for (const raw of filled.split(/\n{2,}/)) {
    const chunk = raw.trim();
    if (!chunk) continue;
    // Um bloco pode misturar texto e botão; separa linha a linha.
    let buffer: string[] = [];
    const flush = () => {
      if (buffer.length) blocks.push({ type: 'p', text: buffer.join('\n') });
      buffer = [];
    };
    for (const line of chunk.split('\n')) {
      const m = BUTTON_RE.exec(line.trim());
      if (m) {
        flush();
        const url = m[2]!.trim();
        // Só http(s): bloqueia javascript: etc. vindos de variável/edição do template.
        if (/^https?:\/\//i.test(url)) blocks.push({ type: 'button', label: m[1]!.trim(), url });
      } else buffer.push(line);
    }
    flush();
  }
  return blocks;
}

/** Versão texto puro (fallback e anexo de log em dev). */
export function blocksToText(blocks: EmailBlock[]): string {
  return blocks
    .map((b) => (b.type === 'p' ? b.text.replace(/\*\*/g, '') : `${b.label}: ${b.url}`))
    .join('\n\n');
}
