import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SdrDeal {
  id: string;
  name: string;
  value: number | null;
  stage_name: string | null;
  origin_name: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  created_at: string;
  updated_at: string;
}

export const useSdrDeals = (ownerEmail: string | undefined) => {
  return useQuery({
    queryKey: ['sdr-deals', ownerEmail],
    queryFn: async () => {
      if (!ownerEmail) return [];

      const { data, error } = await supabase
        .from('crm_deals')
        .select(`
          id,
          name,
          value,
          created_at,
          updated_at,
          crm_stages (stage_name),
          crm_origins (name, display_name),
          crm_contacts (name, phone, email)
        `)
        .eq('owner_id', ownerEmail)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      return (data || []).map((deal: any) => ({
        id: deal.id,
        name: deal.name,
        value: deal.value,
        stage_name: deal.crm_stages?.stage_name || null,
        origin_name: deal.crm_origins?.display_name || deal.crm_origins?.name || null,
        contact_name: deal.crm_contacts?.name || null,
        contact_phone: deal.crm_contacts?.phone || null,
        contact_email: deal.crm_contacts?.email || null,
        created_at: deal.created_at,
        updated_at: deal.updated_at,
      })) as SdrDeal[];
    },
    enabled: !!ownerEmail,
  });
};
