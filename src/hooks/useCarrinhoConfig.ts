import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getDay } from 'date-fns';

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

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
}

/**
 * Determine which carrinho a scheduled date belongs to.
 * On shared days, uses horario_corte of the first carrinho to split.
 */
export function getCarrinhoForDate(
  config: CarrinhoConfig,
  scheduledAt: string | Date
): number | null {
  const date = typeof scheduledAt === 'string' ? new Date(scheduledAt) : scheduledAt;
  const dayOfWeek = getDay(date);

  const matching = config.carrinhos.filter(c => c.dias.includes(dayOfWeek));
  if (matching.length === 0) return null;
  if (matching.length === 1) return matching[0].id;

  const first = matching[0];
  const meetingMinutes = date.getHours() * 60 + date.getMinutes();
  const cutoffMinutes = timeToMinutes(first.horario_corte);

  return meetingMinutes <= cutoffMinutes ? first.id : matching[1].id;
}

/**
 * Check if a date belongs to a specific carrinho.
 */
export function dateMatchesCarrinho(
  scheduledAt: string | Date,
  carrinho: CarrinhoItem,
  config?: CarrinhoConfig
): boolean {
  if (config) {
    return getCarrinhoForDate(config, scheduledAt) === carrinho.id;
  }
  const date = typeof scheduledAt === 'string' ? new Date(scheduledAt) : scheduledAt;
  return carrinho.dias.includes(getDay(date));
}

/**
 * Filter by carrinho with exclusive assignment on shared days.
 */
export function filterByCarrinho<T>(
  items: T[],
  config: CarrinhoConfig,
  selectedCarrinhoId: number | null,
  getScheduledAt: (item: T) => string | Date
): T[] {
  if (!selectedCarrinhoId) return items;
  return items.filter(item => getCarrinhoForDate(config, getScheduledAt(item)) === selectedCarrinhoId);
}
