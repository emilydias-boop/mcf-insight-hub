import { supabase } from '@/integrations/supabase/client';

/** Compara nomes ignorando caixa, acentos e espaços extras ("João" = "Joao"). */
function normalizarNome(nome?: string | null): string {
  return (nome || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}


/**
 * `consortium_cards.vendedor_id` tem FK para `consorcio_vendedor_options(id)`.
 * Cadastros pendentes podem carregar um uuid de outra tabela (ex.: `profiles.id`),
 * o que fazia o insert da cota falhar com 409. Aqui resolvemos para um id válido:
 *
 * 1) se o uuid já existe em `consorcio_vendedor_options`, usa ele;
 * 2) senão, tenta casar pelo nome do vendedor (case-insensitive);
 * 3) senão, devolve `null` — a cota nasce sem vínculo de vendedor, mas nasce.
 */
export async function resolveVendedorOptionId(
  vendedorId?: string | null,
  vendedorName?: string | null,
): Promise<string | null> {
  try {
    if (vendedorId) {
      const { data } = await supabase
        .from('consorcio_vendedor_options')
        .select('id')
        .eq('id', vendedorId)
        .maybeSingle();
      if (data?.id) return data.id;
    }

    const nome = normalizarNome(vendedorName);
    if (nome) {
      const { data } = await supabase.from('consorcio_vendedor_options').select('id, name');
      const achado = (data || []).find((o) => normalizarNome(o.name) === nome);
      if (achado?.id) return achado.id;
    }

  } catch {
    // Falha na resolução nunca pode impedir a criação da cota.
  }
  return null;
}
