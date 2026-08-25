import { supabase } from '@/integrations/supabase/client';
import { calcularParcela, getValoresTabelados } from '@/lib/consorcioCalculos';
import { CondicaoPagamento, ConsorcioCredito, ConsorcioProduto } from '@/types/consorcioProdutos';

/**
 * Fonte de verdade da parcela: a TABELA EMBRACON.
 *
 * Mesma regra que o formulário usa no bloco "Composição da Parcela":
 * 1) valores tabelados de `consorcio_creditos` para (crédito, prazo, condição) → selo "Tabela Oficial";
 * 2) sem linha tabelada, cai na composição calculada do produto (`consorcio_produtos`);
 * 3) sem produto, devolve `undefined` — quem chama decide o fallback.
 *
 * NÃO usa o valor digitado pelo closer e NÃO usa crédito ÷ prazo.
 */
export interface ParcelaOficial {
  /** 1ª à 12ª (Parcelinha) ou 1ª parcela com taxa antecipada (Select). */
  parcela1a12: number;
  /** 13ª em diante (Parcelinha) ou 2ª em diante (Select). */
  parcelaDemais: number;
  usandoTabelaOficial: boolean;
  /** 'dividida_12' = Parcelinha · 'primeira_parcela' = Select. */
  taxaAntecipadaTipo: 'dividida_12' | 'primeira_parcela';
}

export interface ParcelaOficialParams {
  valorCredito: number;
  prazoMeses: number;
  tipoProduto: string;
  condicaoPagamento?: string | null;
  incluiSeguro?: boolean;
  /** Objetivo da carta/cota ('imovel' | 'auto' | 'pesado' ou o id da opção). */
  objetivo?: string | null;
}

function normalizarCondicao(c?: string | null): CondicaoPagamento {
  return c === '50' || c === '25' ? c : 'convencional';
}

/**
 * ÚNICA regra de mapeamento tipo_produto → taxa_antecipada_tipo.
 * 'select' → 'primeira_parcela' · qualquer outro (parcelinha) → 'dividida_12'.
 * Quem precisar dessa tradução deve chamar aqui, e não repetir o ternário.
 */
export function taxaAntecipadaTipoDeProduto(
  tipoProduto?: string | null,
): 'dividida_12' | 'primeira_parcela' {
  return tipoProduto === 'select' ? 'primeira_parcela' : 'dividida_12';
}

/** Forma mínima de produto que a resolução por faixa precisa. */
export interface ProdutoElegivelShape {
  ativo?: boolean | null;
  taxa_antecipada_tipo?: string | null;
  faixa_credito_min?: number | null;
  faixa_credito_max?: number | null;
}

/**
 * MESMO predicado que `resolverParcelaOficial` usa no banco (ativo +
 * taxa_antecipada_tipo + faixa de crédito), aplicado a uma lista já carregada.
 * Diferença deliberada: NÃO faz `limit(1)` — devolve TODOS os elegíveis, porque
 * faixas sobrepostas (SEP/TEP × SEP_ALTO/TEP_ALTO entre 1,0M e 1,2M) precisam ser
 * decididas por quem opera, não pelo primeiro registro que o banco devolver.
 */
export function produtosElegiveisParaCarta<T extends ProdutoElegivelShape>(
  produtos: T[],
  valorCredito: number,
  tipoProduto?: string | null,
): T[] {
  const valor = Number(valorCredito || 0);
  if (valor <= 0) return [];
  const tipoTaxa = taxaAntecipadaTipoDeProduto(tipoProduto);
  return produtos.filter(
    (p) =>
      p.ativo !== false &&
      p.taxa_antecipada_tipo === tipoTaxa &&
      Number(p.faixa_credito_min ?? 0) <= valor &&
      Number(p.faixa_credito_max ?? Infinity) >= valor,
  );
}

export async function resolverParcelaOficial(
  p: ParcelaOficialParams,
): Promise<ParcelaOficial | undefined> {
  const valorCredito = Number(p.valorCredito || 0);
  const prazo = Number(p.prazoMeses || 0);
  if (valorCredito <= 0 || prazo <= 0) return undefined;

  const taxaAntecipadaTipo = taxaAntecipadaTipoDeProduto(p.tipoProduto);


  const { data: produtoRow } = await supabase
    .from('consorcio_produtos')
    .select('*')
    .eq('ativo', true)
    .eq('taxa_antecipada_tipo', taxaAntecipadaTipo)
    .lte('faixa_credito_min', valorCredito)
    .gte('faixa_credito_max', valorCredito)
    .limit(1)
    .maybeSingle();

  if (!produtoRow) return undefined;

  const produto = {
    ...(produtoRow as any),
    prazos_disponiveis: (produtoRow as any).prazos_disponiveis || [200, 220, 240],
    fundo_reserva: (produtoRow as any).fundo_reserva || 2,
    seguro_vida_percentual: (produtoRow as any).seguro_vida_percentual || 0.061,
  } as ConsorcioProduto;

  const condicao = normalizarCondicao(p.condicaoPagamento);

  const { data: creditoRow } = await supabase
    .from('consorcio_creditos')
    .select('*')
    .eq('ativo', true)
    .eq('produto_id', produto.id)
    .eq('valor_credito', valorCredito)
    .limit(1)
    .maybeSingle();

  const tabelados = getValoresTabelados(
    (creditoRow as ConsorcioCredito | null) || undefined,
    prazo,
    condicao,
  );

  if (tabelados.parcela1a12 && tabelados.parcelaDemais) {
    return {
      parcela1a12: Number(tabelados.parcela1a12),
      parcelaDemais: Number(tabelados.parcelaDemais),
      usandoTabelaOficial: true,
      taxaAntecipadaTipo,
    };
  }

  const calc = calcularParcela(valorCredito, prazo, produto, condicao, !!p.incluiSeguro);
  return {
    parcela1a12: calc.parcela1a12,
    parcelaDemais: calc.parcelaDemais,
    usandoTabelaOficial: false,
    taxaAntecipadaTipo,
  };
}

/** Valor oficial da parcela `numero`, respeitando a faixa 1ª–12ª × 13ª em diante. */
export function valorParcelaOficial(oficial: ParcelaOficial, numero: number): number {
  if (oficial.taxaAntecipadaTipo === 'primeira_parcela') {
    return numero === 1 ? oficial.parcela1a12 : oficial.parcelaDemais;
  }
  return numero <= 12 ? oficial.parcela1a12 : oficial.parcelaDemais;
}
