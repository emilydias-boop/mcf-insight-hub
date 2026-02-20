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
    queryFn: async (): Promise<Map<string, boolean>> => {
      const result = new Map<string, boolean>();
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

      // 2. Collect unique deal IDs for R1 meeting lookup
      const dealIds = deals.map(d => d.id);

      // 3. Fetch contract transactions AND R1 meetings in parallel
      const [contracts, r1Attendees] = await Promise.all([
        // Contracts (existing logic)
        batchedIn<{ customer_email: string | null; sale_date: string }>(
          (chunk) =>
            supabase
              .from('hubla_transactions')
              .select('customer_email, sale_date')
              .in('customer_email', chunk)
              .ilike('product_name', '%Contrato%')
              .eq('sale_status', 'completed')
              .order('sale_date', { ascending: true }),
          uniqueEmails
        ),
        // R1 meetings by deal_id
        batchedIn<{ deal_id: string | null; meeting_slots: { scheduled_at: string; meeting_type: string | null } }>(
          (chunk) =>
            supabase
              .from('meeting_slot_attendees')
              .select('deal_id, meeting_slots!inner(scheduled_at, meeting_type)')
              .in('deal_id', chunk)
              .eq('meeting_slots.meeting_type', 'r1') as any,
          dealIds
        ),
      ]);

      // 4. Build email -> earliest contract date
      const earliestContract = new Map<string, Date>();
      for (const c of contracts) {
        const email = c.customer_email?.toLowerCase().trim();
        if (!email) continue;
        const saleDate = new Date(c.sale_date);
        const existing = earliestContract.get(email);
        if (!existing || saleDate < existing) {
          earliestContract.set(email, saleDate);
        }
      }

      // 5. Build dealId -> earliest R1 scheduled_at
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

      // 6. Determine Outside: has contract AND (no R1 OR contract <= R1)
      for (const [email, dealEntries] of emailToDealIds) {
        const contractDate = earliestContract.get(email);
        if (!contractDate) continue; // No contract = not outside

        for (const entry of dealEntries) {
          const r1Date = earliestR1.get(entry.dealId);
          if (!r1Date) {
            // Has contract but no R1 meeting -> Outside
            result.set(entry.dealId, true);
          } else {
            // Has contract and R1 -> Outside if contract was paid before/on R1
            result.set(entry.dealId, contractDate <= r1Date);
          }
        }
      }

      return result;
    },
    enabled: deals.length > 0,
    staleTime: 60000,
    gcTime: 300000,
  });
};
