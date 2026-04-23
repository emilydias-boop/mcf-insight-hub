import { useCarrinhoUnifiedData, isAprovado, isForaDoCarrinho, isPendente, isEmAnalise, isAgendada, isRealizada, isCarrinhoEligible, isProximaSafra, CarrinhoLeadRow } from '@/hooks/useCarrinhoUnifiedData';
import { CarrinhoConfig } from '@/hooks/useCarrinhoConfig';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { getCarrinhoMetricBoundaries } from '@/lib/carrinhoWeekBoundaries';

export interface R2CarrinhoKPIs {
  contratosPagos: number;
  r2Agendadas: number;
  r2Realizadas: number;
  foraDoCarrinho: number;
  aprovados: number;
  aprovadosForaCorte: number;
  pendentes: number;
  emAnalise: number;
}

export function useR2CarrinhoKPIs(weekStart: Date, weekEnd: Date, carrinhoConfig?: CarrinhoConfig, previousConfig?: CarrinhoConfig) {
  const { data: unifiedData, isLoading: unifiedLoading } = useCarrinhoUnifiedData(weekStart, weekEnd, carrinhoConfig, previousConfig);
  
  // Contratos pagos still comes from hubla_transactions (not part of the RPC)
  const cutoffKey = carrinhoConfig?.carrinhos?.[0]?.horario_corte || '12:00';
  const prevCutoffKey = previousConfig?.carrinhos?.[0]?.horario_corte || '12:00';
  
  const { data: contratosPagos, isLoading: contratosLoading } = useQuery({
    queryKey: ['r2-carrinho-contratos', format(weekStart, 'yyyy-MM-dd'), format(weekEnd, 'yyyy-MM-dd'), cutoffKey, prevCutoffKey],
    queryFn: async (): Promise<number> => {
      const boundaries = getCarrinhoMetricBoundaries(weekStart, weekEnd, carrinhoConfig, previousConfig);
      
      const { data: contratosTx } = await supabase
        .from('hubla_transactions')
        .select('customer_email, hubla_id, source, product_name, installment_number')
        .eq('product_name', 'A000 - Contrato')
        .in('sale_status', ['completed', 'refunded'])
        .in('source', ['hubla', 'manual', 'make', 'mcfpay', 'kiwify'])
        .gte('sale_date', boundaries.contratos.start.toISOString())
        .lte('sale_date', boundaries.contratos.end.toISOString());

      const validTx = (contratosTx || []).filter(t => {
        if (t.hubla_id?.startsWith('newsale-')) return false;
        if (t.source === 'make' && t.product_name?.toLowerCase() === 'contrato') return false;
        if (t.installment_number && t.installment_number > 1) return false;
        return true;
      });

      const emailMap = new Map<string, boolean>();
      for (const tx of validTx) {
        const email = (tx.customer_email || '').toLowerCase().trim();
        if (email) emailMap.set(email, true);
      }
      return emailMap.size;
    },
    staleTime: 30000,
  });

  // Derive KPIs from unified data
  const kpis = useMemo((): R2CarrinhoKPIs | undefined => {
    if (!unifiedData) return undefined;
    
    let r2Agendadas = 0;
    let r2Realizadas = 0;
    let foraDoCarrinho = 0;
    let aprovados = 0;
    let aprovadosForaCorte = 0;
    let pendentes = 0;
    let emAnalise = 0;

    // Janela operacional (Sex anterior 12:00 → Sex desta semana 12:00) para R2 agendadas/realizadas/fora.
    const { carrinhoOperacional } = getCarrinhoMetricBoundaries(weekStart, weekEnd, carrinhoConfig, previousConfig);
    const opStart = carrinhoOperacional.start.getTime();
    const opEnd = carrinhoOperacional.end.getTime();
    const inOperationalWindow = (row: CarrinhoLeadRow) => {
      if (row.is_encaixado) return true;
      if (!row.scheduled_at) return false;
      const t = new Date(row.scheduled_at).getTime();
      return t >= opStart && t < opEnd;
    };

    for (const row of unifiedData) {
      const opOk = inOperationalWindow(row);
      if (opOk && isAgendada(row)) r2Agendadas++;
      if (opOk && isRealizada(row)) r2Realizadas++;
      if (opOk && isForaDoCarrinho(row)) foraDoCarrinho++;
      if (isCarrinhoEligible(row)) aprovados++;
      else if (isProximaSafra(row)) aprovadosForaCorte++;
      if (isPendente(row)) pendentes++;
      if (isEmAnalise(row)) emAnalise++;
    }

    return {
      contratosPagos: contratosPagos ?? 0,
      r2Agendadas,
      r2Realizadas,
      foraDoCarrinho,
      aprovados,
      aprovadosForaCorte,
      pendentes,
      emAnalise,
    };
  }, [unifiedData, contratosPagos, weekStart, weekEnd, carrinhoConfig, previousConfig]);

  return {
    data: kpis,
    isLoading: unifiedLoading || contratosLoading,
    refetch: () => {},
  };
}
