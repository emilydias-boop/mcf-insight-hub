import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// ==================== STAGES ====================

export const useCRMStages = (originOrGroupId?: string) => {
  return useQuery({
    queryKey: ['crm-stages', originOrGroupId],
    queryFn: async () => {
      if (!originOrGroupId) {
        // Sem filtro: buscar todas as stages do Clint
        const { data, error } = await supabase
          .from('crm_stages')
          .select('*')
          .eq('is_active', true)
          .order('stage_order');
        
        if (error) throw error;
        return data;
      }
      
      // 1. Verificar se é um grupo
      const { data: groupCheck } = await supabase
        .from('crm_groups')
        .select('id')
        .eq('id', originOrGroupId)
        .maybeSingle();
      
      const isGroup = !!groupCheck;
      
      // 2. Buscar stages locais primeiro (prioridade sobre Clint)
      const localStagesQuery = isGroup
        ? supabase
            .from('local_pipeline_stages')
            .select('*')
            .eq('group_id', originOrGroupId)
            .eq('is_active', true)
        : supabase
            .from('local_pipeline_stages')
            .select('*')
            .eq('origin_id', originOrGroupId)
            .eq('is_active', true);
      
      const { data: localStages, error: localError } = await localStagesQuery.order('stage_order');
      
      if (localError) {
        console.error('Erro ao buscar stages locais:', localError);
      }
      
      // Se tem stages locais, converter para formato compatível com crm_stages
      if (localStages && localStages.length > 0) {
        return localStages.map(s => ({
          id: s.id,
          stage_name: s.name,
          color: s.color,
          stage_order: s.stage_order,
          stage_type: s.stage_type,
          is_active: s.is_active,
          origin_id: s.origin_id || s.group_id,
          clint_id: `local-${s.id}`,
          created_at: s.created_at,
          updated_at: s.updated_at,
        }));
      }
      
      // 3. Fallback: buscar stages do Clint (crm_stages)
      if (isGroup) {
        // Se é grupo, buscar todas origens filhas
        const { data: childOrigins } = await supabase
          .from('crm_origins')
          .select('id')
          .eq('group_id', originOrGroupId);
        
        const originIds = childOrigins?.map(o => o.id) || [];
        
        if (originIds.length > 0) {
          const { data, error } = await supabase
            .from('crm_stages')
            .select('*')
            .in('origin_id', originIds)
            .eq('is_active', true)
            .order('stage_order');
          
          if (error) throw error;
          
          // Remover duplicatas por nome (manter primeiro por stage_order)
          const uniqueStages = data?.reduce((acc, stage) => {
            if (!acc.find(s => s.stage_name === stage.stage_name)) {
              acc.push(stage);
            }
            return acc;
          }, [] as typeof data) || [];
          
          return uniqueStages;
        }
        
        return [];
      }
      
      // Origem normal
      const { data, error } = await supabase
        .from('crm_stages')
        .select('*')
        .eq('origin_id', originOrGroupId)
        .eq('is_active', true)
        .order('stage_order');
      
      if (error) throw error;
      return data;
    },
  });
};

// ==================== ORIGINS ====================

interface Group {
  id: string;
  name: string;
  children: Origin[];
}

interface Origin {
  id: string;
  name: string;
  group_id?: string | null;
  contact_count?: number;
}

// Função para construir árvore de origens agrupadas
const buildOriginTree = (origins: any[], groups: any[]): Group[] => {
  // Criar mapa de grupos
  const groupsMap = new Map<string, Group>();
  groups.forEach(g => {
    groupsMap.set(g.id, { ...g, children: [] });
  });
  
  // Coletar origens sem grupo
  const ungroupedOrigins: Origin[] = [];
  
  // Adicionar origins aos seus grupos ou à lista de sem grupo
  origins.forEach(origin => {
    if (origin.group_id && groupsMap.has(origin.group_id)) {
      groupsMap.get(origin.group_id)!.children.push(origin);
    } else if (!origin.group_id) {
      ungroupedOrigins.push(origin);
    }
  });
  
  // Construir resultado com grupos que têm origins
  const result = Array.from(groupsMap.values()).filter(g => g.children.length > 0);
  
  // Adicionar grupo virtual "Sem Grupo" se houver origens órfãs
  if (ungroupedOrigins.length > 0) {
    result.push({
      id: '__ungrouped__',
      name: 'Sem Grupo',
      children: ungroupedOrigins
    });
  }
  
  return result;
};

export const useCRMOrigins = () => {
  return useQuery({
    queryKey: ['crm-origins-with-groups'],
    queryFn: async () => {
      const [originsRes, groupsRes] = await Promise.all([
        supabase.from('crm_origins').select('*').order('name'),
        supabase.from('crm_groups').select('*').order('name')
      ]);
      
      if (originsRes.error) throw originsRes.error;
      if (groupsRes.error) throw groupsRes.error;
      
      return buildOriginTree(originsRes.data || [], groupsRes.data || []);
    },
  });
};

// ==================== CONTACTS ====================

export const useCRMContacts = (originId?: string) => {
  return useQuery({
    queryKey: ['crm-contacts', originId],
    queryFn: async () => {
      let query = supabase
        .from('crm_contacts')
        .select('*, crm_origins(name)')
        .order('created_at', { ascending: false });
      
      if (originId) {
        query = query.eq('origin_id', originId);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data;
    },
  });
};

// Hook com informações de deals/stages para listagem
export const useCRMContactsWithDeals = () => {
  return useQuery({
    queryKey: ['crm-contacts-with-deals'],
    queryFn: async () => {
      const { data: contacts, error } = await supabase
        .from('crm_contacts')
        .select(`
          *,
          crm_origins(name),
          crm_deals(
            id,
            name,
            stage_id,
            origin_id,
            created_at,
            crm_stages(stage_name, color),
            crm_origins(name)
          )
        `)
        .order('created_at', { ascending: false })
        .limit(500);
      
      if (error) throw error;
      return contacts;
    },
  });
};

export const useCRMContact = (id: string) => {
  return useQuery({
    queryKey: ['crm-contact', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_contacts')
        .select('*, crm_origins(name)')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
};

export const useCreateCRMContact = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (contact: any) => {
      const { data, error } = await supabase
        .from('crm_contacts')
        .insert([contact as any])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-contacts'] });
      toast.success('Contato criado com sucesso');
    },
    onError: (error: any) => {
      toast.error(`Erro ao criar contato: ${error.message}`);
    },
  });
};

export const useUpdateCRMContact = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...contact }: any) => {
      const { data, error } = await supabase
        .from('crm_contacts')
        .update(contact as any)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-contacts'] });
      toast.success('Contato atualizado com sucesso');
    },
    onError: (error: any) => {
      toast.error(`Erro ao atualizar contato: ${error.message}`);
    },
  });
};

// ==================== DEALS ====================

interface DealFilters {
  originId?: string;
  stageId?: string;
  contactId?: string;
  ownerId?: string;
  searchTerm?: string;
  limit?: number;
}

export const useCRMDeals = (filters: DealFilters = {}) => {
  return useQuery({
    queryKey: ['crm-deals', filters],
    queryFn: async () => {
      const limit = filters.limit || 5000;
      
      let originIds: string[] = [];
      
      // Verificar se originId é um grupo (não uma origem)
      if (filters.originId) {
        // Primeiro, verificar se é um group_id
        const { data: groupCheck } = await supabase
          .from('crm_groups')
          .select('id')
          .eq('id', filters.originId)
          .maybeSingle();
        
        if (groupCheck) {
          // É um grupo! Buscar todas as origens filhas
          const { data: childOrigins } = await supabase
            .from('crm_origins')
            .select('id')
            .eq('group_id', filters.originId);
          
          originIds = childOrigins?.map(o => o.id) || [];
        } else {
          // É uma origem normal
          originIds = [filters.originId];
        }
      }
      
      let query = supabase
        .from('crm_deals')
        .select(`
          *,
          crm_contacts(name, email, phone),
          crm_origins(name),
          crm_stages(stage_name, color)
        `)
        .order('created_at', { ascending: false })
        .limit(limit);
      
      // Aplicar filtro de origens
      if (originIds.length > 0) {
        query = query.in('origin_id', originIds);
      }
      
      if (filters.stageId) query = query.eq('stage_id', filters.stageId);
      if (filters.contactId) query = query.eq('contact_id', filters.contactId);
      // Usar owner_profile_id (UUID) em vez de owner_id (email)
      if (filters.ownerId) query = query.eq('owner_profile_id', filters.ownerId);
      // Note: searchTerm filtering is done on the frontend (Negocios.tsx)
      // to search across deal.name, contact.name, email, and phone
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data;
    },
  });
};

export const useCRMDeal = (id: string) => {
  return useQuery({
    queryKey: ['crm-deal', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_deals')
        .select(`
          *,
          crm_contacts(name, email, phone),
          crm_origins(name),
          crm_stages(stage_name, color, stage_order)
        `)
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
};

// Hook para paginação infinita de deals
interface InfiniteDealsFilters {
  originId?: string;
  stageId?: string;
  searchTerm?: string;
  pageSize?: number;
}

export const useCRMDealsInfinite = (filters: InfiniteDealsFilters = {}) => {
  const pageSize = filters.pageSize || 100;
  
  return useInfiniteQuery({
    queryKey: ['crm-deals-infinite', filters],
    queryFn: async ({ pageParam = 0 }) => {
      let query = supabase
        .from('crm_deals')
        .select(`
          *,
          crm_contacts(name, email, phone),
          crm_origins(name),
          crm_stages(stage_name, color)
        `)
        .order('created_at', { ascending: false })
        .range(pageParam, pageParam + pageSize - 1);
      
      if (filters.originId) query = query.eq('origin_id', filters.originId);
      if (filters.stageId) query = query.eq('stage_id', filters.stageId);
      if (filters.searchTerm) query = query.ilike('name', `%${filters.searchTerm}%`);
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      return {
        data: data || [],
        nextOffset: data && data.length === pageSize ? pageParam + pageSize : undefined
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextOffset,
    initialPageParam: 0,
  });
};

export const useCreateCRMDeal = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (deal: any) => {
      const { data, error } = await supabase
        .from('crm_deals')
        .insert([deal as any])
        .select()
        .single();
      
      if (error) throw error;
      
      // Generate tasks automatically for the initial stage
      if (data.stage_id && data.origin_id) {
        try {
          const { generateTasksForStage } = await import('./useStageTaskGeneration');
          await generateTasksForStage(
            data.id,
            data.stage_id,
            data.origin_id,
            data.owner_id,
            data.contact_id
          );
        } catch (taskError) {
          console.error('Error generating initial tasks:', taskError);
          // Don't fail the deal creation if task generation fails
        }
      }
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-deals'] });
      queryClient.invalidateQueries({ queryKey: ['deal-tasks'] });
      toast.success('Negócio criado com sucesso');
    },
    onError: (error: any) => {
      toast.error(`Erro ao criar negócio: ${error.message}`);
    },
  });
};

export const useUpdateCRMDeal = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, previousStageId, ...deal }: any) => {
      // First, update the deal
      const { data, error } = await supabase
        .from('crm_deals')
        .update(deal)
        .eq('id', id)
        .select(`
          *,
          crm_contacts(id, name, email, phone)
        `)
        .single();
      
      if (error) throw error;
      
      // Check if stage changed and generate tasks
      if (deal.stage_id && previousStageId !== deal.stage_id && data.origin_id) {
        // Import dynamically to avoid circular dependencies
        const { handleStageChange } = await import('./useStageTaskGeneration');
        await handleStageChange(
          id,
          previousStageId,
          deal.stage_id,
          data.origin_id,
          data.owner_id,
          data.contact_id
        );
      }
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-deals'] });
      queryClient.invalidateQueries({ queryKey: ['deal-tasks'] });
      toast.success('Negócio atualizado com sucesso');
    },
    onError: (error: any) => {
      toast.error(`Erro ao atualizar negócio: ${error.message}`);
    },
  });
};

export const useDeleteCRMDeal = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('crm_deals')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-deals'] });
      toast.success('Negócio excluído com sucesso');
    },
    onError: (error: any) => {
      toast.error(`Erro ao excluir negócio: ${error.message}`);
    },
  });
};

// ==================== SYNC ====================

export const useSyncClintData = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('sync-clint-data', {
        body: {},
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-stages'] });
      queryClient.invalidateQueries({ queryKey: ['crm-origins'] });
      queryClient.invalidateQueries({ queryKey: ['crm-contacts'] });
      queryClient.invalidateQueries({ queryKey: ['crm-deals'] });
    },
  });
};
