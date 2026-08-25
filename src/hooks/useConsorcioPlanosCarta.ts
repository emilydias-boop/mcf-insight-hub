/**
 * LEITURA APENAS — planos da tabela Embracon para o seletor de plano da carta.
 *
 * Uma única query (produtos ativos + créditos ativos). O filtro por
 * produto/prazo/condição é feito em memória por `filtrarPlanosCarta`, para que a
 * tela possa renderizar N cartas sem chamar hook dentro de loop.
 *
 * Nada aqui escreve no banco.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { taxaAntecipadaTipoDeProduto } from '@/lib/consorcioParcelaOficial';

/** Prazos que a tabela `consorcio_creditos` tem colunas para. */
export const PRAZOS_TABELADOS = [200, 220, 240] as const;

/**
 * O produto tem prazo que a tabela oficial não cobre? Nesse caso a parcela dele
 * sai CALCULADA (composição do produto), não tabelada — informação, não erro.
 */
export function prazosForaDaTabela(prazos?: number[] | null): boolean {
  const lista = (prazos || []).map(Number).filter((n) => n > 0);
  if (lista.length === 0) return false;
  return lista.some((p) => !(PRAZOS_TABELADOS as readonly number[]).includes(p));
}

/** Sufixo de coluna por condição de pagamento. */
function condicaoKey(condicao?: string | null): 'conv' | '50' | '25' | null {
  if (!condicao) return null;
  if (condicao === '50' || condicao === '25') return condicao;
  if (condicao === 'convencional') return 'conv';
  return null;
}

export interface PlanoTabelaProduto {
  id: string;
  codigo: string;
  nome: string;
  taxa_antecipada_tipo: string | null;
}

export interface PlanoTabela {
  produtos: PlanoTabelaProduto[];
  creditos: Record<string, any>[];
}

export interface PlanoCartaOption {
  /** id do registro em `consorcio_creditos` — valor do <SelectItem>. */
  id: string;
  produtoId: string;
  produtoCodigo: string;
  produtoNome: string;
  valorCredito: number;
  parcela1a12: number;
  parcelaDemais: number;
}

export function useConsorcioPlanosTabela() {
  return useQuery({
    queryKey: ['consorcio-planos-carta'],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<PlanoTabela> => {
      const [produtosRes, creditosRes] = await Promise.all([
        supabase
          .from('consorcio_produtos')
          .select('id, codigo, nome, taxa_antecipada_tipo')
          .eq('ativo', true),
        supabase
          .from('consorcio_creditos')
          .select('*')
          .eq('ativo', true)
          .order('valor_credito', { ascending: true }),
      ]);
      if (produtosRes.error) throw produtosRes.error;
      if (creditosRes.error) throw creditosRes.error;
      return {
        produtos: (produtosRes.data || []) as PlanoTabelaProduto[],
        creditos: (creditosRes.data || []) as Record<string, any>[],
      };
    },
  });
}

export interface FiltroPlanoCarta {
  tipoProduto?: string | null;
  prazoMeses?: string | number | null;
  condicaoPagamento?: string | null;
}

export interface ResultadoPlanosCarta {
  opcoes: PlanoCartaOption[];
  /** Rótulos do que falta escolher antes de a lista fazer sentido. */
  faltando: string[];
  /** Prazo informado existe, mas a tabela não tem coluna para ele. */
  prazoForaDaTabela: boolean;
}

/**
 * Planos que casam com produto (via taxa antecipada), prazo e condição.
 * Só entra na lista o crédito que tem os DOIS valores de parcela gravados
 * naquela combinação — assim o seletor nunca oferece um plano incompleto.
 */
export function filtrarPlanosCarta(
  tabela: PlanoTabela | undefined,
  filtro: FiltroPlanoCarta,
): ResultadoPlanosCarta {
  const faltando: string[] = [];
  const tipo = (filtro.tipoProduto || '').trim();
  const prazo = Number(filtro.prazoMeses || 0);
  const cond = condicaoKey(filtro.condicaoPagamento);

  if (!tipo) faltando.push('tipo de produto');
  if (!prazo) faltando.push('prazo');
  if (!cond) faltando.push('condição de pagamento');

  const prazoForaDaTabela =
    prazo > 0 && !(PRAZOS_TABELADOS as readonly number[]).includes(prazo);

  if (!tabela || faltando.length > 0 || prazoForaDaTabela) {
    return { opcoes: [], faltando, prazoForaDaTabela };
  }

  const tipoTaxa = taxaAntecipadaTipoDeProduto(tipo);
  const produtosPorId = new Map(
    tabela.produtos
      .filter(p => p.taxa_antecipada_tipo === tipoTaxa)
      .map(p => [p.id, p]),
  );

  const colPrimeira = `parcela_1a_12a_${cond}_${prazo}`;
  const colDemais = `parcela_demais_${cond}_${prazo}`;

  const opcoes: PlanoCartaOption[] = [];
  tabela.creditos.forEach(c => {
    const produto = produtosPorId.get(String(c.produto_id));
    if (!produto) return;
    const p1 = Number(c[colPrimeira] || 0);
    const pd = Number(c[colDemais] || 0);
    if (!(p1 > 0) || !(pd > 0)) return;
    opcoes.push({
      id: String(c.id),
      produtoId: produto.id,
      produtoCodigo: produto.codigo,
      produtoNome: produto.nome,
      valorCredito: Number(c.valor_credito || 0),
      parcela1a12: p1,
      parcelaDemais: pd,
    });
  });

  opcoes.sort((a, b) => a.valorCredito - b.valorCredito
    || a.produtoCodigo.localeCompare(b.produtoCodigo));

  return { opcoes, faltando, prazoForaDaTabela };
}
