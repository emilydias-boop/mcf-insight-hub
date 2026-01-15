import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface R2PendingLead {
  id: string;
  attendee_name: string;
  attendee_phone: string | null;
  deal_id: string | null;
  status: string;
  contract_paid_at: string;
  meeting_slot: {
    id: string;
    scheduled_at: string;
    closer_id: string | null;
    closer?: {
      id: string;
      name: string;
    } | null;
  };
  deal?: {
    id: string;
    name: string;
    contact?: {
      id: string;
      name: string;
      phone: string | null;
      email: string | null;
    } | null;
  } | null;
}

/**
 * Hook to fetch leads with "Contrato Pago" status from R1 that don't have R2 scheduled yet
 */
export function useR2PendingLeads() {
  return useQuery({
    queryKey: ['r2-pending-leads'],
    queryFn: async () => {
      // Step 1: Get all attendees with contract_paid status from R1 meetings
      const { data: paidAttendees, error: paidError } = await supabase
        .from('meeting_slot_attendees')
        .select(`
          id,
          attendee_name,
          attendee_phone,
          deal_id,
          status,
          created_at,
          meeting_slot:meeting_slots!inner(
            id,
            scheduled_at,
            closer_id,
            meeting_type,
            closer:closers(id, name)
          ),
          deal:crm_deals(
            id,
            name,
            contact:crm_contacts(id, name, phone, email)
          )
        `)
        .eq('status', 'contract_paid')
        .eq('meeting_slots.meeting_type', 'r1')
        .order('created_at', { ascending: false });

      if (paidError) throw paidError;
      if (!paidAttendees || paidAttendees.length === 0) return [];

      // Step 2: Get all deal_ids that already have R2 scheduled
      const dealIds = (paidAttendees as any[])
        .filter(a => a.deal_id)
        .map(a => a.deal_id as string);

      if (dealIds.length === 0) {
        return (paidAttendees as any[]).map(a => ({
          ...a,
          contract_paid_at: a.created_at,
          meeting_slot: Array.isArray(a.meeting_slot) ? a.meeting_slot[0] : a.meeting_slot,
          deal: Array.isArray(a.deal) ? a.deal[0] : a.deal,
        })) as R2PendingLead[];
      }

      // Get R2 attendees for these deals
      const { data: r2Attendees, error: r2Error } = await supabase
        .from('meeting_slot_attendees')
        .select(`
          deal_id,
          meeting_slot:meeting_slots!inner(meeting_type)
        `)
        .in('deal_id', dealIds)
        .eq('meeting_slots.meeting_type', 'r2');

      if (r2Error) throw r2Error;

      // Create a set of deal_ids that already have R2
      const dealsWithR2 = new Set(
        ((r2Attendees as any[]) || []).map(a => a.deal_id)
      );

      // Step 3: Filter out leads that already have R2
      const pendingLeads = (paidAttendees as any[])
        .filter(a => !a.deal_id || !dealsWithR2.has(a.deal_id))
        .map(a => ({
          ...a,
          contract_paid_at: a.created_at,
          meeting_slot: Array.isArray(a.meeting_slot) ? a.meeting_slot[0] : a.meeting_slot,
          deal: Array.isArray(a.deal) ? a.deal[0] : a.deal,
        })) as R2PendingLead[];

      return pendingLeads;
    },
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Refetch every minute
  });
}

/**
 * Get the count of pending R2 leads
 */
export function useR2PendingLeadsCount() {
  const { data: pendingLeads } = useR2PendingLeads();
  return pendingLeads?.length || 0;
}
