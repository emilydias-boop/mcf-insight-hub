import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { getCustomWeekStart, getCustomWeekEnd } from "@/lib/dateHelpers";

export interface SDRCarrinhoMetric {
  sdr_id: string;
  sdr_name: string;
  sdr_email: string;
  aprovados: number;
}

export function useSDRCarrinhoMetrics(weekDate: Date) {
  const weekStart = getCustomWeekStart(weekDate);
  const weekEnd = getCustomWeekEnd(weekDate);

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

      // 2. Fetch R2 attendees with "aprovado" status for the week
      const { data: attendees, error: attendeesError } = await supabase
        .from('meeting_slot_attendees')
        .select(`
          id,
          booked_by,
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

      if (attendeesError) {
        console.error('Error fetching R2 attendees:', attendeesError);
        return [];
      }

      // 3. Get unique booked_by IDs
      const bookedByIds = new Set<string>();
      attendees?.forEach((att: any) => {
        if (att.booked_by) bookedByIds.add(att.booked_by);
      });

      if (bookedByIds.size === 0) {
        return [];
      }

      // 4. Fetch profiles for SDR names
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', Array.from(bookedByIds));

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
        return [];
      }

      const profilesMap = new Map<string, { name: string; email: string }>();
      profiles?.forEach((p: any) => {
        profilesMap.set(p.id, { 
          name: p.full_name || p.email?.split('@')[0] || 'Unknown',
          email: p.email || ''
        });
      });

      // 5. Aggregate by SDR
      const sdrMap = new Map<string, SDRCarrinhoMetric>();

      attendees?.forEach((att: any) => {
        const sdrId = att.booked_by;
        if (!sdrId) return;

        const profile = profilesMap.get(sdrId);
        if (!profile) return;

        if (!sdrMap.has(sdrId)) {
          sdrMap.set(sdrId, {
            sdr_id: sdrId,
            sdr_name: profile.name,
            sdr_email: profile.email,
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
