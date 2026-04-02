import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type StatusParcela = 'paga' | 'vencendo' | 'atrasada' | 'pendente';
export type SituacaoCota = 'quitada' | 'pendente' | 'em_atraso' | 'cancelada';

export interface PagamentoRow {
  id: string;
  card_id: string;
  numero_parcela: number;
  tipo: string;
  valor_parcela: number;
  valor_comissao: number;
  data_vencimento: string;
  data_pagamento: string | null;
  status: string;
  observacao: string | null;
  // Card fields
  nome_completo: string | null;
  razao_social: string | null;
  tipo_pessoa: string;
  grupo: string;
  cota: string;
  cota_status: string;
  vendedor_name: string | null;
  origem: string | null;
  tipo_produto: string | null;
  // Computed
  status_calculado: StatusParcela;
  situacao_cota: SituacaoCota;
  cliente_nome: string;
}

export interface PagamentosKPIData {
  totalRecebido: number;
  totalPendente: number;
  totalAtraso: number;
  parcelasPagas: number;
  parcelasPendentes: number;
  parcelasVencidas: number;
  cotasInadimplentes: number;
  cotasQuitadas: number;
}

export interface PagamentosFiltersState {
  search: string;
  statusParcela: string;
  situacaoCota: string;
  grupo: string;
  responsavel: string;
  origem: string;
  tipo: string;
  periodoInicio: string;
  periodoFim: string;
  apenasInadimplentes: boolean;
  apenasQuitadas: boolean;
  apenasVencendoSemana: boolean;
}

export const defaultFilters: PagamentosFiltersState = {
  search: '',
  statusParcela: 'todos',
  situacaoCota: 'todos',
  grupo: 'todos',
  responsavel: 'todos',
  origem: 'todos',
  tipo: 'todos',
  periodoInicio: '',
  periodoFim: '',
  apenasInadimplentes: false,
  apenasQuitadas: false,
  apenasVencendoSemana: false,
};

function calcStatusParcela(inst: { status: string; data_pagamento: string | null; data_vencimento: string }): StatusParcela {
  if (inst.status === 'pago' || inst.data_pagamento) return 'paga';
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const venc = new Date(inst.data_vencimento + 'T00:00:00');
  const diff = (venc.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24);
  if (diff < 0) return 'atrasada';
  if (diff <= 7) return 'vencendo';
  return 'pendente';
}

interface CardGlobalStats {
  totalParcelas: number;
  parcelasPagas: number;
  temAtraso: boolean;
}

function calcSituacaoCotaGlobal(stats: CardGlobalStats | undefined, cotaStatus: string): SituacaoCota {
  if (cotaStatus === 'cancelado') return 'cancelada';
  if (!stats || stats.totalParcelas === 0) return 'pendente';
  if (stats.parcelasPagas === stats.totalParcelas) return 'quitada';
  if (stats.temAtraso) return 'em_atraso';
  return 'pendente';
}

export function useConsorcioPagamentos(
  filters: PagamentosFiltersState,
  page: number,
  pageSize: number = 50,
  selectedMonth?: { start: string; end: string }
) {
  // Fetch installments filtered by selected month
  const { data: rawData, isLoading, refetch } = useQuery({
    queryKey: ['consorcio-pagamentos-all', selectedMonth?.start, selectedMonth?.end],
    queryFn: async () => {
      const allInstallments: any[] = [];
      let from = 0;
      const batchSize = 1000;
      let hasMore = true;
      
      while (hasMore) {
        let query = supabase
          .from('consortium_installments')
          .select(`
            id, card_id, numero_parcela, tipo, valor_parcela, valor_comissao,
            data_vencimento, data_pagamento, status, observacao,
            consortium_cards!inner (
              nome_completo, razao_social, tipo_pessoa, grupo, cota, 
              status, vendedor_name, origem, tipo_produto
            )
          `)
          .order('data_vencimento', { ascending: true });

        // Filter by selected month
        if (selectedMonth) {
          query = query
            .gte('data_vencimento', selectedMonth.start)
            .lte('data_vencimento', selectedMonth.end);
        }

        query = query.range(from, from + batchSize - 1);
        
        const { data, error } = await query;
        
        if (error) throw error;
        if (!data || data.length === 0) {
          hasMore = false;
        } else {
          allInstallments.push(...data);
          from += batchSize;
          if (data.length < batchSize) hasMore = false;
        }
      }
      
      return allInstallments;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Process: compute statuses and flatten
  const processedData = useMemo(() => {
    if (!rawData) return [];
    
    const withStatus = rawData.map((inst: any) => {
      const card = inst.consortium_cards as any;
      const status_calculado = calcStatusParcela(inst);
      return {
        ...inst,
        nome_completo: card?.nome_completo,
        razao_social: card?.razao_social,
        tipo_pessoa: card?.tipo_pessoa || 'pf',
        grupo: card?.grupo || '',
        cota: card?.cota || '',
        cota_status: card?.status || '',
        vendedor_name: card?.vendedor_name,
        origem: card?.origem,
        tipo_produto: card?.tipo_produto,
        status_calculado,
        cliente_nome: card?.tipo_pessoa === 'pj' ? (card?.razao_social || 'Sem nome') : (card?.nome_completo || 'Sem nome'),
        situacao_cota: '' as SituacaoCota,
      } as PagamentoRow;
    });

    // Compute situacao_cota grouped by card_id
    const byCard = new Map<string, PagamentoRow[]>();
    for (const row of withStatus) {
      const arr = byCard.get(row.card_id) || [];
      arr.push(row);
      byCard.set(row.card_id, arr);
    }
    
    for (const [cardId, parcelas] of byCard) {
      const situacao = calcSituacaoCota(parcelas, parcelas[0]?.cota_status || '');
      for (const p of parcelas) {
        p.situacao_cota = situacao;
      }
    }

    return withStatus;
  }, [rawData]);

  // KPIs
  const kpis = useMemo((): PagamentosKPIData => {
    if (!processedData.length) return {
      totalRecebido: 0, totalPendente: 0, totalAtraso: 0,
      parcelasPagas: 0, parcelasPendentes: 0, parcelasVencidas: 0,
      cotasInadimplentes: 0, cotasQuitadas: 0,
    };

    let totalRecebido = 0, totalPendente = 0, totalAtraso = 0;
    let parcelasPagas = 0, parcelasPendentes = 0, parcelasVencidas = 0;

    for (const p of processedData) {
      if (p.status_calculado === 'paga') {
        totalRecebido += Number(p.valor_parcela);
        parcelasPagas++;
      } else if (p.status_calculado === 'atrasada') {
        totalAtraso += Number(p.valor_parcela);
        parcelasVencidas++;
      } else {
        totalPendente += Number(p.valor_parcela);
        parcelasPendentes++;
      }
    }

    const byCard = new Map<string, SituacaoCota>();
    for (const p of processedData) {
      byCard.set(p.card_id, p.situacao_cota);
    }
    let cotasInadimplentes = 0, cotasQuitadas = 0;
    for (const sit of byCard.values()) {
      if (sit === 'em_atraso') cotasInadimplentes++;
      if (sit === 'quitada') cotasQuitadas++;
    }

    return { totalRecebido, totalPendente, totalAtraso, parcelasPagas, parcelasPendentes, parcelasVencidas, cotasInadimplentes, cotasQuitadas };
  }, [processedData]);

  // Apply filters
  const filteredData = useMemo(() => {
    let result = processedData;
    
    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(r => 
        r.cliente_nome.toLowerCase().includes(q) ||
        r.grupo.toLowerCase().includes(q) ||
        r.cota.toLowerCase().includes(q) ||
        String(r.numero_parcela).includes(q)
      );
    }
    if (filters.statusParcela !== 'todos') {
      result = result.filter(r => r.status_calculado === filters.statusParcela);
    }
    if (filters.situacaoCota !== 'todos') {
      result = result.filter(r => r.situacao_cota === filters.situacaoCota);
    }
    if (filters.grupo !== 'todos') {
      result = result.filter(r => r.grupo === filters.grupo);
    }
    if (filters.responsavel !== 'todos') {
      result = result.filter(r => r.vendedor_name === filters.responsavel);
    }
    if (filters.origem !== 'todos') {
      result = result.filter(r => r.origem === filters.origem);
    }
    if (filters.tipo !== 'todos') {
      result = result.filter(r => r.tipo === filters.tipo);
    }
    if (filters.periodoInicio) {
      result = result.filter(r => r.data_vencimento >= filters.periodoInicio);
    }
    if (filters.periodoFim) {
      result = result.filter(r => r.data_vencimento <= filters.periodoFim);
    }
    if (filters.apenasInadimplentes) {
      result = result.filter(r => r.situacao_cota === 'em_atraso');
    }
    if (filters.apenasQuitadas) {
      result = result.filter(r => r.situacao_cota === 'quitada');
    }
    if (filters.apenasVencendoSemana) {
      result = result.filter(r => r.status_calculado === 'vencendo');
    }

    return result;
  }, [processedData, filters]);

  // Pagination
  const totalItems = filteredData.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const paginatedData = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, page, pageSize]);

  // Unique values for filter dropdowns
  const filterOptions = useMemo(() => {
    const grupos = new Set<string>();
    const responsaveis = new Set<string>();
    const origens = new Set<string>();
    for (const p of processedData) {
      if (p.grupo) grupos.add(p.grupo);
      if (p.vendedor_name) responsaveis.add(p.vendedor_name);
      if (p.origem) origens.add(p.origem);
    }
    return {
      grupos: Array.from(grupos).sort(),
      responsaveis: Array.from(responsaveis).sort(),
      origens: Array.from(origens).sort(),
    };
  }, [processedData]);

  // Alert data
  const alertData = useMemo(() => {
    const parcelasAtraso = processedData.filter(p => p.status_calculado === 'atrasada').length;
    const cotasComAtraso = new Set(processedData.filter(p => p.situacao_cota === 'em_atraso').map(p => p.card_id)).size;
    const valorAberto = processedData
      .filter(p => p.status_calculado === 'atrasada')
      .reduce((sum, p) => sum + Number(p.valor_parcela), 0);
    return { parcelasAtraso, cotasComAtraso, valorAberto };
  }, [processedData]);

  return {
    data: paginatedData,
    allData: filteredData,
    isLoading,
    refetch,
    kpis,
    alertData,
    totalItems,
    totalPages,
    filterOptions,
  };
}

// Hook to get installments for a specific card (for detail drawer)
export function useCardInstallments(cardId: string | null) {
  return useQuery({
    queryKey: ['card-installments-detail', cardId],
    queryFn: async () => {
      if (!cardId) return [];
      const { data, error } = await supabase
        .from('consortium_installments')
        .select('*')
        .eq('card_id', cardId)
        .order('numero_parcela', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!cardId,
  });
}
