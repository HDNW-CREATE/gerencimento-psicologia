/**
 * Renderiza texto simples dos documentos legais: "## Título" vira subtítulo,
 * linhas em branco separam parágrafos. React escapa todo o conteúdo (sem HTML bruto).
 */
export function LegalText({ content }: { content: string }) {
  const blocks = content.replace(/\r\n/g, '\n').split(/\n{2,}/);
  return (
    <div className="prose-soft">
      {blocks.map((b, i) => {
        const lines = b.split('\n');
        return lines.map((line, j) =>
          line.startsWith('## ') ? (
            <h2 key={`${i}-${j}`}>{line.slice(3)}</h2>
          ) : line.trim() ? (
            <p key={`${i}-${j}`}>{line}</p>
          ) : null,
        );
      })}
    </div>
  );
}
