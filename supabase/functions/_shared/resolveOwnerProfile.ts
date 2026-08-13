/**
 * Resolve o profile_id de um owner a partir do email, de forma segura contra
 * profiles duplicados/desativados.
 *
 * Regras:
 * - considera apenas profiles elegíveis (access_status = 'ativo' ou nulo/legado);
 * - só retorna id quando existir EXATAMENTE 1 profile elegível;
 * - em caso de ambiguidade (2+), email vazio ou nenhum elegível, loga warning
 *   e retorna null (nunca escolhe "o primeiro" silenciosamente).
 */
// deno-lint-ignore no-explicit-any
export async function resolveActiveOwnerProfileId(
  supabase: any,
  email: string | null | undefined,
  context = 'owner-resolve',
): Promise<string | null> {
  const normalized = (email ?? '').trim();
  if (!normalized) {
    console.warn(`[${context}] owner_profile_id não resolvido: email vazio`);
    return null;
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, access_status')
    .ilike('email', normalized);

  if (error) {
    console.warn(`[${context}] erro ao buscar profile por email ${normalized}: ${error.message}`);
    return null;
  }

  const rows = (data ?? []) as Array<{ id: string; access_status: string | null }>;
  const eligible = rows.filter((r) => !r.access_status || r.access_status === 'ativo');

  if (eligible.length === 1) return eligible[0].id;

  if (eligible.length > 1) {
    console.warn(
      `[${context}] ⚠️ AMBIGUIDADE: ${eligible.length} profiles ativos com o email ${normalized} ` +
        `(ids: ${eligible.map((r) => r.id).join(', ')}). owner_profile_id NÃO será escrito.`,
    );
    return null;
  }

  console.warn(
    `[${context}] ⚠️ Nenhum profile ativo para o email ${normalized} ` +
      `(total encontrados: ${rows.length}). owner_profile_id NÃO será escrito.`,
  );
  return null;
}
