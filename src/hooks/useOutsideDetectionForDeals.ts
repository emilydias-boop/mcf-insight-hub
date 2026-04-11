import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { isOutsideOffer } from './outsideOfferConstants';

interface DealForOutsideCheck {
  id: string;
  created_at?: string;
  crm_contacts?: {
    email?: string | null;
  } | null;
}

async function batchedIn<T>(
  queryFn: (chunk: string[]) => PromiseLike<{ data: T[] | null; error: any }>,
  items: string[],
  batchSize = 200
): Promise<T[]> {
  if (items.length === 0) return [];
  const chunks: string[][] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    chunks.push(items.slice(i, i + batchSize));
  }
  const results = await Promise.all(chunks.map(chunk => queryFn(chunk)));
  const allData: T[] = [];
  for (const r of results) {
    if (r.error) throw r.error;
    if (r.data) allData.push(...r.data);
  }
  return allData;
}

export const useOutsideDetectionForDeals = (deals: DealForOutsideCheck[]) => {
  const keyParts = deals.map(d => `${d.id}:${d.crm_contacts?.email || ''}`).join(',');

  return useQuery({
    queryKey: ['outside-detection-deals', keyParts],
    queryFn: async (): Promise<Map<string, { isOutside: boolean; productName: string | null }>> => {
      const result = new Map<string, { isOutside: boolean; productName: string | null }>();
      if (!deals.length) return result;

      // 1. Collect unique emails -> deal mappings
      const emailToDealIds = new Map<string, { dealId: string }[]>();
      for (const deal of deals) {
        const email = deal.crm_contacts?.email?.toLowerCase().trim();
        if (!email) continue;
        const existing = emailToDealIds.get(email) || [];
        existing.push({ dealId: deal.id });
        emailToDealIds.set(email, existing);
      }

      const uniqueEmails = Array.from(emailToDealIds.keys());
      if (!uniqueEmails.length) return result;

      // 2. Fetch ALL deal_ids for these contacts (cross-pipeline R1 lookup)
      const allDealsForEmails = await batchedIn<{ id: string; crm_contacts: { email: string } }>(
        (chunk) =>
          supabase
            .from('crm_deals')
            .select('id, crm_contacts!inner(email)')
            .in('crm_contacts.email', chunk) as any,
        uniqueEmails
      );

      const emailToAllDealIds = new Map<string, Set<string>>();
      for (const d of allDealsForEmails) {
        const email = (d.crm_contacts as any)?.email?.toLowerCase().trim();
        if (!email) continue;
        if (!emailToAllDealIds.has(email)) emailToAllDealIds.set(email, new Set());
        emailToAllDealIds.get(email)!.add(d.id);
      }

      const expandedDealIds = new Set<string>(deals.map(d => d.id));
      for (const dealSet of emailToAllDealIds.values()) {
        for (const id of dealSet) expandedDealIds.add(id);
      }
      const allDealIds = Array.from(expandedDealIds);

      // 3. Fetch contracts (with offer_name), non-contract products, R1 meetings, partner products, CLS contracts
      const [contracts, nonContractProducts, r1Attendees, partnerTransactions, clsContracts] = await Promise.all([
        batchedIn<{ customer_email: string | null; sale_date: string; product_name: string | null; offer_name: string | null; linked_attendee_id: string | null }>(
          (chunk) =>
            supabase
              .from('hubla_transactions')
              .select('customer_email, sale_date, product_name, offer_name, linked_attendee_id')
              .in('customer_email', chunk)
              .in('product_category', ['contrato', 'incorporador'])
              .ilike('product_name', '%contrato%')
              .eq('sale_status', 'completed')
              .order('sale_date', { ascending: true }),
          uniqueEmails
        ),
        batchedIn<{ customer_email: string | null; sale_date: string; product_name: string | null }>(
          (chunk) =>
            supabase
              .from('hubla_transactions')
              .select('customer_email, sale_date, product_name')
              .in('customer_email', chunk)
              .not('product_name', 'ilike', '%contrato%')
              .eq('sale_status', 'completed')
              .order('sale_date', { ascending: false }),
          uniqueEmails
        ),
        batchedIn<{ deal_id: string | null; meeting_slots: { scheduled_at: string; meeting_type: string | null } }>(
          (chunk) =>
            supabase
              .from('meeting_slot_attendees')
              .select('deal_id, meeting_slots!inner(scheduled_at, meeting_type)')
              .in('deal_id', chunk)
              .eq('meeting_slots.meeting_type', 'r1') as any,
          allDealIds
        ),
        batchedIn<{ customer_email: string | null }>(
          (chunk) =>
            supabase
              .from('hubla_transactions')
              .select('customer_email')
              .in('customer_email', chunk)
              .eq('sale_status', 'completed')
              .or('product_name.ilike.%A001%,product_name.ilike.%A002%,product_name.ilike.%A003%,product_name.ilike.%A004%,product_name.ilike.%A009%,product_name.ilike.%INCORPORADOR%,product_name.ilike.%ANTICRISE%'),
          uniqueEmails
        ),
        // CLS contracts check
        batchedIn<{ customer_email: string | null }>(
          (chunk) =>
            supabase
              .from('hubla_transactions')
              .select('customer_email')
              .in('customer_email', chunk)
              .eq('sale_status', 'completed')
              .ilike('offer_name', 'Contrato CLS%'),
          uniqueEmails
        ),
      ]);

      // Build disqualification sets
      const partnerEmails = new Set<string>();
      for (const pt of partnerTransactions) {
        const email = pt.customer_email?.toLowerCase().trim();
        if (email) partnerEmails.add(email);
      }
      const clsEmails = new Set<string>();
      for (const c of clsContracts) {
        const email = c.customer_email?.toLowerCase().trim();
        if (email) clsEmails.add(email);
      }

      // 3b. Linked attendee → deal mapping
      const linkedAttendeeIds = contracts
        .map(c => c.linked_attendee_id)
        .filter((id): id is string => !!id);
      
      const linkedAttendeeDealMap = new Map<string, string>();
      if (linkedAttendeeIds.length > 0) {
        const attendeeResults = await batchedIn<{ id: string; deal_id: string | null }>(
          (chunk) =>
            supabase
              .from('meeting_slot_attendees')
              .select('id, deal_id')
              .in('id', chunk),
          linkedAttendeeIds
        );
        for (const a of attendeeResults) {
          if (a.deal_id) linkedAttendeeDealMap.set(a.id, a.deal_id);
        }
      }

      // 4. Build email → contracts (only outside-eligible offers)
      const contractsByEmail = new Map<string, { date: Date; productName: string | null; linkedDealId: string | null }[]>();
      for (const c of contracts) {
        const email = c.customer_email?.toLowerCase().trim();
        if (!email) continue;
        if (!isOutsideOffer(c.offer_name)) continue; // ONLY outside-eligible offers
        const saleDate = new Date(c.sale_date);
        const linkedDealId = c.linked_attendee_id ? (linkedAttendeeDealMap.get(c.linked_attendee_id) || null) : null;
        const existing = contractsByEmail.get(email) || [];
        existing.push({ date: saleDate, productName: c.product_name, linkedDealId });
        contractsByEmail.set(email, existing);
      }

      // 4b. Non-contract product name for display
      const nonContractProductName = new Map<string, string>();
      for (const p of nonContractProducts) {
        const email = p.customer_email?.toLowerCase().trim();
        if (!email || !p.product_name) continue;
        if (!nonContractProductName.has(email)) {
          nonContractProductName.set(email, p.product_name);
        }
      }

      // 5. Build dealId -> earliest R1
      const earliestR1 = new Map<string, Date>();
      for (const a of r1Attendees) {
        if (!a.deal_id) continue;
        const slot = a.meeting_slots as any;
        const scheduledAt = new Date(slot.scheduled_at);
        const existing = earliestR1.get(a.deal_id);
        if (!existing || scheduledAt < existing) {
          earliestR1.set(a.deal_id, scheduledAt);
        }
      }

      // 5b. Map R1s from sibling deals
      for (const [email, currentDealEntries] of emailToDealIds) {
        const allSiblingDealIds = emailToAllDealIds.get(email);
        if (!allSiblingDealIds) continue;
        let earliestR1ForEmail: Date | undefined;
        for (const siblingId of allSiblingDealIds) {
          const r1Date = earliestR1.get(siblingId);
          if (r1Date && (!earliestR1ForEmail || r1Date < earliestR1ForEmail)) {
            earliestR1ForEmail = r1Date;
          }
        }
        if (!earliestR1ForEmail) continue;
        for (const entry of currentDealEntries) {
          const existing = earliestR1.get(entry.dealId);
          if (!existing || earliestR1ForEmail < existing) {
            earliestR1.set(entry.dealId, earliestR1ForEmail);
          }
        }
      }

      // 6. Determine Outside
      for (const [email, dealEntries] of emailToDealIds) {
        // Skip partners and CLS emails
        if (partnerEmails.has(email) || clsEmails.has(email)) continue;

        const emailContracts = contractsByEmail.get(email);
        if (!emailContracts || emailContracts.length === 0) continue;

        const displayName = nonContractProductName.get(email) || emailContracts[0].productName;

        const hasLinkedContracts = emailContracts.some(c => c.linkedDealId !== null);

        for (const entry of dealEntries) {
          const relevantContracts = emailContracts.filter(c => {
            if (hasLinkedContracts && !c.linkedDealId) return false;
            if (!c.linkedDealId) return true;
            return c.linkedDealId === entry.dealId;
          });

          if (relevantContracts.length === 0) continue;

          const earliestContract = relevantContracts.reduce((min, c) => c.date < min.date ? c : min, relevantContracts[0]);

          const r1Date = earliestR1.get(entry.dealId);
          if (!r1Date) {
            result.set(entry.dealId, { isOutside: true, productName: displayName });
          } else {
            const isOutside = earliestContract.date <= r1Date;
            if (isOutside) {
              result.set(entry.dealId, { isOutside: true, productName: displayName });
            }
          }
        }
      }

      return result;
    },
    enabled: deals.length > 0,
    staleTime: 60000,
    gcTime: 300000,
    placeholderData: (previousData) => previousData,
  });
};
