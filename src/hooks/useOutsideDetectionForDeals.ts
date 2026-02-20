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
 * (hubla_transactions with product_name ILIKE '%Contrato%') with sale_date
 * BEFORE the deal's created_at date.
 *
 * Returns a Map<dealId, boolean>.
 */
export const useOutsideDetectionForDeals = (deals: DealForOutsideCheck[]) => {
  // Build a stable query key from deal ids + emails
  const keyParts = deals.map(d => `${d.id}:${d.crm_contacts?.email || ''}`).join(',');

  return useQuery({
    queryKey: ['outside-detection-deals', keyParts],
    queryFn: async (): Promise<Map<string, boolean>> => {
      const result = new Map<string, boolean>();
      if (!deals.length) return result;

      // Collect unique emails
      const emailToDealIds = new Map<string, { dealId: string; createdAt: string }[]>();
      for (const deal of deals) {
        const email = deal.crm_contacts?.email?.toLowerCase().trim();
        if (!email || !deal.created_at) continue;
        const existing = emailToDealIds.get(email) || [];
        existing.push({ dealId: deal.id, createdAt: deal.created_at });
        emailToDealIds.set(email, existing);
      }

      const uniqueEmails = Array.from(emailToDealIds.keys());
      if (!uniqueEmails.length) return result;

      // Fetch contract transactions (batched)
      const contracts = await batchedIn<{
        customer_email: string | null;
        sale_date: string;
      }>(
        (chunk) =>
          supabase
            .from('hubla_transactions')
            .select('customer_email, sale_date')
            .in('customer_email', chunk)
            .ilike('product_name', '%Contrato%')
            .eq('sale_status', 'completed')
            .order('sale_date', { ascending: true }),
        uniqueEmails
      );

      // Build email -> earliest contract date map
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

      // Compare: Outside = contract sale_date < deal created_at
      for (const [email, dealEntries] of emailToDealIds) {
        const contractDate = earliestContract.get(email);
        for (const entry of dealEntries) {
          if (contractDate) {
            const dealDate = new Date(entry.createdAt);
            result.set(entry.dealId, contractDate < dealDate);
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
