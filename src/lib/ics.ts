/** Gerador mínimo de arquivos .ics (RFC 5545) para adicionar a sessão à agenda do celular. */

export interface IcsEvent {
  uid: string;
  startsAt: Date;
  endsAt: Date;
  summary: string;
  description?: string;
  location?: string;
  url?: string;
  organizerName?: string;
  organizerEmail?: string;
  /** Incrementar a cada alteração para o app de agenda atualizar o evento existente. */
  sequence?: number;
  method?: 'REQUEST' | 'CANCEL';
}

const fmt = (d: Date) =>
  d
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');

function esc(v: string) {
  return v
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** Dobra linhas com mais de 75 octetos, como exige a RFC. */
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (Buffer.byteLength(rest) > 75) {
    let cut = 75;
    while (Buffer.byteLength(rest.slice(0, cut)) > 75) cut--;
    out.push(rest.slice(0, cut));
    rest = ` ${rest.slice(cut)}`;
  }
  out.push(rest);
  return out.join('\r\n');
}

export function buildIcs(ev: IcsEvent): Buffer {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Consultorio//Agenda//PT-BR',
    'CALSCALE:GREGORIAN',
    `METHOD:${ev.method ?? 'REQUEST'}`,
    'BEGIN:VEVENT',
    `UID:${ev.uid}`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(ev.startsAt)}`,
    `DTEND:${fmt(ev.endsAt)}`,
    `SEQUENCE:${ev.sequence ?? 0}`,
    `STATUS:${ev.method === 'CANCEL' ? 'CANCELLED' : 'CONFIRMED'}`,
    `SUMMARY:${esc(ev.summary)}`,
  ];
  if (ev.description) lines.push(`DESCRIPTION:${esc(ev.description)}`);
  if (ev.location) lines.push(`LOCATION:${esc(ev.location)}`);
  if (ev.url) lines.push(`URL:${ev.url}`);
  if (ev.organizerEmail) {
    lines.push(
      `ORGANIZER;CN=${esc(ev.organizerName ?? 'Consultório')}:mailto:${ev.organizerEmail}`,
    );
  }
  // Alarme 1h antes
  lines.push(
    'BEGIN:VALARM',
    'TRIGGER:-PT1H',
    'ACTION:DISPLAY',
    'DESCRIPTION:Sessão em 1 hora',
    'END:VALARM',
  );
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return Buffer.from(lines.map(fold).join('\r\n') + '\r\n', 'utf8');
}
