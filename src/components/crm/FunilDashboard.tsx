import { useState, useMemo } from 'react';
import { Calendar, Filter } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useActiveBU } from '@/hooks/useActiveBU';
import { useBUOriginIds } from '@/hooks/useBUPipelineMap';
import { useCRMOverviewData } from '@/hooks/useCRMOverviewData';

import { PipelineHealthBlock } from './overview/PipelineHealthBlock';
import { FlowFunnelBlock } from './overview/FlowFunnelBlock';
import { SdrRankingTable } from './overview/SdrRankingTable';
import { CloserRankingTable } from './overview/CloserRankingTable';
import { OperationalAlertsBlock } from './overview/OperationalAlertsBlock';

import {
  getCustomWeekStart,
  getCustomWeekEnd,
  formatCustomWeekRange,
} from '@/lib/dateHelpers';
import { startOfDay, endOfDay, startOfMonth, endOfMonth, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type PeriodType = 'today' | 'week' | 'month';

function getPeriodRange(period: PeriodType) {
  const now = new Date();
  switch (period) {
    case 'today':
      return { start: startOfDay(now), end: endOfDay(now), label: format(now, "dd/MM/yyyy", { locale: ptBR }) };
    case 'week': {
      const ws = getCustomWeekStart(now);
      const we = getCustomWeekEnd(now);
      return { start: ws, end: we, label: formatCustomWeekRange(now) };
    }
    case 'month': {
      const ms = startOfMonth(now);
      const me = endOfMonth(now);
      return {
        start: ms,
        end: me,
        label: `${format(ms, "dd/MM", { locale: ptBR })} - ${format(me, "dd/MM/yyyy", { locale: ptBR })}`,
      };
    }
  }
}

const PERIOD_OPTIONS: { value: PeriodType; label: string }[] = [
  { value: 'today', label: 'Hoje' },
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mês' },
];

export function FunilDashboard() {
  const [period, setPeriod] = useState<PeriodType>('week');

  const activeBU = useActiveBU();
  const { data: originIds = [] } = useBUOriginIds(activeBU);

  const { start: periodStart, end: periodEnd, label: periodLabel } = useMemo(
    () => getPeriodRange(period),
    [period]
  );

  const { data, isLoading } = useCRMOverviewData(periodStart, periodEnd, originIds, activeBU);

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Período:</span>
          <span className="text-sm text-muted-foreground">{periodLabel}</span>
        </div>
        <div className="flex items-center bg-muted rounded-lg p-1 gap-0.5">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setPeriod(opt.value)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                period === opt.value
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 1. KPIs */}
      <OverviewKPIs data={data?.kpis} isLoading={isLoading} />

      {/* 2. Pipeline Health */}
      <PipelineHealthBlock data={data?.health} isLoading={isLoading} />

      {/* 3. Flow Funnel */}
      <FlowFunnelBlock data={data?.funnel} isLoading={isLoading} />

      {/* 4 & 5. Rankings side by side on large screens */}
      <div className="grid gap-6 lg:grid-cols-2">
        <SdrRankingTable data={data?.sdrRanking} isLoading={isLoading} />
        <CloserRankingTable data={data?.closerRanking} isLoading={isLoading} />
      </div>

      {/* 6. Alerts */}
      <OperationalAlertsBlock data={data} isLoading={isLoading} />
    </div>
  );
}
