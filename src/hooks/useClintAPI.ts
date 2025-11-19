import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ClintAPIRequest, ClintAPIResponse } from '@/types/clint-crm';
import { toast } from 'sonner';

const callClintAPI = async <T>(request: ClintAPIRequest): Promise<T> => {
  const { data, error } = await supabase.functions.invoke('clint-api', {
    body: request,
  });

  if (error) {
    console.error('Erro ao chamar API Clint:', error);
    throw error;
  }

  return data;
};

// Contacts
export const useClintContacts = (params?: Record<string, string>) => {
  return useQuery<any>({
    queryKey: ['clint-contacts', params],
    queryFn: () => callClintAPI({ resource: 'contacts', params }),
  });
};

export const useClintContact = (id: string) => {
  return useQuery<any>({
    queryKey: ['clint-contact', id],
    queryFn: () => callClintAPI({ resource: `contacts/${id}` }),
    enabled: !!id,
  });
};

export const useCreateClintContact = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => callClintAPI({ resource: 'contacts', method: 'POST', data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clint-contacts'] });
      toast.success('Contato criado com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao criar contato');
      console.error(error);
    },
  });
};

export const useUpdateClintContact = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      callClintAPI({ resource: `contacts/${id}`, method: 'PUT', data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clint-contacts'] });
      toast.success('Contato atualizado com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar contato');
      console.error(error);
    },
  });
};

export const useDeleteClintContact = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => callClintAPI({ resource: `contacts/${id}`, method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clint-contacts'] });
      toast.success('Contato excluído com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao excluir contato');
      console.error(error);
    },
  });
};

// Organizations - endpoint may not exist in Clint API, disabled for now
export const useClintOrganizations = (params?: Record<string, string>) => {
  return useQuery<any>({
    queryKey: ['clint-organizations', params],
    queryFn: async () => {
      // Return empty data instead of calling non-existent endpoint
      return { data: [] };
    },
    enabled: false, // Disable this query
  });
};

export const useCreateClintOrganization = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => callClintAPI({ resource: 'organizations', method: 'POST', data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clint-organizations'] });
      toast.success('Organização criada com sucesso');
    },
  });
};

// Deals
export const useClintDeals = (params?: Record<string, string>) => {
  return useQuery<any>({
    queryKey: ['clint-deals', params],
    queryFn: () => callClintAPI({ resource: 'deals', params }),
  });
};

// Buscar stages/etapas da API Clint
export const useClintStages = () => {
  return useQuery<ClintAPIResponse<any[]>>({
    queryKey: ['clint-stages'],
    queryFn: () => callClintAPI({ resource: 'stages' }),
    staleTime: 10 * 60 * 1000, // Cache por 10 minutos (stages mudam raramente)
  });
};

// Buscar TODOS os deals com paginação completa
export const useAllClintDeals = (params?: Record<string, string>) => {
  return useQuery<any>({
    queryKey: ['clint-all-deals', params],
    queryFn: async () => {
      let allDeals: any[] = [];
      let currentPage = 1;
      let totalPages = 1;
      
      console.log('🔄 Iniciando busca paginada de deals...');
      
      // Buscar todas as páginas recursivamente
      while (currentPage <= totalPages) {
        const response = await callClintAPI<ClintAPIResponse<any[]>>({ 
          resource: 'deals', 
          params: {
            ...params,
            page: currentPage.toString(),
            per_page: '200',  // Máximo por página
          }
        });
        
        const deals = response.data || [];
        allDeals = [...allDeals, ...deals];
        
        // Atualizar informações de paginação
        if (response.meta) {
          totalPages = Math.ceil(response.meta.total / response.meta.per_page);
          console.log(`📄 Página ${currentPage}/${totalPages} - ${deals.length} deals carregados (${allDeals.length}/${response.meta.total} total)`);
        }
        
        currentPage++;
        
        // Limite de segurança (máximo 100 páginas = 20.000 deals)
        if (currentPage > 100) {
          console.warn('⚠️ Limite de 100 páginas atingido');
          break;
        }
      }
      
      console.log(`✅ Total de ${allDeals.length} deals carregados`);
      
      return { 
        data: allDeals,
        meta: {
          total: allDeals.length,
          page: 1,
          per_page: allDeals.length
        }
      };
    },
    staleTime: 5 * 60 * 1000,  // Cache por 5 minutos
    gcTime: 10 * 60 * 1000,     // Manter em cache por 10 minutos
  });
};

export const useCreateClintDeal = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => callClintAPI({ resource: 'deals', method: 'POST', data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clint-deals'] });
      toast.success('Negócio criado com sucesso');
    },
  });
};

export const useUpdateClintDealStage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: string }) =>
      callClintAPI({ resource: `deals/${id}`, method: 'PATCH', data: { stage } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clint-deals'] });
      toast.success('Negócio atualizado');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar negócio');
      console.error(error);
    },
  });
};

export const useUpdateClintDeal = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      callClintAPI({ resource: `deals/${id}`, method: 'PUT', data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clint-deals'] });
      toast.success('Negócio atualizado com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar negócio');
      console.error(error);
    },
  });
};

export const useDeleteClintDeal = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => callClintAPI({ resource: `deals/${id}`, method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clint-deals'] });
      toast.success('Negócio excluído com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao excluir negócio');
      console.error(error);
    },
  });
};

// Groups
export const useClintGroups = () => {
  return useQuery<any>({
    queryKey: ['clint-groups'],
    queryFn: () => callClintAPI({ resource: 'groups' }),
  });
};

// Lost Status
export const useClintLostStatuses = () => {
  return useQuery<any>({
    queryKey: ['clint-lost-statuses'],
    queryFn: () => callClintAPI({ resource: 'lost_status' }),
  });
};

// Origins
export const useClintOrigins = () => {
  return useQuery<any>({
    queryKey: ['clint-origins'],
    queryFn: () => callClintAPI({ resource: 'origins' }),
  });
};

export const useCreateClintOrigin = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => callClintAPI({ resource: 'origins', method: 'POST', data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clint-origins'] });
      toast.success('Origem criada com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao criar origem');
      console.error(error);
    },
  });
};

export const useUpdateClintOrigin = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      callClintAPI({ resource: `origins/${id}`, method: 'PUT', data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clint-origins'] });
      toast.success('Origem atualizada com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar origem');
      console.error(error);
    },
  });
};

export const useDeleteClintOrigin = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => callClintAPI({ resource: `origins/${id}`, method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clint-origins'] });
      toast.success('Origem excluída com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao excluir origem');
      console.error(error);
    },
  });
};

// Tags
export const useClintTags = () => {
  return useQuery<any>({
    queryKey: ['clint-tags'],
    queryFn: () => callClintAPI({ resource: 'tags' }),
  });
};

// Users
export const useClintUsers = () => {
  return useQuery<any>({
    queryKey: ['clint-users'],
    queryFn: () => callClintAPI({ resource: 'users' }),
  });
};

// Account
export const useClintAccount = () => {
  return useQuery<any>({
    queryKey: ['clint-account'],
    queryFn: () => callClintAPI({ resource: 'account' }),
  });
};
