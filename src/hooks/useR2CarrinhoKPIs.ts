import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { CarrinhoConfig } from '@/hooks/useCarrinhoConfig';
import { getCarrinhoMetricBoundaries } from '@/lib/carrinhoWeekBoundaries';

export interface R2CarrinhoKPIs {
  contratosPagos: number;
  r2Agendadas: number;
  r2Realizadas: number;
  foraDoCarrinho: number;
  aprovados: number;
  pendentes: number;
  emAnalise: number;
}

export function useR2CarrinhoKPIs(weekStart: Date, weekEnd: Date, carrinhoConfig?: CarrinhoConfig, previousConfig?: CarrinhoConfig) {
  return useQuery({
    queryKey: ['r2-carrinho-kpis', format(weekStart, 'yyyy-MM-dd'), format(weekEnd, 'yyyy-MM-dd'), carrinhoConfig?.carrinhos?.[0]?.horario_corte, previousConfig?.carrinhos?.[0]?.horario_corte],
    queryFn: async (): Promise<R2CarrinhoKPIs> => {
      const boundaries = getCarrinhoMetricBoundaries(weekStart, weekEnd, carrinhoConfig, previousConfig);

      // ===== CONTRATOS PAGOS (safra Qui-Qua) =====
      const { data: contratosTx } = await supabase
        .from('hubla_transactions')
        .select('customer_email, hubla_id, source, product_name, installment_number, sale_status, sale_date')
        .eq('product_name', 'A000 - Contrato')
        .in('sale_status', ['completed', 'refunded'])
        .in('source', ['hubla', 'manual', 'make', 'mcfpay', 'kiwify'])
        .gte('sale_date', boundaries.contratos.start.toISOString())
        .lte('sale_date', boundaries.contratos.end.toISOString());

      const validTx = (contratosTx || []).filter(t => {
        if (t.hubla_id?.startsWith('newsale-')) return false;
        if (t.source === 'make' && t.product_name?.toLowerCase() === 'contrato') return false;
        if (t.installment_number && t.installment_number > 1) return false;
        return true;
      });

      const emailMap = new Map<string, typeof validTx[0]>();
      for (const tx of validTx) {
        const email = (tx.customer_email || '').toLowerCase().trim();
        if (email && !emailMap.has(email)) emailMap.set(email, tx);
      }
      const contratosPagos = emailMap.size;

      // ===== R2 KPIs from operational window (Sex-Sex) =====
      const [statusOptionsResult, r2AttendeesResult, opAprovadosResult] = await Promise.all([
        supabase.from('r2_status_options').select('id, name').eq('is_active', true),
        // R2 attendees in the r2Meetings window (Sex-Sex)
        supabase
          .from('meeting_slot_attendees')
          .select(`
            id,
            status,
            r2_status_id,
            meeting_slot:meeting_slots!inner(
              id,
              status,
              scheduled_at,
              meeting_type
            )
          `)
          .eq('meeting_slot.meeting_type', 'r2')
          .gte('meeting_slot.scheduled_at', boundaries.r2Meetings.start.toISOString())
          .lte('meeting_slot.scheduled_at', boundaries.r2Meetings.end.toISOString()),
        // Aprovados from operational window with cutoff (Sex-Sex)
        supabase
          .from('meeting_slot_attendees')
          .select('id, r2_status_id, meeting_slot:meeting_slots!inner(scheduled_at, meeting_type)')
          .eq('meeting_slot.meeting_type', 'r2')
          .gte('meeting_slot.scheduled_at', boundaries.aprovados.start.toISOString())
          .lte('meeting_slot.scheduled_at', boundaries.aprovados.end.toISOString()),
      ]);

      const statusOptions = statusOptionsResult.data || [];
      const aprovadoStatusId = statusOptions.find(s =>
        s.name.toLowerCase().includes('aprovado') || s.name.toLowerCase().includes('approved')
      )?.id;
      const pendenteStatusId = statusOptions.find(s =>
        s.name.toLowerCase().includes('pendente') || s.name.toLowerCase().includes('pending')
      )?.id;
      const emAnaliseStatusId = statusOptions.find(s =>
        s.name.toLowerCase().includes('análise') || s.name.toLowerCase().includes('analise')
      )?.id;
      const foraDoCarrinhoNames = ['reembolso', 'desistente', 'reprovado', 'próxima semana', 'cancelado'];
      const foraDoCarrinhoStatusIds = statusOptions
        .filter(s => foraDoCarrinhoNames.some(name => s.name.toLowerCase().includes(name)))
        .map(s => s.id);

      // Count aprovados from operational window (with cutoff)
      const aprovados = aprovadoStatusId
        ? (opAprovadosResult.data || []).filter((a: any) => a.r2_status_id === aprovadoStatusId).length
        : 0;

      // Count R2 metrics from r2Meetings window
      let r2Agendadas = 0;
      let r2Realizadas = 0;
      let foraDoCarrinho = 0;
      let pendentes = 0;
      let emAnalise = 0;

      for (const att of r2AttendeesResult.data || []) {
        const slot = (att as any).meeting_slot;
        if (!slot) continue;

        // Exclude cancelled/rescheduled for agendadas count
        if (slot.status !== 'cancelled' && slot.status !== 'rescheduled') {
          r2Agendadas++;
        }

        // Realizadas
        if (att.status === 'completed' || att.status === 'presente' || slot.status === 'completed') {
          r2Realizadas++;
        }

        // Status counts
        if (att.r2_status_id === pendenteStatusId) pendentes++;
        else if (att.r2_status_id === emAnaliseStatusId) emAnalise++;
        else if (att.r2_status_id && foraDoCarrinhoStatusIds.includes(att.r2_status_id)) foraDoCarrinho++;
      }

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
