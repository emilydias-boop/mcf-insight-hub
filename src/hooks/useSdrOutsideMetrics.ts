import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfDay, endOfDay, format, addHours } from "date-fns";
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

      const BRT_OFFSET_HOURS = 3;
      const start = addHours(startOfDay(startDate), BRT_OFFSET_HOURS).toISOString();
      const end = addHours(endOfDay(endDate), BRT_OFFSET_HOURS).toISOString();

      // ===== INVERTED LOGIC: Contracts in period → find meetings after =====

      // 1. Fetch contract transactions with sale_date in the period
      const { data: periodContracts } = await supabase
        .from('hubla_transactions')
        .select('customer_email, sale_date')
        .in('product_category', ['contrato', 'incorporador'])
        .ilike('product_name', '%contrato%')
        .eq('sale_status', 'completed')
        .gte('sale_date', start)
        .lte('sale_date', end)
        .order('sale_date', { ascending: true });

      // 2. Build map: email → earliest sale_date in period
      const periodContractByEmail = new Map<string, Date>();
      periodContracts?.forEach(c => {
        const email = c.customer_email?.toLowerCase();
        if (email) {
          const date = new Date(c.sale_date);
          if (!periodContractByEmail.has(email) || date < periodContractByEmail.get(email)!) {
            periodContractByEmail.set(email, date);
          }
        }
      });

      const contractEmails = Array.from(periodContractByEmail.keys());
      if (contractEmails.length === 0) {
        return { totalOutside: 0, outsideBySdr: new Map() };
      }

      // 3. Find contacts → deals for these emails (include owner_id for no-R1 attribution)
      const { data: contacts } = await supabase
        .from('crm_contacts')
        .select('id, email')
        .in('email', contractEmails);

      const contactEmailMap = new Map<string, string>();
      contacts?.forEach(c => contactEmailMap.set(c.id, c.email!.toLowerCase()));

      const contactIds = Array.from(contactEmailMap.keys());
      if (contactIds.length === 0) {
        return { totalOutside: 0, outsideBySdr: new Map() };
      }

      const { data: deals } = await supabase
        .from('crm_deals')
        .select('id, contact_id, owner_id')
        .in('contact_id', contactIds);

      const dealToEmail = new Map<string, string>();
      const emailToOwnerIds = new Map<string, Set<string>>();
      deals?.forEach(d => {
        const email = contactEmailMap.get(d.contact_id!);
        if (email) {
          dealToEmail.set(d.id, email);
          if (d.owner_id) {
            if (!emailToOwnerIds.has(email)) emailToOwnerIds.set(email, new Set());
            emailToOwnerIds.get(email)!.add(d.owner_id);
          }
        }
      });

      const dealIds = Array.from(dealToEmail.keys());

      // 4. Find R1 meeting attendees with these deal_ids (no date filter)
      let attendees: any[] = [];
      if (dealIds.length > 0) {
        const { data } = await supabase
          .from('meeting_slot_attendees')
          .select(`
            deal_id,
            booked_by,
            is_partner,
            meeting_slot:meeting_slots!inner(
              scheduled_at,
              meeting_type,
              status
            )
          `)
          .in('deal_id', dealIds)
          .eq('meeting_slot.meeting_type', 'r1')
          .neq('meeting_slot.status', 'cancelled')
          .neq('meeting_slot.status', 'canceled')
          .eq('is_partner', false);
        attendees = data || [];
      }

      // 5. Fetch profiles to map booked_by UUID to email
      const profileUuids = new Set<string>();
      attendees.forEach(att => {
        if (att.booked_by) profileUuids.add(att.booked_by);
      });
      // Also collect owner_ids for no-R1 attribution
      emailToOwnerIds.forEach(ownerSet => {
        ownerSet.forEach(oid => profileUuids.add(oid));
      });

      const profileEmailMap = new Map<string, string>();
      if (profileUuids.size > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, email')
          .in('id', Array.from(profileUuids));
        profiles?.forEach(p => {
          if (p.email) profileEmailMap.set(p.id, p.email.toLowerCase());
        });
      }

      // 6. Count outsides per SDR
      const outsideBySdr = new Map<string, number>();
      let totalOutside = 0;
      const countedEmails = new Set<string>();

      // 6a. Outsides WITH R1 (contract before meeting)
      attendees.forEach(att => {
        if (!att.deal_id || !att.booked_by) return;

        const email = dealToEmail.get(att.deal_id);
        if (!email || countedEmails.has(email)) return;

        const contractDate = periodContractByEmail.get(email);
        if (!contractDate) return;

        const meetingSlot = att.meeting_slot as any;
        const meetingDate = new Date(meetingSlot.scheduled_at);

        // Outside = contract purchased BEFORE meeting
        if (contractDate < meetingDate) {
          const sdrEmail = profileEmailMap.get(att.booked_by);
          if (sdrEmail && validSdrEmails.has(sdrEmail)) {
            outsideBySdr.set(sdrEmail, (outsideBySdr.get(sdrEmail) || 0) + 1);
            totalOutside++;
            countedEmails.add(email);
          }
        }
      });

      // 6b. Outsides WITHOUT R1 (contract exists but no R1 meeting found)
      // These are also outsides — they bought before even being placed in R1
      const emailsWithR1 = new Set<string>();
      attendees.forEach(att => {
        if (att.deal_id) {
          const email = dealToEmail.get(att.deal_id);
          if (email) emailsWithR1.add(email);
        }
      });

      for (const email of contractEmails) {
        if (countedEmails.has(email) || emailsWithR1.has(email)) continue;

        // No R1 found → attribute to deal owner
        const ownerIds = emailToOwnerIds.get(email);
        if (!ownerIds || ownerIds.size === 0) continue;

        for (const ownerId of ownerIds) {
          const ownerEmail = profileEmailMap.get(ownerId);
          if (ownerEmail && validSdrEmails.has(ownerEmail)) {
            outsideBySdr.set(ownerEmail, (outsideBySdr.get(ownerEmail) || 0) + 1);
            totalOutside++;
            countedEmails.add(email);
            break; // count once per email
          }
        }
      }

      return { totalOutside, outsideBySdr };
    },
    enabled: !!startDate && !!endDate && sdrsQuery.isSuccess,
    staleTime: 30000,
  });
}
