import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfWeek, endOfWeek } from 'date-fns';

export interface CarrinhoContract {
  id: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  sale_date: string;
  product_name: string;
  product_price: number | null;
  net_value: number | null;
  is_scheduled: boolean;
  is_refund: boolean;
  closer_r1: string | null;
  closer_r2: string | null;
  sdr_name: string | null;
  linked_attendee_id: string | null;
}

export interface CarrinhoFilters {
  weekStart: Date;
  weekEnd: Date;
  closerR2Filter?: string;
  statusFilter?: 'all' | 'scheduled' | 'unscheduled';
}

export const useCarrinhoReport = (filters: CarrinhoFilters) => {
  return useQuery({
    queryKey: ['carrinho-report', filters.weekStart?.toISOString(), filters.weekEnd?.toISOString()],
    queryFn: async () => {
      const startStr = format(filters.weekStart, 'yyyy-MM-dd') + 'T00:00:00-03:00';
      const endStr = format(filters.weekEnd, 'yyyy-MM-dd') + 'T23:59:59-03:00';

      // 1. Fetch transactions for the week (incorporador category, first installment)
      const { data: transactions, error } = await supabase
        .from('hubla_transactions')
        .select('id, customer_name, customer_email, customer_phone, sale_date, product_name, product_price, net_value, linked_attendee_id, event_type, sale_status, installment_number')
        .in('product_category', ['incorporador', 'contrato'])
        .gte('sale_date', startStr)
        .lte('sale_date', endStr)
        .order('sale_date', { ascending: false });

      if (error) throw error;
      if (!transactions?.length) return [];

      // Separate refunds from sales
      const refundTxs = transactions.filter(tx => tx.event_type === 'refund');
      const saleTxs = transactions.filter(tx => tx.event_type !== 'refund');

      // Build set of refunded emails for quick lookup
      const refundedEmails = new Set(refundTxs.map(tx => tx.customer_email?.toLowerCase()).filter(Boolean));

      // 2. Get linked attendee data (for R2 closer)
      const linkedAttendeeIds = saleTxs
        .map(tx => tx.linked_attendee_id)
        .filter((id): id is string => !!id);

      let attendeeMap = new Map<string, { closerR2: string | null; dealId: string | null; scheduledAt: string | null }>();

      if (linkedAttendeeIds.length > 0) {
        const { data: attendees } = await supabase
          .from('meeting_slot_attendees')
          .select('id, deal_id, meeting_slot_id')
          .in('id', linkedAttendeeIds);

        if (attendees?.length) {
          const slotIds = attendees.map(a => a.meeting_slot_id).filter(Boolean);
          const { data: slots } = await supabase
            .from('meeting_slots')
            .select('id, closer_id, meeting_type, scheduled_at')
            .in('id', slotIds);

          const slotMap = new Map(slots?.map(s => [s.id, s]) || []);
          
          // Get closer names
          const closerIds = [...new Set(slots?.map(s => s.closer_id).filter(Boolean) || [])];
          let closerNameMap = new Map<string, string>();
          if (closerIds.length > 0) {
            const { data: closers } = await supabase
              .from('closers')
              .select('id, name')
              .in('id', closerIds);
            closerNameMap = new Map(closers?.map(c => [c.id, c.name]) || []);
          }

          for (const att of attendees) {
            const slot = slotMap.get(att.meeting_slot_id);
            attendeeMap.set(att.id, {
              closerR2: slot ? (closerNameMap.get(slot.closer_id) || null) : null,
              dealId: att.deal_id,
              scheduledAt: slot?.scheduled_at || null,
            });
          }
        }
      }

      // 3. Get deal IDs for R1 closer and SDR lookup
      const dealIds = new Set<string>();
      for (const att of attendeeMap.values()) {
        if (att.dealId) dealIds.add(att.dealId);
      }
      // Also try to find deals by email for unlinked contracts
      const emails = saleTxs
        .filter(tx => !tx.linked_attendee_id && tx.customer_email)
        .map(tx => tx.customer_email!.toLowerCase());

      if (emails.length > 0) {
        const { data: contactDeals } = await supabase
          .from('crm_contacts')
          .select('id, email')
          .in('email', emails);

        if (contactDeals?.length) {
          const contactIds = contactDeals.map(c => c.id);
          const { data: deals } = await supabase
            .from('crm_deals')
            .select('id, contact_id')
            .in('contact_id', contactIds);
          deals?.forEach(d => dealIds.add(d.id));
        }
      }

      // 4. Get R1 meetings for these deals (for R1 closer)
      let r1CloserByDeal = new Map<string, string>();
      let sdrByDeal = new Map<string, string>();

      if (dealIds.size > 0) {
        const dealIdArray = Array.from(dealIds);

        // R1 attendees
        const { data: r1Attendees } = await supabase
          .from('meeting_slot_attendees')
          .select('deal_id, meeting_slot_id, booked_by')
          .in('deal_id', dealIdArray);

        if (r1Attendees?.length) {
          const r1SlotIds = [...new Set(r1Attendees.map(a => a.meeting_slot_id))];
          const { data: r1Slots } = await supabase
            .from('meeting_slots')
            .select('id, closer_id, meeting_type')
            .in('id', r1SlotIds);

          const r1SlotMap = new Map(r1Slots?.map(s => [s.id, s]) || []);
          const r1CloserIds = [...new Set(r1Slots?.filter(s => s.meeting_type === 'r1').map(s => s.closer_id) || [])];
          
          let r1CloserNameMap = new Map<string, string>();
          if (r1CloserIds.length > 0) {
            const { data: closers } = await supabase
              .from('closers')
              .select('id, name')
              .in('id', r1CloserIds);
            r1CloserNameMap = new Map(closers?.map(c => [c.id, c.name]) || []);
          }

          // Get SDR names from booked_by
          const bookedByIds = [...new Set(r1Attendees.map(a => a.booked_by).filter(Boolean))] as string[];
          let sdrNameMap = new Map<string, string>();
          if (bookedByIds.length > 0) {
            const { data: profiles } = await supabase
              .from('profiles')
              .select('id, full_name')
              .in('id', bookedByIds);
            sdrNameMap = new Map(profiles?.map(p => [p.id, p.full_name || '']) || []);
          }

          for (const att of r1Attendees) {
            const slot = r1SlotMap.get(att.meeting_slot_id);
            if (slot?.meeting_type === 'r1' && att.deal_id) {
              r1CloserByDeal.set(att.deal_id, r1CloserNameMap.get(slot.closer_id) || '');
              if (att.booked_by) {
                sdrByDeal.set(att.deal_id, sdrNameMap.get(att.booked_by) || '');
              }
            }
          }
        }

        // Also get SDR from deal owner
        const { data: deals } = await supabase
          .from('crm_deals')
          .select('id, owner_profile_id')
          .in('id', dealIdArray)
          .not('owner_profile_id', 'is', null);

        if (deals?.length) {
          const ownerIds = [...new Set(deals.map(d => d.owner_profile_id).filter(Boolean))] as string[];
          if (ownerIds.length > 0) {
            const { data: profiles } = await supabase
              .from('profiles')
              .select('id, full_name')
              .in('id', ownerIds);
            const ownerNameMap = new Map(profiles?.map(p => [p.id, p.full_name || '']) || []);
            for (const deal of deals) {
              if (deal.owner_profile_id && !sdrByDeal.has(deal.id)) {
                sdrByDeal.set(deal.id, ownerNameMap.get(deal.owner_profile_id) || '');
              }
            }
          }
        }
      }

      // 5. Build result
      // Map email -> deal_id for unlinked contracts
      const emailToDealMap = new Map<string, string>();
      if (dealIds.size > 0) {
        const { data: contactsWithDeals } = await supabase
          .from('crm_deals')
          .select('id, contact_id, crm_contacts(email)')
          .in('id', Array.from(dealIds));
        
        contactsWithDeals?.forEach((d: any) => {
          if (d.crm_contacts?.email) {
            emailToDealMap.set(d.crm_contacts.email.toLowerCase(), d.id);
          }
        });
      }

      const results: CarrinhoContract[] = saleTxs.map(tx => {
        const attData = tx.linked_attendee_id ? attendeeMap.get(tx.linked_attendee_id) : null;
        const dealId = attData?.dealId || (tx.customer_email ? emailToDealMap.get(tx.customer_email.toLowerCase()) : null) || null;

        return {
          id: tx.id,
          customer_name: tx.customer_name,
          customer_email: tx.customer_email,
          customer_phone: tx.customer_phone,
          sale_date: tx.sale_date,
          product_name: tx.product_name,
          product_price: tx.product_price,
          net_value: tx.net_value,
          is_scheduled: !!tx.linked_attendee_id && !!attData,
          is_refund: tx.customer_email ? refundedEmails.has(tx.customer_email.toLowerCase()) : false,
          closer_r1: dealId ? (r1CloserByDeal.get(dealId) || null) : null,
          closer_r2: attData?.closerR2 || null,
          sdr_name: dealId ? (sdrByDeal.get(dealId) || null) : null,
          linked_attendee_id: tx.linked_attendee_id,
        };
      });

      return results;
    },
    enabled: !!filters.weekStart && !!filters.weekEnd,
  });
};

export const useCarrinhoClosers = () => {
  return useQuery({
    queryKey: ['carrinho-closers-r2'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('closers')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });
};
