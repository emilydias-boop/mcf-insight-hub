import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface DistributionConfig {
  id: string;
  origin_id: string;
  user_email: string;
  user_name: string | null;
  percentage: number;
  is_active: boolean;
  current_count: number;
  created_at: string;
  updated_at: string;
}

export interface DistributionConfigInput {
  origin_id: string;
  user_email: string;
  user_name?: string;
  percentage: number;
  is_active?: boolean;
}

/**
 * Hook para buscar configuração de distribuição de uma origin
 */
export const useDistributionConfig = (originId: string | null) => {
  return useQuery({
    queryKey: ['lead-distribution-config', originId],
    queryFn: async () => {
      if (!originId) return [];
      
      const { data, error } = await (supabase as any)
        .from('lead_distribution_config')
        .select('*')
        .eq('origin_id', originId)
        .order('percentage', { ascending: false });
      
      if (error) throw error;
      return data as DistributionConfig[];
    },
    enabled: !!originId,
  });
};

/**
 * Hook para salvar configuração de distribuição
 */
export const useSaveDistributionConfig = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ originId, configs }: { originId: string; configs: DistributionConfigInput[] }) => {
      // 1. Deletar configurações existentes
      const { error: deleteError } = await (supabase as any)
        .from('lead_distribution_config')
        .delete()
        .eq('origin_id', originId);
      
      if (deleteError) throw deleteError;
      
      // 2. Inserir novas configurações
      if (configs.length > 0) {
        const { error: insertError } = await (supabase as any)
          .from('lead_distribution_config')
          .insert(configs.map(c => ({
            origin_id: originId,
            user_email: c.user_email,
            user_name: c.user_name || null,
            percentage: c.percentage,
            is_active: c.is_active ?? true,
            current_count: 0,
          })));
        
        if (insertError) throw insertError;
      }
      
      return true;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['lead-distribution-config', variables.originId] });
      toast.success('Configuração de distribuição salva!');
    },
    onError: (error: any) => {
      console.error('Error saving distribution config:', error);
      toast.error(`Erro ao salvar: ${error.message}`);
    },
  });
};

/**
 * Hook para resetar contadores de distribuição
 */
export const useResetDistributionCounters = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (originId: string) => {
      const { error } = await (supabase.rpc as any)('reset_distribution_counters', { p_origin_id: originId });
      if (error) throw error;
      return true;
    },
    onSuccess: (_, originId) => {
      queryClient.invalidateQueries({ queryKey: ['lead-distribution-config', originId] });
      toast.success('Contadores resetados!');
    },
    onError: (error: any) => {
      console.error('Error resetting counters:', error);
      toast.error(`Erro ao resetar: ${error.message}`);
    },
  });
};

/**
 * Hook para transferir ownership de um deal
 */
export const useTransferDealOwner = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      dealId, 
      newOwnerEmail, 
      newOwnerName,
      newOwnerProfileId,
      previousOwner 
    }: { 
      dealId: string; 
      newOwnerEmail: string; 
      newOwnerName?: string;
      newOwnerProfileId?: string;
      previousOwner?: string;
    }) => {
      // 1. Atualizar owner_id (email legacy) e owner_profile_id (UUID) no deal
      const { error: updateError } = await supabase
        .from('crm_deals')
        .update({ 
          owner_id: newOwnerEmail,
          owner_profile_id: newOwnerProfileId || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', dealId);
      
      if (updateError) throw updateError;
      
      // 2. Registrar atividade de transferência
      const { data: userData } = await supabase.auth.getUser();
      const { error: activityError } = await supabase
        .from('deal_activities')
        .insert({
          deal_id: dealId,
          activity_type: 'owner_change',
          description: `Lead transferido de ${previousOwner || 'N/A'} para ${newOwnerName || newOwnerEmail}`,
          metadata: {
            previous_owner: previousOwner,
            new_owner: newOwnerEmail,
            new_owner_name: newOwnerName,
            transferred_by: userData.user?.email,
            transferred_at: new Date().toISOString(),
          },
        });
      
      if (activityError) throw activityError;
      
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-deals'] });
      queryClient.invalidateQueries({ queryKey: ['crm-deal'] });
      toast.success('Lead transferido com sucesso!');
    },
    onError: (error: any) => {
      console.error('Error transferring deal:', error);
      toast.error(`Erro ao transferir: ${error.message}`);
    },
  });
};
