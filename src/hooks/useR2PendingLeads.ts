import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface R2PendingLead {
  id: string;
  attendee_name: string;
  attendee_phone: string | null;
  deal_id: string | null;
  status: string;
  contract_paid_at: string;
  contact_id: string | null;
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
 * Hook to fetch leads with "Contrato Pago" status from R1 that don't have R2 scheduled yet.
 * Now deduplicates by contact_id instead of just deal_id to handle cases where
 * the same contact has R2 on a different deal.
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
          contract_paid_at,
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
            contact_id,
            contact:crm_contacts(id, name, phone, email)
          )
        `)
        .eq('status', 'contract_paid')
        .eq('meeting_slots.meeting_type', 'r1')
        .order('contract_paid_at', { ascending: false, nullsFirst: false });

      if (paidError) throw paidError;
      if (!paidAttendees || paidAttendees.length === 0) return [];

      // Step 2: Extract contact_ids from the paid attendees
      const contactIds = new Set<string>();
      const attendeesWithContact = (paidAttendees as any[]).map(a => {
        const deal = Array.isArray(a.deal) ? a.deal[0] : a.deal;
        const contactId = deal?.contact_id || deal?.contact?.id || null;
        if (contactId) contactIds.add(contactId);
        return {
          ...a,
          contact_id: contactId,
          meeting_slot: Array.isArray(a.meeting_slot) ? a.meeting_slot[0] : a.meeting_slot,
          deal: deal,
        };
      });

      if (contactIds.size === 0) {
        // No contacts found, return all as pending (edge case)
        return attendeesWithContact.map(a => ({
          ...a,
          contract_paid_at: a.contract_paid_at || a.meeting_slot?.scheduled_at || a.created_at,
        })) as R2PendingLead[];
      }

      // Step 3: Get ALL deals belonging to these contacts
      const { data: allDealsForContacts, error: dealsError } = await supabase
        .from('crm_deals')
        .select('id, contact_id')
        .in('contact_id', Array.from(contactIds));

      if (dealsError) throw dealsError;

      // Create a map: contact_id -> all deal_ids for that contact
      const contactToDealIds = new Map<string, Set<string>>();
      (allDealsForContacts || []).forEach(d => {
        if (d.contact_id) {
          if (!contactToDealIds.has(d.contact_id)) {
            contactToDealIds.set(d.contact_id, new Set());
          }
          contactToDealIds.get(d.contact_id)!.add(d.id);
        }
      });

      // Collect ALL deal_ids that belong to any of these contacts
      const allDealIds = new Set<string>();
      contactToDealIds.forEach(dealSet => {
        dealSet.forEach(dealId => allDealIds.add(dealId));
      });

      if (allDealIds.size === 0) {
        return attendeesWithContact.map(a => ({
          ...a,
          contract_paid_at: a.contract_paid_at || a.meeting_slot?.scheduled_at || a.created_at,
        })) as R2PendingLead[];
      }

      // Step 4: Get R2 attendees for ALL deals of these contacts
      const { data: r2Attendees, error: r2Error } = await supabase
        .from('meeting_slot_attendees')
        .select(`
          deal_id,
          meeting_slot:meeting_slots!inner(meeting_type)
        `)
        .in('deal_id', Array.from(allDealIds))
        .eq('meeting_slots.meeting_type', 'r2');

      if (r2Error) throw r2Error;

      // Create a set of deal_ids that have R2
      const dealsWithR2 = new Set(
        ((r2Attendees as any[]) || []).map(a => a.deal_id)
      );

      // Step 5: Find which contacts already have R2 (via ANY of their deals)
      const contactsWithR2 = new Set<string>();
      contactToDealIds.forEach((dealSet, contactId) => {
        for (const dealId of dealSet) {
          if (dealsWithR2.has(dealId)) {
            contactsWithR2.add(contactId);
            break;
          }
        }
      });

      // Step 6: Filter out leads whose contact already has R2
      const pendingLeads = attendeesWithContact
        .filter(a => {
          // If no contact_id, fall back to deal_id check
          if (!a.contact_id) {
            return !a.deal_id || !dealsWithR2.has(a.deal_id);
          }
          // Exclude if contact already has R2
          return !contactsWithR2.has(a.contact_id);
        })
        .map(a => ({
          ...a,
          contract_paid_at: a.contract_paid_at || a.meeting_slot?.scheduled_at || a.created_at,
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
