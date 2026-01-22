import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/formatters';
import { SdrPayoutWithDetails } from '@/types/sdr-fechamento';
import {
  DollarSign,
  Target,
  Wallet,
  CreditCard,
  TrendingUp,
  UtensilsCrossed,
} from 'lucide-react';

interface SdrFechamentoViewProps {
  payout: SdrPayoutWithDetails;
}

export function SdrFechamentoView({ payout }: SdrFechamentoViewProps) {
  const calculateGlobalPct = () => {
    const pcts = [
      payout.pct_reunioes_agendadas,
      payout.pct_reunioes_realizadas,
      payout.pct_tentativas,
      payout.pct_organizacao,
    ].filter((p) => p !== null) as number[];

    if (pcts.length === 0) return 0;
    return pcts.reduce((a, b) => a + b, 0) / pcts.length;
  };

  const globalPct = calculateGlobalPct();

  return (
    <>
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-1.5 text-muted-foreground/70 text-xs">
              <TrendingUp className="h-3.5 w-3.5" />
              % Meta Global
            </div>
            <div
              className={`text-xl font-bold mt-1 ${
                globalPct >= 100
                  ? 'text-success'
                  : globalPct >= 70
                  ? 'text-warning'
                  : 'text-destructive'
              }`}
            >
              {globalPct.toFixed(1)}%
            </div>
          </CardContent>
        </Card>

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

      {/* Indicators Preview */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm font-semibold">Resumo dos Indicadores</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="text-xs text-muted-foreground/70">
                Reuniões Agendadas
              </div>
              <div className="text-lg font-semibold mt-0.5">
                {(payout.pct_reunioes_agendadas || 0).toFixed(1)}%
              </div>
              <div className="text-xs text-muted-foreground/70">
                Mult: {payout.mult_reunioes_agendadas || 0}x
              </div>
            </div>

            <div className="p-3 rounded-lg bg-muted/50">
              <div className="text-xs text-muted-foreground/70">
                Reuniões Realizadas
              </div>
              <div className="text-lg font-semibold mt-0.5">
                {(payout.pct_reunioes_realizadas || 0).toFixed(1)}%
              </div>
              <div className="text-xs text-muted-foreground/70">
                Mult: {payout.mult_reunioes_realizadas || 0}x
              </div>
            </div>

            <div className="p-3 rounded-lg bg-muted/50">
              <div className="text-xs text-muted-foreground/70">
                Tentativas
              </div>
              <div className="text-lg font-semibold mt-0.5">
                {(payout.pct_tentativas || 0).toFixed(1)}%
              </div>
              <div className="text-xs text-muted-foreground/70">
                Mult: {payout.mult_tentativas || 0}x
              </div>
            </div>

            <div className="p-3 rounded-lg bg-muted/50">
              <div className="text-xs text-muted-foreground/70">
                Organização
              </div>
              <div className="text-lg font-semibold mt-0.5">
                {(payout.pct_organizacao || 0).toFixed(1)}%
              </div>
              <div className="text-xs text-muted-foreground/70">
                Mult: {payout.mult_organizacao || 0}x
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
