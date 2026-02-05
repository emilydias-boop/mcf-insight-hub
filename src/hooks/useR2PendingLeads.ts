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

      // Step 2: Extract contact_ids, names, and phones from the paid attendees
      const contactIds = new Set<string>();
      const normalizedNames = new Set<string>();
      const normalizedPhones = new Set<string>();
      
      const attendeesWithContact = (paidAttendees as any[]).map(a => {
        const deal = Array.isArray(a.deal) ? a.deal[0] : a.deal;
        const contactId = deal?.contact_id || deal?.contact?.id || null;
        if (contactId) contactIds.add(contactId);
        
        // Collect normalized name
        const normalizedName = a.attendee_name?.toLowerCase().trim() || null;
        if (normalizedName) normalizedNames.add(normalizedName);
        
        // Collect normalized phone (digits only, min 8 chars)
        const normalizedPhone = a.attendee_phone?.replace(/\D/g, '') || null;
        if (normalizedPhone && normalizedPhone.length >= 8) normalizedPhones.add(normalizedPhone);
        
        return {
          ...a,
          contact_id: contactId,
          normalized_name: normalizedName,
          normalized_phone: normalizedPhone,
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

      // Step 4b: Get ALL R2 attendees by name/phone (fallback correlation)
      const { data: r2ByNamePhone } = await supabase
        .from('meeting_slot_attendees')
        .select(`
          attendee_name,
          attendee_phone,
          meeting_slot:meeting_slots!inner(meeting_type)
        `)
        .eq('meeting_slots.meeting_type', 'r2');

      // Create sets of normalized names/phones with R2
      const r2Names = new Set<string>();
      const r2Phones = new Set<string>();
      ((r2ByNamePhone as any[]) || []).forEach(a => {
        const name = a.attendee_name?.toLowerCase().trim();
        if (name) r2Names.add(name);
        const phone = a.attendee_phone?.replace(/\D/g, '');
        if (phone && phone.length >= 8) r2Phones.add(phone);
      });

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

      // Step 6: Filter out leads that already have R2 (by any correlation method)
      const pendingLeads = attendeesWithContact
        .filter(a => {
          // 1. Check by contact_id
          if (a.contact_id && contactsWithR2.has(a.contact_id)) {
            return false;
          }
          // 2. Check by deal_id
          if (a.deal_id && dealsWithR2.has(a.deal_id)) {
            return false;
          }
          // 3. Check by normalized name (fallback)
          if (a.normalized_name && r2Names.has(a.normalized_name)) {
            return false;
          }
          // 4. Check by normalized phone (fallback)
          if (a.normalized_phone && r2Phones.has(a.normalized_phone)) {
            return false;
          }
          return true;
        })
        .map(a => ({
          ...a,
          contract_paid_at: a.contract_paid_at || a.meeting_slot?.scheduled_at || a.created_at,
        })) as R2PendingLead[];

      // Step 7: For rescheduled leads, find the most recent R1 closer
      const dealIdsForLatestCloser = pendingLeads
        .filter(a => a.deal_id)
        .map(a => a.deal_id as string);

      if (dealIdsForLatestCloser.length > 0) {
        const { data: latestAttendees } = await supabase
          .from('meeting_slot_attendees')
          .select(`
            deal_id,
            meeting_slot:meeting_slots!inner(
              scheduled_at,
              meeting_type,
              closer:closers(id, name)
            )
          `)
          .in('deal_id', dealIdsForLatestCloser)
          .eq('meeting_slots.meeting_type', 'r1')
          .order('meeting_slots(scheduled_at)', { ascending: false });

        // Create map: deal_id -> most recent closer
        const latestCloserMap = new Map<string, { id: string; name: string } | null>();
        ((latestAttendees as any[]) || []).forEach(att => {
          if (att.deal_id && !latestCloserMap.has(att.deal_id)) {
            const slot = Array.isArray(att.meeting_slot) ? att.meeting_slot[0] : att.meeting_slot;
            latestCloserMap.set(att.deal_id, slot?.closer || null);
          }
        });

        // Enrich pendingLeads with most recent closer
        return pendingLeads.map(lead => {
          const latestCloser = lead.deal_id ? latestCloserMap.get(lead.deal_id) : null;
          if (latestCloser) {
            return {
              ...lead,
              meeting_slot: {
                ...lead.meeting_slot,
                closer: latestCloser
              }
            };
          }
          return lead;
        }) as R2PendingLead[];
      }

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
