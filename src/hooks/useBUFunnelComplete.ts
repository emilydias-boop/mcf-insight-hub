import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useStageMovements } from './useStageMovements';
import type { TagFilterRule, TagOperator } from '@/components/crm/TagFilterPopover';

export type FunnelStageKey =
  | 'universo'
  | 'qualificados'
  | 'semInteresse'
  | 'agendadosR1'
  | 'r1Realizada'
  | 'noShowR1'
  | 'contratoPago'
  | 'r2Realizada'
  | 'vendasFinais';

export interface BUFunnelData {
  universo: number;
  qualificados: number;
  semInteresse: number;
  agendadosR1: number;
  r1Realizada: number;
  noShowR1: number;
  contratoPago: number;
  r2Realizada: number;
  vendasFinais: number;
}

interface UseBUFunnelCompleteParams {
  originIds: string[] | null;
  startDate: Date;
  endDate: Date;
  tagFilters: TagFilterRule[];
  tagOperator: TagOperator;
  enabled?: boolean;
}

const normalizeName = (s: string | null | undefined): string => {
  if (!s) return '';
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
};

const QUALIFICADO_KEYS = ['lead qualificado', 'qualificado'];
const SEM_INTERESSE_KEYS = ['sem interesse', 'perdido', 'desqualificado', 'sem retorno'];
const CONTRATO_PAGO_KEYS = ['contrato pago'];

function sumByKeys(
  summary: Array<{ stageNameKey: string; uniqueLeads: number }>,
  keys: string[],
): number {
  let total = 0;
  summary.forEach((s) => {
    const key = normalizeName(s.stageNameKey);
    if (keys.some((k) => key.includes(k))) total += s.uniqueLeads;
  });
  return total;
}

export function useBUFunnelComplete({
  originIds,
  startDate,
  endDate,
  tagFilters,
  tagOperator,
  enabled = true,
}: UseBUFunnelCompleteParams) {
  // Reusa hook existente (universo + estágios CRM)
  const stageMov = useStageMovements({
    originIds,
    startDate,
    endDate,
    tagFilters,
    tagOperator,
    enabled,
  });

  // Query agenda R1/R2 + Hubla, escopo dos contact_ids do universo
  const agendaQuery = useQuery({
    queryKey: [
      'bu-funnel-agenda',
      originIds,
      startDate.toISOString(),
      endDate.toISOString(),
      tagFilters,
      tagOperator,
    ],
    enabled: enabled && !!stageMov.data,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const startIso = startDate.toISOString();
      const endIso = endDate.toISOString();

      // 1) meeting_slot_attendees join meeting_slots no período
      // Buscamos slots no período com tipo r1/r2 e seus attendees
      const { data: slots, error: slotsErr } = await supabase
        .from('meeting_slots')
        .select('id, meeting_type, scheduled_at')
        .gte('scheduled_at', startIso)
        .lte('scheduled_at', endIso)
        .in('meeting_type', ['r1', 'r2']);
      if (slotsErr) throw slotsErr;

      const r1SlotIds = new Set<string>();
      const r2SlotIds = new Set<string>();
      (slots || []).forEach((s: any) => {
        if (s.meeting_type === 'r1') r1SlotIds.add(s.id);
        if (s.meeting_type === 'r2') r2SlotIds.add(s.id);
      });

      const allSlotIds = [...r1SlotIds, ...r2SlotIds];
      let attendees: Array<{
        contact_id: string | null;
        deal_id: string | null;
        meeting_slot_id: string;
        status: string | null;
        contract_paid_at: string | null;
      }> = [];

      if (allSlotIds.length > 0) {
        // paginar
        const PAGE = 1000;
        for (let i = 0; i < allSlotIds.length; i += PAGE) {
          const batch = allSlotIds.slice(i, i + PAGE);
          const { data, error } = await supabase
            .from('meeting_slot_attendees')
            .select('contact_id, deal_id, meeting_slot_id, status, contract_paid_at')
            .in('meeting_slot_id', batch);
          if (error) throw error;
          attendees.push(...((data as any[]) || []));
        }
      }

      // 2) hubla_transactions vendas finais (parceria)
      const { data: hubla, error: hublaErr } = await supabase
        .from('hubla_transactions')
        .select('id, customer_email, sale_date, sale_status, product_category')
        .eq('sale_status', 'completed')
        .ilike('product_category', '%parceria%')
        .gte('sale_date', startIso)
        .lte('sale_date', endIso);
      if (hublaErr) throw hublaErr;

      return { attendees, r1SlotIds, r2SlotIds, hublaCount: (hubla || []).length };
    },
  });

  const isLoading = stageMov.isLoading || agendaQuery.isLoading;
  const isFetching = stageMov.isFetching || agendaQuery.isFetching;

  let data: BUFunnelData | null = null;

  if (stageMov.data && agendaQuery.data) {
    const summary = stageMov.data.summary;
    const universo = stageMov.data.totalUniqueLeads;
    const qualificados = sumByKeys(summary, QUALIFICADO_KEYS);
    const semInteresse = sumByKeys(summary, SEM_INTERESSE_KEYS);
    const contratoPagoStage = sumByKeys(summary, CONTRATO_PAGO_KEYS);

    // Dedup por contact_id (fallback deal_id) para R1/R2
    const r1ContactsAgendados = new Set<string>();
    const r1ContactsRealizada = new Set<string>();
    const r1ContactsNoShow = new Set<string>();
    const r2ContactsRealizada = new Set<string>();
    const contractPaidContacts = new Set<string>();

    agendaQuery.data.attendees.forEach((a) => {
      const key = a.contact_id ?? a.deal_id;
      if (!key) return;
      const isR1 = agendaQuery.data!.r1SlotIds.has(a.meeting_slot_id);
      const isR2 = agendaQuery.data!.r2SlotIds.has(a.meeting_slot_id);
      const status = (a.status || '').toLowerCase();

      if (isR1) {
        r1ContactsAgendados.add(key);
        if (status === 'completed' || status === 'realizada') r1ContactsRealizada.add(key);
        if (status === 'no_show') r1ContactsNoShow.add(key);
      }
      if (isR2) {
        if (status === 'completed' || status === 'realizada') r2ContactsRealizada.add(key);
      }
      if (status === 'contract_paid' || a.contract_paid_at) contractPaidContacts.add(key);
    });

    data = {
      universo,
      qualificados,
      semInteresse,
      agendadosR1: r1ContactsAgendados.size,
      r1Realizada: r1ContactsRealizada.size,
      noShowR1: r1ContactsNoShow.size,
      contratoPago: Math.max(contratoPagoStage, contractPaidContacts.size),
      r2Realizada: r2ContactsRealizada.size,
      vendasFinais: agendaQuery.data.hublaCount,
    };
  }

  return {
    data,
    isLoading,
    isFetching,
    error: stageMov.error || agendaQuery.error,
  };
}