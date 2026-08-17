/**
 * Renderizador simples do markdown usado no Termo de Adesão
 * (títulos, negrito, listas e parágrafos). Sem dependência externa.
 */
function inline(text: string, keyPrefix: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith('**') && p.endsWith('**') ? (
      <strong key={`${keyPrefix}-${i}`}>{p.slice(2, -2)}</strong>
    ) : (
      <span key={`${keyPrefix}-${i}`}>{p}</span>
    ),
  );
}

export function TermoMarkdown({ content, className }: { content: string; className?: string }) {
  const lines = (content || '').split('\n');
  const blocks: JSX.Element[] = [];
  let list: string[] = [];

  const flushList = (key: string) => {
    if (!list.length) return;
    blocks.push(
      <ul key={key} className="list-disc pl-6 space-y-1 my-3">
        {list.map((item, i) => (
          <li key={i}>{inline(item, `${key}-${i}`)}</li>
        ))}
      </ul>,
    );
    list = [];
  };

  lines.forEach((raw, idx) => {
    const line = raw.trim();
    const key = `l-${idx}`;
    if (!line) {
      flushList(`ul-${idx}`);
      return;
    }
    if (/^(-|\d+\.)\s+/.test(line)) {
      list.push(line.replace(/^(-|\d+\.)\s+/, ''));
      return;
    }
    flushList(`ul-${idx}`);
    if (line.startsWith('### ')) {
      blocks.push(<h4 key={key} className="font-semibold mt-4 mb-1">{inline(line.slice(4), key)}</h4>);
    } else if (line.startsWith('## ')) {
      blocks.push(<h3 key={key} className="font-semibold text-base mt-5 mb-2">{inline(line.slice(3), key)}</h3>);
    } else if (line.startsWith('# ')) {
      blocks.push(<h2 key={key} className="font-bold text-lg mt-2 mb-3">{inline(line.slice(2), key)}</h2>);
    } else {
      blocks.push(<p key={key} className="my-2 leading-relaxed">{inline(line, key)}</p>);
    }
  });
  flushList('ul-end');

  return <div className={className}>{blocks}</div>;
}
