import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { parseISO, isValid } from 'date-fns';
import { toast } from 'sonner';

export interface CarrinhoWeekOverride {
  start: string; // yyyy-MM-dd
  end: string;   // yyyy-MM-dd
  label?: string;
}

export function useCarrinhoWeekOverride() {
  const queryClient = useQueryClient();

  const { data: override, isLoading } = useQuery({
    queryKey: ['carrinho-week-override'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'carrinho_week_override')
        .maybeSingle();
      if (error) throw error;
      if (!data?.value) return null;

      const val = data.value as unknown as CarrinhoWeekOverride;
      if (!val.start || !val.end) return null;

      const startDate = parseISO(val.start);
      const endDate = parseISO(val.end);
      if (!isValid(startDate) || !isValid(endDate)) return null;

      // Return stable strings instead of Date objects to prevent React Query re-render loops
      return { start: val.start, end: val.end, label: val.label || '' };
    },
  });

  const saveOverride = useMutation({
    mutationFn: async (params: CarrinhoWeekOverride) => {
      // Upsert by key
      const { data: existing } = await supabase
        .from('settings')
        .select('id')
        .eq('key', 'carrinho_week_override')
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('settings')
          .update({ value: params as any, updated_at: new Date().toISOString() })
          .eq('key', 'carrinho_week_override');
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('settings')
          .insert({ key: 'carrinho_week_override', value: params as any });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['carrinho-week-override'] });
      toast.success('Exceção de semana salva!');
    },
    onError: () => toast.error('Erro ao salvar exceção'),
  });

  const removeOverride = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('settings')
        .delete()
        .eq('key', 'carrinho_week_override');
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['carrinho-week-override'] });
      toast.success('Exceção removida, semana padrão restaurada.');
    },
    onError: () => toast.error('Erro ao remover exceção'),
  });

  return { override, isLoading, saveOverride, removeOverride };
}
