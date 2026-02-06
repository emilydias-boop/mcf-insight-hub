import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { GRMetrics } from '@/types/gr-types';

// Hook para métricas de uma carteira específica
export const useGRWalletMetrics = (walletId?: string) => {
  return useQuery({
    queryKey: ['gr-wallet-metrics', walletId],
    queryFn: async () => {
      if (!walletId) return null;
      
      const { data: entries, error } = await supabase
        .from('gr_wallet_entries')
        .select('status, purchase_value, entry_date, updated_at')
        .eq('wallet_id', walletId);
      
      if (error) throw error;
      
      const now = new Date();
      const ativos = entries?.filter(e => e.status === 'ativo').length || 0;
      const em_negociacao = entries?.filter(e => e.status === 'em_negociacao').length || 0;
      const convertidos = entries?.filter(e => e.status === 'convertido').length || 0;
      const inativos = entries?.filter(e => e.status === 'inativo').length || 0;
      const total = entries?.length || 0;
      
      // Calcular tempo médio (média de dias entre entry_date e updated_at para convertidos)
      const temposDias = entries
        ?.filter(e => e.status === 'convertido')
        .map(e => {
          const entry = new Date(e.entry_date);
          const updated = new Date(e.updated_at);
          return Math.round((updated.getTime() - entry.getTime()) / (1000 * 60 * 60 * 24));
        }) || [];
      
      const tempo_medio_dias = temposDias.length > 0 
        ? Math.round(temposDias.reduce((a, b) => a + b, 0) / temposDias.length)
        : 0;
      
      // Receita gerada (soma de purchase_value dos convertidos)
      const receita_gerada = entries
        ?.filter(e => e.status === 'convertido')
        .reduce((sum, e) => sum + (e.purchase_value || 0), 0) || 0;
      
      return {
        total_entries: total,
        ativos,
        em_negociacao,
        convertidos,
        inativos,
        taxa_conversao: total > 0 ? Math.round((convertidos / total) * 100 * 10) / 10 : 0,
        tempo_medio_dias,
        receita_gerada,
      } as GRMetrics;
    },
    enabled: !!walletId,
  });
};

// Hook para métricas gerais (todas as carteiras)
export const useAllGRMetrics = () => {
  return useQuery({
    queryKey: ['all-gr-metrics'],
    queryFn: async () => {
      const { data: entries, error } = await supabase
        .from('gr_wallet_entries')
        .select('status, purchase_value, entry_date, updated_at');
      
      if (error) throw error;
      
      const ativos = entries?.filter(e => e.status === 'ativo').length || 0;
      const em_negociacao = entries?.filter(e => e.status === 'em_negociacao').length || 0;
      const convertidos = entries?.filter(e => e.status === 'convertido').length || 0;
      const inativos = entries?.filter(e => e.status === 'inativo').length || 0;
      const total = entries?.length || 0;
      
      const temposDias = entries
        ?.filter(e => e.status === 'convertido')
        .map(e => {
          const entry = new Date(e.entry_date);
          const updated = new Date(e.updated_at);
          return Math.round((updated.getTime() - entry.getTime()) / (1000 * 60 * 60 * 24));
        }) || [];
      
      const tempo_medio_dias = temposDias.length > 0 
        ? Math.round(temposDias.reduce((a, b) => a + b, 0) / temposDias.length)
        : 0;
      
      const receita_gerada = entries
        ?.filter(e => e.status === 'convertido')
        .reduce((sum, e) => sum + (e.purchase_value || 0), 0) || 0;
      
      return {
        total_entries: total,
        ativos,
        em_negociacao,
        convertidos,
        inativos,
        taxa_conversao: total > 0 ? Math.round((convertidos / total) * 100 * 10) / 10 : 0,
        tempo_medio_dias,
        receita_gerada,
      } as GRMetrics;
    },
  });
};
