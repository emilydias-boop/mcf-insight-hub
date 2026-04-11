import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { isOutsideOffer } from './outsideOfferConstants';

interface OutsideInfo {
  isOutside: boolean;
  contractDate: string | null;
}

interface AttendeeForCheck {
  id: string;
  email: string | null;
  meetingDate: string;
}

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

export const useOutsideDetectionBatch = (attendees: AttendeeForCheck[]) => {
  return useQuery({
    queryKey: ['outside-detection-batch', attendees.map(a => `${a.id}:${a.email}`).join(',')],
    queryFn: async (): Promise<Record<string, OutsideInfo>> => {
      if (!attendees.length) return {};

      const emails = [...new Set(
        attendees
          .map(a => a.email?.toLowerCase().trim())
          .filter((email): email is string => Boolean(email))
      )];

      if (!emails.length) return {};

      // Fetch contracts WITH offer_name, plus CLS/partner checks in parallel
      const [contracts, clsContracts, partnerTransactions] = await Promise.all([
        // Outside-eligible contracts
        batchedInOutside<{
          customer_email: string | null;
          sale_date: string;
          offer_name: string | null;
        }>(
          (chunk) => supabase
            .from('hubla_transactions')
            .select('customer_email, sale_date, offer_name')
            .in('customer_email', chunk)
            .in('product_category', ['contrato', 'incorporador'])
            .ilike('product_name', '%contrato%')
            .eq('sale_status', 'completed')
            .order('sale_date', { ascending: true }),
          emails
        ),
        // CLS contracts (disqualifies outside)
        batchedInOutside<{ customer_email: string | null }>(
          (chunk) => supabase
            .from('hubla_transactions')
            .select('customer_email')
            .in('customer_email', chunk)
            .eq('sale_status', 'completed')
            .ilike('offer_name', 'Contrato CLS%'),
          emails
        ),
        // Partner products (disqualifies outside)
        batchedInOutside<{ customer_email: string | null }>(
          (chunk) => supabase
            .from('hubla_transactions')
            .select('customer_email')
            .in('customer_email', chunk)
            .eq('sale_status', 'completed')
            .or('product_name.ilike.%A001%,product_name.ilike.%A002%,product_name.ilike.%A003%,product_name.ilike.%A004%,product_name.ilike.%A009%,product_name.ilike.%INCORPORADOR%,product_name.ilike.%ANTICRISE%'),
          emails
        ),
      ]);

      // Build disqualification sets
      const clsEmails = new Set(clsContracts.map(c => c.customer_email?.toLowerCase().trim()).filter(Boolean));
      const partnerEmails = new Set(partnerTransactions.map(c => c.customer_email?.toLowerCase().trim()).filter(Boolean));

      const result: Record<string, OutsideInfo> = {};

      for (const att of attendees) {
        const email = att.email?.toLowerCase().trim();
        if (!email) continue;

        // Disqualify: has CLS or partner products
        if (clsEmails.has(email) || partnerEmails.has(email)) continue;

        // Find earliest outside-eligible contract
        const outsideContract = contracts.find(
          c => c.customer_email?.toLowerCase().trim() === email && isOutsideOffer(c.offer_name)
        );

        if (outsideContract) {
          const contractDate = new Date(outsideContract.sale_date);
          const meetingDate = new Date(att.meetingDate);

          result[att.id] = {
            isOutside: contractDate < meetingDate,
            contractDate: outsideContract.sale_date
          };
        }
      }

      return result;
    },
    enabled: attendees.length > 0,
    staleTime: 60000,
    gcTime: 300000,
  });
};
