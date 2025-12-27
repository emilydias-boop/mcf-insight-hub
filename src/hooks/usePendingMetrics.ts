import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

// Emails autorizados (além de roles admin/manager/coordenador)
const AUTHORIZED_EMAILS = [
  'emily.dias@minhacasafinanciada.com',
  'emily@minhacasafinanciada.com',
];

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
  const { user, role } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Verificar se o usuário pode ver métricas pendentes
  const canManageMetrics = (() => {
    // Verificar por role
    if (role && ['admin', 'manager', 'coordenador'].includes(role)) {
      return true;
    }
    // Verificar por email
    if (user?.email && AUTHORIZED_EMAILS.some(e => e.toLowerCase() === user.email?.toLowerCase())) {
      return true;
    }
    return false;
  })();

  const { data: pendingMetrics, isLoading, refetch, error } = useQuery({
    queryKey: ['pending-metrics'],
    queryFn: async () => {
      console.log('🔍 Buscando métricas pendentes...');
      const { data, error } = await supabase
        .from('weekly_metrics')
        .select('*')
        .eq('approval_status', 'pending')
        .order('start_date', { ascending: false }); // CORRIGIDO: era week_start

      if (error) {
        console.error('❌ Erro ao buscar métricas pendentes:', error);
        throw error;
      }
      
      console.log(`✅ Encontradas ${data?.length || 0} métricas pendentes`);
      return data as PendingMetric[];
    },
    enabled: canManageMetrics,
  });

  // Log de erro
  if (error) {
    console.error('usePendingMetrics error:', error);
  }

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
      queryClient.invalidateQueries({ queryKey: ['weekly-metrics-list'] });
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
      queryClient.invalidateQueries({ queryKey: ['weekly-metrics-list'] });
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
      queryClient.invalidateQueries({ queryKey: ['weekly-metrics-list'] });
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

  // NOVO: Mutation para recalcular uma semana
  const recalculateMutation = useMutation({
    mutationFn: async ({ 
      metricId, 
      startDate, 
      endDate 
    }: { 
      metricId: string; 
      startDate: string; 
      endDate: string;
    }) => {
      console.log(`🔄 Recalculando semana ${startDate} a ${endDate}...`);
      
      // 1. Deletar o registro atual
      const { error: deleteError } = await supabase
        .from('weekly_metrics')
        .delete()
        .eq('id', metricId);

      if (deleteError) throw deleteError;

      // 2. Recalcular via edge function
      const { data, error: calcError } = await supabase.functions.invoke('calculate-weekly-metrics', {
        body: { week_start: startDate, week_end: endDate }
      });

      if (calcError) throw calcError;

      // 3. Marcar como pending para revisão
      const { error: updateError } = await supabase
        .from('weekly_metrics')
        .update({ approval_status: 'pending' })
        .eq('start_date', startDate)
        .eq('end_date', endDate);

      if (updateError) throw updateError;

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['weekly-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['evolution-data'] });
      queryClient.invalidateQueries({ queryKey: ['weekly-metrics-list'] });
      queryClient.invalidateQueries({ queryKey: ['existing-weeks'] });
      toast({
        title: '🔄 Semana recalculada',
        description: 'As métricas foram recalculadas com sucesso. Revise os novos valores.',
      });
    },
    onError: (error) => {
      console.error('❌ Erro ao recalcular:', error);
      toast({
        title: 'Erro ao recalcular',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    pendingMetrics: pendingMetrics || [],
    isLoading,
    canManageMetrics, // Renomeado de isEmily
    isEmily: canManageMetrics, // Mantém retrocompatibilidade
    hasPendingMetrics: (pendingMetrics?.length || 0) > 0,
    refetch,
    approveMetrics: approveMutation.mutate,
    rejectMetrics: rejectMutation.mutate,
    editAndApproveMetrics: editAndApproveMutation.mutate,
    recalculateWeek: recalculateMutation.mutate,
    isApproving: approveMutation.isPending,
    isRejecting: rejectMutation.isPending,
    isEditing: editAndApproveMutation.isPending,
    isRecalculating: recalculateMutation.isPending,
  };
}
