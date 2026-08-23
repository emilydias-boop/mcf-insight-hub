/**
 * Diff de formulário contra um SNAPSHOT do que foi hidratado na abertura.
 *
 * Por que diff e não "pula se estiver vazio":
 * - "pula se vazio" impede o usuário de LIMPAR um campo de propósito;
 * - diff manda o campo limpo (mudança real) e NÃO manda o campo intocado,
 *   então nada é zerado por acidente;
 * - se algum campo falhar em hidratar e abrir vazio, o snapshot também está
 *   vazio: o diff não acusa mudança e o dado antigo no banco sobrevive.
 *
 * O snapshot tem que ser tirado DEPOIS que os valores chegaram ao formulário.
 * Tirar antes (com um objeto parcial) faz o diff enxergar a hidratação como
 * mudança do usuário e reenviar tudo — exatamente o problema que evitamos aqui.
 */

/** Forma comparável de um valor: vazio/nulo colapsam, datas e objetos viram texto estável. */
export function normalizarParaDiff(valor: unknown): unknown {
  if (valor === undefined || valor === null) return null;
  if (typeof valor === 'string') {
    const t = valor.trim();
    return t === '' ? null : t;
  }
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null;
  if (typeof valor === 'boolean') return valor;
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : valor.getTime();
  try {
    return JSON.stringify(valor);
  } catch {
    return String(valor);
  }
}

export function valorMudou(antes: unknown, depois: unknown): boolean {
  return normalizarParaDiff(antes) !== normalizarParaDiff(depois);
}

/**
 * Só as chaves de `atual` cujo valor difere do snapshot.
 * Chaves com valor `undefined` em `atual` são ignoradas (nunca foram enviadas).
 */
export function diffContraSnapshot<T extends Record<string, unknown>>(
  snapshot: T | null | undefined,
  atual: T,
): Partial<T> {
  if (!snapshot) return { ...atual };
  const saida: Partial<T> = {};
  (Object.keys(atual) as Array<keyof T>).forEach((chave) => {
    const depois = atual[chave];
    if (depois === undefined) return;
    if (valorMudou(snapshot[chave], depois)) saida[chave] = depois;
  });
  return saida;
}

/** Rótulos legíveis das chaves alteradas — usado nas mensagens de "nada mudou". */
export function nenhumaAlteracao(diff: Record<string, unknown>): boolean {
  return Object.keys(diff).length === 0;
}
