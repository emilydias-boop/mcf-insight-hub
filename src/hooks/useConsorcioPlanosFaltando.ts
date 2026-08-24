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
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
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

/** Sugestão que a equipe decidiu ignorar (ex.: crédito que é soma de cartas). */
export interface SugestaoIgnorada extends CombinacaoFaltante {
  ignoradoPorNome: string | null;
  ignoradoEm: string | null;
}

export interface PlanosFaltandoResultado {
  /** Fila ativa (já sem as ignoradas). */
  combinacoes: CombinacaoFaltante[];
  /** Sugestões ignoradas — nunca somem, dá para restaurar. */
  ignoradas: SugestaoIgnorada[];
  /** Total de cartas vivas cobertas pelo cálculo. */
  cartasAnalisadas: number;
  /** Cartas com prazo sem coluna na tabela — cadastrar plano NÃO resolve. */
  cartasPrazoForaDaTabela: number;
  /** Cartas com crédito abaixo de R$ 1.000 — erro de digitação; cadastrar plano não resolve. */
  cartasCreditoAbaixoMinimo: number;
  /** Mapa cartaId → chave da combinação faltante (para o Dossiê). */
  porCarta: Record<string, string>;
  /** Índice chave → combinação ATIVA (ignoradas ficam fora, de propósito). */
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
  ignoradas: [],
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
      const [cartasRes, propostasRes, creditosRes, produtosRes, ignoradosRes] = await Promise.all([
        supabase
          .from('consorcio_proposal_cartas')
          .select('id, proposal_id, tipo_produto, valor_credito, prazo_meses, condicao_pagamento')
          .is('declinada_at', null),
        supabase.from('consorcio_proposals').select('id, status'),
        supabase.from('consorcio_creditos').select('*').eq('ativo', true),
        supabase.from('consorcio_produtos').select('id, taxa_antecipada_tipo, ativo'),
        supabase
          .from('consorcio_planos_faltando_ignorados')
          .select('combinacao_key, ignorado_por, created_at'),
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

      const todas = [...acc.values()].sort(
        (a, b) =>
          b.cartas - a.cartas ||
          a.tipoTaxaLabel.localeCompare(b.tipoTaxaLabel) ||
          a.valorCredito - b.valorCredito,
      );

      // Sugestões que a equipe marcou como "ignorar" (ex.: o crédito gravado é a
      // soma de várias cartas, não o crédito de um plano). Só filtra a fila —
      // nenhuma carta é alterada.
      const ignoradosRows = ((ignoradosRes as any)?.data || []) as Array<{
        combinacao_key: string;
        ignorado_por: string | null;
        created_at: string;
      }>;
      const nomePorUser = new Map<string, string>();
      const userIds = [...new Set(ignoradosRows.map(r => r.ignorado_por).filter(Boolean))] as string[];
      if (userIds.length > 0) {
        const { data: perfis } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', userIds);
        (perfis || []).forEach((p: any) => nomePorUser.set(String(p.id), p.full_name || ''));
      }
      const metaIgnorada = new Map(ignoradosRows.map(r => [r.combinacao_key, r]));

      const combinacoes = todas.filter(c => !metaIgnorada.has(c.key));
      const ignoradas: SugestaoIgnorada[] = todas
        .filter(c => metaIgnorada.has(c.key))
        .map(c => {
          const m = metaIgnorada.get(c.key)!;
          return {
            ...c,
            ignoradoPorNome: (m.ignorado_por && nomePorUser.get(m.ignorado_por)) || null,
            ignoradoEm: m.created_at || null,
          };
        });

      const porChave: Record<string, CombinacaoFaltante> = {};
      combinacoes.forEach((c) => { porChave[c.key] = c; });

      return {
        combinacoes,
        ignoradas,
        cartasAnalisadas,
        cartasPrazoForaDaTabela,
        cartasCreditoAbaixoMinimo,
        porCarta,
        porChave,
      };

    },
  });
}

/** Ignora uma sugestão da fila de cadastro de plano. Reversível. */
export function useIgnorarSugestaoPlano() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (key: string) => {
      const { error } = await supabase
        .from('consorcio_planos_faltando_ignorados')
        .insert({ combinacao_key: key } as any);
      // 23505 = duas pessoas clicaram junto; o estado final é o mesmo.
      if (error && (error as any).code !== '23505') throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['consorcio-planos-faltando'] });
      toast.success('Sugestão ignorada');
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao ignorar sugestão'),
  });
}

/** Devolve a sugestão para a fila (apaga a linha de "ignorada"). */
export function useRestaurarSugestaoPlano() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (key: string) => {
      const { error } = await supabase
        .from('consorcio_planos_faltando_ignorados')
        .delete()
        .eq('combinacao_key', key);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['consorcio-planos-faltando'] });
      toast.success('Sugestão restaurada');
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao restaurar sugestão'),
  });
}

export { VAZIO as PLANOS_FALTANDO_VAZIO };
