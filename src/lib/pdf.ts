import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib';

/**
 * Pequeno construtor de PDF sobre `pdf-lib` (roda em serverless, sem navegador).
 * Usa fontes padrão (Latin-1/WinAnsi): acentos do português funcionam; caracteres fora
 * dessa faixa (emoji etc.) são substituídos por "?" para não quebrar a geração.
 */
const A4: [number, number] = [595.28, 841.89];
const MARGIN = 56;

/** Caracteres que a codificação WinAnsi consegue representar. */
const NOT_WINANSI = new RegExp(
  '[^\\t\\n\\u0020-\\u007E\\u00A0-\\u00FF\\u2013\\u2014\\u2018\\u2019\\u201C\\u201D\\u2022\\u2026\\u20AC]',
  'g',
);

/** Mantém só o que a codificação WinAnsi consegue representar. */
export function winAnsi(text: string): string {
  return text.split('\r').join('').replace(NOT_WINANSI, '?');
}

/** HTML simples (saída do editor) → texto com quebras de linha. */
export function htmlToText(html: string): string {
  return html
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/(p|h[1-6]|blockquote|div)>/gi, '\n\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/(ul|ol)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export class PdfBuilder {
  private doc!: PDFDocument;
  private font!: PDFFont;
  private bold!: PDFFont;
  private page!: PDFPage;
  private y = 0;

  constructor(private footerText = '') {}

  static async create(footerText = '') {
    const b = new PdfBuilder(footerText);
    b.doc = await PDFDocument.create();
    b.font = await b.doc.embedFont(StandardFonts.Helvetica);
    b.bold = await b.doc.embedFont(StandardFonts.HelveticaBold);
    b.newPage();
    return b;
  }

  get pdf() {
    return this.doc;
  }
  get width() {
    return A4[0] - MARGIN * 2;
  }
  get cursor() {
    return this.y;
  }

  newPage() {
    this.page = this.doc.addPage(A4);
    this.y = A4[1] - MARGIN;
  }

  private ensure(space: number) {
    if (this.y - space < MARGIN + 20) this.newPage();
  }

  private wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
    const lines: string[] = [];
    for (const para of winAnsi(text).split('\n')) {
      if (!para.trim()) {
        lines.push('');
        continue;
      }
      let line = '';
      for (const word of para.split(/\s+/)) {
        const test = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(test, size) <= maxWidth) line = test;
        else {
          if (line) lines.push(line);
          line = word;
        }
      }
      if (line) lines.push(line);
    }
    return lines;
  }

  text(
    text: string,
    opts: {
      size?: number;
      bold?: boolean;
      color?: [number, number, number];
      indent?: number;
      gap?: number;
      align?: 'left' | 'center' | 'right';
    } = {},
  ) {
    const size = opts.size ?? 11;
    const font = opts.bold ? this.bold : this.font;
    const indent = opts.indent ?? 0;
    const lh = size * 1.4;
    const [r, g, b] = opts.color ?? [0.13, 0.17, 0.15];
    for (const line of this.wrap(text, font, size, this.width - indent)) {
      this.ensure(lh);
      let x = MARGIN + indent;
      if (opts.align === 'center')
        x = MARGIN + (this.width - font.widthOfTextAtSize(line, size)) / 2;
      if (opts.align === 'right') x = MARGIN + this.width - font.widthOfTextAtSize(line, size);
      this.page.drawText(line, { x, y: this.y - size, size, font, color: rgb(r, g, b) });
      this.y -= lh;
    }
    this.y -= opts.gap ?? 0;
  }

  heading(text: string, size = 16) {
    this.ensure(size * 2);
    this.text(text, { size, bold: true, color: [0.25, 0.42, 0.34], gap: 4 });
  }

  rule() {
    this.ensure(10);
    this.page.drawLine({
      start: { x: MARGIN, y: this.y - 4 },
      end: { x: MARGIN + this.width, y: this.y - 4 },
      thickness: 0.6,
      color: rgb(0.8, 0.78, 0.72),
    });
    this.y -= 12;
  }

  space(n = 8) {
    this.y -= n;
  }

  /** Linha "rótulo: valor". */
  kv(label: string, value: string) {
    this.ensure(16);
    const l = winAnsi(`${label}: `);
    this.page.drawText(l, {
      x: MARGIN,
      y: this.y - 11,
      size: 11,
      font: this.bold,
      color: rgb(0.25, 0.3, 0.28),
    });
    const w = this.bold.widthOfTextAtSize(l, 11);
    const lines = this.wrap(value, this.font, 11, this.width - w);
    lines.forEach((line, i) => {
      if (i > 0) this.ensure(15);
      this.page.drawText(line, {
        x: MARGIN + w,
        y: this.y - 11,
        size: 11,
        font: this.font,
        color: rgb(0.13, 0.17, 0.15),
      });
      this.y -= 15;
    });
    if (lines.length === 0) this.y -= 15;
  }

  async image(
    bytes: Uint8Array,
    mime: string,
    maxW = 140,
    maxH = 60,
    align: 'left' | 'center' = 'left',
  ) {
    const img =
      mime === 'image/png'
        ? await this.doc.embedPng(bytes)
        : mime === 'image/jpeg'
          ? await this.doc.embedJpg(bytes)
          : null;
    if (!img) return;
    const scale = Math.min(maxW / img.width, maxH / img.height, 1);
    const w = img.width * scale;
    const h = img.height * scale;
    this.ensure(h + 6);
    const x = align === 'center' ? MARGIN + (this.width - w) / 2 : MARGIN;
    this.page.drawImage(img, { x, y: this.y - h, width: w, height: h });
    this.y -= h + 6;
  }

  async save(): Promise<Uint8Array> {
    const pages = this.doc.getPages();
    pages.forEach((p, i) => {
      const label = winAnsi(
        `${this.footerText}${this.footerText ? '  ·  ' : ''}Página ${i + 1} de ${pages.length}`,
      );
      const w = this.font.widthOfTextAtSize(label, 8);
      p.drawText(label, {
        x: (A4[0] - w) / 2,
        y: 28,
        size: 8,
        font: this.font,
        color: rgb(0.5, 0.5, 0.48),
      });
    });
    return this.doc.save();
  }
}
