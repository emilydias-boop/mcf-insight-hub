import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { EvolutionData } from '@/types/dashboard';
import { getCustomWeekStart, addCustomWeeks, formatDateForDB, getCustomWeekEnd } from '@/lib/dateHelpers';
import { format, startOfMonth } from 'date-fns';
import { 
  deduplicateTransactions, 
  calcularMetricasSemana,
  formatDateForBrazil,
  HublaTransactionBase 
} from '@/lib/transactionHelpers';

export const useEvolutionData = (canal?: string, limit: number = 52) => {
  return useQuery({
    queryKey: ['evolution-data', canal, limit],
    staleTime: 30000,
    queryFn: async () => {
      // Calcular semana atual e início do range
      const semanaAtual = getCustomWeekStart(new Date());
      const semanaInicio = addCustomWeeks(semanaAtual, -(limit - 1));
      
      const startDateRange = formatDateForBrazil(semanaInicio, false);
      const endDateRange = formatDateForBrazil(getCustomWeekEnd(semanaAtual), true);
      const startDateStr = formatDateForDB(semanaInicio);
      const endDateStr = formatDateForDB(getCustomWeekEnd(semanaAtual));
      
      // Buscar TODAS as transações do período completo
      const { data: allTransactions } = await supabase
        .from("hubla_transactions")
        .select(
          "hubla_id, product_name, product_category, net_value, sale_date, installment_number, total_installments, customer_name, customer_email, raw_data, product_price, event_type, source"
        )
        .eq("sale_status", "completed")
        .or("event_type.eq.invoice.payment_succeeded,source.eq.kiwify,source.eq.make")
        .not("customer_email", "is", null)
        .neq("customer_email", "")
        .not("customer_name", "is", null)
        .neq("customer_name", "")
        .gt("net_value", 0)
        .or("count_in_dashboard.is.null,count_in_dashboard.eq.true")
        .gte("sale_date", startDateRange)
        .lte("sale_date", endDateRange);

      // Buscar custos de ads do período completo
      const { data: allCosts } = await supabase
        .from("daily_costs")
        .select("amount, date")
        .eq("cost_type", "ads")
        .gte("date", startDateStr)
        .lte("date", endDateStr);

      // Buscar custos operacionais (mensal)
      const monthsInRange = new Set<string>();
      let currentDate = new Date(semanaInicio);
      while (currentDate <= semanaAtual) {
        monthsInRange.add(format(startOfMonth(currentDate), 'yyyy-MM-dd'));
        currentDate = new Date(currentDate.setMonth(currentDate.getMonth() + 1));
      }
      
      const { data: operationalCosts } = await supabase
        .from("operational_costs")
        .select("amount, cost_type, month")
        .in("month", Array.from(monthsInRange));

      // Gerar array de semanas customizadas (Sáb-Sex)
      const semanas: Array<{ startDate: Date; endDate: Date; weekLabel: string }> = [];
      let weekStart = new Date(semanaInicio);
      
      while (weekStart <= semanaAtual) {
        const weekEnd = getCustomWeekEnd(weekStart);
        const startDay = weekStart.getDate().toString().padStart(2, '0');
        const startMonth = (weekStart.getMonth() + 1).toString().padStart(2, '0');
        const endDay = weekEnd.getDate().toString().padStart(2, '0');
        const endMonth = (weekEnd.getMonth() + 1).toString().padStart(2, '0');
        
        semanas.push({
          startDate: new Date(weekStart),
          endDate: weekEnd,
          weekLabel: `${startDay}/${startMonth} - ${endDay}/${endMonth}`,
        });
        
        weekStart = addCustomWeeks(weekStart, 1);
      }

      // Calcular métricas para cada semana usando função compartilhada
      const evolutionData: EvolutionData[] = semanas.map((semana) => {
        const weekStartStr = formatDateForBrazil(semana.startDate, false);
        const weekEndStr = formatDateForBrazil(semana.endDate, true);
        const weekStartDate = formatDateForDB(semana.startDate);
        const weekEndDate = formatDateForDB(semana.endDate);
        
        // Filtrar transações da semana
        const weekTransactions = (allTransactions || []).filter((tx) => {
          const saleDate = tx.sale_date;
          return saleDate >= weekStartStr && saleDate <= weekEndStr;
        }) as HublaTransactionBase[];
        
        // Deduplicar usando mesma lógica
        const deduplicatedTx = deduplicateTransactions(weekTransactions);
        
        // Calcular custos de ads da semana
        const weekAdsCosts = (allCosts || [])
          .filter((c) => c.date >= weekStartDate && c.date <= weekEndDate)
          .reduce((sum, c) => sum + (c.amount || 0), 0);
        
        // Calcular custo operacional semanal (mensal / 4)
        const monthKey = format(startOfMonth(semana.startDate), 'yyyy-MM-dd');
        const monthCosts = (operationalCosts || []).filter((c) => c.month === monthKey);
        const custoEquipe = monthCosts.filter((c) => c.cost_type === 'team').reduce((sum, c) => sum + (c.amount || 0), 0);
        const custoEscritorio = monthCosts.filter((c) => c.cost_type === 'office').reduce((sum, c) => sum + (c.amount || 0), 0);
        
        // Usar função compartilhada para calcular todas as métricas
        const metricas = calcularMetricasSemana(
          deduplicatedTx,
          weekAdsCosts,
          custoEquipe,
          custoEscritorio
        );
        
        return {
          periodo: semana.weekLabel,
          semanaLabel: semana.weekLabel,
          faturamento: metricas.faturamentoTotal,
          custos: metricas.custoTotal,
          lucro: metricas.lucro,
          roi: metricas.roi,
          roas: metricas.roas,
          vendasA010: metricas.vendasA010,
          vendasContratos: 0,
          leads: 0,
        };
      });

      return evolutionData;
    },
  });
};
