import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { CreditProduct, CreditStage, CreditDeal, CreditPartner, CreditClient, CreditDealActivity } from '@/types/credito';

// Products
export function useCreditProducts() {
  return useQuery({
    queryKey: ['credit-products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('credit_products')
        .select('*')
        .eq('is_active', true)
        .order('display_order');
      if (error) throw error;
      return data as CreditProduct[];
    },
  });
}

// Stages by product
export function useCreditStages(productId?: string) {
  return useQuery({
    queryKey: ['credit-stages', productId],
    queryFn: async () => {
      let query = supabase.from('credit_stages').select('*').order('stage_order');
      if (productId) {
        query = query.eq('product_id', productId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as CreditStage[];
    },
  });
}

// Deals
export function useCreditDeals(productId?: string) {
  return useQuery({
    queryKey: ['credit-deals', productId],
    queryFn: async () => {
      let query = supabase
        .from('credit_deals')
        .select(`
          *,
          product:credit_products(*),
          stage:credit_stages(*),
          client:credit_clients(*),
          partner:credit_partners(*)
        `)
        .order('created_at', { ascending: false });
      
      if (productId) {
        query = query.eq('product_id', productId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as CreditDeal[];
    },
  });
}

export function useCreditDeal(id: string) {
  return useQuery({
    queryKey: ['credit-deal', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('credit_deals')
        .select(`
          *,
          product:credit_products(*),
          stage:credit_stages(*),
          client:credit_clients(*),
          partner:credit_partners(*)
        `)
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as CreditDeal;
    },
    enabled: !!id,
  });
}

export function useCreateCreditDeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (deal: Partial<CreditDeal>) => {
      const { data, error } = await supabase
        .from('credit_deals')
        .insert(deal as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit-deals'] });
    },
  });
}

export function useUpdateCreditDeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...deal }: Partial<CreditDeal> & { id: string }) => {
      const { data, error } = await supabase
        .from('credit_deals')
        .update(deal)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['credit-deals'] });
      queryClient.invalidateQueries({ queryKey: ['credit-deal', variables.id] });
    },
  });
}

export function useDeleteCreditDeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('credit_deals')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit-deals'] });
    },
  });
}

// Partners
export function useCreditPartners() {
  return useQuery({
    queryKey: ['credit-partners'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('credit_partners')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as CreditPartner[];
    },
  });
}

export function useCreditPartner(id: string) {
  return useQuery({
    queryKey: ['credit-partner', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('credit_partners')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as CreditPartner;
    },
    enabled: !!id,
  });
}

export function useCreateCreditPartner() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (partner: Partial<CreditPartner>) => {
      const { data, error } = await supabase
        .from('credit_partners')
        .insert(partner as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit-partners'] });
    },
  });
}

export function useUpdateCreditPartner() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...partner }: Partial<CreditPartner> & { id: string }) => {
      const { data, error } = await supabase
        .from('credit_partners')
        .update(partner)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['credit-partners'] });
      queryClient.invalidateQueries({ queryKey: ['credit-partner', variables.id] });
    },
  });
}

// Clients
export function useCreditClients() {
  return useQuery({
    queryKey: ['credit-clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('credit_clients')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as CreditClient[];
    },
  });
}

// Deal Activities
export function useCreditDealActivities(dealId: string) {
  return useQuery({
    queryKey: ['credit-deal-activities', dealId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('credit_deal_activities')
        .select('*')
        .eq('deal_id', dealId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as CreditDealActivity[];
    },
    enabled: !!dealId,
  });
}

// KPIs
export function useCreditKPIs() {
  return useQuery({
    queryKey: ['credit-kpis'],
    queryFn: async () => {
      const { data: deals, error } = await supabase
        .from('credit_deals')
        .select(`
          *,
          stage:credit_stages(*)
        `);
      
      if (error) throw error;

      const totalDeals = deals?.length || 0;
      const totalSolicitado = deals?.reduce((sum, d) => sum + (d.valor_solicitado || 0), 0) || 0;
      const totalAprovado = deals?.reduce((sum, d) => sum + (d.valor_aprovado || 0), 0) || 0;
      const dealsPorProduto = deals?.reduce((acc, d) => {
        acc[d.product_id] = (acc[d.product_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};
      
      const ganhos = deals?.filter(d => d.stage?.is_won).length || 0;
      const perdidos = deals?.filter(d => d.stage?.is_final && !d.stage?.is_won).length || 0;

      return {
        totalDeals,
        totalSolicitado,
        totalAprovado,
        dealsPorProduto,
        ganhos,
        perdidos,
        taxaConversao: totalDeals > 0 ? (ganhos / totalDeals) * 100 : 0,
      };
    },
  });
}
