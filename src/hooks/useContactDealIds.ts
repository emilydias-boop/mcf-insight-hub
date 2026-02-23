import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Given a dealId (UUID), resolves the contact_id and fetches ALL deal IDs
 * for that same contact across all pipelines.
 * 
 * Fallback logic when contact_id is NULL:
 * 1. Try replicated_from_deal_id chain
 * 2. Try matching contact by deal name
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
          .select('contact_id, replicated_from_deal_id, name')
          .eq('id', dealId)
          .maybeSingle();
        
        resolvedContactId = deal?.contact_id;

        // Fallback 1: follow replicated_from_deal_id chain
        if (!resolvedContactId && deal?.replicated_from_deal_id) {
          const { data: sourceDeal } = await supabase
            .from('crm_deals')
            .select('contact_id')
            .eq('id', deal.replicated_from_deal_id)
            .maybeSingle();
          resolvedContactId = sourceDeal?.contact_id;
        }

        // Fallback 2: match by deal name - handle duplicates
        if (!resolvedContactId && deal?.name) {
          const { data: contacts } = await supabase
            .from('crm_contacts')
            .select('id')
            .ilike('name', deal.name.trim());
          
          if (contacts?.length === 1) {
            resolvedContactId = contacts[0].id;
          } else if (contacts && contacts.length > 1) {
            // Multiple contacts with same name - find which has deals
            const contactIds = contacts.map(c => c.id);
            const { data: dealsForContacts } = await supabase
              .from('crm_deals')
              .select('contact_id')
              .in('contact_id', contactIds)
              .limit(1);
            resolvedContactId = dealsForContacts?.[0]?.contact_id || contacts[0].id;
          }
        }
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
      // Ensure the current dealId is always included
      if (dealId) ids.add(dealId);
      return Array.from(ids);
    },
    enabled: !!dealId || !!contactId,
    staleTime: 60000,
  });
}
