import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { R2StatusOption, R2ThermometerOption } from '@/types/r2Agenda';
import { toast } from 'sonner';

// ============ Status Options ============

export function useR2StatusOptions() {
  return useQuery({
    queryKey: ['r2-status-options'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('r2_status_options')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) throw error;
      return data as R2StatusOption[];
    }
  });
}

export function useCreateR2StatusOption() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { name: string; color: string; display_order?: number }) => {
      const { data: result, error } = await supabase
        .from('r2_status_options')
        .insert({
          name: data.name,
          color: data.color,
          display_order: data.display_order ?? 0
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['r2-status-options'] });
      toast.success('Status criado com sucesso');
    },
    onError: () => {
      toast.error('Erro ao criar status');
    }
  });
}

export function useUpdateR2StatusOption() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<R2StatusOption> & { id: string }) => {
      const { error } = await supabase
        .from('r2_status_options')
        .update(data)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['r2-status-options'] });
      toast.success('Status atualizado');
    },
    onError: () => {
      toast.error('Erro ao atualizar status');
    }
  });
}

export function useDeleteR2StatusOption() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('r2_status_options')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['r2-status-options'] });
      toast.success('Status removido');
    },
    onError: () => {
      toast.error('Erro ao remover status');
    }
  });
}

// ============ Thermometer Options ============

export function useR2ThermometerOptions() {
  return useQuery({
    queryKey: ['r2-thermometer-options'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('r2_thermometer_options')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) throw error;
      return data as R2ThermometerOption[];
    }
  });
}

export function useCreateR2ThermometerOption() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { name: string; color: string }) => {
      const { data: result, error } = await supabase
        .from('r2_thermometer_options')
        .insert({
          name: data.name,
          color: data.color
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['r2-thermometer-options'] });
      toast.success('Tag criada com sucesso');
    },
    onError: () => {
      toast.error('Erro ao criar tag');
    }
  });
}

export function useUpdateR2ThermometerOption() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<R2ThermometerOption> & { id: string }) => {
      const { error } = await supabase
        .from('r2_thermometer_options')
        .update(data)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['r2-thermometer-options'] });
      toast.success('Tag atualizada');
    },
    onError: () => {
      toast.error('Erro ao atualizar tag');
    }
  });
}

export function useDeleteR2ThermometerOption() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('r2_thermometer_options')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['r2-thermometer-options'] });
      toast.success('Tag removida');
    },
    onError: () => {
      toast.error('Erro ao remover tag');
    }
  });
}
