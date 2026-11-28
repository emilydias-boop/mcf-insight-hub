import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ParcelaGrade } from '@/lib/consorcioPagamentoGrade';

export interface ResumoCota {
  card_id: string;
  grupo: string;
  cota: string;
  cliente: string;
  status_cota: string;
  responsavel: string | null;
  prazo: number;
  parcelas_geradas: number;
  ultima_paga: number;
  vencidas_qtd: number;
  vencidas_valor: number;
  proxima_numero: number | null;
  proxima_vencimento: string | null;
  proxima_valor: number | null;
  proxima_quem_paga: string | null;
  mcf_aberto: number;
  bloco_atual: number;
  total: number;
}

export interface FiltrosResumoCotas {
  busca: string;
  grupo: string;
  status: string;
  quemPaga: string;
  soAtraso: boolean;
  responsavel: string;
}

export function useConsorcioResumoCotas(filtros: FiltrosResumoCotas, pagina: number) {
  return useQuery({
    queryKey: ['consorcio-resumo-cotas', filtros, pagina],
    queryFn: async (): Promise<ResumoCota[]> => {
      const { data, error } = await supabase.rpc('consorcio_resumo_cotas', {
        p_limit: 50, p_offset: (pagina - 1) * 50,
        p_busca: filtros.busca || null, p_grupo: filtros.grupo || null,
        p_status: filtros.status || null, p_quem_paga: filtros.quemPaga || null,
        p_so_atraso: filtros.soAtraso, p_responsavel: filtros.responsavel || null,
      });
      if (error) throw error;
      return (data || []) as ResumoCota[];
    },
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}

export function useConsorcioParcelasBloco(cardId: string, inicio: number, fim: number) {
  return useQuery({
    queryKey: ['consorcio-parcelas-cota', cardId, inicio, fim],
    queryFn: async (): Promise<ParcelaGrade[]> => {
      const { data, error } = await supabase.rpc('consorcio_parcelas_cota', {
        p_card_id: cardId, p_de: inicio, p_ate: fim,
      });
      if (error) throw error;
      return (data || []) as ParcelaGrade[];
    },
    enabled: fim >= inicio,
    staleTime: 30_000,
  });
}