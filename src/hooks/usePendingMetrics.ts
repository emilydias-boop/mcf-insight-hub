import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

// Emily's user ID
const EMILY_USER_ID = '3e91331b-dc4c-4126-83e8-4435e3cc9b76';

export interface PendingMetric {
  id: string;
  start_date: string;
  end_date: string;
  week_label: string;
  approval_status: string;
  approval_notes: string | null;
  total_revenue: number;
  faturamento_total: number;
  ads_cost: number;
  total_cost: number;
  operating_profit: number;
  roi: number;
  roas: number;
  cpl: number;
  a010_sales: number;
  clint_revenue: number;
  faturamento_clint: number;
  incorporador_50k: number;
  ultrameta_clint: number;
  ultrameta_liquido: number;
}

export function usePendingMetrics() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Only Emily can see pending metrics
  const isEmily = user?.id === EMILY_USER_ID;

  const { data: pendingMetrics, isLoading, refetch } = useQuery({
    queryKey: ['pending-metrics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('weekly_metrics')
        .select('*')
        .eq('approval_status', 'pending')
        .order('week_start', { ascending: false });

      if (error) throw error;
      return data as PendingMetric[];
    },
    enabled: isEmily,
  });

  const approveMutation = useMutation({
    mutationFn: async ({ metricId, notes }: { metricId: string; notes?: string }) => {
      const { error } = await supabase
        .from('weekly_metrics')
        .update({
          approval_status: 'approved',
          approved_by: user?.id,
          approved_at: new Date().toISOString(),
          approval_notes: notes || null,
        })
        .eq('id', metricId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['weekly-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['evolution-data'] });
      toast({
        title: '✅ Métricas aprovadas',
        description: 'As métricas da semana foram aprovadas com sucesso.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao aprovar',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ metricId, reason }: { metricId: string; reason: string }) => {
      const { error } = await supabase
        .from('weekly_metrics')
        .update({
          approval_status: 'rejected',
          approved_by: user?.id,
          approved_at: new Date().toISOString(),
          approval_notes: reason,
        })
        .eq('id', metricId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-metrics'] });
      toast({
        title: '❌ Métricas rejeitadas',
        description: 'As métricas foram marcadas como rejeitadas.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao rejeitar',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const editAndApproveMutation = useMutation({
    mutationFn: async ({ 
      metricId, 
      corrections,
      notes 
    }: { 
      metricId: string; 
      corrections: Partial<PendingMetric>;
      notes?: string;
    }) => {
      const { error } = await supabase
        .from('weekly_metrics')
        .update({
          ...corrections,
          approval_status: 'approved',
          approved_by: user?.id,
          approved_at: new Date().toISOString(),
          approval_notes: notes || 'Valores corrigidos manualmente',
        })
        .eq('id', metricId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['weekly-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['evolution-data'] });
      toast({
        title: '✅ Métricas corrigidas e aprovadas',
        description: 'As métricas foram editadas e aprovadas com sucesso.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao editar',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    pendingMetrics: pendingMetrics || [],
    isLoading,
    isEmily,
    hasPendingMetrics: (pendingMetrics?.length || 0) > 0,
    refetch,
    approveMetrics: approveMutation.mutate,
    rejectMetrics: rejectMutation.mutate,
    editAndApproveMetrics: editAndApproveMutation.mutate,
    isApproving: approveMutation.isPending,
    isRejecting: rejectMutation.isPending,
    isEditing: editAndApproveMutation.isPending,
  };
}
