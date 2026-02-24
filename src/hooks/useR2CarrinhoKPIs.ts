import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfDay, endOfDay } from 'date-fns';

export interface R2CarrinhoKPIs {
  contratosPagos: number;
  r2Agendadas: number;
  r2Realizadas: number;
  foraDoCarrinho: number;
  aprovados: number;
  pendentes: number;
  emAnalise: number;
}

export function useR2CarrinhoKPIs(weekStart: Date, weekEnd: Date) {
  return useQuery({
    queryKey: ['r2-carrinho-kpis', format(weekStart, 'yyyy-MM-dd'), format(weekEnd, 'yyyy-MM-dd')],
    queryFn: async (): Promise<R2CarrinhoKPIs> => {
      // ===== CONTRATOS PAGOS =====
      // Count unique contracts (A000) paid in the week from hubla_transactions
      // This aligns with the "Vendas MCF Incorporador" tab
      const { data: contratosTx } = await supabase
        .from('hubla_transactions')
        .select('customer_email')
        .ilike('product_name', '%A000%')
        .eq('product_category', 'incorporador')
        .gte('sale_date', startOfDay(weekStart).toISOString())
        .lte('sale_date', endOfDay(weekEnd).toISOString());

      // Deduplicate by email (one contract per customer)
      const uniqueContracts = new Set(
        (contratosTx || [])
          .map(tx => tx.customer_email?.toLowerCase())
          .filter(Boolean)
      );
      const contratosPagos = uniqueContracts.size;

      // ===== R2 MEETINGS =====
      // Get all R2 meetings in the week with attendees
      const { data: r2Meetings } = await supabase
        .from('meeting_slots')
        .select(`
          id,
          status,
          scheduled_at,
          attendees:meeting_slot_attendees(
            id,
            status,
            r2_status_id,
            deal_id
          )
        `)
        .eq('meeting_type', 'r2')
        .gte('scheduled_at', startOfDay(weekStart).toISOString())
        .lte('scheduled_at', endOfDay(weekEnd).toISOString());

      // ===== R2 AGENDADAS =====
      // Count ATTENDEES (not slots) in scheduled/invited/pending meetings
      // Exclude rescheduled attendees to avoid double-counting reagendados
      const scheduledStatuses = ['scheduled', 'invited', 'pending'];
      const r2Agendadas = (r2Meetings || [])
        .filter(m => scheduledStatuses.includes(m.status))
        .reduce((acc, m) => acc + (m.attendees?.filter((a: any) => a.status !== 'rescheduled')?.length || 0), 0);

      // ===== R2 REALIZADAS =====
      // Count completed meetings (slots, not attendees - represents meetings held)
      const r2Realizadas = (r2Meetings || [])
        .filter(m => m.status === 'completed')
        .length;

      // ===== R2 STATUS OPTIONS =====
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

      // Get IDs for "fora do carrinho" statuses
      const foraDoCarrinhoNames = ['reembolso', 'desistente', 'reprovado', 'próxima semana', 'cancelado'];
      const foraDoCarrinhoStatusIds = statusOptions
        ?.filter(s => foraDoCarrinhoNames.some(name => s.name.toLowerCase().includes(name)))
        .map(s => s.id) || [];

      // ===== ATTENDEE STATUS COUNTS =====
      const allAttendees = (r2Meetings || []).flatMap(m => 
        (m.attendees || []).map(a => ({
          ...a,
          scheduled_at: m.scheduled_at,
          meeting_status: m.status
        }))
      );
      
      // Deduplicar aprovados por deal_id
      const aprovadoAttendees = allAttendees.filter(a => a.r2_status_id === aprovadoStatusId);
      const aprovadosDeduplicated = new Map<string, typeof aprovadoAttendees[0]>();

      for (const att of aprovadoAttendees) {
        const key = att.deal_id || att.id;
        const existing = aprovadosDeduplicated.get(key);
        
        if (!existing || 
            (att.meeting_status === 'completed' && existing.meeting_status !== 'completed') ||
            (att.meeting_status === existing.meeting_status && 
             new Date(att.scheduled_at) > new Date(existing.scheduled_at))) {
          aprovadosDeduplicated.set(key, att);
        }
      }

      const aprovados = aprovadosDeduplicated.size;

      const pendentes = allAttendees.filter(a => 
        a.r2_status_id === pendenteStatusId
      ).length;

      const emAnalise = allAttendees.filter(a => 
        a.r2_status_id === emAnaliseStatusId
      ).length;

      const foraDoCarrinho = allAttendees.filter(a => 
        a.r2_status_id && foraDoCarrinhoStatusIds.includes(a.r2_status_id)
      ).length;

      return {
        contratosPagos,
        r2Agendadas,
        r2Realizadas,
        foraDoCarrinho,
        aprovados,
        pendentes,
        emAnalise,
      };
    },
  });
}
