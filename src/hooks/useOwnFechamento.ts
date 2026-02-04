import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { SdrPayoutWithDetails, PayoutAdjustment, PayoutStatus, Sdr, SdrCompPlan } from '@/types/sdr-fechamento';
import { startOfMonth, endOfMonth, format } from 'date-fns';

export type FechamentoUserType = 'sdr' | 'closer' | 'unknown';

export interface CloserMetrics {
  r1Realizada: number;
  contratosPagos: number;
  noShows: number;
  outsideSales: number;
  r2Agendadas: number;
  taxaConversao: number;
  taxaNoShow: number;
}

export interface OwnFechamentoData {
  userType: FechamentoUserType;
  userRecord: Sdr | null;
  payout: SdrPayoutWithDetails | null;
  compPlan: SdrCompPlan | null;
  closerMetrics: CloserMetrics | null;
  closerId: string | null;
  canSendNfse: boolean;
  isLoading: boolean;
  error: Error | null;
}

const transformPayout = (data: any): SdrPayoutWithDetails => ({
  ...data,
  ajustes_json: (data.ajustes_json as PayoutAdjustment[]) || [],
  status: data.status as PayoutStatus,
});

export function useOwnFechamento(anoMes: string): OwnFechamentoData {
  const { user } = useAuth();

  // Fetch own SDR record (includes both SDRs and Closers via role_type)
  const { 
    data: sdrRecord, 
    isLoading: sdrLoading, 
    error: sdrError 
  } = useQuery({
    queryKey: ['own-sdr-record'],
    queryFn: async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return null;

      // First try to find by user_id
      let { data, error } = await supabase
        .from('sdr')
        .select('*')
        .eq('user_id', authUser.id)
        .single();
      
      // Fallback: search by email if not found by user_id
      if (error?.code === 'PGRST116' && authUser.email) {
        const emailResult = await supabase
          .from('sdr')
          .select('*')
          .eq('email', authUser.email)
          .single();
        
        data = emailResult.data;
        error = emailResult.error;
      }
      
      if (error && error.code !== 'PGRST116') throw error;
      return data as Sdr | null;
    },
    enabled: !!user,
  });

  // Determine user type
  const userType: FechamentoUserType = sdrRecord?.role_type === 'closer' 
    ? 'closer' 
    : sdrRecord?.role_type === 'sdr' 
      ? 'sdr' 
      : 'unknown';

  // Fetch payout for the month
  const { 
    data: payout, 
    isLoading: payoutLoading,
    error: payoutError 
  } = useQuery({
    queryKey: ['own-payout', anoMes, sdrRecord?.id],
    queryFn: async () => {
      if (!sdrRecord?.id) return null;

      const { data, error } = await supabase
        .from('sdr_month_payout')
        .select(`
          *,
          sdr:sdr_id(id, user_id, name, email, active, nivel, meta_diaria, observacao, status, criado_por, aprovado_por, aprovado_em, created_at, updated_at, squad, role_type)
        `)
        .eq('sdr_id', sdrRecord.id)
        .eq('ano_mes', anoMes)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data ? transformPayout(data) : null;
    },
    enabled: !!sdrRecord?.id && !!anoMes,
  });

  // Fetch comp plan
  const { 
    data: compPlan, 
    isLoading: compPlanLoading 
  } = useQuery({
    queryKey: ['own-comp-plan', sdrRecord?.id, anoMes],
    queryFn: async () => {
      if (!sdrRecord?.id || !anoMes) return null;
      
      const [year, month] = anoMes.split('-').map(Number);
      const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
      
      const { data, error } = await supabase
        .from('sdr_comp_plan')
        .select('*')
        .eq('sdr_id', sdrRecord.id)
        .lte('vigencia_inicio', monthStart)
        .or(`vigencia_fim.is.null,vigencia_fim.gte.${monthStart}`)
        .order('vigencia_inicio', { ascending: false })
        .limit(1)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data as SdrCompPlan | null;
    },
    enabled: !!sdrRecord?.id && !!anoMes,
  });

  // Fetch closer ID (for closers only)
  const { 
    data: closerId, 
    isLoading: closerIdLoading 
  } = useQuery({
    queryKey: ['own-closer-id', sdrRecord?.email],
    queryFn: async () => {
      if (!sdrRecord?.email) return null;

      const { data, error } = await supabase
        .from('closers')
        .select('id')
        .eq('email', sdrRecord.email)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data?.id || null;
    },
    enabled: !!sdrRecord?.email && userType === 'closer',
  });

  // Fetch closer metrics for the month (for closers only)
  const { 
    data: closerMetrics, 
    isLoading: closerMetricsLoading 
  } = useQuery({
    queryKey: ['own-closer-metrics', closerId, anoMes],
    queryFn: async () => {
      if (!closerId || !anoMes) return null;

      const [year, month] = anoMes.split('-').map(Number);
      const startDate = startOfMonth(new Date(year, month - 1));
      const endDate = endOfMonth(new Date(year, month - 1));

      // Fetch meeting slot attendees for this closer
      const { data: meetings, error } = await supabase
        .from('meeting_slots')
        .select(`
          id,
          scheduled_at,
          meeting_slot_attendees (
            id,
            status
          )
        `)
        .eq('closer_id', closerId)
        .eq('meeting_type', 'r1')
        .gte('scheduled_at', startDate.toISOString())
        .lte('scheduled_at', endDate.toISOString());

      if (error) throw error;

      let r1Realizada = 0;
      let contratosPagos = 0;
      let noShows = 0;
      let r1Agendada = 0;

      meetings?.forEach(meeting => {
        const attendees = meeting.meeting_slot_attendees as { id: string; status: string | null }[] | null;
        attendees?.forEach(att => {
          r1Agendada++;
          if (att.status === 'completed') r1Realizada++;
          if (att.status === 'contract_paid') {
            r1Realizada++;
            contratosPagos++;
          }
          if (att.status === 'no_show') noShows++;
        });
      });

      // Fetch outside sales (contracts before scheduled meeting)
      // This is a simplified version - the full logic is in useR1CloserMetrics
      let outsideSales = 0;

      // Fetch R2 scheduled
      const { data: r2Meetings } = await supabase
        .from('meeting_slots')
        .select('id, meeting_slot_attendees(id)')
        .eq('closer_id', closerId)
        .eq('meeting_type', 'r2')
        .gte('scheduled_at', startDate.toISOString())
        .lte('scheduled_at', endDate.toISOString());

      let r2Agendadas = 0;
      r2Meetings?.forEach(m => {
        r2Agendadas += m.meeting_slot_attendees?.length || 0;
      });

      const taxaConversao = r1Realizada > 0 
        ? ((contratosPagos + outsideSales) / r1Realizada) * 100 
        : 0;
      
      const taxaNoShow = r1Agendada > 0 
        ? (noShows / r1Agendada) * 100 
        : 0;

      return {
        r1Realizada,
        contratosPagos,
        noShows,
        outsideSales,
        r2Agendadas,
        taxaConversao,
        taxaNoShow,
      } as CloserMetrics;
    },
    enabled: !!closerId && !!anoMes && userType === 'closer',
  });

  const isLoading = sdrLoading || payoutLoading || compPlanLoading || 
    (userType === 'closer' && (closerIdLoading || closerMetricsLoading));

  const canSendNfse = payout?.status === 'APPROVED' && !payout?.nfse_id;

  return {
    userType,
    userRecord: sdrRecord || null,
    payout: payout || null,
    compPlan: compPlan || null,
    closerMetrics: closerMetrics || null,
    closerId: closerId || null,
    canSendNfse,
    isLoading,
    error: sdrError || payoutError || null,
  };
}
