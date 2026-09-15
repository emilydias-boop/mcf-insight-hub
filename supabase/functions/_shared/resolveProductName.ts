/**
 * Normaliza o nome do produto que chega dos gateways (Hubla, Kiwify, MCF Pay)
 * para o nome canônico existente em `product_configurations`.
 *
 * Regras:
 * - normaliza a grafia crua: remove espaços das pontas e colapsa espaços internos;
 * - procura a grafia normalizada em `product_name_aliases.alias`;
 *   se existir, devolve `canonical_product_name`;
 * - se não existir alias, devolve a grafia normalizada;
 * - à prova de falha: qualquer erro na consulta apenas loga warning e devolve
 *   a grafia normalizada (nunca lança exceção, nunca derruba o webhook);
 * - cache em memória por invocação, já que o mesmo webhook pode gravar
 *   vários produtos na mesma execução.
 */

const aliasCache = new Map<string, string | null>();

export function normalizeProductNameText(raw: string | null | undefined): string {
  return (raw ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * Consulta bruta de alias. Devolve o nome canônico ou null quando não houver
 * mapeamento (ou quando a consulta falhar).
 */
// deno-lint-ignore no-explicit-any
export async function lookupProductAlias(
  supabase: any,
  aliasKey: string,
  context = 'product-alias',
): Promise<string | null> {
  const key = normalizeProductNameText(aliasKey);
  if (!key) return null;

  if (aliasCache.has(key)) return aliasCache.get(key) ?? null;

  try {
    const { data, error } = await supabase
      .from('product_name_aliases')
      .select('canonical_product_name')
      .eq('alias', key)
      .maybeSingle();

    if (error) {
      console.warn(`[${context}] erro ao consultar alias "${key}": ${error.message}`);
      return null;
    }

    const canonical = normalizeProductNameText(data?.canonical_product_name) || null;
    aliasCache.set(key, canonical);
    return canonical;
  } catch (e) {
    console.warn(`[${context}] falha inesperada ao consultar alias "${key}": ${(e as Error)?.message}`);
    return null;
  }
}

/**
 * Nome canônico do produto a partir da grafia crua do gateway.
 */
// deno-lint-ignore no-explicit-any
export async function resolveProductName(
  supabase: any,
  rawName: string | null | undefined,
  context = 'product-name-resolve',
): Promise<string> {
  const normalized = normalizeProductNameText(rawName);
  if (!normalized) return normalized;

  const canonical = await lookupProductAlias(supabase, normalized, context);
  return canonical ?? normalized;
}
