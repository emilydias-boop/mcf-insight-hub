import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SdrStatusBadge } from '@/components/sdr-fechamento/SdrStatusBadge';
import { useOwnPayout, useOwnSdr } from '@/hooks/useSdrFechamento';
import { formatCurrency } from '@/lib/formatters';
import {
  Eye,
  RefreshCw,
  DollarSign,
  Target,
  Wallet,
  CreditCard,
  TrendingUp,
  UtensilsCrossed,
} from 'lucide-react';

const MeuFechamento = () => {
  const navigate = useNavigate();
  const currentMonth = format(new Date(), 'yyyy-MM');
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  const { data: sdr, isLoading: sdrLoading } = useOwnSdr();
  const { data: payout, isLoading: payoutLoading } = useOwnPayout(selectedMonth);

  const isLoading = sdrLoading || payoutLoading;

  // Generate last 12 months options
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const date = subMonths(new Date(), i);
    return {
      value: format(date, 'yyyy-MM'),
      label: format(date, 'MMMM yyyy', { locale: ptBR }),
    };
  });

  const calculateGlobalPct = () => {
    if (!payout) return 0;
    const pcts = [
      payout.pct_reunioes_agendadas,
      payout.pct_reunioes_realizadas,
      payout.pct_tentativas,
      payout.pct_organizacao,
    ].filter((p) => p !== null) as number[];

    if (pcts.length === 0) return 0;
    return pcts.reduce((a, b) => a + b, 0) / pcts.length;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!sdr) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">
          Você não está cadastrado como SDR no sistema.
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          Entre em contato com seu gestor para mais informações.
        </p>
      </div>
    );
  }

  const globalPct = calculateGlobalPct();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Meu Fechamento</h1>
          <p className="text-muted-foreground">
            Olá, {sdr.name}! Acompanhe seu fechamento mensal.
          </p>
        </div>

        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!payout ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              Nenhum fechamento encontrado para{' '}
              {monthOptions.find((o) => o.value === selectedMonth)?.label}.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              O fechamento será gerado pela gestão.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Status Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-3">
                Fechamento de{' '}
                {monthOptions.find((o) => o.value === selectedMonth)?.label}
                <SdrStatusBadge status={payout.status} />
              </CardTitle>
              <Button
                variant="outline"
                onClick={() => navigate(`/fechamento-sdr/${payout.id}`)}
              >
                <Eye className="h-4 w-4 mr-2" />
                Ver Detalhes
              </Button>
            </CardHeader>
          </Card>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <TrendingUp className="h-4 w-4" />
                  % Meta Global
                </div>
                <div
                  className={`text-2xl font-bold mt-1 ${
                    globalPct >= 100
                      ? 'text-green-400'
                      : globalPct >= 70
                      ? 'text-yellow-400'
                      : 'text-red-400'
                  }`}
                >
                  {globalPct.toFixed(1)}%
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Target className="h-4 w-4" />
                  OTE
                </div>
                <div className="text-2xl font-bold mt-1">
                  {formatCurrency(4000)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Wallet className="h-4 w-4" />
                  Fixo
                </div>
                <div className="text-2xl font-bold mt-1">
                  {formatCurrency(payout.valor_fixo || 0)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <DollarSign className="h-4 w-4" />
                  Variável
                </div>
                <div className="text-2xl font-bold mt-1 text-primary">
                  {formatCurrency(payout.valor_variavel_total || 0)}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-primary/10 border-primary/20">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-primary text-sm">
                  <CreditCard className="h-4 w-4" />
                  Total Conta
                </div>
                <div className="text-2xl font-bold mt-1 text-primary">
                  {formatCurrency(payout.total_conta || 0)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <UtensilsCrossed className="h-4 w-4" />
                  Total iFood
                </div>
                <div className="text-2xl font-bold mt-1">
                  {formatCurrency(payout.total_ifood || 0)}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Indicators Preview */}
          <Card>
            <CardHeader>
              <CardTitle>Resumo dos Indicadores</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-lg bg-muted/50">
                  <div className="text-sm text-muted-foreground">
                    Reuniões Agendadas
                  </div>
                  <div className="text-xl font-bold mt-1">
                    {(payout.pct_reunioes_agendadas || 0).toFixed(1)}%
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Mult: {payout.mult_reunioes_agendadas || 0}x
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-muted/50">
                  <div className="text-sm text-muted-foreground">
                    Reuniões Realizadas
                  </div>
                  <div className="text-xl font-bold mt-1">
                    {(payout.pct_reunioes_realizadas || 0).toFixed(1)}%
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Mult: {payout.mult_reunioes_realizadas || 0}x
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-muted/50">
                  <div className="text-sm text-muted-foreground">
                    Tentativas
                  </div>
                  <div className="text-xl font-bold mt-1">
                    {(payout.pct_tentativas || 0).toFixed(1)}%
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Mult: {payout.mult_tentativas || 0}x
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-muted/50">
                  <div className="text-sm text-muted-foreground">
                    Organização
                  </div>
                  <div className="text-xl font-bold mt-1">
                    {(payout.pct_organizacao || 0).toFixed(1)}%
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Mult: {payout.mult_organizacao || 0}x
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default MeuFechamento;
