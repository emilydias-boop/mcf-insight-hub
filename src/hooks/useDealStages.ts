import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DealStage {
  id: string;
  stage_id: string;
  stage_name: string;
  stage_order: number;
  color: string | null;
  is_active: boolean;
}

export const useDealStages = () => {
  return useQuery({
    queryKey: ['deal-stages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deal_stages')
        .select('*')
        .eq('is_active', true)
        .order('stage_order');
      
      if (error) throw error;
      return data as DealStage[];
    },
  });
};
