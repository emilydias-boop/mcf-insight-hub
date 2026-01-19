import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { QualificationDataType } from '@/components/crm/qualification/QualificationFields';

interface SaveQualificationNoteParams {
  dealId: string;
  qualificationData: QualificationDataType;
  summary: string;
  paraR1?: boolean;
}

/**
 * Hook para salvar nota de qualificação (para R1)
 */
export const useSaveQualificationNote = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ dealId, qualificationData, summary, paraR1 = true }: SaveQualificationNoteParams) => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      
      // Buscar nome do usuário
      let sdrName = userData.user?.email || 'SDR';
      if (userId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', userId)
          .single();
        if (profile?.full_name) sdrName = profile.full_name;
      }
      
      // 1. Salvar nos custom_fields do deal
      const { error: updateError } = await supabase
        .from('crm_deals')
        .update({
          custom_fields: {
            ...qualificationData,
            leadSummary: summary,
            qualification_saved: true,
            qualification_date: new Date().toISOString(),
          },
        })
        .eq('id', dealId);
      
      if (updateError) throw updateError;
      
      // 2. Criar nota de qualificação no deal_activities
      const { data, error } = await supabase
        .from('deal_activities')
        .insert({
          deal_id: dealId,
          activity_type: 'qualification_note',
          description: summary,
          user_id: userId,
          metadata: {
            qualification_data: qualificationData,
            para_r1: paraR1,
            sdr_name: sdrName,
            qualified_at: new Date().toISOString(),
          },
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['crm-deal', variables.dealId] });
      queryClient.invalidateQueries({ queryKey: ['crm-deals'] });
      queryClient.invalidateQueries({ queryKey: ['deal-activities', variables.dealId] });
      toast.success('Qualificação salva!');
    },
    onError: (error: any) => {
      console.error('Error saving qualification:', error);
      toast.error(`Erro ao salvar qualificação: ${error.message}`);
    },
  });
};

/**
 * Hook para buscar nota de qualificação de um deal (para closers)
 */
export const useQualificationNote = (dealId: string) => {
  return useQuery({
    queryKey: ['qualification-note', dealId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deal_activities')
        .select('*')
        .eq('deal_id', dealId)
        .eq('activity_type', 'qualification_note')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!dealId,
  });
};
