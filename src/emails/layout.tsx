import * as React from 'react';
import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';

/** Identidade visual do consultório nos e-mails (tons suaves, tipografia limpa). */
const colors = {
  bg: '#f5f1ea',
  card: '#ffffff',
  primary: '#4f7a68',
  text: '#2d3a35',
  muted: '#74807b',
  border: '#e6e0d4',
};

export type EmailBlock =
  { type: 'p'; text: string } | { type: 'button'; label: string; url: string };

export interface EmailLayoutProps {
  clinicName: string;
  professionalName: string;
  crp: string;
  preview: string;
  blocks: EmailBlock[];
  footerNote?: string;
}

const URL_RE = /(https?:\/\/[^\s<]+)/g;

/** Inline: **negrito**, quebras de linha e links automáticos. React escapa todo o texto (anti-XSS). */
function renderInline(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const lines = text.split('\n');
  lines.forEach((line, li) => {
    const bolds = line.split(/(\*\*[^*]+\*\*)/g);
    bolds.forEach((chunk, bi) => {
      const isBold = /^\*\*[^*]+\*\*$/.test(chunk);
      const content = isBold ? chunk.slice(2, -2) : chunk;
      const parts = content.split(URL_RE);
      const nodes = parts.map((part, pi) =>
        /^https?:\/\//.test(part) ? (
          <Link key={`${li}-${bi}-${pi}`} href={part} style={{ color: colors.primary }}>
            {part}
          </Link>
        ) : (
          <React.Fragment key={`${li}-${bi}-${pi}`}>{part}</React.Fragment>
        ),
      );
      out.push(
        isBold ? (
          <strong key={`${li}-${bi}`}>{nodes}</strong>
        ) : (
          <React.Fragment key={`${li}-${bi}`}>{nodes}</React.Fragment>
        ),
      );
    });
    if (li < lines.length - 1) out.push(<br key={`br-${li}`} />);
  });
  return out;
}

export function EmailLayout(props: EmailLayoutProps) {
  return (
    <Html lang="pt-BR">
      <Head />
      <Preview>{props.preview}</Preview>
      <Body
        style={{
          backgroundColor: colors.bg,
          margin: 0,
          padding: '24px 12px',
          fontFamily: 'Helvetica, Arial, sans-serif',
        }}
      >
        <Container style={{ maxWidth: 560, margin: '0 auto' }}>
          <Section style={{ textAlign: 'center', padding: '8px 0 20px' }}>
            <Text
              style={{
                margin: 0,
                fontFamily: 'Georgia, serif',
                fontSize: 22,
                color: colors.primary,
              }}
            >
              {props.clinicName}
            </Text>
          </Section>
          <Section
            style={{
              backgroundColor: colors.card,
              border: `1px solid ${colors.border}`,
              borderRadius: 14,
              padding: '28px 26px',
            }}
          >
            {props.blocks.map((b, i) =>
              b.type === 'p' ? (
                <Text
                  key={i}
                  style={{
                    margin: '0 0 16px',
                    fontSize: 16,
                    lineHeight: '25px',
                    color: colors.text,
                  }}
                >
                  {renderInline(b.text)}
                </Text>
              ) : (
                <Section key={i} style={{ textAlign: 'center', margin: '8px 0 22px' }}>
                  <Button
                    href={b.url}
                    style={{
                      backgroundColor: colors.primary,
                      color: '#fff',
                      padding: '13px 26px',
                      borderRadius: 10,
                      fontSize: 16,
                      fontWeight: 600,
                      textDecoration: 'none',
                    }}
                  >
                    {b.label}
                  </Button>
                </Section>
              ),
            )}
          </Section>
          <Hr style={{ borderColor: colors.border, margin: '22px 0 14px' }} />
          <Text
            style={{
              margin: 0,
              textAlign: 'center',
              fontSize: 13,
              lineHeight: '20px',
              color: colors.muted,
            }}
          >
            {props.professionalName} · {props.crp}
            <br />
            {props.footerNote ??
              'Você recebeu este e-mail porque possui cadastro em nosso sistema.'}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
