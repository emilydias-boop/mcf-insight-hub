import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/formatters';
import { SdrPayoutWithDetails } from '@/types/sdr-fechamento';
import { CloserMetrics } from '@/hooks/useOwnFechamento';
import {
  DollarSign,
  Target,
  Wallet,
  CreditCard,
  UtensilsCrossed,
  Users,
  FileCheck,
  AlertTriangle,
  Sparkles,
  CalendarPlus,
  TrendingUp,
} from 'lucide-react';

interface CloserFechamentoViewProps {
  payout: SdrPayoutWithDetails;
  closerMetrics: CloserMetrics | null;
}

export function CloserFechamentoView({ payout, closerMetrics }: CloserFechamentoViewProps) {
  const getNoShowColor = (rate: number) => {
    if (rate <= 20) return 'text-success';
    if (rate <= 35) return 'text-warning';
    return 'text-destructive';
  };

  const getColorForPct = (pct: number) => {
    if (pct >= 100) return 'text-success';
    if (pct >= 70) return 'text-warning';
    return 'text-destructive';
  };

  return (
    <>
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-1.5 text-muted-foreground/70 text-xs">
              <Target className="h-3.5 w-3.5" />
              OTE
            </div>
            <div className="text-xl font-bold mt-1">
              {formatCurrency(6000)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-1.5 text-muted-foreground/70 text-xs">
              <Wallet className="h-3.5 w-3.5" />
              Fixo
            </div>
            <div className="text-xl font-bold mt-1">
              {formatCurrency(payout.valor_fixo || 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-1.5 text-muted-foreground/70 text-xs">
              <DollarSign className="h-3.5 w-3.5" />
              Variável
            </div>
            <div className="text-xl font-bold mt-1 text-primary">
              {formatCurrency(payout.valor_variavel_total || 0)}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-primary/10 border-primary/20">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-1.5 text-primary text-xs">
              <CreditCard className="h-3.5 w-3.5" />
              Total Conta
            </div>
            <div className="text-xl font-bold mt-1 text-primary">
              {formatCurrency(payout.total_conta || 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-1.5 text-muted-foreground/70 text-xs">
              <UtensilsCrossed className="h-3.5 w-3.5" />
              Total iFood
            </div>
            <div className="text-xl font-bold mt-1">
              {formatCurrency(payout.total_ifood || 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Indicators */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm font-semibold">Indicadores de Performance</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {/* R1 Realizadas */}
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70">
                <Users className="h-3.5 w-3.5" />
                R1 Realizadas
              </div>
              <div className="text-lg font-semibold mt-0.5">
                {closerMetrics?.r1Realizada || 0}
              </div>
              <div className="text-xs text-muted-foreground/70">
                {(payout.pct_reunioes_realizadas || 0).toFixed(1)}% da meta
              </div>
              <div className="text-xs text-muted-foreground/70">
                Mult: {payout.mult_reunioes_realizadas || 0}x
              </div>
            </div>

            {/* Contratos Pagos */}
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70">
                <FileCheck className="h-3.5 w-3.5" />
                Contratos Pagos
              </div>
              <div className="text-lg font-semibold mt-0.5 text-success">
                {closerMetrics?.contratosPagos || 0}
              </div>
              <div className="text-xs text-muted-foreground/70">
                {(payout.pct_reunioes_agendadas || 0).toFixed(1)}% da meta
              </div>
              <div className="text-xs text-muted-foreground/70">
                Mult: {payout.mult_reunioes_agendadas || 0}x
              </div>
            </div>

            {/* Taxa de Conversão */}
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70">
                <TrendingUp className="h-3.5 w-3.5" />
                Taxa Conversão
              </div>
              <div className={`text-lg font-semibold mt-0.5 ${getColorForPct(closerMetrics?.taxaConversao || 0)}`}>
                {(closerMetrics?.taxaConversao || 0).toFixed(1)}%
              </div>
              <div className="text-xs text-muted-foreground/70">
                (Contratos / Realizadas)
              </div>
            </div>

            {/* Taxa No-Show */}
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70">
                <AlertTriangle className="h-3.5 w-3.5" />
                Taxa No-Show
              </div>
              <div className={`text-lg font-semibold mt-0.5 ${getNoShowColor(closerMetrics?.taxaNoShow || 0)}`}>
                {(closerMetrics?.taxaNoShow || 0).toFixed(1)}%
              </div>
              <div className="text-xs text-muted-foreground/70">
                {closerMetrics?.noShows || 0} no-shows
              </div>
            </div>

            {/* Outside Sales */}
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70">
                <Sparkles className="h-3.5 w-3.5" />
                Outside Sales
              </div>
              <div className="text-lg font-semibold mt-0.5 text-primary">
                {closerMetrics?.outsideSales || 0}
              </div>
              <div className="text-xs text-muted-foreground/70">
                Vendas antes do R1
              </div>
            </div>
          </div>

          {/* Secondary metrics row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
            {/* R2 Agendadas */}
            <div className="p-3 rounded-lg bg-muted/30">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70">
                <CalendarPlus className="h-3.5 w-3.5" />
                R2 Agendadas
              </div>
              <div className="text-lg font-semibold mt-0.5">
                {closerMetrics?.r2Agendadas || 0}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
