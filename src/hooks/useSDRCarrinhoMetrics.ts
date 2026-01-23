import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { getCustomWeekStart, getCustomWeekEnd } from "@/lib/dateHelpers";
import { SDR_LIST } from "@/constants/team";

export interface SDRCarrinhoMetric {
  sdr_id: string;
  sdr_name: string;
  sdr_email: string;
  aprovados: number;
}

export function useSDRCarrinhoMetrics(weekDate: Date) {
  const weekStart = getCustomWeekStart(weekDate);
  const weekEnd = getCustomWeekEnd(weekDate);

  // Build set of valid SDR emails
  const validSdrEmails = new Set(SDR_LIST.map(s => s.email.toLowerCase()));
  const sdrNameMap = new Map(SDR_LIST.map(s => [s.email.toLowerCase(), s.nome]));

  return useQuery({
    queryKey: ['sdr-carrinho-metrics', format(weekStart, 'yyyy-MM-dd'), format(weekEnd, 'yyyy-MM-dd')],
    queryFn: async (): Promise<SDRCarrinhoMetric[]> => {
      // 1. Fetch R2 status options to find "aprovado"
      const { data: statusOptions, error: statusError } = await supabase
        .from('r2_status_options')
        .select('id, name')
        .ilike('name', '%aprov%');

      if (statusError) {
        console.error('Error fetching R2 status options:', statusError);
        return [];
      }

      const aprovadoStatusIds = statusOptions?.map(s => s.id) || [];
      if (aprovadoStatusIds.length === 0) {
        return [];
      }

      // 2. Fetch R2 attendees with "aprovado" status for the week (get deal_id)
      const { data: r2Attendees, error: r2Error } = await supabase
        .from('meeting_slot_attendees')
        .select(`
          id,
          deal_id,
          r2_status_id,
          meeting_slot:meeting_slots!inner(
            id,
            scheduled_at,
            meeting_type,
            status
          )
        `)
        .eq('meeting_slot.meeting_type', 'r2')
        .in('r2_status_id', aprovadoStatusIds)
        .gte('meeting_slot.scheduled_at', weekStart.toISOString())
        .lte('meeting_slot.scheduled_at', weekEnd.toISOString())
        .not('meeting_slot.status', 'in', '("cancelled","rescheduled")');

      if (r2Error) {
        console.error('Error fetching R2 attendees:', r2Error);
        return [];
      }

      // 3. Get unique deal_ids from R2 approved attendees
      const dealIds = new Set<string>();
      r2Attendees?.forEach((att: any) => {
        if (att.deal_id) dealIds.add(att.deal_id);
      });

      if (dealIds.size === 0) {
        return [];
      }

      // 4. Fetch R1 attendees for these deals to get the original booked_by (SDR)
      const { data: r1Attendees, error: r1Error } = await supabase
        .from('meeting_slot_attendees')
        .select(`
          id,
          deal_id,
          booked_by,
          meeting_slot:meeting_slots!inner(
            id,
            meeting_type
          )
        `)
        .in('deal_id', Array.from(dealIds))
        .eq('meeting_slot.meeting_type', 'r1');

      if (r1Error) {
        console.error('Error fetching R1 attendees:', r1Error);
        return [];
      }

      // 5. Build map: deal_id -> booked_by (SDR who booked R1)
      const dealToBookedBy = new Map<string, string>();
      r1Attendees?.forEach((att: any) => {
        if (att.deal_id && att.booked_by) {
          // Keep the first booked_by found (original R1)
          if (!dealToBookedBy.has(att.deal_id)) {
            dealToBookedBy.set(att.deal_id, att.booked_by);
          }
        }
      });

      // 6. Get unique booked_by IDs
      const bookedByIds = new Set<string>(dealToBookedBy.values());
      if (bookedByIds.size === 0) {
        return [];
      }

      // 7. Fetch profiles for SDR emails
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', Array.from(bookedByIds));

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
        return [];
      }

      // Map profile ID to email (lowercase)
      const profileEmailMap = new Map<string, string>();
      profiles?.forEach((p: any) => {
        if (p.email) {
          profileEmailMap.set(p.id, p.email.toLowerCase());
        }
      });

      // 8. Aggregate by SDR - ONLY include valid SDRs from SDR_LIST
      const sdrMap = new Map<string, SDRCarrinhoMetric>();

      r2Attendees?.forEach((att: any) => {
        const dealId = att.deal_id;
        if (!dealId) return;

        const sdrId = dealToBookedBy.get(dealId);
        if (!sdrId) return;

        const sdrEmail = profileEmailMap.get(sdrId);
        if (!sdrEmail) return;

        // FILTER: Only count if booked by a valid SDR from SDR_LIST
        if (!validSdrEmails.has(sdrEmail)) return;

        const sdrName = sdrNameMap.get(sdrEmail) || sdrEmail.split('@')[0];

        if (!sdrMap.has(sdrId)) {
          sdrMap.set(sdrId, {
            sdr_id: sdrId,
            sdr_name: sdrName,
            sdr_email: sdrEmail,
            aprovados: 0,
          });
        }

        const metric = sdrMap.get(sdrId)!;
        metric.aprovados++;
      });

      // Sort by aprovados desc
      return Array.from(sdrMap.values()).sort((a, b) => b.aprovados - a.aprovados);
    },
    refetchInterval: 30000,
  });
}
