import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface R2Closer {
  id: string;
  name: string;
  email: string;
  color: string | null;
  is_active: boolean | null;
  calendly_event_type_uri: string | null;
  calendly_default_link: string | null;
  employee_id: string | null;
  meeting_type: string | null;
  priority: number | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface R2CloserFormData {
  name: string;
  email: string;
  color?: string;
  is_active?: boolean;
  calendly_event_type_uri?: string;
  calendly_default_link?: string;
  employee_id?: string;
  priority?: number;
}

export function useR2ClosersList() {
  return useQuery({
    queryKey: ['r2-closers-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('closers')
        .select('*')
        .eq('meeting_type', 'r2')
        .order('priority', { ascending: true, nullsFirst: false })
        .order('name');
      
      if (error) throw error;
      return data as R2Closer[];
    }
  });
}

export function useActiveR2Closers() {
  return useQuery({
    queryKey: ['r2-closers-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('closers')
        .select('*')
        .eq('meeting_type', 'r2')
        .eq('is_active', true)
        .order('priority', { ascending: true, nullsFirst: false })
        .order('name');
      
      if (error) throw error;
      return data as R2Closer[];
    }
  });
}

export function useR2Closer(id: string) {
  return useQuery({
    queryKey: ['r2-closer', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('closers')
        .select('*')
        .eq('id', id)
        .eq('meeting_type', 'r2')
        .single();
      
      if (error) throw error;
      return data as R2Closer;
    },
    enabled: !!id
  });
}

export function useCreateR2Closer() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: R2CloserFormData) => {
      const { data: result, error } = await supabase
        .from('closers')
        .insert({
          name: data.name,
          email: data.email,
          color: data.color || null,
          is_active: data.is_active ?? true,
          calendly_event_type_uri: data.calendly_event_type_uri || null,
          calendly_default_link: data.calendly_default_link || null,
          employee_id: data.employee_id || null,
          meeting_type: 'r2',
          priority: data.priority ?? 99,
        })
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['r2-closers-list'] });
      queryClient.invalidateQueries({ queryKey: ['r2-closers-active'] });
      toast.success('Closer R2 criado com sucesso!');
    },
    onError: (error: any) => {
      toast.error(`Erro ao criar closer R2: ${error.message}`);
    }
  });
}

export function useUpdateR2Closer() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<R2CloserFormData> }) => {
      const { data: result, error } = await supabase
        .from('closers')
        .update({
          ...data,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('meeting_type', 'r2')
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['r2-closers-list'] });
      queryClient.invalidateQueries({ queryKey: ['r2-closers-active'] });
      toast.success('Closer R2 atualizado com sucesso!');
    },
    onError: (error: any) => {
      toast.error(`Erro ao atualizar closer R2: ${error.message}`);
    }
  });
}

export function useDeleteR2Closer() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('closers')
        .delete()
        .eq('id', id)
        .eq('meeting_type', 'r2');
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['r2-closers-list'] });
      queryClient.invalidateQueries({ queryKey: ['r2-closers-active'] });
      toast.success('Closer R2 removido com sucesso!');
    },
    onError: (error: any) => {
      toast.error(`Erro ao remover closer R2: ${error.message}`);
    }
  });
}
