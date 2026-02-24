import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfDay, endOfDay, format } from "date-fns";
import { useSdrsFromSquad } from "./useSdrsFromSquad";

export interface SdrOutsideMetrics {
  totalOutside: number;
  outsideBySdr: Map<string, number>;
}

export function useSdrOutsideMetrics(
  startDate: Date | null, 
  endDate: Date | null,
  squad: string = 'incorporador'
) {
  const sdrsQuery = useSdrsFromSquad(squad);

  return useQuery({
    queryKey: ['sdr-outside-metrics', 
      startDate ? format(startDate, 'yyyy-MM-dd') : null,
      endDate ? format(endDate, 'yyyy-MM-dd') : null,
      squad
    ],
    queryFn: async (): Promise<SdrOutsideMetrics> => {
      if (!startDate || !endDate) {
        return { totalOutside: 0, outsideBySdr: new Map() };
      }

      const sdrs = sdrsQuery.data || [];
      const validSdrEmails = new Set(sdrs.map(s => s.email.toLowerCase()));

      const start = startOfDay(startDate).toISOString();
      const end = endOfDay(endDate).toISOString();

      // Fetch R1 meetings in the period with their attendees
      const { data: meetings, error: meetingsError } = await supabase
        .from('meeting_slots')
        .select(`
          id,
          scheduled_at,
          meeting_slot_attendees (
            id,
            deal_id,
            booked_by
          )
        `)
        .eq('meeting_type', 'r1')
        .gte('scheduled_at', start)
        .lte('scheduled_at', end)
        .neq('status', 'cancelled')
        .neq('status', 'canceled');

      if (meetingsError) throw meetingsError;

      // Fetch profiles to map booked_by UUID to email
      const bookedByIds = new Set<string>();
      meetings?.forEach(meeting => {
        meeting.meeting_slot_attendees?.forEach(att => {
          if (att.booked_by) bookedByIds.add(att.booked_by);
        });
      });

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email')
        .in('id', Array.from(bookedByIds));

      const profileEmailMap = new Map<string, string>();
      profiles?.forEach(p => {
        if (p.email) profileEmailMap.set(p.id, p.email.toLowerCase());
      });

      // Get all deal_ids from the meetings
      const dealIds = new Set<string>();
      meetings?.forEach(meeting => {
        meeting.meeting_slot_attendees?.forEach(att => {
          if (att.deal_id) dealIds.add(att.deal_id);
        });
      });

      if (dealIds.size === 0) {
        return { totalOutside: 0, outsideBySdr: new Map() };
      }

      // Fetch deals with their contact emails
      const { data: deals } = await supabase
        .from('crm_deals')
        .select('id, contact:crm_contacts(id, email)')
        .in('id', Array.from(dealIds));

      // Map deal_id -> email
      const dealEmailMap = new Map<string, string>();
      deals?.forEach(deal => {
        const contact = deal.contact as { id: string; email: string | null } | null;
        if (contact?.email) {
          dealEmailMap.set(deal.id, contact.email.toLowerCase());
        }
      });

      // Get unique emails from deals
      const attendeeEmails = [...new Set(Array.from(dealEmailMap.values()))];

      if (attendeeEmails.length === 0) {
        return { totalOutside: 0, outsideBySdr: new Map() };
      }

      // Fetch contract transactions for these emails
      const { data: contracts } = await supabase
        .from('hubla_transactions')
        .select('customer_email, sale_date')
        .in('customer_email', attendeeEmails)
        .in('product_category', ['contrato', 'incorporador'])
        .ilike('product_name', '%contrato%')
        .eq('sale_status', 'completed')
        .order('sale_date', { ascending: true });

      // Map email -> earliest contract date
      const emailContractDate = new Map<string, Date>();
      contracts?.forEach(c => {
        const email = c.customer_email?.toLowerCase();
        if (email) {
          const date = new Date(c.sale_date);
          if (!emailContractDate.has(email) || date < emailContractDate.get(email)!) {
            emailContractDate.set(email, date);
          }
        }
      });

      // Count outsides per SDR (contract purchased BEFORE meeting)
      const outsideBySdr = new Map<string, number>();
      let totalOutside = 0;

      meetings?.forEach(meeting => {
        meeting.meeting_slot_attendees?.forEach(att => {
          if (!att.deal_id || !att.booked_by) return;

          // Get SDR email from booked_by
          const sdrEmail = profileEmailMap.get(att.booked_by);
          if (!sdrEmail || !validSdrEmails.has(sdrEmail)) return;

          // Get contact email from deal
          const contactEmail = dealEmailMap.get(att.deal_id);
          if (!contactEmail) return;

          // Check if contact has a contract before this meeting
          const contractDate = emailContractDate.get(contactEmail);
          if (contractDate) {
            const meetingDate = new Date(meeting.scheduled_at);

            // Outside = contract purchased BEFORE meeting
            if (contractDate < meetingDate) {
              outsideBySdr.set(sdrEmail, (outsideBySdr.get(sdrEmail) || 0) + 1);
              totalOutside++;
            }
          }
        });
      });

      return { totalOutside, outsideBySdr };
    },
    enabled: !!startDate && !!endDate && sdrsQuery.isSuccess,
    staleTime: 30000,
  });
}
