import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useBillingAnnualSummary, AnnualMonthSummary } from '@/hooks/useBillingAnnualSummary';
import { formatCurrency } from '@/lib/formatters';
import { TrendingUp, TrendingDown, AlertTriangle, Undo2 } from 'lucide-react';

interface Props {
  year: number;
}

export const CobrancaResumoAnual = ({ year }: Props) => {
  const { data: months = [], isLoading } = useBillingAnnualSummary(year);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mt-4">
        {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="h-36 w-full" />)}
      </div>
    );
  }

  const totals = months.reduce(
    (acc, m) => ({
      previsto: acc.previsto + m.totalPrevisto,
      recebido: acc.recebido + m.totalRecebido,
      risco: acc.risco + m.totalEmRisco,
      reembolsado: acc.reembolsado + m.totalReembolsado,
    }),
    { previsto: 0, recebido: 0, risco: 0, reembolsado: 0 }
  );

  return (
    <div className="space-y-6 mt-4">
      {/* Annual totals */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label="Total Previsto" value={totals.previsto} icon={TrendingUp} color="text-blue-600" />
        <SummaryCard label="Total Recebido" value={totals.recebido} icon={TrendingUp} color="text-green-600" />
        <SummaryCard label="Total em Risco" value={totals.risco} icon={AlertTriangle} color="text-amber-600" />
        <SummaryCard label="Total Reembolsado" value={totals.reembolsado} icon={Undo2} color="text-purple-600" />
      </div>

      {/* Monthly grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {months.map((m) => (
          <MonthCard key={m.month} data={m} />
        ))}
      </div>
    </div>
  );
};

const SummaryCard = ({ label, value, icon: Icon, color }: { label: string; value: number; icon: any; color: string }) => (
  <Card>
    <CardContent className="p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`h-4 w-4 ${color}`} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className={`text-lg font-bold ${color}`}>{formatCurrency(value)}</p>
    </CardContent>
  </Card>
);

const MonthCard = ({ data }: { data: AnnualMonthSummary }) => {
  const pct = data.totalPrevisto > 0 ? (data.totalRecebido / data.totalPrevisto) * 100 : 0;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="font-semibold text-sm">{data.label}</span>
          <span className={`text-xs font-medium ${pct >= 80 ? 'text-green-600' : pct >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
            {pct.toFixed(0)}%
          </span>
        </div>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Previsto</span>
            <span className="font-medium">{formatCurrency(data.totalPrevisto)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Recebido</span>
            <span className="font-medium text-green-600">{formatCurrency(data.totalRecebido)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Em Risco</span>
            <span className="font-medium text-amber-600">{formatCurrency(data.totalEmRisco)}</span>
          </div>
          {data.totalReembolsado > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Reembolso</span>
              <span className="font-medium text-purple-600">{formatCurrency(data.totalReembolsado)}</span>
            </div>
          )}
        </div>
        {/* Progress bar */}
        <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%` }} />
        </div>
      </CardContent>
    </Card>
  );
};
