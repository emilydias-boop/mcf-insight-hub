/**
 * LEITURA APENAS — quais combinações de plano as vendas já usaram e a tabela
 * `consorcio_creditos` não tem cadastradas.
 *
 * REGRA (Fase D2, aprovada):
 * - Carta viva = `declinada_at IS NULL` e proposta não excluída/declinada.
 * - Cobertura = existe crédito ATIVO de produto ATIVO com o MESMO tipo de taxa
 *   antecipada (parcelinha × select), MESMO valor de crédito (comparado em
 *   centavos inteiros), no prazo da carta, com as DUAS parcelas > 0.
 * - Carta COM condição gravada: precisa da coluna daquela condição.
 * - Carta SEM condição gravada (a maioria, por normalização silenciosa): só é
 *   pedido se o crédito/prazo não existe em NENHUMA das três condições. Isso
 *   evita transformar dado faltante da venda em pedido de cadastro de plano.
 * - Prazo fora de 200/220/240 não é pedido de plano: entra num contador neutro.
 *
 * Custo: uma passada nos créditos para montar um Set de chaves e um lookup O(1)
 * por carta. Nada de cartas × planos.
 *
 * Nada aqui escreve, recalcula ou corrige o que está gravado.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { taxaAntecipadaTipoDeProduto } from '@/lib/consorcioParcelaOficial';
import { CONDICOES, PRAZOS } from '@/hooks/useConsorcioCreditosAdmin';

type TipoTaxa = 'dividida_12' | 'primeira_parcela';
type CondKey = 'conv' | '50' | '25';

const CONDICAO_LABEL: Record<CondKey, string> = {
  conv: 'Convencional',
  '50': 'Mais por Menos 50%',
  '25': 'Mais por Menos 25%',
};

const TIPO_TAXA_LABEL: Record<TipoTaxa, string> = {
  dividida_12: 'Parcelinha',
  primeira_parcela: 'Select',
};

function condKeyDaCarta(c?: string | null): CondKey | null {
  if (c === '50' || c === '25') return c;
  if (c === 'convencional') return 'conv';
  return null;
}

const centavos = (v: unknown) => Math.round(Number(v || 0) * 100);

/**
 * Piso de saneamento: abaixo de R$ 1.000,00 (100.000 centavos) não existe carta
 * de consórcio — é erro de digitação na venda. Essas cartas não entram na fila de
 * cadastro de plano (cadastrar plano não resolve erro de digitação) e viram um
 * contador neutro. R$ 40.000 continua na fila: é crédito plausível, só não está
 * cadastrado. O corte é só contra o absurdo.
 */
export const MIN_CREDITO_CENTAVOS = 100_000;

export interface CombinacaoFaltante {
  /** Chave estável: tipoTaxa|centavos|prazo|condKey ('?' quando não informada). */
  key: string;
  tipoTaxa: TipoTaxa;
  tipoTaxaLabel: string;
  valorCredito: number;
  prazoMeses: number;
  /** null = a carta não declarou condição (rótulo "condição não informada"). */
  condKey: CondKey | null;
  condicaoLabel: string;
  /** Quantas cartas gravadas dependem desta combinação. */
  cartas: number;
  /** Coluna(s) de parcela que o cadastro precisa preencher. */
  colunas: string[];
}

export interface PlanosFaltandoResultado {
  combinacoes: CombinacaoFaltante[];
  /** Total de cartas vivas cobertas pelo cálculo. */
  cartasAnalisadas: number;
  /** Cartas com prazo sem coluna na tabela — cadastrar plano NÃO resolve. */
  cartasPrazoForaDaTabela: number;
  /** Cartas com crédito abaixo de R$ 1.000 — erro de digitação; cadastrar plano não resolve. */
  cartasCreditoAbaixoMinimo: number;
  /** Mapa cartaId → chave da combinação faltante (para o Dossiê). */
  porCarta: Record<string, string>;
  /** Índice chave → combinação, para telas que só têm os campos do cadastro. */
  porChave: Record<string, CombinacaoFaltante>;
}

/**
 * Chave da combinação a partir dos campos já gravados (carta OU cadastro
 * pendente, que não guarda o id da carta). Retorna null quando não dá para
 * comparar (sem crédito, crédito abaixo do piso de saneamento, ou prazo sem
 * coluna na tabela). Crédito abaixo de R$ 1.000 é erro de digitação e não gera
 * aviso "Plano fora da tabela" no Dossiê.
 */
export function chaveDaCombinacao(reg: {
  tipo_produto?: string | null;
  valor_credito?: number | string | null;
  prazo_meses?: number | string | null;
  condicao_pagamento?: string | null;
}): string | null {
  const cent = centavos(reg.valor_credito);
  const prazo = Number(reg.prazo_meses || 0);
  if (cent <= 0 || cent < MIN_CREDITO_CENTAVOS || !(PRAZOS as readonly number[]).includes(prazo)) return null;
  const tipoTaxa = taxaAntecipadaTipoDeProduto(reg.tipo_produto);
  const cond = condKeyDaCarta(reg.condicao_pagamento);
  return `${tipoTaxa}|${cent}|${prazo}|${cond ?? '?'}`;
}

const VAZIO: PlanosFaltandoResultado = {
  combinacoes: [],
  cartasAnalisadas: 0,
  cartasPrazoForaDaTabela: 0,
  cartasCreditoAbaixoMinimo: 0,
  porCarta: {},
  porChave: {},
};


export function useConsorcioPlanosFaltando() {
  return useQuery({
    queryKey: ['consorcio-planos-faltando'],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<PlanosFaltandoResultado> => {
      const [cartasRes, propostasRes, creditosRes, produtosRes] = await Promise.all([
        supabase
          .from('consorcio_proposal_cartas')
          .select('id, proposal_id, tipo_produto, valor_credito, prazo_meses, condicao_pagamento')
          .is('declinada_at', null),
        supabase.from('consorcio_proposals').select('id, status'),
        supabase.from('consorcio_creditos').select('*').eq('ativo', true),
        supabase.from('consorcio_produtos').select('id, taxa_antecipada_tipo, ativo'),
      ]);
      if (cartasRes.error) throw cartasRes.error;
      if (creditosRes.error) throw creditosRes.error;

      const mortas = new Set(
        ((propostasRes.data || []) as Array<{ id: string; status?: string | null }>)
          .filter(p => ['excluida', 'declinada'].includes(String(p.status || '').toLowerCase()))
          .map(p => p.id),
      );

      // tipo de taxa por produto, para saber a qual "família" cada crédito pertence
      const tipoPorProduto = new Map<string, TipoTaxa>();
      ((produtosRes.data || []) as Array<{ id: string; taxa_antecipada_tipo: string | null; ativo: boolean | null }>)
        .filter(p => p.ativo !== false)
        .forEach(p => {
          if (p.taxa_antecipada_tipo === 'primeira_parcela' || p.taxa_antecipada_tipo === 'dividida_12') {
            tipoPorProduto.set(p.id, p.taxa_antecipada_tipo);
          }
        });

      // Uma passada: Set de chaves completas (tipoTaxa|cent|prazo|cond)
      // + Set de chaves "qualquer condição" (tipoTaxa|cent|prazo).
      const completas = new Set<string>();
      const qualquerCondicao = new Set<string>();
      for (const cr of (creditosRes.data || []) as Array<Record<string, any>>) {
        const tipoTaxa = tipoPorProduto.get(String(cr.produto_id));
        if (!tipoTaxa) continue;
        const cent = centavos(cr.valor_credito);
        for (const cond of CONDICOES) {
          for (const prazo of PRAZOS) {
            const p1 = Number(cr[`parcela_1a_12a_${cond.key}_${prazo}`] || 0);
            const pd = Number(cr[`parcela_demais_${cond.key}_${prazo}`] || 0);
            if (!(p1 > 0) || !(pd > 0)) continue;
            completas.add(`${tipoTaxa}|${cent}|${prazo}|${cond.key}`);
            qualquerCondicao.add(`${tipoTaxa}|${cent}|${prazo}`);
          }
        }
      }

      const acc = new Map<string, CombinacaoFaltante>();
      const porCarta: Record<string, string> = {};
      let cartasAnalisadas = 0;
      let cartasPrazoForaDaTabela = 0;
      let cartasCreditoAbaixoMinimo = 0;

      for (const c of (cartasRes.data || []) as Array<Record<string, any>>) {
        if (c.proposal_id && mortas.has(String(c.proposal_id))) continue;
        cartasAnalisadas += 1;

        const prazo = Number(c.prazo_meses || 0);
        const cent = centavos(c.valor_credito);
        if (cent <= 0) continue;
        // Crédito abaixo de R$ 1.000 é erro de digitação — não existe consórcio
        // nessa faixa. Não entra na fila nem no mapa porCarta (logo, não gera
        // aviso no Dossiê). Cadastrar plano não resolve erro de digitação.
        if (cent < MIN_CREDITO_CENTAVOS) {
          cartasCreditoAbaixoMinimo += 1;
          continue;
        }
        if (!(PRAZOS as readonly number[]).includes(prazo)) {
          cartasPrazoForaDaTabela += 1;
          continue;
        }

        const tipoTaxa = taxaAntecipadaTipoDeProduto(c.tipo_produto);
        const cond = condKeyDaCarta(c.condicao_pagamento);

        const coberta = cond
          ? completas.has(`${tipoTaxa}|${cent}|${prazo}|${cond}`)
          : qualquerCondicao.has(`${tipoTaxa}|${cent}|${prazo}`);
        if (coberta) continue;

        const key = `${tipoTaxa}|${cent}|${prazo}|${cond ?? '?'}`;
        const atual = acc.get(key);
        if (atual) {
          atual.cartas += 1;
        } else {
          acc.set(key, {
            key,
            tipoTaxa,
            tipoTaxaLabel: TIPO_TAXA_LABEL[tipoTaxa],
            valorCredito: cent / 100,
            prazoMeses: prazo,
            condKey: cond,
            condicaoLabel: cond ? CONDICAO_LABEL[cond] : 'condição não informada',
            cartas: 1,
            colunas: cond
              ? [`parcela_1a_12a_${cond}_${prazo}`, `parcela_demais_${cond}_${prazo}`]
              : CONDICOES.flatMap(x => [
                  `parcela_1a_12a_${x.key}_${prazo}`,
                  `parcela_demais_${x.key}_${prazo}`,
                ]),
          });
        }
        porCarta[String(c.id)] = key;
      }

      const combinacoes = [...acc.values()].sort(
        (a, b) =>
          b.cartas - a.cartas ||
          a.tipoTaxaLabel.localeCompare(b.tipoTaxaLabel) ||
          a.valorCredito - b.valorCredito,
      );

      const porChave: Record<string, CombinacaoFaltante> = {};
      combinacoes.forEach((c) => { porChave[c.key] = c; });

      return { combinacoes, cartasAnalisadas, cartasPrazoForaDaTabela, cartasCreditoAbaixoMinimo, porCarta, porChave };

    },
  });
}

export { VAZIO as PLANOS_FALTANDO_VAZIO };
