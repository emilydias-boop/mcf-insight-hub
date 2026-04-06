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
  isConsorcioPayout: boolean;
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

      let { data, error } = await supabase
        .from('sdr')
        .select('*')
        .eq('user_id', authUser.id)
        .single();
      
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

  const userType: FechamentoUserType = sdrRecord?.role_type === 'closer' 
    ? 'closer' 
    : sdrRecord?.role_type === 'sdr' 
      ? 'sdr' 
      : 'unknown';

  const isConsorcioSquad = sdrRecord?.squad === 'consorcio';

  // Fetch SDR payout for the month
  const { 
    data: sdrPayout, 
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

  // Fetch consorcio payout (for consorcio closers only)
  const {
    data: consorcioPayout,
    isLoading: consorcioPayoutLoading,
  } = useQuery({
    queryKey: ['own-consorcio-payout', anoMes, closerId],
    queryFn: async () => {
      if (!closerId || !anoMes) return null;

      const { data, error } = await supabase
        .from('consorcio_closer_payout')
        .select(`
          *,
          closer:closer_id(id, name, email, color, is_active, employee_id)
        `)
        .eq('closer_id', closerId)
        .eq('ano_mes', anoMes)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      if (!data) return null;

      // Map consorcio payout to SdrPayoutWithDetails format
      const mapped: SdrPayoutWithDetails = {
        id: data.id,
        sdr_id: sdrRecord?.id || '',
        ano_mes: data.ano_mes,
        valor_fixo: data.fixo_valor,
        valor_variavel: data.valor_variavel_final || 0,
        bonus: data.bonus_extra || 0,
        total_conta: data.total_conta || 0,
        status: data.status as PayoutStatus,
        ajustes_json: (data.ajustes_json as PayoutAdjustment[]) || [],
        aprovado_por: data.aprovado_por,
        aprovado_em: data.aprovado_em,
        nfse_id: data.nfse_id,
        created_at: data.created_at,
        updated_at: data.updated_at,
        sdr: sdrRecord ? {
          id: sdrRecord.id,
          user_id: sdrRecord.user_id,
          name: sdrRecord.name,
          email: sdrRecord.email,
          active: sdrRecord.active,
          nivel: sdrRecord.nivel,
          meta_diaria: sdrRecord.meta_diaria,
          observacao: sdrRecord.observacao,
          status: sdrRecord.status,
          criado_por: sdrRecord.criado_por,
          aprovado_por: sdrRecord.aprovado_por,
          aprovado_em: sdrRecord.aprovado_em,
          created_at: sdrRecord.created_at,
          updated_at: sdrRecord.updated_at,
          squad: sdrRecord.squad,
          role_type: sdrRecord.role_type,
        } : undefined,
        // Fields that don't exist in consorcio but are in the type
        dias_uteis: data.dias_uteis_mes || 0,
        rpg: 0,
        docs_enviados: 0,
        docs_reuniao: 0,
        r1_agendada: 0,
        r1_realizada: 0,
        contrato_pago: 0,
        organizacao: data.score_organizacao || 0,
      } as any;

      return mapped;
    },
    enabled: !!closerId && !!anoMes && isConsorcioSquad,
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

  // Fetch closer metrics for the month (for closers only, non-consorcio)
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

      let outsideSales = 0;

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
    enabled: !!closerId && !!anoMes && userType === 'closer' && !isConsorcioSquad,
  });

  // Determine which payout to use
  // For consorcio closers: prefer consorcio payout over sdr payout
  const isConsorcioPayout = isConsorcioSquad && !!consorcioPayout && consorcioPayout.status !== 'DRAFT';
  const effectivePayout = isConsorcioPayout 
    ? consorcioPayout 
    : sdrPayout;

  const isLoading = sdrLoading || payoutLoading || compPlanLoading || 
    (userType === 'closer' && closerIdLoading) ||
    (isConsorcioSquad && consorcioPayoutLoading) ||
    (!isConsorcioSquad && userType === 'closer' && closerMetricsLoading);

  const canSendNfse = effectivePayout?.status === 'APPROVED' && !effectivePayout?.nfse_id;

  return {
    userType,
    userRecord: sdrRecord || null,
    payout: effectivePayout || null,
    compPlan: compPlan || null,
    closerMetrics: closerMetrics || null,
    closerId: closerId || null,
    canSendNfse,
    isConsorcioPayout,
    isLoading,
    error: sdrError || payoutError || null,
  };
}
