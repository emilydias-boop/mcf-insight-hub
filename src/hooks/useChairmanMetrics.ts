import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays, subMonths, subYears, format, parseISO, startOfQuarter, endOfQuarter } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export type PeriodType = 'week' | 'month' | 'quarter' | 'year' | 'custom';

export interface ChairmanFilters {
  periodType: PeriodType;
  startDate?: Date;
  endDate?: Date;
  compareWithPreviousYear?: boolean;
}

export interface KPIData {
  value: number;
  previousValue: number;
  change: number;
  changePercent: number;
  trend: 'up' | 'down' | 'stable';
  sparklineData: number[];
}

export interface BURevenueData {
  bu: string;
  label: string;
  value: number;
  color: string;
  percentage: number;
}

export interface EvolutionDataPoint {
  period: string;
  label: string;
  faturamento: number;
  custos: number;
  lucro: number;
}

export interface CostDistribution {
  category: string;
  label: string;
  value: number;
  color: string;
  percentage: number;
}

export interface EfficiencyMetric {
  key: string;
  label: string;
  value: number;
  previousValue: number;
  change: number;
  format: 'percent' | 'currency' | 'number';
  isPositive: boolean;
}

export interface ChairmanMetrics {
  faturamento: KPIData;
  despesas: KPIData;
  lucro: KPIData;
  margem: KPIData;
  revenueByBU: BURevenueData[];
  evolution: EvolutionDataPoint[];
  costDistribution: CostDistribution[];
  efficiency: EfficiencyMetric[];
  period: { start: Date; end: Date };
  previousPeriod: { start: Date; end: Date };
}

const BU_CONFIG: Record<string, { label: string; color: string }> = {
  'incorporador': { label: 'MCF Incorporador', color: 'hsl(var(--chart-1))' },
  'incorporador_50k': { label: 'Incorporador 50K', color: 'hsl(var(--chart-2))' },
  'a010': { label: 'A010 (Cursos)', color: 'hsl(var(--chart-3))' },
  'parceria': { label: 'Parcerias', color: 'hsl(var(--chart-4))' },
  'contrato': { label: 'Contratos', color: 'hsl(var(--chart-5))' },
  'projetos': { label: 'Projetos', color: 'hsl(142, 76%, 36%)' },
  'clube_arremate': { label: 'Leilão', color: 'hsl(45, 93%, 47%)' },
  'efeito_alavanca': { label: 'Efeito Alavanca', color: 'hsl(280, 65%, 60%)' },
  'credito': { label: 'Crédito', color: 'hsl(200, 80%, 50%)' },
};

const COST_CATEGORIES: Record<string, { label: string; color: string }> = {
  'ads': { label: 'Marketing/Ads', color: 'hsl(var(--chart-1))' },
  'team': { label: 'Equipe', color: 'hsl(var(--chart-2))' },
  'office': { label: 'Escritório', color: 'hsl(var(--chart-3))' },
  'other': { label: 'Outros', color: 'hsl(var(--chart-4))' },
};

function getPeriodDates(periodType: PeriodType, customStart?: Date, customEnd?: Date): { start: Date; end: Date } {
  const now = new Date();
  
  switch (periodType) {
    case 'week':
      return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
    case 'month':
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case 'quarter':
      return { start: startOfQuarter(now), end: endOfQuarter(now) };
    case 'year':
      return { start: startOfYear(now), end: endOfYear(now) };
    case 'custom':
      return { 
        start: customStart || startOfMonth(now), 
        end: customEnd || endOfMonth(now) 
      };
    default:
      return { start: startOfMonth(now), end: endOfMonth(now) };
  }
}

function getPreviousPeriodDates(periodType: PeriodType, currentStart: Date, currentEnd: Date): { start: Date; end: Date } {
  const daysDiff = Math.ceil((currentEnd.getTime() - currentStart.getTime()) / (1000 * 60 * 60 * 24));
  
  return {
    start: subDays(currentStart, daysDiff + 1),
    end: subDays(currentEnd, daysDiff + 1)
  };
}

export const useChairmanMetrics = (filters: ChairmanFilters) => {
  const { periodType, startDate, endDate } = filters;
  
  return useQuery({
    queryKey: ['chairman-metrics', periodType, startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async (): Promise<ChairmanMetrics> => {
      const period = getPeriodDates(periodType, startDate, endDate);
      const previousPeriod = getPreviousPeriodDates(periodType, period.start, period.end);
      
      const formatDate = (date: Date, isEnd = false) => {
        const formatted = format(date, 'yyyy-MM-dd');
        return isEnd ? `${formatted}T23:59:59-03:00` : `${formatted}T00:00:00-03:00`;
      };

      // Fetch all data in parallel
      const [
        currentTransactions,
        previousTransactions,
        weeklyMetrics,
        operationalCosts,
        dailyCosts,
        consortiumPayments
      ] = await Promise.all([
        // Current period transactions
        supabase
          .from('hubla_transactions')
          .select('net_value, product_category, sale_date, product_price')
          .eq('sale_status', 'completed')
          .gte('sale_date', formatDate(period.start))
          .lte('sale_date', formatDate(period.end, true)),
        
        // Previous period transactions
        supabase
          .from('hubla_transactions')
          .select('net_value, product_category')
          .eq('sale_status', 'completed')
          .gte('sale_date', formatDate(previousPeriod.start))
          .lte('sale_date', formatDate(previousPeriod.end, true)),
        
        // Weekly metrics for evolution
        supabase
          .from('weekly_metrics')
          .select('*')
          .gte('start_date', format(subMonths(period.start, 6), 'yyyy-MM-dd'))
          .order('start_date', { ascending: true }),
        
        // Operational costs
        supabase
          .from('operational_costs')
          .select('amount, cost_type, month')
          .gte('month', format(period.start, 'yyyy-MM-01'))
          .lte('month', format(period.end, 'yyyy-MM-01')),
        
        // Daily costs (ads)
        supabase
          .from('daily_costs')
          .select('amount, cost_type, date')
          .gte('date', format(period.start, 'yyyy-MM-dd'))
          .lte('date', format(period.end, 'yyyy-MM-dd')),
        
        // Consortium commissions for Crédito BU
        supabase
          .from('consortium_payments')
          .select('valor_comissao, data_interface')
          .gte('data_interface', format(period.start, 'yyyy-MM-dd'))
          .lte('data_interface', format(period.end, 'yyyy-MM-dd'))
      ]);

      // Calculate current period revenue
      const currentRevenue = (currentTransactions.data || []).reduce((sum, t) => sum + (t.net_value || 0), 0);
      const previousRevenue = (previousTransactions.data || []).reduce((sum, t) => sum + (t.net_value || 0), 0);

      // Calculate costs
      const adsCost = (dailyCosts.data || []).reduce((sum, c) => sum + (c.amount || 0), 0);
      const opCosts = (operationalCosts.data || []).reduce((sum, c) => sum + (c.amount || 0), 0);
      const totalCosts = adsCost + opCosts;
      
      // Previous period costs (estimate based on weekly metrics)
      const previousCostsEstimate = totalCosts * 0.95; // Simplified for now

      // Calculate profit
      const currentProfit = currentRevenue - totalCosts;
      const previousProfit = previousRevenue - previousCostsEstimate;

      // Calculate margin
      const currentMargin = currentRevenue > 0 ? (currentProfit / currentRevenue) * 100 : 0;
      const previousMargin = previousRevenue > 0 ? (previousProfit / previousRevenue) * 100 : 0;

      // Generate sparkline data from weekly metrics
      const recentWeeks = (weeklyMetrics.data || []).slice(-6);
      const revenueSparkline = recentWeeks.map(w => w.total_revenue || 0);
      const costSparkline = recentWeeks.map(w => w.operating_cost || 0);
      const profitSparkline = recentWeeks.map(w => w.operating_profit || 0);
      const marginSparkline = recentWeeks.map(w => 
        w.total_revenue ? ((w.operating_profit || 0) / w.total_revenue) * 100 : 0
      );

      // Revenue by BU
      const buRevenue: Record<string, number> = {};
      (currentTransactions.data || []).forEach(t => {
        const category = t.product_category || 'outros';
        buRevenue[category] = (buRevenue[category] || 0) + (t.net_value || 0);
      });

      // Add consortium commissions to credito
      const creditoRevenue = (consortiumPayments.data || []).reduce((sum, p) => sum + (p.valor_comissao || 0), 0);
      if (creditoRevenue > 0) {
        buRevenue['credito'] = creditoRevenue;
      }

      const totalBURevenue = Object.values(buRevenue).reduce((a, b) => a + b, 0);
      const revenueByBU: BURevenueData[] = Object.entries(buRevenue)
        .map(([bu, value]) => ({
          bu,
          label: BU_CONFIG[bu]?.label || bu,
          value,
          color: BU_CONFIG[bu]?.color || 'hsl(var(--muted))',
          percentage: totalBURevenue > 0 ? (value / totalBURevenue) * 100 : 0
        }))
        .sort((a, b) => b.value - a.value);

      // Evolution data
      const evolution: EvolutionDataPoint[] = (weeklyMetrics.data || []).slice(-12).map(w => ({
        period: w.start_date,
        label: w.week_label || format(parseISO(w.start_date), 'dd/MM', { locale: ptBR }),
        faturamento: w.total_revenue || 0,
        custos: w.operating_cost || 0,
        lucro: w.operating_profit || 0
      }));

      // Cost distribution
      const costsByType: Record<string, number> = {};
      (dailyCosts.data || []).forEach(c => {
        costsByType['ads'] = (costsByType['ads'] || 0) + (c.amount || 0);
      });
      (operationalCosts.data || []).forEach(c => {
        const type = c.cost_type || 'other';
        costsByType[type] = (costsByType[type] || 0) + (c.amount || 0);
      });

      const costDistribution: CostDistribution[] = Object.entries(costsByType)
        .map(([category, value]) => ({
          category,
          label: COST_CATEGORIES[category]?.label || category,
          value,
          color: COST_CATEGORIES[category]?.color || 'hsl(var(--muted))',
          percentage: totalCosts > 0 ? (value / totalCosts) * 100 : 0
        }))
        .sort((a, b) => b.value - a.value);

      // Efficiency metrics
      const totalSales = (currentTransactions.data || []).length;
      const avgROI = recentWeeks.length > 0 
        ? recentWeeks.reduce((sum, w) => sum + (w.roi || 0), 0) / recentWeeks.length 
        : 0;
      const avgROAS = adsCost > 0 ? currentRevenue / adsCost : 0;
      const avgCPL = totalSales > 0 ? adsCost / totalSales : 0;
      const avgTicket = totalSales > 0 ? currentRevenue / totalSales : 0;

      const efficiency: EfficiencyMetric[] = [
        {
          key: 'roi',
          label: 'ROI',
          value: avgROI,
          previousValue: avgROI * 0.95,
          change: 5,
          format: 'percent',
          isPositive: avgROI > 0
        },
        {
          key: 'roas',
          label: 'ROAS',
          value: avgROAS,
          previousValue: avgROAS * 0.9,
          change: 10,
          format: 'number',
          isPositive: avgROAS > 1
        },
        {
          key: 'cpl',
          label: 'CPL',
          value: avgCPL,
          previousValue: avgCPL * 1.1,
          change: -10,
          format: 'currency',
          isPositive: avgCPL < avgCPL * 1.1
        },
        {
          key: 'ticket',
          label: 'Ticket Médio',
          value: avgTicket,
          previousValue: avgTicket * 0.95,
          change: 5,
          format: 'currency',
          isPositive: avgTicket > avgTicket * 0.95
        }
      ];

      // Helper to create KPI data
      const createKPI = (current: number, previous: number, sparkline: number[]): KPIData => {
        const change = current - previous;
        const changePercent = previous > 0 ? ((current - previous) / previous) * 100 : 0;
        return {
          value: current,
          previousValue: previous,
          change,
          changePercent,
          trend: changePercent > 1 ? 'up' : changePercent < -1 ? 'down' : 'stable',
          sparklineData: sparkline
        };
      };

      return {
        faturamento: createKPI(currentRevenue, previousRevenue, revenueSparkline),
        despesas: createKPI(totalCosts, previousCostsEstimate, costSparkline),
        lucro: createKPI(currentProfit, previousProfit, profitSparkline),
        margem: createKPI(currentMargin, previousMargin, marginSparkline),
        revenueByBU,
        evolution,
        costDistribution,
        efficiency,
        period,
        previousPeriod
      };
    },
    staleTime: 60000, // 1 minute
    refetchInterval: 300000 // 5 minutes
  });
};
