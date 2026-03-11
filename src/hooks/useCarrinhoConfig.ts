import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getDay, getHours, getMinutes } from 'date-fns';

export interface CarrinhoItem {
  id: number;
  label: string;
  dias: number[]; // 0=Dom, 1=Seg, ..., 6=Sáb
  horario_corte: string; // "HH:mm"
  horario_reuniao: string; // "HH:mm"
}

export interface CarrinhoConfig {
  carrinhos: CarrinhoItem[];
}

const DEFAULT_CONFIG: CarrinhoConfig = {
  carrinhos: [
    {
      id: 1,
      label: 'Carrinho 1',
      dias: [1, 2, 3, 4, 5],
      horario_corte: '12:00',
      horario_reuniao: '12:00',
    },
  ],
};

export function useCarrinhoConfig() {
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ['carrinho-config'],
    queryFn: async (): Promise<CarrinhoConfig> => {
      const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'carrinho_config')
        .maybeSingle();
      if (error) throw error;
      if (!data?.value) return DEFAULT_CONFIG;
      const val = data.value as unknown as CarrinhoConfig;
      if (!val.carrinhos || val.carrinhos.length === 0) return DEFAULT_CONFIG;
      return val;
    },
  });

  const saveConfig = useMutation({
    mutationFn: async (newConfig: CarrinhoConfig) => {
      const { data: existing } = await supabase
        .from('settings')
        .select('id')
        .eq('key', 'carrinho_config')
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('settings')
          .update({ value: newConfig as any, updated_at: new Date().toISOString() })
          .eq('key', 'carrinho_config');
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('settings')
          .insert({ key: 'carrinho_config', value: newConfig as any });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['carrinho-config'] });
      toast.success('Configuração do carrinho salva!');
    },
    onError: () => toast.error('Erro ao salvar configuração'),
  });

  return { config: config ?? DEFAULT_CONFIG, isLoading, saveConfig };
}

/**
 * Check if a date belongs to a specific carrinho based on day of week and cutoff time.
 * Returns true if the date falls within the carrinho's days, considering the cutoff hour.
 */
export function dateMatchesCarrinho(
  scheduledAt: string | Date,
  carrinho: CarrinhoItem
): boolean {
  const date = typeof scheduledAt === 'string' ? new Date(scheduledAt) : scheduledAt;
  const dayOfWeek = getDay(date);
  return carrinho.dias.includes(dayOfWeek);
}

/**
 * Filter an array of items by carrinho. If selectedCarrinhoId is null, return all.
 * getScheduledAt extracts the date from each item.
 */
export function filterByCarrinho<T>(
  items: T[],
  config: CarrinhoConfig,
  selectedCarrinhoId: number | null,
  getScheduledAt: (item: T) => string | Date
): T[] {
  if (!selectedCarrinhoId) return items;
  const carrinho = config.carrinhos.find(c => c.id === selectedCarrinhoId);
  if (!carrinho) return items;
  return items.filter(item => dateMatchesCarrinho(getScheduledAt(item), carrinho));
}
