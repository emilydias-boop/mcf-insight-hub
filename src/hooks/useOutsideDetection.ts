import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface OutsideInfo {
  isOutside: boolean;
  contractDate: string | null;
}

interface AttendeeForCheck {
  id: string;
  email: string | null;
  meetingDate: string;
}

/**
 * Executes a Supabase .in() query in batches to avoid URL length limits.
 */
async function batchedInOutside<T>(
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
 * Batch hook to detect "Outside" leads - leads who purchased a contract BEFORE their first meeting (R1)
 * This is detected by comparing hubla_transactions.sale_date with the meeting scheduled_at date
 */
export const useOutsideDetectionBatch = (attendees: AttendeeForCheck[]) => {
  return useQuery({
    queryKey: ['outside-detection-batch', attendees.map(a => `${a.id}:${a.email}`).join(',')],
    queryFn: async (): Promise<Record<string, OutsideInfo>> => {
      if (!attendees.length) return {};

      // Get unique emails (lowercase, non-null)
      const emails = [...new Set(
        attendees
          .map(a => a.email?.toLowerCase().trim())
          .filter((email): email is string => Boolean(email))
      )];

      if (!emails.length) return {};

      // Fetch contract transactions for these emails (batched)
      const contracts = await batchedInOutside<{
        customer_email: string | null;
        sale_date: string;
        product_name: string | null;
        product_category: string | null;
      }>(
        (chunk) => supabase
          .from('hubla_transactions')
          .select('customer_email, sale_date, product_name, product_category')
          .in('customer_email', chunk)
          .in('product_category', ['contrato', 'incorporador'])
          .ilike('product_name', '%contrato%')
          .eq('sale_status', 'completed')
          .order('sale_date', { ascending: true }),
        emails
      );

      // Map result by attendee id
      const result: Record<string, OutsideInfo> = {};

      for (const att of attendees) {
        const email = att.email?.toLowerCase().trim();
        if (!email) continue;

        // Find the earliest contract for this email
        const contract = contracts?.find(
          c => c.customer_email?.toLowerCase().trim() === email
        );

        if (contract) {
          const contractDate = new Date(contract.sale_date);
          const meetingDate = new Date(att.meetingDate);

          // Outside = contract purchased BEFORE meeting
          result[att.id] = {
            isOutside: contractDate < meetingDate,
            contractDate: contract.sale_date
          };
        }
      }

      return result;
    },
    enabled: attendees.length > 0,
    staleTime: 60000, // 1 minute cache
    gcTime: 300000, // 5 minutes
  });
};
