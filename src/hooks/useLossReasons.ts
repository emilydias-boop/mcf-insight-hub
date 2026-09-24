import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface LossReason {
  id: string;
  label: string;
  sort_order: number;
  is_active: boolean;
  requires_note: boolean;
}

export function useLossReasons() {
  const query = useQuery({
    queryKey: ['crm-loss-reasons'],
    queryFn: async (): Promise<LossReason[]> => {
      const { data, error } = await (supabase as any)
        .from('crm_loss_reasons')
        .select('id, label, sort_order, is_active, requires_note')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data || []) as LossReason[];
    },
    staleTime: 10 * 60 * 1000,
  });
  const all = query.data || [];
  return { all, active: all.filter((r) => r.is_active), isLoading: query.isLoading };
}
