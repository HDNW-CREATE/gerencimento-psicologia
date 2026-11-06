'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useServerAction } from '@/components/forms/use-action';
import { deleteFaqAction, saveFaqAction } from '@/server/actions/settings';

interface Faq {
  id?: string;
  question: string;
  answer: string;
  published: boolean;
}

function FaqRow({ initial, onSaved }: { initial: Faq; onSaved?: () => void }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [del, setDel] = useState(false);
  const save = useServerAction(saveFaqAction, {
    onSuccess: () => {
      if (!initial.id) setV({ question: '', answer: '', published: true });
      router.refresh();
      onSaved?.();
    },
  });
  const remove = useServerAction(deleteFaqAction, {
    onSuccess: () => {
      setDel(false);
      router.refresh();
    },
  });
  const key = initial.id ?? 'new';
  return (
    <div className="space-y-2 border-b pb-4 last:border-0">
      <Label htmlFor={`q-${key}`}>Pergunta</Label>
      <Input
        id={`q-${key}`}
        value={v.question}
        onChange={(e) => setV({ ...v, question: e.target.value })}
      />
      <Label htmlFor={`a-${key}`}>Resposta</Label>
      <Textarea
        id={`a-${key}`}
        value={v.answer}
        onChange={(e) => setV({ ...v, answer: e.target.value })}
        className="min-h-20"
      />
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-[hsl(var(--primary))]"
            checked={v.published}
            onChange={(e) => setV({ ...v, published: e.target.checked })}
          />{' '}
          Publicada
        </label>
        <Button
          size="sm"
          loading={save.pending}
          onClick={() => save.execute({ ...v, id: initial.id })}
        >
          {initial.id ? 'Salvar' : 'Adicionar'}
        </Button>
        {initial.id && (
          <Button
            size="icon"
            variant="ghost"
            aria-label="Remover pergunta"
            onClick={() => setDel(true)}
          >
            <Trash2 />
          </Button>
        )}
      </div>
      <ConfirmDialog
        open={del}
        onOpenChange={setDel}
        destructive
        title="Remover esta pergunta?"
        description="Ela deixará de aparecer no site."
        confirmLabel="Remover"
        loading={remove.pending}
        onConfirm={() => initial.id && remove.execute({ id: initial.id })}
      />
    </div>
  );
}

export function FaqManager({ faqs }: { faqs: (Faq & { id: string })[] }) {
  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle>Perguntas frequentes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {faqs.map((f) => (
          <FaqRow key={f.id} initial={f} />
        ))}
        <p className="pt-2 text-sm font-semibold">Nova pergunta</p>
        <FaqRow initial={{ question: '', answer: '', published: true }} />
      </CardContent>
    </Card>
  );
}
