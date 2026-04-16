import { useMemo } from 'react';
import { useCarrinhoUnifiedData, isAprovado } from '@/hooks/useCarrinhoUnifiedData';
import { CarrinhoConfig } from '@/hooks/useCarrinhoConfig';

export interface CloserCarrinhoMetric {
  closer_id: string;
  closer_name: string;
  closer_color: string | null;
  aprovados: number;
}

export function useCloserCarrinhoMetrics(weekStart: Date, weekEnd: Date, config?: CarrinhoConfig, previousConfig?: CarrinhoConfig) {
  const { data: unifiedData, isLoading } = useCarrinhoUnifiedData(weekStart, weekEnd, config, previousConfig);

  const data = useMemo((): CloserCarrinhoMetric[] => {
    if (!unifiedData) return [];

    const closerMap = new Map<string, CloserCarrinhoMetric>();
    let unassignedCount = 0;

    for (const row of unifiedData) {
      if (!isAprovado(row)) continue;

      // Find closer from R1 data (same logic as before)
      const closerId = row.r1_closer_id;
      if (!closerId) {
        unassignedCount++;
        continue;
      }

      if (!closerMap.has(closerId)) {
        closerMap.set(closerId, {
          closer_id: closerId,
          closer_name: row.r1_closer_name || 'Desconhecido',
          closer_color: null,
          aprovados: 0,
        });
      }
      closerMap.get(closerId)!.aprovados++;
    }

    const result = Array.from(closerMap.values())
      .filter(m => m.aprovados > 0)
      .sort((a, b) => b.aprovados - a.aprovados);

    if (unassignedCount > 0) {
      result.push({
        closer_id: 'unassigned',
        closer_name: 'Sem Closer',
        closer_color: '#6B7280',
        aprovados: unassignedCount,
      });
    }

    return result;
  }, [unifiedData]);

  return { data, isLoading };
}
