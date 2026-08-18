/**
 * Renderizador do markdown dos documentos do Consórcio (Termo de Adesão e
 * Comprovante de Cadastro) dentro do papel institucional (`.papel`).
 *
 * O conteúdo armazenado continua sendo markdown — aqui só se decide a
 * apresentação. Nunca use `dangerouslySetInnerHTML` com o texto do modelo:
 * ele é editável por admin/manager e é exibido numa página pública.
 */
import { useEffect } from 'react';
import { ensurePapelStylesheet } from '@/lib/documentoPapel';

const WORD_CHAR = /[0-9A-Za-zÀ-ÿ]/;
const isWord = (c?: string) => !!c && WORD_CHAR.test(c);
const isWhitespace = (c?: string) => !!c && /\s/.test(c);

/**
 * `**negrito**`, `*itálico*` e `_itálico_`.
 *
 * Os delimitadores só abrem/fecham ênfase em **fronteira de palavra** e nunca
 * junto a espaço no lado interno: sem isso, e-mails com `_` e expressões como
 * `a*b*c` ou `5 * 12 * 3` seriam corrompidos.
 * Tokenizador manual de propósito — lookbehind em regex não é seguro em
 * Safari/iOS antigo, e esta função roda na página pública do cliente.
 */
function inline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let buf = '';
  let k = 0;
  const flush = () => {
    if (buf) {
      nodes.push(<span key={`${keyPrefix}-t${k++}`}>{buf}</span>);
      buf = '';
    }
  };
  let i = 0;
  while (i < text.length) {
    if (text.startsWith('**', i) && !isWhitespace(text[i + 2])) {
      const end = text.indexOf('**', i + 2);
      if (
        end > i + 2 &&
        !isWhitespace(text[end - 1]) &&
        !text.slice(i + 2, end).includes('\n')
      ) {
        flush();
        nodes.push(<strong key={`${keyPrefix}-b${k++}`}>{text.slice(i + 2, end)}</strong>);
        i = end + 2;
        continue;
      }
    }
    const c = text[i];
    if (c === '*' && text[i + 1] !== '*' && !isWord(text[i - 1]) && !isWhitespace(text[i + 1])) {
      const end = text.indexOf('*', i + 1);
      if (
        end > i + 1 &&
        !isWhitespace(text[end - 1]) &&
        !isWord(text[end + 1]) &&
        !text.slice(i + 1, end).includes('\n')
      ) {
        flush();
        nodes.push(<em key={`${keyPrefix}-i${k++}`}>{text.slice(i + 1, end)}</em>);
        i = end + 1;
        continue;
      }
    }
    if (c === '_' && !isWord(text[i - 1]) && !isWhitespace(text[i + 1])) {
      const end = text.indexOf('_', i + 1);
      if (
        end > i + 1 &&
        !isWhitespace(text[end - 1]) &&
        !isWord(text[end + 1]) &&
        !text.slice(i + 1, end).includes('\n')
      ) {
        flush();
        nodes.push(<em key={`${keyPrefix}-u${k++}`}>{text.slice(i + 1, end)}</em>);
        i = end + 1;
        continue;
      }
    }
    buf += c;
    i++;
  }
  flush();
  return nodes;
}

const TAG_CLASS: Record<string, string> = {
  'mcf capital': 'tag mcf',
  cliente: 'tag cli',
  pago: 'tag pg',
  'a pagar': 'tag pend',
  'a vencer': 'tag pend',
  pendente: 'tag pend',
};

/** Célula de tabela: selo quando o texto é exatamente um dos rótulos conhecidos. */
function cell(raw: string, key: string): React.ReactNode {
  const limpo = raw.replace(/\*\*/g, '').trim();
  const cls = TAG_CLASS[limpo.toLowerCase()];
  if (cls) return <span className={cls}>{limpo}</span>;
  return inline(raw, key);
}

const KV_RE = /^\*\*(.+?):\*\*\s*(.*)$/;

export function TermoMarkdown({
  content,
  className,
  bare,
}: {
  content: string;
  className?: string;
  /** Renderiza sem o wrapper `.papel` — evita `.papel` dentro de `.papel`. */
  bare?: boolean;
}) {
  // Também garante o CSS em consumidores `bare` renderizados no navegador.
  // Na renderização estática da janela de impressão o efeito não roda, e a
  // própria janela já recebe a folha completa por `escreverImpressao`.
  useEffect(() => {
    ensurePapelStylesheet();
  }, []);

  const lines = (content || '').split('\n');
  const blocks: JSX.Element[] = [];

  let ul: string[] = [];
  let ol: string[] = [];
  let olStart = 1;
  let table: string[][] = [];
  let kv: { rotulo: string; valor: string }[] = [];

  const flushUl = (key: string) => {
    if (!ul.length) return;
    blocks.push(
      <ul key={key}>
        {ul.map((item, i) => (
          <li key={i}>{inline(item, `${key}-${i}`)}</li>
        ))}
      </ul>,
    );
    ul = [];
  };

  const flushOl = (key: string) => {
    if (!ol.length) return;
    blocks.push(
      <ol key={key} start={olStart}>
        {ol.map((item, i) => (
          <li key={i}>{inline(item, `${key}-${i}`)}</li>
        ))}
      </ol>,
    );
    ol = [];
    olStart = 1;
  };

  /**
   * Grade rótulo/valor só quando houver DUAS ou mais linhas consecutivas no
   * padrão `**Rótulo:** valor`. Linha isolada é parágrafo comum — senão uma
   * frase legítima como `**Importante:** ...` viraria célula de grade.
   */
  const flushKv = (key: string) => {
    if (!kv.length) return;
    if (kv.length === 1) {
      const par = kv[0];
      blocks.push(
        <p key={key}>
          <strong>{par.rotulo}:</strong> {inline(par.valor, `${key}-0`)}
        </p>,
      );
      kv = [];
      return;
    }
    blocks.push(
      <div className="kv" key={key}>
        {kv.map((par, i) => {
          const full = /^endere[çc]o/i.test(par.rotulo) || par.valor.length > 60;
          return (
            <div key={i} className={full ? 'full' : undefined}>
              <b>{par.rotulo}</b>
              <span>{inline(par.valor, `${key}-${i}`)}</span>
            </div>
          );
        })}
      </div>,
    );
    kv = [];
  };

  const flushTable = (key: string) => {
    if (!table.length) return;
    const [head, ...body] = table;
    blocks.push(
      <table className="doc" key={key}>
        <thead>
          <tr>
            {head.map((c, i) => (
              <th key={i}>{c.replace(/\*\*/g, '')}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, r) => {
            const ehTotal = (row[0] || '').replace(/\*\*/g, '').trim().toLowerCase() === 'total';
            return (
            <tr key={r} className={ehTotal ? 'tot' : undefined}>
              {row.map((c, i) => (
                <td key={i}>{cell(c, `${key}-${r}-${i}`)}</td>
              ))}
            </tr>
            );
          })}
        </tbody>
      </table>,
    );
    table = [];
  };

  const flushAll = (idx: number | string) => {
    flushUl(`ul-${idx}`);
    flushOl(`ol-${idx}`);
    flushKv(`kv-${idx}`);
    flushTable(`tb-${idx}`);
  };

  lines.forEach((raw, idx) => {
    const line = raw.trim();
    const key = `l-${idx}`;

    if (!line) {
      // Linha em branco NÃO quebra lista: itens separados por linha vazia
      // continuam a mesma `<ol>`/`<ul>`. Grades e tabelas, sim, são fechadas.
      flushKv(`kv-${idx}`);
      flushTable(`tb-${idx}`);
      return;
    }

    // Tabela markdown
    if (line.startsWith('|')) {
      flushUl(`ul-${idx}`);
      flushOl(`ol-${idx}`);
      flushKv(`kv-${idx}`);
      const celulas = line.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
      if (!celulas.every((c) => /^:?-{2,}:?$/.test(c))) table.push(celulas);
      return;
    }
    flushTable(`tb-${idx}`);

    // Par rótulo/valor → grade .kv
    const par = KV_RE.exec(line);
    if (par) {
      flushUl(`ul-${idx}`);
      flushOl(`ol-${idx}`);
      kv.push({ rotulo: par[1].trim(), valor: par[2].trim() });
      return;
    }
    flushKv(`kv-${idx}`);

    // Listas — ordenada preserva a numeração
    if (/^\d+\.\s+/.test(line)) {
      flushUl(`ul-${idx}`);
      if (!ol.length) olStart = Number(line.match(/^(\d+)\./)?.[1] || 1);
      ol.push(line.replace(/^\d+\.\s+/, ''));
      return;
    }
    if (/^-\s+/.test(line)) {
      flushOl(`ol-${idx}`);
      ul.push(line.replace(/^-\s+/, ''));
      return;
    }
    flushUl(`ul-${idx}`);
    flushOl(`ol-${idx}`);

    if (line.startsWith('### ')) {
      blocks.push(<h3 key={key}>{inline(line.slice(4), key)}</h3>);
    } else if (line.startsWith('## ')) {
      blocks.push(<h2 key={key}>{inline(line.slice(3), key)}</h2>);
    } else if (line.startsWith('# ')) {
      blocks.push(<h1 key={key}>{inline(line.slice(2), key)}</h1>);
    } else {
      blocks.push(<p key={key}>{inline(line, key)}</p>);
    }
  });

  flushAll('end');

  if (bare) return <>{blocks}</>;
  return <PapelWrapper className={className}>{blocks}</PapelWrapper>;
}

/** Wrapper `.papel`; a folha já é garantida pelo componente acima. */
function PapelWrapper({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={className ? `papel ${className}` : 'papel'}>{children}</div>;
}
