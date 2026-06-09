import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { calcularComissao } from '@/lib/commissionCalculator';
import { TipoProduto } from '@/types/consorcio';
import {
  EMBRACON_CALENDAR_2026,
  CalendarWeek,
  CALENDAR_RANGE,
  findCalendarWeek,
} from '@/lib/embraconCalendar2026';

export interface PrevisaoParcela {
  installmentId: string;
  cardId: string;
  numeroParcela: number;
  dataPagamento: string;
  valorParcela: number;
  valorComissao: number;
  tipoProduto: TipoProduto;
  valorCredito: number;
  grupo: string;
  cota: string;
  cliente: string;
  vendedorNome: string;
  vendedorId: string | null;
  /** true = parcela ainda não paga, projetada pelo vencimento (não inadimplente). */
  previsto: boolean;
}

export interface PrevisaoSemana extends CalendarWeek {
  parcelas: PrevisaoParcela[];
  totalComissao: number;
  totalParcelas: number;
  totalCotas: number;
  totalValorParcela: number;
  /** Total da semana já com saneamento anti-outlier (parcelas > 5× a mediana são limitadas) */
  totalComissaoSaneada: number;
  /** Quantidade de parcelas que tiveram a comissão limitada pelo anti-outlier */
  outliersCount: number;
  /** Valor total "removido" pelo anti-outlier nessa semana */
  outliersValor: number;
  /** Média móvel das últimas 4 semanas (incluindo essa), em cima de totalComissaoSaneada */
  mediaMovel4s: number;
  /** Total realizado: apenas parcelas pagas. */
  totalComissaoRealizada: number;
  /** Total projetado: apenas parcelas a vencer (pendentes, não inadimplentes). */
  totalComissaoProjetada: number;
  /** Qtd parcelas realizadas (pagas). */
  parcelasRealizadas: number;
  /** Qtd parcelas projetadas (a vencer). */
  parcelasProjetadas: number;
}

export interface PrevisaoResult {
  semanas: PrevisaoSemana[];
  totalGeralComissao: number;
  totalGeralParcelas: number;
  proximaSemana?: PrevisaoSemana;
}

/**
 * Previsão semanal de comissões — agrupa parcelas pagas (status='pago') pelo
 * período de apuração oficial Embracon 2026 (quinta → quarta), com pagamento
 * ao parceiro na quinta-feira seguinte.
 */
export function useConsorcioPrevisaoComissoes() {
  return useQuery({
    queryKey: ['consorcio-previsao-comissoes', CALENDAR_RANGE.start, CALENDAR_RANGE.end],
    queryFn: async (): Promise<PrevisaoResult> => {
      const { data: installments, error } = await supabase
        .from('consortium_installments')
        .select(`
          id,
          card_id,
          numero_parcela,
          data_pagamento,
          valor_parcela,
          status,
          consortium_cards!inner (
            grupo,
            cota,
            valor_credito,
            tipo_produto,
            nome_completo,
            razao_social,
            tipo_pessoa,
            vendedor_id,
            vendedor_name,
            status
          )
        `)
        .eq('status', 'pago')
        .in('consortium_cards.status', ['ativo', 'contemplado'])
        .not('data_pagamento', 'is', null)
        .gte('data_pagamento', CALENDAR_RANGE.start)
        .lte('data_pagamento', CALENDAR_RANGE.end)
        .limit(10000);

      if (error) throw error;

      // ============================================================
      // Coleta TODAS as comissões previstas para calcular a mediana
      // por tipoProduto (usada como base do anti-outlier).
      // ============================================================
      const todasComissoes: Record<string, number[]> = {};
      for (const inst of installments ?? []) {
        const card = (inst as any).consortium_cards;
        if (!card) continue;
        const tipo = (card.tipo_produto || 'select') as string;
        const c = calcularComissao(
          Number(card.valor_credito) || 0,
          tipo as TipoProduto,
          (inst as any).numero_parcela,
        );
        if (c > 0) {
          if (!todasComissoes[tipo]) todasComissoes[tipo] = [];
          todasComissoes[tipo].push(c);
        }
      }
      function mediana(arr: number[]): number {
        if (!arr.length) return 0;
        const s = [...arr].sort((a, b) => a - b);
        const m = Math.floor(s.length / 2);
        return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
      }
      const medianaPorTipo: Record<string, number> = {};
      for (const k of Object.keys(todasComissoes)) {
        medianaPorTipo[k] = mediana(todasComissoes[k]);
      }
      // Fator de corte: parcelas acima de 5× a mediana do seu tipo são limitadas a 5× a mediana.
      const OUTLIER_FACTOR = 5;

      // Inicializa estrutura por semana
      const byWeek = new Map<number, PrevisaoSemana>();
      for (const w of EMBRACON_CALENDAR_2026) {
        byWeek.set(w.n, {
          ...w,
          parcelas: [],
          totalComissao: 0,
          totalParcelas: 0,
          totalCotas: 0,
          totalValorParcela: 0,
          totalComissaoSaneada: 0,
          outliersCount: 0,
          outliersValor: 0,
          mediaMovel4s: 0,
        });
      }

      for (const inst of installments ?? []) {
        const card = (inst as any).consortium_cards;
        if (!card) continue;
        // Defesa extra: ignora cotas canceladas/inválidas
        if (card.status && card.status !== 'ativo' && card.status !== 'contemplado') continue;
        const week = findCalendarWeek(inst.data_pagamento as string);
        if (!week) continue;
        const bucket = byWeek.get(week.n);
        if (!bucket) continue;

        const valorCredito = Number(card.valor_credito) || 0;
        const tipoProduto = (card.tipo_produto || 'select') as TipoProduto;
        // Calcula comissão usando a tabela oficial (SELECT/PARCELINHA) sem override do produto.
        const valorComissao = calcularComissao(valorCredito, tipoProduto, inst.numero_parcela);

        // Anti-outlier: limita comissão acima de 5× a mediana do tipoProduto.
        const med = medianaPorTipo[tipoProduto] || 0;
        const tetoSaneamento = med > 0 ? med * OUTLIER_FACTOR : Infinity;
        const valorComissaoSaneada = Math.min(valorComissao, tetoSaneamento);
        if (valorComissaoSaneada < valorComissao) {
          bucket.outliersCount += 1;
          bucket.outliersValor += valorComissao - valorComissaoSaneada;
        }

        const cliente =
          card.tipo_pessoa === 'pj' ? card.razao_social : card.nome_completo;

        bucket.parcelas.push({
          installmentId: inst.id,
          cardId: inst.card_id,
          numeroParcela: inst.numero_parcela,
          dataPagamento: inst.data_pagamento as string,
          valorParcela: Number(inst.valor_parcela) || 0,
          valorComissao,
          tipoProduto,
          valorCredito,
          grupo: card.grupo || '',
          cota: card.cota || '',
          cliente: cliente || '-',
          vendedorNome: card.vendedor_name || '-',
          vendedorId: card.vendedor_id || null,
        });
        bucket.totalComissao += valorComissao;
        bucket.totalComissaoSaneada += valorComissaoSaneada;
        bucket.totalValorParcela += Number(inst.valor_parcela) || 0;
        bucket.totalParcelas += 1;
      }

      // Conta cotas distintas por semana
      for (const semana of byWeek.values()) {
        semana.totalCotas = new Set(semana.parcelas.map((p) => p.cardId)).size;
      }

      const semanas = Array.from(byWeek.values());

      // ============================================================
      // Média móvel 4 semanas (sobre totalComissaoSaneada).
      // Suaviza o efeito de "deslize" da Embracon: parcela paga numa
      // semana mas comissionada em outra. Para cada semana N, faz a
      // média das semanas [N-3..N], considerando só semanas com algum
      // pagamento previsto (totalParcelas > 0).
      // ============================================================
      for (let i = 0; i < semanas.length; i++) {
        const janela: number[] = [];
        for (let j = Math.max(0, i - 3); j <= i; j++) {
          if (semanas[j].totalParcelas > 0) {
            janela.push(semanas[j].totalComissaoSaneada);
          }
        }
        semanas[i].mediaMovel4s =
          janela.length > 0 ? janela.reduce((a, b) => a + b, 0) / janela.length : 0;
      }

      const totalGeralComissao = semanas.reduce((s, w) => s + w.totalComissao, 0);
      const totalGeralParcelas = semanas.reduce((s, w) => s + w.totalParcelas, 0);

      // Próxima semana = primeira com data de pagamento >= hoje
      const hoje = new Date().toISOString().slice(0, 10);
      const proximaSemana = semanas.find((w) => w.dataPagamento >= hoje);

      return { semanas, totalGeralComissao, totalGeralParcelas, proximaSemana };
    },
    staleTime: 1000 * 60 * 2,
  });
}
