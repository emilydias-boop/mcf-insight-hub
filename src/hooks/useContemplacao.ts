import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { ConsorcioCard } from '@/types/consorcio';

export interface ContemplationFilters {
  search?: string;
  grupo?: string;
  status?: string;
  tipoProduto?: string;
  vendedorId?: string;
}

export function useContemplationCards(filters: ContemplationFilters) {
  return useQuery({
    queryKey: ['contemplation-cards', filters],
    queryFn: async () => {
      let query = supabase
        .from('consortium_cards')
        .select('*')
        .order('grupo', { ascending: true })
        .order('cota', { ascending: true });

      if (filters.grupo && filters.grupo !== 'todos') {
        query = query.eq('grupo', filters.grupo);
      }
      if (filters.status && filters.status !== 'todos') {
        if (filters.status === 'contemplado') {
          query = query.not('motivo_contemplacao', 'is', null);
        } else if (filters.status === 'nao_contemplado') {
          query = query.is('motivo_contemplacao', null);
        } else {
          query = query.eq('status', filters.status);
        }
      }
      if (filters.tipoProduto && filters.tipoProduto !== 'todos') {
        query = query.eq('tipo_produto', filters.tipoProduto);
      }
      if (filters.vendedorId && filters.vendedorId !== 'todos') {
        query = query.eq('vendedor_id', filters.vendedorId);
      }
      if (filters.search) {
        const s = filters.search;
        query = query.or(`nome_completo.ilike.%${s}%,razao_social.ilike.%${s}%,cpf.ilike.%${s}%,cnpj.ilike.%${s}%,cota.ilike.%${s}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as ConsorcioCard[];
    },
  });
}

export function useVerificarSorteio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      cardId: string;
      numeroSorteado: string;
      contemplado: boolean;
      distancia: number;
      dataAssembleia: string;
      observacao?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();

      // Always insert history
      const { error: histErr } = await supabase
        .from('consorcio_sorteio_history' as any)
        .insert({
          card_id: params.cardId,
          numero_sorteado: params.numeroSorteado,
          contemplado: params.contemplado,
          distancia: params.distancia,
          data_assembleia: params.dataAssembleia,
          observacao: params.observacao || null,
          created_by: user?.id,
        });
      if (histErr) throw histErr;

      // If contemplado, update the card
      if (params.contemplado) {
        const { error: updErr } = await supabase
          .from('consortium_cards')
          .update({
            motivo_contemplacao: 'sorteio',
            numero_contemplacao: params.numeroSorteado,
            data_contemplacao: params.dataAssembleia,
          })
          .eq('id', params.cardId);
        if (updErr) throw updErr;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contemplation-cards'] });
      toast.success('Verificação de sorteio registrada');
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useRegistrarLance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      cardId: string;
      percentualLance: number;
      valorLance: number;
      chanceClassificacao: string;
      posicaoEstimada?: number;
      observacao?: string;
      salvo: boolean;
      registrarContemplacao?: boolean;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();

      const { error: histErr } = await supabase
        .from('consorcio_lance_history' as any)
        .insert({
          card_id: params.cardId,
          percentual_lance: params.percentualLance,
          valor_lance: params.valorLance,
          chance_classificacao: params.chanceClassificacao,
          posicao_estimada: params.posicaoEstimada || null,
          observacao: params.observacao || null,
          salvo: params.salvo,
          created_by: user?.id,
        });
      if (histErr) throw histErr;

      if (params.registrarContemplacao) {
        const { error: updErr } = await supabase
          .from('consortium_cards')
          .update({
            motivo_contemplacao: 'lance',
            valor_lance: params.valorLance,
            percentual_lance: params.percentualLance,
            data_contemplacao: new Date().toISOString().split('T')[0],
          })
          .eq('id', params.cardId);
        if (updErr) throw updErr;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contemplation-cards'] });
      toast.success('Lance registrado com sucesso');
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useSorteioHistory(cardId: string | null) {
  return useQuery({
    queryKey: ['sorteio-history', cardId],
    enabled: !!cardId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('consorcio_sorteio_history' as any)
        .select('*')
        .eq('card_id', cardId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useLanceHistory(cardId: string | null) {
  return useQuery({
    queryKey: ['lance-history', cardId],
    enabled: !!cardId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('consorcio_lance_history' as any)
        .select('*')
        .eq('card_id', cardId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useMarcarContemplada() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      cardId: string;
      motivo: string;
    }) => {
      const { error } = await supabase
        .from('consortium_cards')
        .update({
          motivo_contemplacao: params.motivo,
          data_contemplacao: new Date().toISOString().split('T')[0],
        })
        .eq('id', params.cardId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contemplation-cards'] });
      toast.success('Cota marcada como contemplada');
    },
    onError: (e: any) => toast.error(e.message),
  });
}
