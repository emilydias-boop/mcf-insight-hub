import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth } from 'date-fns';

export interface CloserContractItem {
  id: string;
  leadName: string;
  sdrName: string | null;
  meetingDate: string | null;
  contractPaidAt: string;
}

export const useCloserContractsList = (sdrId: string | undefined, anoMes: string | undefined) => {
  return useQuery({
    queryKey: ['closer-contracts-list', sdrId, anoMes],
    queryFn: async (): Promise<CloserContractItem[]> => {
      if (!sdrId || !anoMes) return [];

      // 1. Get closer email from sdr table
      const { data: sdr } = await supabase
        .from('sdr')
        .select('email')
        .eq('id', sdrId)
        .single();

      if (!sdr?.email) return [];

      // 2. Find closer_id from closers table
      const { data: closers } = await supabase
        .from('closers')
        .select('id')
        .ilike('email', sdr.email)
        .eq('is_active', true);

      const closerId = closers?.[0]?.id;
      if (!closerId) return [];

      // 3. Date range
      const [year, month] = anoMes.split('-').map(Number);
      const monthDate = new Date(year, month - 1, 1);
      const startDate = format(startOfMonth(monthDate), 'yyyy-MM-dd');
      const endDate = format(endOfMonth(monthDate), 'yyyy-MM-dd');

      // 4. Get meeting slots for this closer in the period
      const { data: slots, error: slotsError } = await supabase
        .from('meeting_slots')
        .select(`
          id,
          scheduled_at,
          meeting_slot_attendees (
            id,
            attendee_name,
            status,
            contract_paid_at,
            booked_by,
            deal_id,
            is_partner,
            crm_deals (
              name
            )
          )
        `)
        .eq('closer_id', closerId)
        .gte('scheduled_at', `${startDate}T00:00:00`)
        .lte('scheduled_at', `${endDate}T23:59:59`);

      if (slotsError) {
        console.error('[useCloserContractsList] Error:', slotsError);
        return [];
      }

      // 5. Collect contract_paid/refunded attendees
      const contractAttendees: Array<{
        id: string;
        leadName: string;
        meetingDate: string;
        contractPaidAt: string;
        bookedBy: string | null;
      }> = [];

      for (const slot of slots || []) {
        for (const att of (slot as any).meeting_slot_attendees || []) {
          if (att.is_partner) continue;
          if (att.status === 'contract_paid' || att.status === 'refunded') {
            if (!att.contract_paid_at) continue;
            // Exclude outsides: contract paid before the meeting
            if (new Date(att.contract_paid_at) < new Date(slot.scheduled_at)) continue;
            // Check if contract_paid_at is in the month range
            const paidDate = att.contract_paid_at.slice(0, 10);
            if (paidDate >= startDate && paidDate <= endDate) {
              contractAttendees.push({
                id: att.id,
                leadName: att.attendee_name || att.crm_deals?.name || 'Lead sem nome',
                meetingDate: slot.scheduled_at,
                contractPaidAt: att.contract_paid_at,
                bookedBy: att.booked_by,
              });
            }
          }
        }
      }

      // 6. Resolve SDR names from booked_by UUIDs
      const bookedByIds = [...new Set(contractAttendees.map(a => a.bookedBy).filter(Boolean))] as string[];
      let profileMap: Record<string, string> = {};

      if (bookedByIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', bookedByIds);

        for (const p of profiles || []) {
          if (p.full_name) profileMap[p.id] = p.full_name;
        }
      }

      return contractAttendees
        .map(att => ({
          id: att.id,
          leadName: att.leadName,
          sdrName: att.bookedBy ? (profileMap[att.bookedBy] || null) : null,
          meetingDate: att.meetingDate,
          contractPaidAt: att.contractPaidAt,
        }))
        .sort((a, b) => new Date(b.contractPaidAt).getTime() - new Date(a.contractPaidAt).getTime());
    },
    enabled: !!sdrId && !!anoMes,
    staleTime: 60_000,
  });
};
