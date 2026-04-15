import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, endOfDay, differenceInDays } from 'date-fns';

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
  r1Date: string | null;
  r1CloserName: string | null;
  r1Status: string | null;
  sdrName: string | null;
  hasR2: boolean;
  r2Date: string | null;
  r2CloserName: string | null;
  r2StatusName: string | null;
  r2StatusColor: string | null;
  r2AttendeeStatus: string | null;
  carrinhoStatus: string | null;
  carrinhoWeekStart: string | null;
  diasParado: number | null;
  situacao: 'completo' | 'aguardando_r2' | 'sem_status' | 'pendente' | 'parado';
  situacaoLabel: string;
}

export function useContractLifecycleReport(filters: ContractLifecycleFilters) {
  return useQuery({
    queryKey: ['contract-lifecycle-report', filters.startDate.toISOString(), filters.endDate.toISOString(), filters.closerR1Id, filters.situacao],
    staleTime: 30000,
    queryFn: async () => {
      // Step 1: Get R1 attendees with contract_paid_at in the period
      const { data: r1Attendees, error: r1Error } = await supabase
        .from('meeting_slot_attendees')
        .select(`
          id,
          attendee_name,
          attendee_phone,
          contract_paid_at,
          deal_id,
          status,
          is_partner,
          meeting_slot:meeting_slots!inner(
            id,
            scheduled_at,
            meeting_type,
            booked_by,
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

      if (r1Error) throw r1Error;

      // Step 2: Collect booked_by UUIDs and resolve SDR names
      const bookedByIds = [...new Set(
        (r1Attendees || [])
          .map((a: any) => a.meeting_slot?.booked_by)
          .filter(Boolean) as string[]
      )];

      let profilesMap: Record<string, string> = {};
      if (bookedByIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', bookedByIds);
        if (profiles) {
          for (const p of profiles) {
            if (p.id && p.full_name) profilesMap[p.id] = p.full_name;
          }
        }
      }

      // Step 3: Collect deal_ids to fetch R2 info
      const dealIds = (r1Attendees || [])
        .map((a: any) => a.deal_id)
        .filter(Boolean) as string[];

      // Step 4: Fetch R2 attendees for those deals
      let r2Map: Record<string, {
        r2Date: string | null;
        r2CloserName: string | null;
        r2StatusName: string | null;
        r2StatusColor: string | null;
        r2StatusId: string | null;
        r2AttendeeStatus: string | null;
        carrinhoStatus: string | null;
        carrinhoWeekStart: string | null;
      }> = {};

      if (dealIds.length > 0) {
        const { data: r2Data } = await supabase
          .from('meeting_slot_attendees')
          .select(`
            deal_id,
            status,
            r2_status_id,
            carrinho_status,
            carrinho_week_start,
            r2_status:r2_status_options(id, name, color),
            meeting_slot:meeting_slots!inner(
              scheduled_at,
              meeting_type,
              closer:closers!meeting_slots_closer_id_fkey(id, name)
            )
          `)
          .eq('meeting_slot.meeting_type', 'r2')
          .in('deal_id', dealIds)
          .neq('status', 'cancelled');

        if (r2Data) {
          for (const r2 of r2Data as any[]) {
            const ms = r2.meeting_slot;
            if (r2.deal_id && ms) {
              const existing = r2Map[r2.deal_id];
              const newDate = ms.scheduled_at;
              if (!existing || (newDate && (!existing.r2Date || newDate > existing.r2Date))) {
                r2Map[r2.deal_id] = {
                  r2Date: ms.scheduled_at,
                  r2CloserName: ms.closer?.name || null,
                  r2StatusName: r2.r2_status?.name || null,
                  r2StatusColor: r2.r2_status?.color || null,
                  r2StatusId: r2.r2_status_id,
                  r2AttendeeStatus: r2.status,
                  carrinhoStatus: r2.carrinho_status,
                  carrinhoWeekStart: r2.carrinho_week_start,
                };
              }
            }
          }
        }
      }

      const now = new Date();

      // Step 5: Transform into rows
      const rows: ContractLifecycleRow[] = (r1Attendees || []).map((att: any) => {
        const ms = att.meeting_slot;
        const deal = att.deal;
        const r2Info = att.deal_id ? r2Map[att.deal_id] : null;

        const hasR2 = !!r2Info;
        const hasR2Status = !!(r2Info?.r2StatusId);
        const r2StatusName = r2Info?.r2StatusName || null;
        const isTerminal = r2StatusName && ['Aprovado', 'Reprovado'].includes(r2StatusName);

        let situacao: ContractLifecycleRow['situacao'] = 'pendente';
        let situacaoLabel = '🔄 Pendente';

        if (!hasR2) {
          situacao = 'aguardando_r2';
          situacaoLabel = '⏳ Aguardando R2';
        } else if (isTerminal) {
          situacao = 'completo';
          situacaoLabel = '✅ Completo';
        } else if (!hasR2Status) {
          situacao = 'sem_status';
          situacaoLabel = '⚠️ Sem Status';
        }

        // Calculate dias parado for non-terminal
        let diasParado: number | null = null;
        if (!isTerminal && att.contract_paid_at) {
          diasParado = differenceInDays(now, new Date(att.contract_paid_at));
        }

        // Resolve SDR name
        const bookedBy = ms?.booked_by;
        const sdrName = bookedBy ? (profilesMap[bookedBy] || null) : null;

        return {
          id: att.id,
          leadName: att.attendee_name || deal?.contact?.name || deal?.name || null,
          phone: att.attendee_phone || deal?.contact?.phone || null,
          contractPaidAt: att.contract_paid_at,
          dealId: att.deal_id,
          r1Date: ms?.scheduled_at || null,
          r1CloserName: ms?.closer?.name || null,
          r1Status: att.status,
          sdrName,
          hasR2,
          r2Date: r2Info?.r2Date || null,
          r2CloserName: r2Info?.r2CloserName || null,
          r2StatusName,
          r2StatusColor: r2Info?.r2StatusColor || null,
          r2AttendeeStatus: r2Info?.r2AttendeeStatus || null,
          carrinhoStatus: r2Info?.carrinhoStatus || null,
          carrinhoWeekStart: r2Info?.carrinhoWeekStart || null,
          diasParado,
          situacao,
          situacaoLabel,
        };
      });

      // Apply filters
      let filtered = rows;
      if (filters.situacao && filters.situacao !== 'all') {
        filtered = rows.filter(r => r.situacao === filters.situacao);
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
