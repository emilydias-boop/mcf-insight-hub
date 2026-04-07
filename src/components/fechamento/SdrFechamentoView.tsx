import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/formatters';
import { SdrPayoutWithDetails, SdrMonthKpi } from '@/types/sdr-fechamento';
import { DynamicIndicatorsGrid } from '@/components/fechamento/DynamicIndicatorCard';
import { useActiveMetricsForSdr } from '@/hooks/useActiveMetricsForSdr';
import {
  DollarSign,
  Target,
  Wallet,
  CreditCard,
  UtensilsCrossed,
} from 'lucide-react';

interface SdrFechamentoViewProps {
  payout: SdrPayoutWithDetails;
  sdrId: string;
  anoMes: string;
  kpi: SdrMonthKpi | null;
}

export function SdrFechamentoView({ payout, sdrId, anoMes, kpi }: SdrFechamentoViewProps) {
  const { metricas, isLoading: metricasLoading } = useActiveMetricsForSdr(sdrId, anoMes);

  const diasUteisMes = (payout as any).dias_uteis_mes || (payout as any).dias_uteis || 22;
  const sdrMetaDiaria = payout.sdr?.meta_diaria || 3;
  const variavelTotal = payout.valor_variavel_total || 0;

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
              {formatCurrency(4000)}
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

      {/* Dynamic Indicators */}
      <DynamicIndicatorsGrid
        metricas={metricas}
        kpi={kpi}
        payout={payout}
        diasUteisMes={diasUteisMes}
        sdrMetaDiaria={sdrMetaDiaria}
        variavelTotal={variavelTotal}
      />
    </>
  );
}
