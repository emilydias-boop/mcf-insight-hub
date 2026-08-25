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
  codigo?: string | null;
  ativo?: boolean | null;
  taxa_antecipada_tipo?: string | null;
  faixa_credito_min?: number | null;
  faixa_credito_max?: number | null;
  objetivo_option_id?: string | null;
  /** `name` da opção de objetivo ('imovel' | 'auto' | 'pesado'), quando carregado. */
  objetivo_nome?: string | null;
}

/** 'Imóvel' → 'imovel'. Compara objetivo sem depender de acento/caixa. */
function normalizarObjetivo(v?: string | null): string {
  return String(v ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * O produto atende o objetivo informado? Aceita tanto o `name` da opção
 * ('auto') quanto o id da opção — quem chama tem um ou outro na mão.
 */
export function produtoCasaObjetivo(
  p: ProdutoElegivelShape,
  objetivo?: string | null,
): boolean {
  const alvo = normalizarObjetivo(objetivo);
  if (!alvo) return false;
  if (p.objetivo_option_id && String(p.objetivo_option_id) === String(objetivo)) return true;
  return !!p.objetivo_nome && normalizarObjetivo(p.objetivo_nome) === alvo;
}

/**
 * Desempate DETERMINÍSTICO e declarado quando mais de um produto é elegível:
 * 1) faixa de crédito mais ESTREITA primeiro — o produto mais específico ganha
 *    do mais genérico (TP 120k–600k ganha de TEP 600k–1,2M no limite de 600k;
 *    TEP 600k–1,2M ganha de TEP_ALTO 1,0–2,0M entre 1,0M e 1,2M);
 * 2) empate de largura → maior `faixa_credito_min` (o de piso mais alto é o mais
 *    específico para aquele valor);
 * 3) empate ainda → `codigo` em ordem alfabética (EI1 antes de PSE).
 * Nunca "o primeiro que o banco devolver".
 */
export function ordenarProdutosPorEspecificidade<T extends ProdutoElegivelShape>(
  produtos: T[],
): T[] {
  const largura = (p: T) =>
    Number(p.faixa_credito_max ?? Infinity) - Number(p.faixa_credito_min ?? 0);
  return [...produtos].sort((a, b) => {
    const la = largura(a);
    const lb = largura(b);
    if (la !== lb) return la - lb;
    const mina = Number(a.faixa_credito_min ?? 0);
    const minb = Number(b.faixa_credito_min ?? 0);
    if (mina !== minb) return minb - mina;
    return String(a.codigo ?? '').localeCompare(String(b.codigo ?? ''));
  });
}

/**
 * MESMO predicado que `resolverParcelaOficial` usa no banco (ativo +
 * taxa_antecipada_tipo + faixa de crédito), aplicado a uma lista já carregada,
 * agora também respeitando o OBJETIVO.
 *
 * O objetivo entra como AFUNILAMENTO, não como corte cego: se houver produto do
 * objetivo informado, só esses ficam — é isso que impede um crédito de 150k de
 * imóvel casar com um produto de auto de 45k–180k. Se NENHUM produto atender o
 * objetivo (hoje só existem produtos de imóvel, e há cotas com objetivo 'auto'),
 * o conjunto volta a ser o de antes — sem objetivo o comportamento é idêntico ao
 * histórico, e nada de venda antiga muda de produto.
 *
 * NÃO faz `limit(1)`: devolve TODOS os elegíveis, já ORDENADOS por
 * especificidade (`ordenarProdutosPorEspecificidade`), porque faixas sobrepostas
 * (EI1 × PSE, TP × TEP, SEP/TEP × SEP_ALTO/TEP_ALTO) precisam de critério
 * declarado, e quem opera ainda pode escolher outro na tela.
 */
export function produtosElegiveisParaCarta<T extends ProdutoElegivelShape>(
  produtos: T[],
  valorCredito: number,
  tipoProduto?: string | null,
  objetivo?: string | null,
): T[] {
  const valor = Number(valorCredito || 0);
  if (valor <= 0) return [];
  const tipoTaxa = taxaAntecipadaTipoDeProduto(tipoProduto);
  const base = produtos.filter(
    (p) =>
      p.ativo !== false &&
      p.taxa_antecipada_tipo === tipoTaxa &&
      Number(p.faixa_credito_min ?? 0) <= valor &&
      Number(p.faixa_credito_max ?? Infinity) >= valor,
  );
  const doObjetivo = objetivo
    ? base.filter((p) => produtoCasaObjetivo(p, objetivo))
    : [];
  return ordenarProdutosPorEspecificidade(doObjetivo.length > 0 ? doObjetivo : base);
}

export async function resolverParcelaOficial(
  p: ParcelaOficialParams,
): Promise<ParcelaOficial | undefined> {
  const valorCredito = Number(p.valorCredito || 0);
  const prazo = Number(p.prazoMeses || 0);
  if (valorCredito <= 0 || prazo <= 0) return undefined;

  const taxaAntecipadaTipo = taxaAntecipadaTipoDeProduto(p.tipoProduto);


  // Sem `limit(1)`: traz todos os elegíveis por (ativo + taxa antecipada + faixa)
  // e deixa o afunilamento por objetivo e o desempate por especificidade para
  // `produtosElegiveisParaCarta` — determinístico, e o mesmo critério da tela.
  const { data: produtoRows } = await supabase
    .from('consorcio_produtos')
    .select('*, consorcio_objetivo_options(name)')
    .eq('ativo', true)
    .eq('taxa_antecipada_tipo', taxaAntecipadaTipo)
    .lte('faixa_credito_min', valorCredito)
    .gte('faixa_credito_max', valorCredito);

  const candidatos = (produtoRows || []).map((row: any) => ({
    ...row,
    objetivo_nome: row.consorcio_objetivo_options?.name ?? null,
  }));

  const produtoRow = produtosElegiveisParaCarta(
    candidatos,
    valorCredito,
    p.tipoProduto,
    p.objetivo,
  )[0];

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
