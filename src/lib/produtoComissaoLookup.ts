import { supabase } from '@/integrations/supabase/client';
import { TipoProduto } from '@/types/consorcio';
import { ProdutoComissaoContext } from '@/lib/commissionCalculator';
import { ComissaoBase, ComissaoScheduleItem } from '@/types/consorcioProdutos';

/**
 * Busca o produto cadastrado que casa com (valor_credito, tipo_produto)
 * e retorna o contexto de comissão (schedule + base). Se nenhum produto
 * for encontrado ou não tiver schedule, retorna undefined — fazendo o
 * calculator cair no fallback hardcoded SELECT/PARCELINHA.
 */
export async function getProdutoComissaoContext(
  valorCredito: number,
  tipoProduto: TipoProduto,
  extra?: { valorVenda?: number; valorParcela?: number }
): Promise<ProdutoComissaoContext | undefined> {
  if (!valorCredito || valorCredito <= 0) return undefined;

  const tipoTaxa: 'primeira_parcela' | 'dividida_12' =
    tipoProduto === 'select' ? 'primeira_parcela' : 'dividida_12';

  const { data, error } = await supabase
    .from('consorcio_produtos')
    .select('comissao_schedule, comissao_base')
    .eq('ativo', true)
    .eq('taxa_antecipada_tipo', tipoTaxa)
    .lte('faixa_credito_min', valorCredito)
    .gte('faixa_credito_max', valorCredito)
    .limit(1)
    .maybeSingle();

  if (error || !data) return undefined;

  const schedule = (data as any).comissao_schedule as ComissaoScheduleItem[] | null;
  const base = ((data as any).comissao_base as ComissaoBase) || 'valor_credito';

  if (!schedule || schedule.length === 0) return undefined;

  return {
    schedule,
    base,
    valorParcela: extra?.valorParcela,
    valorVenda: extra?.valorVenda,
  };
}