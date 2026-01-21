import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getCustomWeekStart, getCustomWeekEnd } from '@/lib/dateHelpers';
import { format, startOfDay, endOfDay } from 'date-fns';

export interface R2CarrinhoKPIs {
  contratosPagos: number;
  r2Agendadas: number;
  r2Realizadas: number;
  r2NoShow: number;
  aprovados: number;
  pendentes: number;
  emAnalise: number;
}

export function useR2CarrinhoKPIs(weekDate: Date) {
  const weekStart = getCustomWeekStart(weekDate);
  const weekEnd = getCustomWeekEnd(weekDate);

  return useQuery({
    queryKey: ['r2-carrinho-kpis', format(weekStart, 'yyyy-MM-dd'), format(weekEnd, 'yyyy-MM-dd')],
    queryFn: async (): Promise<R2CarrinhoKPIs> => {
      // Count R1 contracts paid in the week
      const { data: r1Contracts } = await supabase
        .from('meeting_slot_attendees')
        .select(`
          id,
          status,
          meeting_slots!inner(
            id,
            meeting_type,
            scheduled_at
          )
        `)
        .eq('status', 'contract_paid')
        .eq('meeting_slots.meeting_type', 'r1')
        .gte('meeting_slots.scheduled_at', startOfDay(weekStart).toISOString())
        .lte('meeting_slots.scheduled_at', endOfDay(weekEnd).toISOString());

      // Get all R2 meetings in the week
      const { data: r2Meetings } = await supabase
        .from('meeting_slots')
        .select(`
          id,
          status,
          scheduled_at,
          attendees:meeting_slot_attendees(
            id,
            status,
            r2_status_id
          )
        `)
        .eq('meeting_type', 'r2')
        .gte('scheduled_at', startOfDay(weekStart).toISOString())
        .lte('scheduled_at', endOfDay(weekEnd).toISOString());

      // Get R2 status options to find "Aprovado" status
      const { data: statusOptions } = await supabase
        .from('r2_status_options')
        .select('id, name')
        .eq('is_active', true);

      const aprovadoStatusId = statusOptions?.find(s => 
        s.name.toLowerCase().includes('aprovado') || 
        s.name.toLowerCase().includes('approved')
      )?.id;

      const pendenteStatusId = statusOptions?.find(s => 
        s.name.toLowerCase().includes('pendente') || 
        s.name.toLowerCase().includes('pending')
      )?.id;

      const emAnaliseStatusId = statusOptions?.find(s => 
        s.name.toLowerCase().includes('análise') || 
        s.name.toLowerCase().includes('analise') ||
        s.name.toLowerCase().includes('analysis')
      )?.id;

      // Calculate KPIs
      const r2Agendadas = r2Meetings?.filter(m => 
        !['cancelled', 'rescheduled'].includes(m.status)
      ).length || 0;

      const r2Realizadas = r2Meetings?.filter(m => 
        m.status === 'completed'
      ).length || 0;

      const r2NoShow = r2Meetings?.filter(m => 
        m.status === 'no_show'
      ).length || 0;

      // Count attendees by R2 status
      const allAttendees = r2Meetings?.flatMap(m => m.attendees || []) || [];
      
      const aprovados = allAttendees.filter(a => 
        a.r2_status_id === aprovadoStatusId
      ).length;

      const pendentes = allAttendees.filter(a => 
        a.r2_status_id === pendenteStatusId
      ).length;

      const emAnalise = allAttendees.filter(a => 
        a.r2_status_id === emAnaliseStatusId
      ).length;

      return {
        contratosPagos: r1Contracts?.length || 0,
        r2Agendadas,
        r2Realizadas,
        r2NoShow,
        aprovados,
        pendentes,
        emAnalise,
      };
    },
  });
}
