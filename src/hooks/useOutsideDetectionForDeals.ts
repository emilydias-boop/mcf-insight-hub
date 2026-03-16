import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface DealForOutsideCheck {
  id: string;
  created_at?: string;
  crm_contacts?: {
    email?: string | null;
  } | null;
}

/**
 * Executes a Supabase .in() query in batches to avoid URL length limits.
 */
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

/**
 * Hook to detect "Outside" deals in the Kanban board.
 * A deal is "Outside" if its contact has a completed contract transaction
 * (hubla_transactions with product_name ILIKE '%Contrato%') AND either:
 *   - No R1 meeting exists for that deal, OR
 *   - The contract sale_date is <= the earliest R1 meeting scheduled_at
 *
 * Returns a Map<dealId, boolean>.
 */
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

      // Build email -> all deal_ids map (including sibling deals from other pipelines)
      const emailToAllDealIds = new Map<string, Set<string>>();
      for (const d of allDealsForEmails) {
        const email = (d.crm_contacts as any)?.email?.toLowerCase().trim();
        if (!email) continue;
        if (!emailToAllDealIds.has(email)) emailToAllDealIds.set(email, new Set());
        emailToAllDealIds.get(email)!.add(d.id);
      }

      // Expanded deal IDs: current deals + all sibling deals from same contacts
      const expandedDealIds = new Set<string>(deals.map(d => d.id));
      for (const dealSet of emailToAllDealIds.values()) {
        for (const id of dealSet) expandedDealIds.add(id);
      }
      const allDealIds = Array.from(expandedDealIds);

      // 3. Fetch contract transactions, non-contract products, R1 meetings, AND partner transactions in parallel
      const [contracts, nonContractProducts, r1Attendees, partnerTransactions] = await Promise.all([
        // Contracts (for outside detection) - now also fetch linked_attendee_id
        batchedIn<{ customer_email: string | null; sale_date: string; product_name: string | null; linked_attendee_id: string | null }>(
          (chunk) =>
            supabase
              .from('hubla_transactions')
              .select('customer_email, sale_date, product_name, linked_attendee_id')
              .in('customer_email', chunk)
              .in('product_category', ['contrato', 'incorporador'])
              .ilike('product_name', '%contrato%')
              .eq('sale_status', 'completed')
              .order('sale_date', { ascending: true }),
          uniqueEmails
        ),
        // Non-contract products (partnership/course names to display)
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
        // R1 meetings by expanded deal_ids (includes sibling deals from other pipelines)
        batchedIn<{ deal_id: string | null; meeting_slots: { scheduled_at: string; meeting_type: string | null } }>(
          (chunk) =>
            supabase
              .from('meeting_slot_attendees')
              .select('deal_id, meeting_slots!inner(scheduled_at, meeting_type)')
              .in('deal_id', chunk)
              .eq('meeting_slots.meeting_type', 'r1') as any,
          allDealIds
        ),
        // Partner products: detect emails that already bought partnership products
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
      ]);

      // Build set of partner emails (those who bought non-contract, non-ignored products)
      const partnerEmails = new Set<string>();
      for (const pt of partnerTransactions) {
        const email = pt.customer_email?.toLowerCase().trim();
        if (email) partnerEmails.add(email);
      }

      // 3b. Now fetch the deal_ids for linked_attendee_ids from contracts
      const linkedAttendeeIds = contracts
        .map(c => c.linked_attendee_id)
        .filter((id): id is string => !!id);
      
      const linkedAttendeeDealMap = new Map<string, string>(); // attendee_id -> deal_id
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
          if (a.deal_id) {
            linkedAttendeeDealMap.set(a.id, a.deal_id);
          }
        }
      }

      // 4. Build email -> earliest contract date + product name
      //    BUT skip contracts that are linked to a specific deal (via linked_attendee_id)
      //    We'll handle the linked logic per-deal in step 6
      const contractsByEmail = new Map<string, { date: Date; productName: string | null; linkedDealId: string | null }[]>();
      for (const c of contracts) {
        const email = c.customer_email?.toLowerCase().trim();
        if (!email) continue;
        const saleDate = new Date(c.sale_date);
        const linkedDealId = c.linked_attendee_id ? (linkedAttendeeDealMap.get(c.linked_attendee_id) || null) : null;
        const existing = contractsByEmail.get(email) || [];
        existing.push({ date: saleDate, productName: c.product_name, linkedDealId });
        contractsByEmail.set(email, existing);
      }

      // 4b. Build email -> most recent non-contract product name
      const nonContractProductName = new Map<string, string>();
      for (const p of nonContractProducts) {
        const email = p.customer_email?.toLowerCase().trim();
        if (!email || !p.product_name) continue;
        if (!nonContractProductName.has(email)) {
          nonContractProductName.set(email, p.product_name);
        }
      }

      // 5. Build dealId -> earliest R1 scheduled_at (across all pipelines)
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

      // 5b. Map R1s from sibling deals back to current deals via email
      //     If a sibling deal has an R1, the current deal should also "see" it
      for (const [email, currentDealEntries] of emailToDealIds) {
        const allSiblingDealIds = emailToAllDealIds.get(email);
        if (!allSiblingDealIds) continue;

        // Find earliest R1 across ALL deals for this email
        let earliestR1ForEmail: Date | undefined;
        for (const siblingId of allSiblingDealIds) {
          const r1Date = earliestR1.get(siblingId);
          if (r1Date && (!earliestR1ForEmail || r1Date < earliestR1ForEmail)) {
            earliestR1ForEmail = r1Date;
          }
        }

        if (!earliestR1ForEmail) continue;

        // Apply to all current deals for this email
        for (const entry of currentDealEntries) {
          const existing = earliestR1.get(entry.dealId);
          if (!existing || earliestR1ForEmail < existing) {
            earliestR1.set(entry.dealId, earliestR1ForEmail);
          }
        }
      }

      // 6. Determine Outside: has contract AND (no R1 OR contract <= R1)
      //    NEW: Skip partners (emails that bought A001, A009, etc.) — they are NOT outside
      //    NEW: Skip contracts that are linked to a DIFFERENT deal's attendee
      for (const [email, dealEntries] of emailToDealIds) {
        // Skip partners entirely — their contract is a legitimate sale, not "outside"
        if (partnerEmails.has(email)) continue;

        const emailContracts = contractsByEmail.get(email);
        if (!emailContracts || emailContracts.length === 0) continue;

        const displayName = nonContractProductName.get(email) || emailContracts[0].productName;

        // If there are linked contracts, ignore unlinked ones (they're duplicates/orphans)
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
