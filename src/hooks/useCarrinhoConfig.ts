import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getDay, format, subWeeks } from 'date-fns';

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

function getWeekKey(weekStart: Date): string {
  return `carrinho_config_${format(weekStart, 'yyyy-MM-dd')}`;
}

export function useCarrinhoConfig(weekStart?: Date) {
  const queryClient = useQueryClient();
  const weekKey = weekStart ? getWeekKey(weekStart) : 'carrinho_config';

  const { data: config, isLoading } = useQuery({
    queryKey: ['carrinho-config', weekKey],
    queryFn: async (): Promise<CarrinhoConfig> => {
      // Try week-specific key first
      const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', weekKey)
        .maybeSingle();
      if (error) throw error;
      if (data?.value) {
        const val = data.value as unknown as CarrinhoConfig;
        if (val.carrinhos && val.carrinhos.length > 0) return val;
      }

      // Fallback: try global key (legacy)
      if (weekKey !== 'carrinho_config') {
        const { data: globalData, error: globalError } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'carrinho_config')
          .maybeSingle();
        if (globalError) throw globalError;
        if (globalData?.value) {
          const val = globalData.value as unknown as CarrinhoConfig;
          if (val.carrinhos && val.carrinhos.length > 0) return val;
        }
      }

      return DEFAULT_CONFIG;
    },
  });

  const saveConfig = useMutation({
    mutationFn: async (newConfig: CarrinhoConfig) => {
      const { data: existing } = await supabase
        .from('settings')
        .select('id')
        .eq('key', weekKey)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('settings')
          .update({ value: newConfig as any, updated_at: new Date().toISOString() })
          .eq('key', weekKey);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('settings')
          .insert({ key: weekKey, value: newConfig as any });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['carrinho-config', weekKey] });
      queryClient.invalidateQueries({ queryKey: ['r2-carrinho-data'] });
      queryClient.invalidateQueries({ queryKey: ['r2-carrinho-kpis'] });
      queryClient.invalidateQueries({ queryKey: ['r2-fora-carrinho-data'] });
      queryClient.invalidateQueries({ queryKey: ['r2-carrinho-vendas'] });
      queryClient.invalidateQueries({ queryKey: ['r2-accumulated-leads'] });
      toast.success('Configuração do carrinho salva!');
    },
    onError: () => toast.error('Erro ao salvar configuração'),
  });

  /** Copy config from previous week */
  const copyFromPreviousWeek = useMutation({
    mutationFn: async () => {
      if (!weekStart) throw new Error('weekStart required');
      const prevWeekStart = subWeeks(weekStart, 1);
      const prevKey = getWeekKey(prevWeekStart);

      const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', prevKey)
        .maybeSingle();
      if (error) throw error;
      if (!data?.value) throw new Error('Nenhuma configuração encontrada na semana anterior');

      const prevConfig = data.value as unknown as CarrinhoConfig;
      if (!prevConfig.carrinhos || prevConfig.carrinhos.length === 0) {
        throw new Error('Configuração da semana anterior está vazia');
      }

      // Save as current week
      const { data: existing } = await supabase
        .from('settings')
        .select('id')
        .eq('key', weekKey)
        .maybeSingle();

      if (existing) {
        const { error: upErr } = await supabase
          .from('settings')
          .update({ value: prevConfig as any, updated_at: new Date().toISOString() })
          .eq('key', weekKey);
        if (upErr) throw upErr;
      } else {
        const { error: insErr } = await supabase
          .from('settings')
          .insert({ key: weekKey, value: prevConfig as any });
        if (insErr) throw insErr;
      }

      return prevConfig;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['carrinho-config', weekKey] });
      toast.success('Configuração copiada da semana anterior!');
    },
    onError: (err: Error) => toast.error(err.message || 'Erro ao copiar configuração'),
  });

  return { config: config ?? DEFAULT_CONFIG, isLoading, saveConfig, copyFromPreviousWeek };
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
