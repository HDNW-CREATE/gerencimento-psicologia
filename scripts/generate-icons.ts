/* eslint-disable no-console */
/**
 * Gera os ícones PWA (PNG) sem dependências externas: fundo verde-sálvia com um círculo claro.
 * Uso: npm run icons   (já existem em public/icons; rode de novo para trocar as cores)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { deflateSync } from 'node:zlib';

function crc32(buf: Buffer): number {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function png(size: number, opts: { padding: number }): Buffer {
  const bg = [63, 101, 84]; // #3f6554
  const fg = [248, 245, 239]; // #f8f5ef
  const raw = Buffer.alloc((size * 3 + 1) * size);
  const cx = size / 2;
  const cy = size / 2;
  const r = (size / 2 - opts.padding) * 0.62;
  // Símbolo simples: círculo claro com um "recorte" que lembra uma folha/abraço
  for (let y = 0; y < size; y++) {
    const row = y * (size * 3 + 1);
    raw[row] = 0;
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - cx, y - cy);
      const inner = Math.hypot(x - (cx + r * 0.28), y - (cy - r * 0.1));
      const ring = d <= r && inner > r * 0.62;
      const [R, G, B] = ring ? fg : bg;
      raw[row + 1 + x * 3] = R!;
      raw[row + 2 + x * 3] = G!;
      raw[row + 3 + x * 3] = B!;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // 8 bits
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const dir = path.join(process.cwd(), 'public', 'icons');
mkdirSync(dir, { recursive: true });
writeFileSync(path.join(dir, 'icon-192.png'), png(192, { padding: 0 }));
writeFileSync(path.join(dir, 'icon-512.png'), png(512, { padding: 0 }));
// "maskable": o conteúdo fica dentro da zona segura (~80%)
writeFileSync(path.join(dir, 'icon-512-maskable.png'), png(512, { padding: 50 }));
console.log('Ícones gerados em public/icons');
