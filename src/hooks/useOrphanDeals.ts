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

export interface OrphanDealsFilters {
  origin_id?: string;
  data_source?: string;
  has_suggestion?: boolean | null;
  date_from?: string;
  date_to?: string;
  min_value?: number;
  search?: string;
  page?: number;
  per_page?: number;
}

export interface OrphanDealsResult {
  deals: OrphanDeal[];
  total: number;
  totalWithSuggestion: number;
  totalWithoutSuggestion: number;
}

export function useOrphanDeals(filters: OrphanDealsFilters = {}) {
  const { page = 1, per_page = 50 } = filters;

  return useQuery({
    queryKey: ['orphan-deals', filters],
    queryFn: async (): Promise<OrphanDealsResult> => {
      // Primeiro buscar contagem total
      let countQuery = supabase
        .from('crm_deals')
        .select('id', { count: 'exact', head: true })
        .is('owner_id', null);

      const { count: total } = await countQuery;

      // Construir query principal com filtros
      let query = supabase
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

      // Aplicar filtros
      if (filters.origin_id) {
        query = query.eq('origin_id', filters.origin_id);
      }
      if (filters.data_source) {
        query = query.eq('data_source', filters.data_source);
      }
      if (filters.date_from) {
        query = query.gte('created_at', filters.date_from);
      }
      if (filters.date_to) {
        query = query.lte('created_at', filters.date_to + 'T23:59:59');
      }
      if (filters.min_value !== undefined && filters.min_value > 0) {
        query = query.gte('value', filters.min_value);
      }
      if (filters.search) {
        query = query.ilike('name', `%${filters.search}%`);
      }

      // Aplicar paginação
      const from = (page - 1) * per_page;
      const to = from + per_page - 1;
      query = query.range(from, to);

      const { data: deals, error } = await query;

      if (error) throw error;

      // Coletar emails únicos para buscar sugestões de owner
      const emailsSet = new Set<string>();
      (deals || []).forEach((deal: any) => {
        if (deal.crm_contacts?.email) {
          emailsSet.add(deal.crm_contacts.email.toLowerCase());
        }
      });
      const emails = Array.from(emailsSet);

      // Buscar owners de deals onde contatos têm os mesmos emails
      const ownerByEmail = new Map<string, string>();
      
      if (emails.length > 0) {
        const { data: dealsWithOwners } = await supabase
          .from('crm_deals')
          .select(`
            owner_id,
            crm_contacts!crm_deals_contact_id_fkey (
              email
            )
          `)
          .not('owner_id', 'is', null)
          .not('contact_id', 'is', null);

        dealsWithOwners?.forEach((d: any) => {
          const email = d.crm_contacts?.email?.toLowerCase();
          if (email && d.owner_id && !ownerByEmail.has(email)) {
            ownerByEmail.set(email, d.owner_id);
          }
        });
      }

      // Mapear deals com sugestões
      const mappedDeals: OrphanDeal[] = (deals || []).map((deal: any) => {
        const contactEmail = deal.crm_contacts?.email?.toLowerCase();
        const suggestedOwner = contactEmail ? ownerByEmail.get(contactEmail) || null : null;

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
      });

      // Filtrar por has_suggestion se especificado
      let filteredDeals = mappedDeals;
      if (filters.has_suggestion === true) {
        filteredDeals = mappedDeals.filter(d => d.suggested_owner);
      } else if (filters.has_suggestion === false) {
        filteredDeals = mappedDeals.filter(d => !d.suggested_owner);
      }

      const totalWithSuggestion = mappedDeals.filter(d => d.suggested_owner).length;
      const totalWithoutSuggestion = mappedDeals.filter(d => !d.suggested_owner).length;

      return {
        deals: filteredDeals,
        total: total || 0,
        totalWithSuggestion,
        totalWithoutSuggestion,
      };
    },
  });
}

export function useAssignDealOwner() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ dealIds, ownerId, ownerProfileId }: { 
      dealIds: string[]; 
      ownerId: string; 
      ownerProfileId?: string;
    }) => {
      const updateData: Record<string, unknown> = { 
        owner_id: ownerId, 
        updated_at: new Date().toISOString() 
      };
      
      if (ownerProfileId) {
        updateData.owner_profile_id = ownerProfileId;
      }
      
      const { error } = await supabase
        .from('crm_deals')
        .update(updateData)
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

export function useDeleteZeroValueDeals() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from('crm_deals')
        .delete()
        .is('owner_id', null)
        .or('value.is.null,value.eq.0')
        .select('id');

      if (error) throw error;
      return data?.length || 0;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['orphan-deals'] });
      toast.success(`${count} deals com valor zero excluídos`);
    },
    onError: (error: any) => {
      toast.error(`Erro ao excluir deals: ${error.message}`);
    },
  });
}

export function useMergeDuplicateContacts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dryRun: boolean = true) => {
      const { data, error } = await supabase.functions.invoke('merge-duplicate-contacts', {
        body: { dry_run: dryRun, limit: 100 },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['orphan-deals'] });
      queryClient.invalidateQueries({ queryKey: ['crm-contacts'] });
      if (data?.dry_run) {
        toast.info(`Simulação: ${data?.would_merge || 0} contatos seriam unificados`);
      } else {
        toast.success(`${data?.merged || 0} contatos unificados com sucesso`);
      }
    },
    onError: (error: any) => {
      toast.error(`Erro ao unificar contatos: ${error.message}`);
    },
  });
}
