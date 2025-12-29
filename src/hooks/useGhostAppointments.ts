import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface GhostAuditCase {
  id: string;
  deal_id: string;
  contact_id: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  sdr_email: string;
  sdr_name: string | null;
  ghost_type: 'tipo_a' | 'tipo_b' | 'ciclo_infinito' | 'regressao' | 'excesso_requalificacao' | 'webhook_duplicado';
  severity: 'low' | 'medium' | 'high' | 'critical';
  total_r1_agendada: number;
  distinct_days: number;
  no_show_count: number;
  detection_reason: string;
  movement_history: MovementHistory[];
  first_r1_date: string | null;
  last_r1_date: string | null;
  status: 'pending' | 'reviewed' | 'confirmed_fraud' | 'false_positive';
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  detection_date: string;
  created_at: string;
  updated_at: string;
}

export interface MovementHistory {
  date: string;
  to_stage: string;
  from_stage: string | null;
  owner: string | null;
}

export interface GhostAuditFilters {
  status?: string;
  severity?: string;
  ghost_type?: string;
  sdr_email?: string;
  startDate?: string;
  endDate?: string;
}

export interface GhostAuditStats {
  total: number;
  pending: number;
  confirmed_fraud: number;
  false_positive: number;
  critical: number;
  high: number;
  by_sdr: Record<string, number>;
}

// Hook para listar casos de auditoria
export function useGhostAuditList(filters?: GhostAuditFilters) {
  return useQuery({
    queryKey: ['ghost-audit', filters],
    queryFn: async () => {
      let query = supabase
        .from('ghost_appointments_audit')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }
      if (filters?.severity && filters.severity !== 'all') {
        query = query.eq('severity', filters.severity);
      }
      if (filters?.ghost_type && filters.ghost_type !== 'all') {
        query = query.eq('ghost_type', filters.ghost_type);
      }
      if (filters?.sdr_email) {
        // Busca rápida (SDR ou Lead)
        const term = filters.sdr_email.trim();
        if (term) {
          query = query.or(
            `sdr_email.ilike.%${term}%,sdr_name.ilike.%${term}%,contact_name.ilike.%${term}%,contact_email.ilike.%${term}%`
          );
        }
      }
      if (filters?.startDate) {
        query = query.gte('detection_date', filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte('detection_date', filters.endDate);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map(item => ({
        ...item,
        movement_history: item.movement_history as unknown as MovementHistory[]
      })) as GhostAuditCase[];
    }
  });
}

// Hook para estatísticas
export function useGhostAuditStats() {
  return useQuery({
    queryKey: ['ghost-audit-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ghost_appointments_audit')
        .select('status, severity, sdr_email, sdr_name');

      if (error) throw error;

      const stats: GhostAuditStats = {
        total: data.length,
        pending: data.filter(d => d.status === 'pending').length,
        confirmed_fraud: data.filter(d => d.status === 'confirmed_fraud').length,
        false_positive: data.filter(d => d.status === 'false_positive').length,
        critical: data.filter(d => d.severity === 'critical').length,
        high: data.filter(d => d.severity === 'high').length,
        by_sdr: {}
      };

      data.forEach(d => {
        const sdr = d.sdr_name || d.sdr_email;
        stats.by_sdr[sdr] = (stats.by_sdr[sdr] || 0) + 1;
      });

      return stats;
    }
  });
}

// Hook para executar detecção manualmente
export function useRunGhostDetection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (daysBack: number = 14) => {
      const { data, error } = await supabase.functions.invoke('detect-ghost-appointments', {
        body: { days_back: daysBack, create_alerts: true }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ghost-audit'] });
      queryClient.invalidateQueries({ queryKey: ['ghost-audit-stats'] });
      
      if (data.new_cases > 0) {
        toast.success(`${data.new_cases} novos casos detectados e registrados`);
      } else {
        toast.info('Nenhum novo caso detectado');
      }
    },
    onError: (error: Error) => {
      toast.error(`Erro ao executar detecção: ${error.message}`);
    }
  });
}

// Hook para atualizar status de um caso
export function useUpdateAuditStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      id, 
      status, 
      notes 
    }: { 
      id: string; 
      status: GhostAuditCase['status']; 
      notes?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('ghost_appointments_audit')
        .update({
          status,
          review_notes: notes,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ghost-audit'] });
      queryClient.invalidateQueries({ queryKey: ['ghost-audit-stats'] });
      toast.success('Status atualizado com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar: ${error.message}`);
    }
  });
}

// Hook para buscar um caso específico
export function useGhostAuditCase(id: string) {
  return useQuery({
    queryKey: ['ghost-audit', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ghost_appointments_audit')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return {
        ...data,
        movement_history: data.movement_history as unknown as MovementHistory[]
      } as GhostAuditCase;
    },
    enabled: !!id
  });
}

// Labels e helpers
export const GHOST_TYPE_LABELS: Record<string, string> = {
  tipo_a: 'Tipo A - Sem No-Show',
  tipo_b: 'Tipo B - No-Shows Consecutivos',
  ciclo_infinito: 'Ciclo Infinito',
  regressao: 'Regressão',
  excesso_requalificacao: 'Excesso de Requalificação',
  webhook_duplicado: 'Webhook Duplicado'
};

export const SEVERITY_LABELS: Record<string, string> = {
  critical: 'Crítico',
  high: 'Alto',
  medium: 'Médio',
  low: 'Baixo'
};

export const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente',
  reviewed: 'Revisado',
  confirmed_fraud: 'Fraude Confirmada',
  false_positive: 'Falso Positivo'
};
