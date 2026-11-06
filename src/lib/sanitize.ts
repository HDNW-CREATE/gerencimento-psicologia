import sanitizeHtml from 'sanitize-html';

/** HTML permitido no editor de texto rico (anti-XSS). Sem atributos, scripts, estilos ou links. */
export function sanitizeRichText(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      'p',
      'br',
      'strong',
      'b',
      'em',
      'i',
      'u',
      's',
      'ul',
      'ol',
      'li',
      'h2',
      'h3',
      'blockquote',
      'hr',
    ],
    allowedAttributes: {},
    disallowedTagsMode: 'discard',
  }).slice(0, 100_000);
}
