'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { RotateCcw, Send, Sparkles, X } from 'lucide-react';
import { ASSISTANT_NAME, type AssistantReply, type AssistantState } from '@/lib/assistant/types';
import { cn } from '@/lib/utils';
import { assistantMessageAction } from '@/server/actions/assistant';

type Role = 'staff' | 'patient';

interface Message {
  id: number;
  from: 'bot' | 'me';
  text: string;
  links?: AssistantReply['links'];
  quick?: string[];
}

const TEXTS: Record<
  Role,
  { subtitle: string; greeting: (name: string) => string; quick: string[] }
> = {
  staff: {
    subtitle: 'Assistente da psicóloga',
    greeting: (n) =>
      `Olá, ${n}! Eu sou a **${ASSISTANT_NAME}**. 🌿\nPosso mostrar a sua agenda, buscar pacientes, ver pendências e **cadastrar pacientes** por aqui. O que você precisa?`,
    quick: [
      'Quem eu vou atender hoje?',
      'Cadastrar paciente',
      'Pagamentos pendentes',
      'Resumo do mês',
    ],
  },
  patient: {
    subtitle: 'Assistente do consultório',
    greeting: (n) =>
      `Olá, ${n}! Eu sou a **${ASSISTANT_NAME}**. 🌿\nPosso ajudar com suas sessões, horários, pagamentos e contato. Como posso ajudar?`,
    quick: ['Minha próxima sessão', 'Horários disponíveis', 'Pagamentos', 'Preciso remarcar'],
  },
};

/** Só aceita links internos ou destinos externos conhecidos (WhatsApp e Google Maps). */
function safeHref(href: string): { href: string; external: boolean } | null {
  if (href.startsWith('/') && !href.startsWith('//')) return { href, external: false };
  if (href.startsWith('https://wa.me/') || href.startsWith('https://www.google.com/maps/'))
    return { href, external: true };
  return null;
}

/** "**negrito**" e quebras de linha. Tudo vira nós React (sem HTML bruto → sem XSS). */
function RichText({ text }: { text: string }) {
  return (
    <>
      {text.split('\n').map((line, i) => (
        <span key={i} className="block min-h-[1.2em]">
          {line
            .split(/(\*\*[^*]+\*\*)/g)
            .map((part, j) =>
              /^\*\*[^*]+\*\*$/.test(part) ? (
                <strong key={j}>{part.slice(2, -2)}</strong>
              ) : (
                <span key={j}>{part}</span>
              ),
            )}
        </span>
      ))}
    </>
  );
}

export function AssistantWidget({ role, firstName }: { role: Role; firstName: string }) {
  const t = TEXTS[role];
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [state, setState] = useState<AssistantState>(null);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const nextId = useRef(1);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const reset = useCallback(() => {
    nextId.current = 1;
    setState(null);
    setMessages([
      { id: nextId.current++, from: 'bot', text: t.greeting(firstName), quick: t.quick },
    ]);
  }, [t, firstName]);

  // Saudação local na primeira abertura (não chama o servidor).
  useEffect(() => {
    if (open && messages.length === 0) reset();
  }, [open, messages.length, reset]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, pending]);

  const close = useCallback(() => {
    setOpen(false);
    buttonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  async function send(raw: string) {
    const text = raw.trim();
    if (!text || pending) return;
    setInput('');
    // Remove os botões de resposta rápida antigos (evita cliques em respostas vencidas).
    setMessages((m) => [
      ...m.map((x) => ({ ...x, quick: undefined })),
      { id: nextId.current++, from: 'me', text },
    ]);
    setPending(true);
    try {
      const r = await assistantMessageAction({ text, state });
      if (r.ok && r.data) {
        setState(r.data.state);
        setMessages((m) => [
          ...m,
          ...r.data!.replies.map((rep) => ({
            id: nextId.current++,
            from: 'bot' as const,
            text: rep.text,
            links: rep.links,
            quick: rep.quick,
          })),
        ]);
      } else {
        setMessages((m) => [
          ...m,
          {
            id: nextId.current++,
            from: 'bot',
            text: r.ok ? 'Não consegui responder agora.' : r.error,
          },
        ]);
      }
    } catch {
      setMessages((m) => [
        ...m,
        {
          id: nextId.current++,
          from: 'bot',
          text: 'Sem conexão no momento. Tente de novo em instantes.',
        },
      ]);
    } finally {
      setPending(false);
      inputRef.current?.focus();
    }
  }

  return (
    <>
      {open && (
        <section
          role="dialog"
          aria-label={`${ASSISTANT_NAME}, ${t.subtitle.toLowerCase()}`}
          className="fixed bottom-[calc(8.5rem+env(safe-area-inset-bottom))] left-3 z-50 flex h-[min(32rem,calc(100dvh-11rem))] w-[calc(100vw-1.5rem)] max-w-[24rem] flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl md:bottom-20 md:left-4"
        >
          <header className="flex items-center gap-3 bg-primary px-4 py-3 text-primary-foreground">
            <span
              className="flex size-9 items-center justify-center rounded-full bg-primary-foreground/15"
              aria-hidden
            >
              <Sparkles className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-serif text-lg leading-tight">{ASSISTANT_NAME}</p>
              <p className="truncate text-xs opacity-90">{t.subtitle}</p>
            </div>
            <button
              type="button"
              onClick={reset}
              aria-label="Nova conversa"
              title="Nova conversa"
              className="rounded-md p-2 hover:bg-primary-foreground/15"
            >
              <RotateCcw className="size-4" />
            </button>
            <button
              type="button"
              onClick={close}
              aria-label="Fechar chat"
              className="rounded-md p-2 hover:bg-primary-foreground/15"
            >
              <X className="size-4" />
            </button>
          </header>

          <div
            role="log"
            aria-live="polite"
            aria-label="Conversa"
            className="flex-1 space-y-3 overflow-y-auto bg-background/60 p-3"
          >
            {messages.map((m) => (
              <div
                key={m.id}
                className={cn('flex flex-col gap-2', m.from === 'me' ? 'items-end' : 'items-start')}
              >
                <div
                  className={cn(
                    'max-w-[88%] rounded-2xl px-3.5 py-2 text-[15px] leading-snug',
                    m.from === 'me'
                      ? 'rounded-br-sm bg-primary text-primary-foreground'
                      : 'rounded-bl-sm border bg-card',
                  )}
                >
                  <RichText text={m.text} />
                </div>
                {m.links && m.links.length > 0 && (
                  <div className="flex max-w-[88%] flex-wrap gap-1.5">
                    {m.links.map((l) => {
                      const s = safeHref(l.href);
                      if (!s) return null;
                      const cls =
                        'rounded-full border border-primary/40 bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground hover:bg-accent/70';
                      return s.external ? (
                        <a
                          key={l.href + l.label}
                          href={s.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cls}
                        >
                          {l.label}
                        </a>
                      ) : (
                        <Link
                          key={l.href + l.label}
                          href={s.href}
                          onClick={() => window.matchMedia('(max-width: 767px)').matches && close()}
                          className={cls}
                        >
                          {l.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
                {m.quick && m.quick.length > 0 && (
                  <div className="flex max-w-full flex-wrap gap-1.5">
                    {m.quick.map((q) => (
                      <button
                        key={q}
                        type="button"
                        disabled={pending}
                        onClick={() => send(q)}
                        className="rounded-full border bg-card px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {pending && (
              <div
                className="flex items-center gap-1 pl-2"
                role="status"
                aria-label={`${ASSISTANT_NAME} está digitando`}
              >
                {[0, 150, 300].map((d) => (
                  <span
                    key={d}
                    className="size-2 animate-bounce rounded-full bg-muted-foreground/60"
                    style={{ animationDelay: `${d}ms` }}
                  />
                ))}
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form
            className="border-t bg-card p-2.5"
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
          >
            <div className="flex gap-2">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                maxLength={500}
                autoComplete="off"
                placeholder="Escreva sua mensagem…"
                aria-label="Mensagem para a assistente"
                className="h-11 min-w-0 flex-1 rounded-full border border-input bg-background px-4 text-[15px]"
              />
              <button
                type="submit"
                disabled={pending || !input.trim()}
                aria-label="Enviar"
                className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50"
              >
                <Send className="size-4" />
              </button>
            </div>
            <p className="mt-1.5 px-1 text-[11px] leading-tight text-muted-foreground">
              {role === 'patient'
                ? 'Assistente automática — não substitui atendimento. Em emergência: 188 (CVV) ou 192 (SAMU).'
                : 'Assistente automática. Não mostra conteúdo de prontuário.'}
            </p>
          </form>
        </section>
      )}

      <button
        ref={buttonRef}
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-expanded={open}
        aria-label={open ? `Fechar ${ASSISTANT_NAME}` : `Abrir ${ASSISTANT_NAME}, assistente`}
        className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] left-3 z-50 flex h-14 items-center gap-2 rounded-full bg-primary pl-4 pr-5 text-primary-foreground shadow-lg transition-transform hover:scale-105 md:bottom-4 md:left-4"
      >
        <Sparkles className="size-5" aria-hidden />
        <span className="font-medium">{ASSISTANT_NAME}</span>
      </button>
    </>
  );
}
