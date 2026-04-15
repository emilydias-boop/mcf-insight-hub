import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, endOfDay } from 'date-fns';
import type { Json } from '@/integrations/supabase/types';

export interface ContractLifecycleFilters {
  startDate: Date;
  endDate: Date;
  closerR1Id?: string;
  situacao?: string;
}

export interface ContractLifecycleRow {
  id: string;
  leadName: string | null;
  phone: string | null;
  contractPaidAt: string | null;
  dealId: string | null;
  // R1 info
  r1Date: string | null;
  r1CloserName: string | null;
  r1Status: string | null;
  // R2 info
  hasR2: boolean;
  r2Date: string | null;
  r2CloserName: string | null;
  r2StatusName: string | null;
  r2StatusColor: string | null;
  // Carrinho info
  carrinhoStatus: string | null;
  carrinhoWeekStart: string | null;
  // Derived
  situacao: 'completo' | 'aguardando_r2' | 'sem_status' | 'pendente' | 'parado';
  situacaoLabel: string;
}

export function useContractLifecycleReport(filters: ContractLifecycleFilters) {
  return useQuery({
    queryKey: ['contract-lifecycle-report', filters.startDate.toISOString(), filters.endDate.toISOString(), filters.closerR1Id, filters.situacao],
    staleTime: 30000,
    queryFn: async () => {
      // Step 1: Get R2 attendees with contract_paid_at in the period
      const { data: r2Attendees, error: r2Error } = await supabase
        .from('meeting_slot_attendees')
        .select(`
          id,
          attendee_name,
          attendee_phone,
          contract_paid_at,
          deal_id,
          status,
          r2_status_id,
          carrinho_status,
          carrinho_week_start,
          is_partner,
          meeting_slot:meeting_slots!inner(
            id,
            scheduled_at,
            meeting_type,
            closer:closers!meeting_slots_closer_id_fkey(id, name)
          ),
          r2_status:r2_status_options(id, name, color),
          deal:crm_deals(
            id,
            name,
            contact:crm_contacts(name, phone)
          )
        `)
        .eq('meeting_slot.meeting_type', 'r2')
        .not('contract_paid_at', 'is', null)
        .gte('contract_paid_at', startOfDay(filters.startDate).toISOString())
        .lte('contract_paid_at', endOfDay(filters.endDate).toISOString())
        .neq('status', 'cancelled')
        .eq('is_partner', false);

      if (r2Error) throw r2Error;

      // Step 2: Collect deal_ids to fetch R1 info
      const dealIds = (r2Attendees || [])
        .map((a: any) => a.deal_id)
        .filter(Boolean) as string[];

      let r1Map: Record<string, { date: string; closerName: string | null; status: string }> = {};

      if (dealIds.length > 0) {
        const { data: r1Data } = await supabase
          .from('meeting_slot_attendees')
          .select(`
            deal_id,
            status,
            meeting_slot:meeting_slots!inner(
              scheduled_at,
              meeting_type,
              closer:closers!meeting_slots_closer_id_fkey(id, name)
            )
          `)
          .eq('meeting_slot.meeting_type', 'r1')
          .in('deal_id', dealIds);

        if (r1Data) {
          for (const r1 of r1Data) {
            const ms = r1.meeting_slot as any;
            if (r1.deal_id && ms) {
              r1Map[r1.deal_id] = {
                date: ms.scheduled_at,
                closerName: ms.closer?.name || null,
                status: r1.status,
              };
            }
          }
        }
      }

      // Step 3: Transform
      const rows: ContractLifecycleRow[] = (r2Attendees || []).map((att: any) => {
        const ms = att.meeting_slot;
        const r2StatusObj = att.r2_status;
        const deal = att.deal;
        const r1Info = att.deal_id ? r1Map[att.deal_id] : null;

        const hasR2 = true; // they are joined with R2 meeting_slots
        const hasR2Status = !!att.r2_status_id;
        const r2StatusName = r2StatusObj?.name || null;
        const isTerminal = r2StatusName && ['Aprovado', 'Reprovado'].includes(r2StatusName);

        let situacao: ContractLifecycleRow['situacao'] = 'pendente';
        let situacaoLabel = '🔄 Pendente';

        if (isTerminal) {
          situacao = 'completo';
          situacaoLabel = '✅ Completo';
        } else if (!hasR2Status) {
          situacao = 'sem_status';
          situacaoLabel = '⚠️ Sem Status';
        }

        return {
          id: att.id,
          leadName: att.attendee_name || deal?.contact?.name || deal?.name || null,
          phone: att.attendee_phone || deal?.contact?.phone || null,
          contractPaidAt: att.contract_paid_at,
          dealId: att.deal_id,
          r1Date: r1Info?.date || null,
          r1CloserName: r1Info?.closerName || null,
          r1Status: r1Info?.status || null,
          hasR2,
          r2Date: ms?.scheduled_at || null,
          r2CloserName: ms?.closer?.name || null,
          r2StatusName,
          r2StatusColor: r2StatusObj?.color || null,
          carrinhoStatus: att.carrinho_status,
          carrinhoWeekStart: att.carrinho_week_start,
          situacao,
          situacaoLabel,
        };
      });

      // Now also find attendees with contract_paid_at but NO R2 (aguardando R2)
      const { data: noR2Attendees, error: noR2Error } = await supabase
        .from('meeting_slot_attendees')
        .select(`
          id,
          attendee_name,
          attendee_phone,
          contract_paid_at,
          deal_id,
          status,
          r2_status_id,
          carrinho_status,
          carrinho_week_start,
          is_partner,
          meeting_slot:meeting_slots!inner(
            id,
            scheduled_at,
            meeting_type,
            closer:closers!meeting_slots_closer_id_fkey(id, name)
          ),
          deal:crm_deals(
            id,
            name,
            contact:crm_contacts(name, phone)
          )
        `)
        .eq('meeting_slot.meeting_type', 'r1')
        .not('contract_paid_at', 'is', null)
        .gte('contract_paid_at', startOfDay(filters.startDate).toISOString())
        .lte('contract_paid_at', endOfDay(filters.endDate).toISOString())
        .neq('status', 'cancelled')
        .eq('is_partner', false);

      if (!noR2Error && noR2Attendees) {
        // Filter out deals already covered by R2 attendees
        const r2DealIds = new Set(rows.map(r => r.dealId).filter(Boolean));
        const r2AttIds = new Set(rows.map(r => r.id));

        for (const att of noR2Attendees as any[]) {
          // Skip if this deal already has an R2 entry
          if (att.deal_id && r2DealIds.has(att.deal_id)) continue;
          if (r2AttIds.has(att.id)) continue;

          const ms = att.meeting_slot;
          const deal = att.deal;

          rows.push({
            id: att.id,
            leadName: att.attendee_name || deal?.contact?.name || deal?.name || null,
            phone: att.attendee_phone || deal?.contact?.phone || null,
            contractPaidAt: att.contract_paid_at,
            dealId: att.deal_id,
            r1Date: ms?.scheduled_at || null,
            r1CloserName: ms?.closer?.name || null,
            r1Status: att.status,
            hasR2: false,
            r2Date: null,
            r2CloserName: null,
            r2StatusName: null,
            r2StatusColor: null,
            carrinhoStatus: null,
            carrinhoWeekStart: null,
            situacao: 'aguardando_r2',
            situacaoLabel: '⏳ Aguardando R2',
          });
        }
      }

      // Apply situacao filter
      let filtered = rows;
      if (filters.situacao && filters.situacao !== 'all') {
        filtered = rows.filter(r => r.situacao === filters.situacao);
      }

      // Apply closerR1 filter
      if (filters.closerR1Id) {
        // We need closer id, but we only have name. Let's skip this for now and filter by name later if needed.
      }

      // Sort by contract_paid_at desc
      filtered.sort((a, b) => {
        const da = a.contractPaidAt ? new Date(a.contractPaidAt).getTime() : 0;
        const db = b.contractPaidAt ? new Date(b.contractPaidAt).getTime() : 0;
        return db - da;
      });

      return filtered;
    },
  });
}

export function useR1ClosersForReport() {
  return useQuery({
    queryKey: ['r1-closers-for-lifecycle-report'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('closers')
        .select('id, name')
        .eq('is_active', true)
        .eq('meeting_type', 'r1')
        .order('name');

      if (error) throw error;
      return data || [];
    },
  });
}
