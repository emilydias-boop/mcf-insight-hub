export interface CampoResumo {
  tag?: string | null;
  label?: string | null;
  valor?: string | number | null;
  valor_bruto?: unknown;
}
export interface SecaoResumo {
  chave?: string | null;
  titulo?: string | null;
  campos?: CampoResumo[] | null;
}

const norm = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const CHAVES = ['contato', 'objetivo', 'patrimonio', 'financ', 'planej', 'cliente'];
const chaveDe = (t: string) => CHAVES.find((k) => norm(t).includes(k)) ?? null;

/** Distribui as linhas "Seção: Rótulo — valor; ..." do resumo nas seções. Só exibição. */
export function distribuirResumo(
  resumo: string | null | undefined,
  secoes: SecaoResumo[],
): { secoes: SecaoResumo[]; resto: string } {
  const result = secoes.map((s) => ({ ...s, campos: [...(s.campos ?? [])] }));
  if (!resumo) return { secoes: result, resto: '' };
  const resto: string[] = [];
  for (const linhaBruta of resumo.split(/\r?\n/)) {
    const linha = linhaBruta.trim();
    if (!linha) continue;
    const idx = linha.indexOf(':');
    const titulo = idx > 0 ? linha.slice(0, idx).trim() : '';
    const chave = titulo ? chaveDe(titulo) : null;
    if (!chave) { resto.push(linha); continue; }
    const campos: CampoResumo[] = linha.slice(idx + 1).split(';').map((p) => p.trim()).filter(Boolean)
      .map((p) => {
        const m = p.match(/^(.+?)\s+[—–-]\s+(.*)$/);
        return m ? { label: m[1].trim(), valor: m[2].trim() } : { label: p, valor: null };
      });
    let alvo = result.find((s) => chaveDe(`${s.chave ?? ''} ${s.titulo ?? ''}`) === chave);
    if (!alvo) {
      alvo = { chave, titulo, campos: [] };
      result.push(alvo);
    }
    if (!alvo.campos!.length) alvo.campos = campos;
  }
  return { secoes: result, resto: resto.join('\n') };
}
