import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface FixActivitiesResult {
  success: boolean;
  dry_run: boolean;
  total: number;
  fixed: number;
  skipped: number;
  errors: number;
}

export const useFixReprocessedActivities = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { dryRun?: boolean }): Promise<FixActivitiesResult> => {
      const { data, error } = await supabase.functions.invoke('fix-reprocessed-activities', {
        body: {
          dry_run: params.dryRun || false,
          limit: 500
        }
      });

      if (error) throw error;
      return data as FixActivitiesResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sdr-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['deal-activities'] });
    }
  });
};
