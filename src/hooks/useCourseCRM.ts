import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CourseCRMData {
  contact_id: string | null;
  contact_name: string | null;
  deal_id: string | null;
  deal_name: string | null;
  stage_name: string | null;
  stage_color: string | null;
  origin_name: string | null;
}

export const useCourseCRM = (email: string | null) => {
  return useQuery({
    queryKey: ['course-crm', email],
    queryFn: async () => {
      if (!email) return null;

      const { data, error } = await supabase
        .from('crm_contacts')
        .select(`
          id,
          name,
          crm_deals!crm_deals_contact_id_fkey (
            id,
            name,
            stage_id,
            crm_stages!crm_deals_stage_id_fkey (
              stage_name,
              color
            ),
            origin_id,
            crm_origins!crm_deals_origin_id_fkey (
              name
            )
          )
        `)
        .ilike('email', email)
        .limit(1)
        .single();

      if (error || !data) return null;

      const deal = data.crm_deals?.[0];
      const stage = deal?.crm_stages;
      const origin = deal?.crm_origins;

      return {
        contact_id: data.id,
        contact_name: data.name,
        deal_id: deal?.id || null,
        deal_name: deal?.name || null,
        stage_name: stage?.stage_name || null,
        stage_color: stage?.color || null,
        origin_name: origin?.name || null,
      } as CourseCRMData;
    },
    enabled: !!email,
    refetchInterval: 60000,
  });
};
