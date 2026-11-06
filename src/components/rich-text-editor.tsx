'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Bold, Heading2, Italic, List, ListOrdered, Quote, Redo2, Undo2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  label: string;
  minHeight?: string;
}

/** Editor de texto rico (Tiptap). A saída é SEMPRE sanitizada no servidor antes de ser gravada. */
export function RichTextEditor({ value, onChange, label, minHeight = '10rem' }: Props) {
  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [2, 3] }, link: false })],
    content: value,
    immediatelyRender: false, // evita divergência de hidratação no Next
    onUpdate: ({ editor: e }) => onChange(e.isEmpty ? '' : e.getHTML()),
    editorProps: {
      attributes: {
        'aria-label': label,
        role: 'textbox',
        'aria-multiline': 'true',
        class: 'rich-content prose-sm max-w-none px-3.5 py-3 outline-none',
        style: `min-height:${minHeight}`,
      },
    },
  });

  if (!editor) return <div className="h-40 animate-pulse rounded-lg border bg-muted" aria-busy />;

  const Btn = ({
    onClick,
    active,
    label: l,
    children,
  }: {
    onClick: () => void;
    active?: boolean;
    label: string;
    children: React.ReactNode;
  }) => (
    <button
      type="button"
      onClick={onClick}
      aria-label={l}
      aria-pressed={active}
      className={cn(
        'flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted [&_svg]:size-4',
        active && 'bg-accent text-accent-foreground',
      )}
    >
      {children}
    </button>
  );

  return (
    <div className="rounded-lg border border-input bg-card focus-within:ring-2 focus-within:ring-ring">
      <div className="flex flex-wrap gap-0.5 border-b p-1" role="toolbar" aria-label="Formatação">
        <Btn
          label="Negrito"
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold />
        </Btn>
        <Btn
          label="Itálico"
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic />
        </Btn>
        <Btn
          label="Título"
          active={editor.isActive('heading', { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 />
        </Btn>
        <Btn
          label="Lista"
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List />
        </Btn>
        <Btn
          label="Lista numerada"
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered />
        </Btn>
        <Btn
          label="Citação"
          active={editor.isActive('blockquote')}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quote />
        </Btn>
        <span className="mx-1 w-px bg-border" aria-hidden />
        <Btn label="Desfazer" onClick={() => editor.chain().focus().undo().run()}>
          <Undo2 />
        </Btn>
        <Btn label="Refazer" onClick={() => editor.chain().focus().redo().run()}>
          <Redo2 />
        </Btn>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
