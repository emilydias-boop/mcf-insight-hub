import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Premiacao, PremiacaoFormData, PremiacaoGanhador, MetricaConfig } from '@/types/premiacoes';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';

export function usePremiacoes(bu?: string, status?: string) {
  return useQuery({
    queryKey: ['premiacoes', bu, status],
    queryFn: async () => {
      let query = supabase
        .from('premiacoes')
        .select('*')
        .order('created_at', { ascending: false });

      if (bu) {
        query = query.eq('bu', bu);
      }

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Premiacao[];
    },
  });
}

export function usePremiacao(id: string | undefined) {
  return useQuery({
    queryKey: ['premiacao', id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('premiacoes')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as Premiacao;
    },
    enabled: !!id,
  });
}

export function usePremiacaoGanhadores(premiacaoId: string | undefined) {
  return useQuery({
    queryKey: ['premiacao-ganhadores', premiacaoId],
    queryFn: async () => {
      if (!premiacaoId) return [];

      const { data, error } = await supabase
        .from('premiacao_ganhadores')
        .select('*')
        .eq('premiacao_id', premiacaoId)
        .order('posicao', { ascending: true });

      if (error) throw error;
      return data as PremiacaoGanhador[];
    },
    enabled: !!premiacaoId,
  });
}

export function useCreatePremiacao() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (formData: PremiacaoFormData) => {
      const insertData: any = {
        nome: formData.nome,
        descricao: formData.descricao || null,
        premio_descricao: formData.premio_descricao,
        premio_valor: formData.premio_valor || null,
        bu: formData.bu,
        cargos_elegiveis: formData.cargos_elegiveis,
        tipo_competicao: formData.tipo_competicao,
        metrica_ranking: formData.metrica_ranking,
        metrica_config: formData.metrica_config,
        data_inicio: format(formData.data_inicio, 'yyyy-MM-dd'),
        data_fim: format(formData.data_fim, 'yyyy-MM-dd'),
        qtd_ganhadores: formData.qtd_ganhadores,
        status: 'rascunho',
        created_by: user?.id,
      };
      
      const { data, error } = await supabase
        .from('premiacoes')
        .insert([insertData])
        .select()
        .single();

      if (error) throw error;
      return data as Premiacao;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['premiacoes'] });
      toast.success('Premiação criada com sucesso!');
    },
    onError: (error) => {
      console.error('Erro ao criar premiação:', error);
      toast.error('Erro ao criar premiação');
    },
  });
}

export function useUpdatePremiacao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Premiacao> & { id: string }) => {
      const { data, error } = await supabase
        .from('premiacoes')
        .update(updates as Record<string, unknown>)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as Premiacao;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['premiacoes'] });
      queryClient.invalidateQueries({ queryKey: ['premiacao', data.id] });
      toast.success('Premiação atualizada!');
    },
    onError: (error) => {
      console.error('Erro ao atualizar premiação:', error);
      toast.error('Erro ao atualizar premiação');
    },
  });
}

export function useDeletePremiacao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('premiacoes')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['premiacoes'] });
      toast.success('Premiação excluída!');
    },
    onError: (error) => {
      console.error('Erro ao excluir premiação:', error);
      toast.error('Erro ao excluir premiação');
    },
  });
}

export function useAtivarPremiacao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from('premiacoes')
        .update({ status: 'ativa' })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as Premiacao;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['premiacoes'] });
      queryClient.invalidateQueries({ queryKey: ['premiacao', data.id] });
      toast.success('Premiação ativada!');
    },
    onError: (error) => {
      console.error('Erro ao ativar premiação:', error);
      toast.error('Erro ao ativar premiação');
    },
  });
}

export function useEncerrarPremiacao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from('premiacoes')
        .update({ status: 'encerrada' })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as Premiacao;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['premiacoes'] });
      queryClient.invalidateQueries({ queryKey: ['premiacao', data.id] });
      toast.success('Premiação encerrada!');
    },
    onError: (error) => {
      console.error('Erro ao encerrar premiação:', error);
      toast.error('Erro ao encerrar premiação');
    },
  });
}
