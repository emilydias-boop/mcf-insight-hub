import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// ==================== STAGES ====================

export const useCRMStages = (originId?: string, groupId?: string) => {
  return useQuery({
    queryKey: ['crm-stages', originId, groupId],
    queryFn: async () => {
      // Se temos um originId específico
      if (originId) {
        // Verificar se é uma origin ou um group
        const { data: origin } = await supabase
          .from('crm_origins')
          .select('id')
          .eq('id', originId)
          .maybeSingle();
        
        if (origin) {
          // É uma origin específica
          const { data, error } = await supabase
            .from('crm_stages')
            .select('*')
            .eq('origin_id', originId)
            .eq('is_active', true)
            .order('stage_order');
          
          if (error) throw error;
          return data;
        } else {
          // Pode ser um group_id - buscar estágios de todas origins do grupo
          const { data: originsInGroup } = await supabase
            .from('crm_origins')
            .select('id')
            .eq('group_id', originId);
          
          if (originsInGroup && originsInGroup.length > 0) {
            const { data, error } = await supabase
              .from('crm_stages')
              .select('*')
              .in('origin_id', originsInGroup.map(o => o.id))
              .eq('is_active', true)
              .order('stage_order');
            
            if (error) throw error;
            
            // Deduplicar por stage_name (manter o de menor stage_order)
            const stageMap = new Map();
            data.forEach((stage: any) => {
              if (!stageMap.has(stage.stage_name) || stage.stage_order < stageMap.get(stage.stage_name).stage_order) {
                stageMap.set(stage.stage_name, stage);
              }
            });
            return Array.from(stageMap.values()).sort((a, b) => a.stage_order - b.stage_order);
          }
        }
      }
      
      // Se temos um groupId explícito
      if (groupId) {
        const { data: originsInGroup } = await supabase
          .from('crm_origins')
          .select('id')
          .eq('group_id', groupId);
        
        if (originsInGroup && originsInGroup.length > 0) {
          const { data, error } = await supabase
            .from('crm_stages')
            .select('*')
            .in('origin_id', originsInGroup.map(o => o.id))
            .eq('is_active', true)
            .order('stage_order');
          
          if (error) throw error;
          
          // Deduplicar
          const stageMap = new Map();
          data.forEach((stage: any) => {
            if (!stageMap.has(stage.stage_name) || stage.stage_order < stageMap.get(stage.stage_name).stage_order) {
              stageMap.set(stage.stage_name, stage);
            }
          });
          return Array.from(stageMap.values()).sort((a, b) => a.stage_order - b.stage_order);
        }
      }
      
      // Sem filtro - buscar todos
      const { data, error } = await supabase
        .from('crm_stages')
        .select('*')
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
  groupId?: string; // Novo: buscar por grupo
}

export const useCRMDeals = (filters: DealFilters = {}) => {
  return useQuery({
    queryKey: ['crm-deals', filters],
    queryFn: async () => {
      let query = supabase
        .from('crm_deals')
        .select(`
          *,
          crm_contacts(name, email, phone),
          crm_origins(name, group_id),
          crm_stages(stage_name, color)
        `)
        .order('created_at', { ascending: false });
      
      // Se temos originId, verificar se é uma origin ou um group
      if (filters.originId) {
        // Primeiro, verificar se existe uma origin com esse ID
        const { data: origin } = await supabase
          .from('crm_origins')
          .select('id')
          .eq('id', filters.originId)
          .maybeSingle();
        
        if (origin) {
          // É uma origin específica
          query = query.eq('origin_id', filters.originId);
        } else {
          // Pode ser um group_id - buscar todas origins do grupo
          const { data: originsInGroup } = await supabase
            .from('crm_origins')
            .select('id')
            .eq('group_id', filters.originId);
          
          if (originsInGroup && originsInGroup.length > 0) {
            query = query.in('origin_id', originsInGroup.map(o => o.id));
          }
        }
      }
      
      if (filters.stageId) query = query.eq('stage_id', filters.stageId);
      if (filters.contactId) query = query.eq('contact_id', filters.contactId);
      if (filters.ownerId) query = query.eq('owner_id', filters.ownerId);
      
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
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-deals'] });
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
    mutationFn: async ({ id, ...deal }: any) => {
      const { data, error } = await supabase
        .from('crm_deals')
        .update(deal)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-deals'] });
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
