'use client';

import { useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, NativeSelect } from '@/components/ui/input';
import { useServerAction } from '@/components/forms/use-action';
import { saveAnamnesisConfigAction } from '@/server/actions/settings';

interface FieldDef {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'yesno';
}

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40) || 'campo';

export function AnamnesisConfigForm({ initial }: { initial: FieldDef[] }) {
  const [fields, setFields] = useState(initial);
  const { execute, pending } = useServerAction(saveAnamnesisConfigAction);

  const move = (i: number, dir: -1 | 1) =>
    setFields((f) => {
      const n = [...f];
      const j = i + dir;
      if (j < 0 || j >= n.length) return f;
      [n[i], n[j]] = [n[j]!, n[i]!];
      return n;
    });

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle>Campos da anamnese (ficha inicial)</CardTitle>
        <CardDescription>
          Defina as perguntas da ficha. Apagar um campo aqui <strong>não apaga</strong> respostas já
          registradas (ficam guardadas na versão do prontuário).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {fields.map((f, i) => (
          <div key={f.key + i} className="flex flex-wrap items-center gap-2 rounded-lg border p-2">
            <Input
              aria-label="Pergunta"
              className="min-w-48 flex-1"
              value={f.label}
              onChange={(e) =>
                setFields((all) =>
                  all.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)),
                )
              }
            />
            <NativeSelect
              aria-label="Tipo"
              className="w-40"
              value={f.type}
              onChange={(e) =>
                setFields((all) =>
                  all.map((x, j) =>
                    j === i ? { ...x, type: e.target.value as FieldDef['type'] } : x,
                  ),
                )
              }
            >
              <option value="textarea">Texto longo</option>
              <option value="text">Texto curto</option>
              <option value="yesno">Sim / Não</option>
            </NativeSelect>
            <Button size="icon" variant="ghost" aria-label="Subir" onClick={() => move(i, -1)}>
              <ArrowUp />
            </Button>
            <Button size="icon" variant="ghost" aria-label="Descer" onClick={() => move(i, 1)}>
              <ArrowDown />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Remover campo"
              onClick={() => setFields((all) => all.filter((_, j) => j !== i))}
            >
              <Trash2 />
            </Button>
          </div>
        ))}
        <div className="flex flex-wrap gap-2 pt-2">
          <Button
            variant="outline"
            onClick={() =>
              setFields((f) => [
                ...f,
                { key: `campo_${f.length + 1}_${Date.now() % 1000}`, label: '', type: 'textarea' },
              ])
            }
          >
            <Plus /> Adicionar campo
          </Button>
          <Button
            loading={pending}
            onClick={() => {
              // O identificador (chave) é gerado do texto da pergunta quando novo, e preservado se já existia
              const used = new Set<string>();
              const normalized = fields
                .filter((f) => f.label.trim())
                .map((f) => {
                  let key = initial.find((i) => i.key === f.key) ? f.key : slug(f.label);
                  while (used.has(key)) key += '_2';
                  used.add(key);
                  return { ...f, key, label: f.label.trim() };
                });
              execute({ fields: normalized });
            }}
          >
            Salvar campos
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
