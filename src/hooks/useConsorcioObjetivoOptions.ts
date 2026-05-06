import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ConsorcioObjetivoOption {
  id: string;
  name: string;
  label: string;
  display_order: number;
  is_active: boolean;
}

export function useConsorcioObjetivoOptions() {
  return useQuery({
    queryKey: ['consorcio-objetivo-options'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('consorcio_objetivo_options')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });
      if (error) throw error;
      return data as ConsorcioObjetivoOption[];
    },
  });
}

export function useCreateConsorcioObjetivoOption() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; label: string; display_order?: number }) => {
      const { error } = await supabase
        .from('consorcio_objetivo_options')
        .insert({
          name: data.name,
          label: data.label,
          display_order: data.display_order ?? 0,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['consorcio-objetivo-options'] });
      toast.success('Objetivo criado');
    },
    onError: () => toast.error('Erro ao criar objetivo'),
  });
}

export function useUpdateConsorcioObjetivoOption() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<ConsorcioObjetivoOption> & { id: string }) => {
      const { error } = await supabase
        .from('consorcio_objetivo_options')
        .update(data)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['consorcio-objetivo-options'] });
      toast.success('Objetivo atualizado');
    },
    onError: () => toast.error('Erro ao atualizar objetivo'),
  });
}

export function useDeleteConsorcioObjetivoOption() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('consorcio_objetivo_options')
        .update({ is_active: false })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['consorcio-objetivo-options'] });
      toast.success('Objetivo removido');
    },
    onError: () => toast.error('Erro ao remover objetivo'),
  });
}