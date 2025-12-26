import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Closer {
  id: string;
  name: string;
  email: string;
  color: string | null;
  is_active: boolean | null;
  calendly_event_type_uri: string | null;
  employee_id: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface CloserFormData {
  name: string;
  email: string;
  color?: string;
  is_active?: boolean;
  calendly_event_type_uri?: string;
  employee_id?: string;
}

export function useClosersList() {
  return useQuery({
    queryKey: ['closers-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('closers')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data as Closer[];
    }
  });
}

export function useCloser(id: string) {
  return useQuery({
    queryKey: ['closer', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('closers')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data as Closer;
    },
    enabled: !!id
  });
}

export function useCreateCloser() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: CloserFormData) => {
      const { data: result, error } = await supabase
        .from('closers')
        .insert({
          name: data.name,
          email: data.email,
          color: data.color || null,
          is_active: data.is_active ?? true,
          calendly_event_type_uri: data.calendly_event_type_uri || null,
          employee_id: data.employee_id || null
        })
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['closers-list'] });
      queryClient.invalidateQueries({ queryKey: ['closers'] });
      toast.success('Closer criado com sucesso!');
    },
    onError: (error: any) => {
      toast.error(`Erro ao criar closer: ${error.message}`);
    }
  });
}

export function useUpdateCloser() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CloserFormData> }) => {
      const { data: result, error } = await supabase
        .from('closers')
        .update({
          ...data,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['closers-list'] });
      queryClient.invalidateQueries({ queryKey: ['closers'] });
      toast.success('Closer atualizado com sucesso!');
    },
    onError: (error: any) => {
      toast.error(`Erro ao atualizar closer: ${error.message}`);
    }
  });
}

export function useDeleteCloser() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('closers')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['closers-list'] });
      queryClient.invalidateQueries({ queryKey: ['closers'] });
      toast.success('Closer removido com sucesso!');
    },
    onError: (error: any) => {
      toast.error(`Erro ao remover closer: ${error.message}`);
    }
  });
}
