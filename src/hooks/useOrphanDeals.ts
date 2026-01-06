import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface OrphanDeal {
  id: string;
  name: string;
  value: number | null;
  created_at: string;
  contact_id: string | null;
  contact_name: string | null;
  contact_email: string | null;
  origin_id: string | null;
  origin_name: string | null;
  product_name: string | null;
  data_source: string | null;
  suggested_owner: string | null;
}

export function useOrphanDeals() {
  return useQuery({
    queryKey: ['orphan-deals'],
    queryFn: async (): Promise<OrphanDeal[]> => {
      // Buscar deals sem owner
      const { data: deals, error } = await supabase
        .from('crm_deals')
        .select(`
          id,
          name,
          value,
          created_at,
          contact_id,
          origin_id,
          product_name,
          data_source,
          crm_contacts!crm_deals_contact_id_fkey (
            name,
            email
          ),
          crm_origins!crm_deals_origin_id_fkey (
            name
          )
        `)
        .is('owner_id', null)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Para cada deal, buscar sugestão de owner (de outro deal do mesmo contato)
      const dealsWithSuggestions = await Promise.all(
        (deals || []).map(async (deal: any) => {
          let suggestedOwner: string | null = null;

          if (deal.contact_id) {
            const { data: existingDeal } = await supabase
              .from('crm_deals')
              .select('owner_id')
              .eq('contact_id', deal.contact_id)
              .not('owner_id', 'is', null)
              .limit(1)
              .maybeSingle();

            suggestedOwner = existingDeal?.owner_id || null;
          }

          return {
            id: deal.id,
            name: deal.name,
            value: deal.value,
            created_at: deal.created_at,
            contact_id: deal.contact_id,
            contact_name: deal.crm_contacts?.name || null,
            contact_email: deal.crm_contacts?.email || null,
            origin_id: deal.origin_id,
            origin_name: deal.crm_origins?.name || null,
            product_name: deal.product_name,
            data_source: deal.data_source,
            suggested_owner: suggestedOwner,
          };
        })
      );

      return dealsWithSuggestions;
    },
  });
}

export function useAssignDealOwner() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ dealIds, ownerId }: { dealIds: string[]; ownerId: string }) => {
      const { error } = await supabase
        .from('crm_deals')
        .update({ owner_id: ownerId, updated_at: new Date().toISOString() })
        .in('id', dealIds);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orphan-deals'] });
      queryClient.invalidateQueries({ queryKey: ['crm-deals'] });
      toast.success('Owner atribuído com sucesso');
    },
    onError: (error: any) => {
      toast.error(`Erro ao atribuir owner: ${error.message}`);
    },
  });
}

export function useApplySuggestedOwners() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('backfill-orphan-owners', {
        body: { dry_run: false },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['orphan-deals'] });
      queryClient.invalidateQueries({ queryKey: ['crm-deals'] });
      toast.success(`${data?.updated || 0} deals atualizados com sucesso`);
    },
    onError: (error: any) => {
      toast.error(`Erro ao aplicar sugestões: ${error.message}`);
    },
  });
}
