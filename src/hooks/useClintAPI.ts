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
