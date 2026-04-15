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
      const weekStartStr = format(weekStart, 'yyyy-MM-dd');

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

      // ===== R2 KPIs from operational window (Sex-Sex) + encaixados =====
      // Build encaixados queries separately to work around missing type for carrinho_week_start
      const encaixadosQuery1 = supabase
        .from('meeting_slot_attendees')
        .select(`id, status, r2_status_id, deal_id, meeting_slot:meeting_slots!inner(id, status, scheduled_at, meeting_type)`)
        .eq('meeting_slot.meeting_type', 'r2');
      (encaixadosQuery1 as any).eq('carrinho_week_start', weekStartStr);

      const encaixadosQuery2 = supabase
        .from('meeting_slot_attendees')
        .select('id, r2_status_id, deal_id, meeting_slot:meeting_slots!inner(scheduled_at, meeting_type)')
        .eq('meeting_slot.meeting_type', 'r2');
      (encaixadosQuery2 as any).eq('carrinho_week_start', weekStartStr);

      const [statusOptionsResult, r2AttendeesResult, opAprovadosResult, encaixadosResult, encaixadosAprovadosResult] = await Promise.all([
        supabase.from('r2_status_options').select('id, name').eq('is_active', true),
        supabase
          .from('meeting_slot_attendees')
          .select(`id, status, r2_status_id, meeting_slot:meeting_slots!inner(id, status, scheduled_at, meeting_type)`)
          .eq('meeting_slot.meeting_type', 'r2')
          .gte('meeting_slot.scheduled_at', boundaries.r2Meetings.start.toISOString())
          .lte('meeting_slot.scheduled_at', boundaries.r2Meetings.end.toISOString()),
        supabase
          .from('meeting_slot_attendees')
          .select('id, r2_status_id, meeting_slot:meeting_slots!inner(scheduled_at, meeting_type)')
          .eq('meeting_slot.meeting_type', 'r2')
          .gte('meeting_slot.scheduled_at', boundaries.aprovados.start.toISOString())
          .lte('meeting_slot.scheduled_at', boundaries.aprovados.end.toISOString()),
        encaixadosQuery1,
        encaixadosQuery2,
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

      // Merge encaixados into r2Attendees, dedup by deal_id (lead-level) then id
      const r2LeadKeys = new Map<string, any>();
      const r2AttendeeIds = new Set<string>();
      // Encaixados take priority
      for (const enc of encaixadosResult.data || []) {
        const key = (enc as any).deal_id || enc.id;
        r2LeadKeys.set(key, enc);
        r2AttendeeIds.add(enc.id);
      }
      for (const att of r2AttendeesResult.data || []) {
        const key = (att as any).deal_id || att.id;
        if (!r2LeadKeys.has(key) && !r2AttendeeIds.has(att.id)) {
          r2LeadKeys.set(key, att);
          r2AttendeeIds.add(att.id);
        }
      }
      const mergedR2 = Array.from(r2LeadKeys.values());

      // Merge encaixados into aprovados, same logic
      const apLeadKeys = new Map<string, any>();
      const opAprovadosIds = new Set<string>();
      for (const enc of encaixadosAprovadosResult.data || []) {
        const key = (enc as any).deal_id || enc.id;
        apLeadKeys.set(key, enc);
        opAprovadosIds.add(enc.id);
      }
      for (const att of opAprovadosResult.data || []) {
        const key = (att as any).deal_id || att.id;
        if (!apLeadKeys.has(key) && !opAprovadosIds.has(att.id)) {
          apLeadKeys.set(key, att);
          opAprovadosIds.add(att.id);
        }
      }
      const mergedAprovados = Array.from(apLeadKeys.values());

      // Count aprovados
      const aprovados = aprovadoStatusId
        ? mergedAprovados.filter((a: any) => a.r2_status_id === aprovadoStatusId).length
        : 0;

      // Count R2 metrics
      let r2Agendadas = 0;
      let r2Realizadas = 0;
      let foraDoCarrinho = 0;
      let pendentes = 0;
      let emAnalise = 0;

      for (const att of mergedR2) {
        const slot = (att as any).meeting_slot;
        if (!slot) continue;

        if (slot.status !== 'cancelled' && slot.status !== 'rescheduled') {
          r2Agendadas++;
        }

        if (att.status === 'completed' || att.status === 'presente' || slot.status === 'completed') {
          r2Realizadas++;
        }

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
