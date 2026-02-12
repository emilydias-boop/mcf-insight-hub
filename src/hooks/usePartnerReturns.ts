import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PartnerReturn {
  id: string;
  contact_id: string | null;
  contact_email: string | null;
  contact_name: string | null;
  partner_product: string;
  return_source: string;
  return_product: string | null;
  return_value: number;
  original_deal_id: string | null;
  blocked: boolean;
  notes: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
}

export function usePartnerReturns() {
  return useQuery({
    queryKey: ['partner-returns'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('partner_returns' as any)
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return (data || []) as unknown as PartnerReturn[];
    },
  });
}

export function useMarkPartnerReturnReviewed() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, userId }: { id: string; userId: string }) => {
      const { error } = await supabase
        .from('partner_returns' as any)
        .update({
          reviewed_at: new Date().toISOString(),
          reviewed_by: userId,
        } as any)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner-returns'] });
    },
  });
}
