/**
 * Hook de kanban com paginação no SERVIDOR.
 *
 * Hoje o kanban de /crm/negocios carrega até 10.000 negócios de uma vez e
 * filtra no navegador — pipelines maiores (Inside Sales ~25 mil) ficam
 * truncadas. Este módulo chama as RPCs `kanban_*` do banco, que contam e
 * paginam no servidor. Nesta etapa NADA na tela muda: só o hook existe.
 *
 * Os tipos gerados do Supabase ainda não conhecem essas RPCs, por isso
 * todas as chamadas usam `(supabase as any).rpc(...)` e lançam erro quando
 * `error` vier preenchido.
 */

import { useQuery, useInfiniteQuery, keepPreviousData, type QueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import type { DealFiltersState } from '@/components/crm/DealFilters';
import type { ActivitySummary } from '@/hooks/useDealActivitySummary';

const PAGE_SIZE_COLUNA = 50;
const PAGE_SIZE_LISTA = 2000;

// ---------------------------------------------------------------------------
// 1. montarFiltrosKanban
// ---------------------------------------------------------------------------

/**
 * Converte o estado de filtros da tela no payload `p_filtros` das RPCs.
 * Inclui `search` quando tem 2+ caracteres (busca roda no servidor);
 * `dateRange` vira `dateFrom`/`dateTo`.
 * Remove chaves null/undefined para a chave de cache ficar estável.
 */
export function montarFiltrosKanban(
  filters: DealFiltersState,
  opts: { restrictOwnerProfileId?: string; restrictCloserEmail?: string } = {},
): Record<string, unknown> {
  const out: Record<string, unknown> = {
    owner: filters.owner,
    closerEmail: filters.closerEmail,
    dealStatus: filters.dealStatus,
    inactivityDays: filters.inactivityDays,
    salesChannel: filters.salesChannel,
    attemptsRange: filters.attemptsRange,
    selectedTags: filters.selectedTags,
    tagFilters: filters.tagFilters,
    tagOperator: filters.tagOperator,
    productFilters: filters.productFilters,
    productOperator: filters.productOperator,
    activityPriority: filters.activityPriority,
    outsideFilter: filters.outsideFilter,
    temperature: filters.temperature,
    lossReasons: filters.lossReasons,
  };

  if (filters.dateRange?.from) {
    out.dateFrom = format(filters.dateRange.from, 'yyyy-MM-dd');
    if (filters.dateRange.to) {
      out.dateTo = format(filters.dateRange.to, 'yyyy-MM-dd');
    }
  }

  const search = filters.search?.trim();
  if (search && search.length >= 2) out.search = search;

  if (opts.restrictOwnerProfileId) out.restrictOwnerProfileId = opts.restrictOwnerProfileId;
  if (opts.restrictCloserEmail) out.restrictCloserEmail = opts.restrictCloserEmail;

  for (const key of Object.keys(out)) {
    if (out[key] === null || out[key] === undefined) delete out[key];
  }
  return out;
}

// ---------------------------------------------------------------------------
// 2. useKanbanOrigemIds
// ---------------------------------------------------------------------------

/**
 * Mesma regra do useCRMDeals: se scopeId for id de um grupo (crm_groups),
 * devolve os ids das origens do grupo; senão devolve [scopeId].
 */
export function useKanbanOrigemIds(scopeId?: string) {
  return useQuery({
    queryKey: ['kanban', 'origens', scopeId],
    enabled: !!scopeId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<string[]> => {
      const { data: grupo } = await supabase
        .from('crm_groups')
        .select('id')
        .eq('id', scopeId!)
        .maybeSingle();

      if (grupo) {
        const { data: origens, error } = await supabase
          .from('crm_origins')
          .select('id')
          .eq('group_id', scopeId!);
        if (error) throw error;
        return (origens || []).map((o) => o.id);
      }
      return [scopeId!];
    },
  });
}

// ---------------------------------------------------------------------------
// 3. useKanbanContagem
// ---------------------------------------------------------------------------

interface UseKanbanContagemArgs {
  originIds: string[];
  filtros: Record<string, unknown>;
  colunas: { id: string; name: string }[];
  enabled?: boolean;
}

export function useKanbanContagem({ originIds, filtros, colunas, enabled = true }: UseKanbanContagemArgs) {
  return useQuery({
    queryKey: ['kanban', 'contagem', originIds, filtros, colunas.map((c) => c.id)],
    enabled: enabled && originIds.length > 0,
    staleTime: 15 * 1000,
    refetchOnWindowFocus: true,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<Map<string, number>> => {
      const { data, error } = await (supabase as any).rpc('kanban_contagem', {
        p_origin_ids: originIds,
        p_filtros: filtros,
        p_colunas_ids: colunas.map((c) => c.id),
        p_colunas_nomes: colunas.map((c) => c.name),
      });
      if (error) throw error;
      const map = new Map<string, number>();
      for (const row of (data || []) as { stage_id: string; total: number }[]) {
        map.set(row.stage_id, row.total);
      }
      return map;
    },
  });
}

// ---------------------------------------------------------------------------
// 4. useKanbanColuna
// ---------------------------------------------------------------------------

interface UseKanbanColunaArgs {
  originIds: string[];
  filtros: Record<string, unknown>;
  stageId: string;
  stageName: string;
  colunasIds: string[];
  ordem: string;
  enabled?: boolean;
}

export function useKanbanColuna({ originIds, filtros, stageId, stageName, colunasIds, ordem, enabled = true }: UseKanbanColunaArgs) {
  const query = useInfiniteQuery({
    queryKey: ['kanban', 'coluna', originIds, filtros, stageId, ordem],
    enabled: enabled && originIds.length > 0,
    staleTime: 15 * 1000,
    refetchOnWindowFocus: true,
    initialPageParam: 0,
    queryFn: async ({ pageParam }): Promise<any[]> => {
      const { data, error } = await (supabase as any).rpc('kanban_pagina', {
        p_origin_ids: originIds,
        p_filtros: filtros,
        p_stage_id: stageId,
        p_stage_name: stageName,
        p_colunas_ids: colunasIds,
        p_ordem: ordem,
        p_offset: pageParam,
        p_limit: PAGE_SIZE_COLUNA,
      });
      if (error) throw error;
      return (data || []) as any[];
    },
    getNextPageParam: (last, all) =>
      last.length === PAGE_SIZE_COLUNA ? all.length * PAGE_SIZE_COLUNA : undefined,
  });

  // Páginas achatadas, sem id repetido (mantém a primeira ocorrência).
  const deals: any[] = [];
  const vistos = new Set<string>();
  for (const pagina of query.data?.pages || []) {
    for (const deal of pagina) {
      if (deal?.id && !vistos.has(deal.id)) {
        vistos.add(deal.id);
        deals.push(deal);
      }
    }
  }

  return { ...query, deals };
}

// ---------------------------------------------------------------------------
// 5. buscarKanbanLista (função async, não é hook)
// ---------------------------------------------------------------------------

interface BuscarKanbanListaArgs {
  originIds: string[];
  filtros: Record<string, unknown>;
  stageId?: string | null;
  stageName?: string | null;
  colunasIds?: string[] | null;
  ordem: string;
}

/** Busca a lista leve em páginas de 2000 até esgotar. */
export async function buscarKanbanLista({
  originIds,
  filtros,
  stageId = null,
  stageName = null,
  colunasIds = null,
  ordem,
}: BuscarKanbanListaArgs): Promise<any[]> {
  const tudo: any[] = [];
  let offset = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await (supabase as any).rpc('kanban_lista', {
      p_origin_ids: originIds,
      p_filtros: filtros,
      p_stage_id: stageId,
      p_stage_name: stageName,
      p_colunas_ids: colunasIds,
      p_ordem: ordem,
      p_offset: offset,
      p_limit: PAGE_SIZE_LISTA,
    });
    if (error) throw error;
    const pagina = (data || []) as any[];
    tudo.push(...pagina);
    if (pagina.length < PAGE_SIZE_LISTA) break;
    offset += PAGE_SIZE_LISTA;
  }
  return tudo;
}

// ---------------------------------------------------------------------------
// 6. useKanbanDonos
// ---------------------------------------------------------------------------

export function useKanbanDonos(originIds: string[], filtros: Record<string, unknown>) {
  return useQuery({
    queryKey: ['kanban', 'donos', originIds, filtros],
    enabled: originIds.length > 0,
    staleTime: 60 * 1000,
    queryFn: async (): Promise<{ owner_profile_id: string | null; owner_id: string | null }[]> => {
      const { data, error } = await (supabase as any).rpc('kanban_donos', {
        p_origin_ids: originIds,
        p_filtros: filtros,
      });
      if (error) throw error;
      return (data || []) as { owner_profile_id: string | null; owner_id: string | null }[];
    },
  });
}

// ---------------------------------------------------------------------------
// 7. useKanbanProdutos
// ---------------------------------------------------------------------------

export function useKanbanProdutos(originIds: string[], filtros: Record<string, unknown>, enabled = true) {
  return useQuery({
    queryKey: ['kanban', 'produtos', originIds, filtros],
    enabled: enabled && originIds.length > 0,
    staleTime: 10 * 60 * 1000,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await (supabase as any).rpc('kanban_produtos', {
        p_origin_ids: originIds,
        p_filtros: filtros,
      });
      if (error) throw error;
      return ((data || []) as { produto: string }[]).map((r) => r.produto);
    },
  });
}

// ---------------------------------------------------------------------------
// 8. resumoDoDeal
// ---------------------------------------------------------------------------

/** O kanban_resumo vem da RPC no mesmo formato de ActivitySummary. */
export function resumoDoDeal(deal: any): ActivitySummary | undefined {
  return deal?.kanban_resumo as ActivitySummary | undefined;
}

// ---------------------------------------------------------------------------
// 9. invalidarKanban
// ---------------------------------------------------------------------------

export function invalidarKanban(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ['kanban'] });
}
