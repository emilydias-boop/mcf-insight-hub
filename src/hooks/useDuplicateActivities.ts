import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface DuplicateActivity {
  id: string;
  deal_id: string;
  original_activity_id: string;
  duplicate_activity_id: string;
  from_stage: string | null;
  to_stage: string | null;
  gap_seconds: number | null;
  status: 'pending' | 'ignored' | 'deleted';
  detected_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
}

export interface DuplicateFilters {
  status?: string;
  period?: 'all' | '7' | '30' | '90';
  sdr_email?: string;
}

export interface DuplicateStats {
  total: number;
  pending: number;
  ignored: number;
  deleted: number;
}

// Hook para listar duplicatas
export function useDuplicatesList(filters?: DuplicateFilters) {
  return useQuery({
    queryKey: ['duplicates', filters],
    queryFn: async () => {
      let query = supabase
        .from('deal_activities_duplicates')
        .select(`
          *,
          original:deal_activities!deal_activities_duplicates_original_activity_id_fkey(
            id, deal_id, to_stage, from_stage, created_at, metadata
          ),
          duplicate:deal_activities!deal_activities_duplicates_duplicate_activity_id_fkey(
            id, deal_id, to_stage, from_stage, created_at, metadata
          )
        `)
        .order('detected_at', { ascending: false })
        .limit(500);

      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      if (filters?.period && filters.period !== 'all') {
        const days = parseInt(filters.period);
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        query = query.gte('detected_at', startDate.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    }
  });
}

// Hook para estatísticas de duplicatas
export function useDuplicatesStats() {
  return useQuery({
    queryKey: ['duplicates-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deal_activities_duplicates')
        .select('status');

      if (error) throw error;

      const stats: DuplicateStats = {
        total: data.length,
        pending: data.filter(d => d.status === 'pending').length,
        ignored: data.filter(d => d.status === 'ignored').length,
        deleted: data.filter(d => d.status === 'deleted').length
      };

      return stats;
    }
  });
}

// Hook para atualizar status individual
export function useUpdateDuplicateStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'ignored' | 'deleted' }) => {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('deal_activities_duplicates')
        .update({
          status,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['duplicates'] });
      queryClient.invalidateQueries({ queryKey: ['duplicates-stats'] });
      toast.success('Status atualizado');
    },
    onError: (error: Error) => {
      toast.error(`Erro: ${error.message}`);
    }
  });
}

// Hook para ações em lote
export function useBulkUpdateDuplicates() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      status, 
      filterStatus 
    }: { 
      status: 'ignored' | 'deleted'; 
      filterStatus?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();

      let query = supabase
        .from('deal_activities_duplicates')
        .update({
          status,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString()
        });

      if (filterStatus && filterStatus !== 'all') {
        query = query.eq('status', filterStatus);
      } else {
        query = query.eq('status', 'pending');
      }

      const { error, count } = await query;
      if (error) throw error;
      return count;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['duplicates'] });
      queryClient.invalidateQueries({ queryKey: ['duplicates-stats'] });
      toast.success(`${count || 'Todas'} duplicatas atualizadas`);
    },
    onError: (error: Error) => {
      toast.error(`Erro: ${error.message}`);
    }
  });
}

// Hook para executar detecção manual
export function useRunDuplicateDetection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (daysBack: number = 7) => {
      const { data, error } = await supabase.functions.invoke('detect-duplicate-activities', {
        body: { days_back: daysBack }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['duplicates'] });
      queryClient.invalidateQueries({ queryKey: ['duplicates-stats'] });
      
      if (data.stats?.duplicates_found > 0) {
        toast.success(`${data.stats.duplicates_found} duplicatas detectadas`);
      } else {
        toast.info('Nenhuma nova duplicata encontrada');
      }
    },
    onError: (error: Error) => {
      toast.error(`Erro: ${error.message}`);
    }
  });
}
