import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Given a dealId (UUID), resolves the contact_id and fetches ALL deal IDs
 * for that same contact across all pipelines.
 * This enables cross-pipeline data consolidation.
 */
export function useContactDealIds(dealId: string | undefined, contactId?: string | null) {
  return useQuery({
    queryKey: ['contact-deal-ids', dealId, contactId],
    queryFn: async (): Promise<string[]> => {
      let resolvedContactId = contactId;

      // If contactId not provided, resolve it from the deal
      if (!resolvedContactId && dealId) {
        const { data: deal } = await supabase
          .from('crm_deals')
          .select('contact_id')
          .eq('id', dealId)
          .maybeSingle();
        resolvedContactId = deal?.contact_id;
      }

      if (!resolvedContactId) return dealId ? [dealId] : [];

      // Fetch all deals for this contact
      const { data: deals } = await supabase
        .from('crm_deals')
        .select('id, clint_id')
        .eq('contact_id', resolvedContactId);

      if (!deals || deals.length === 0) return dealId ? [dealId] : [];

      // Return unique IDs (both UUID and clint_id for legacy compatibility)
      const ids = new Set<string>();
      for (const d of deals) {
        ids.add(d.id);
        if (d.clint_id) ids.add(d.clint_id);
      }
      return Array.from(ids);
    },
    enabled: !!dealId || !!contactId,
    staleTime: 60000, // Cache for 1 minute
  });
}
