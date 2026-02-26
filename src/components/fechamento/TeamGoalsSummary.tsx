import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useTeamMonthlyGoals, useTeamMonthlyGoalWinners, useAuthorizeWinner } from "@/hooks/useTeamMonthlyGoals";
import { useTeamRevenueByMonth } from "@/hooks/useTeamRevenueByMonth";
import { formatCurrency } from "@/lib/formatters";
import { useSdrPayouts } from "@/hooks/useSdrFechamento";
import { Target, Trophy, CheckCircle2, Circle, Sparkles, UtensilsCrossed, Award } from "lucide-react";
import { format, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface TeamGoalsSummaryProps {
  anoMes: string;
  bu?: string;
}

interface GoalLevel {
  key: 'meta' | 'supermeta' | 'ultrameta' | 'divina';
  label: string;
  targetValue: number;
  prize?: number;
  prizeLabel?: string;
  reached: boolean;
  icon: React.ReactNode;
}

export function TeamGoalsSummary({ anoMes, bu = 'incorporador' }: TeamGoalsSummaryProps) {
  const { data: teamGoal, isLoading: isLoadingGoal } = useTeamMonthlyGoals(anoMes, bu);
  const { data: winners, isLoading: isLoadingWinners } = useTeamMonthlyGoalWinners(teamGoal?.id);
  const { data: currentRevenue = 0, isLoading: isLoadingRevenue } = useTeamRevenueByMonth(anoMes, bu);
  const { data: payouts } = useSdrPayouts(anoMes, {});
  const authorizeWinner = useAuthorizeWinner();

  // Se não há meta configurada, não mostrar
  if (!teamGoal && !isLoadingGoal) {
    return null;
  }

  if (isLoadingGoal || isLoadingRevenue) {
    return (
      <Card className="bg-card/50 border-primary/20">
        <CardHeader className="pb-3">
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!teamGoal) return null;

  // Definir níveis de meta
  const goalLevels: GoalLevel[] = [
    {
      key: 'meta',
      label: 'Meta',
      targetValue: teamGoal.meta_valor,
      prize: teamGoal.meta_premio_ifood,
      prizeLabel: teamGoal.meta_premio_ifood > 0 ? `iFood +${formatCurrency(teamGoal.meta_premio_ifood)}` : undefined,
      reached: currentRevenue >= teamGoal.meta_valor,
      icon: <Target className="h-4 w-4" />,
    },
    {
      key: 'supermeta',
      label: 'Supermeta',
      targetValue: teamGoal.supermeta_valor,
      prize: teamGoal.supermeta_premio_ifood,
      prizeLabel: teamGoal.supermeta_premio_ifood > 0 ? `iFood +${formatCurrency(teamGoal.supermeta_premio_ifood)}` : undefined,
      reached: currentRevenue >= teamGoal.supermeta_valor,
      icon: <Trophy className="h-4 w-4" />,
    },
    {
      key: 'ultrameta',
      label: 'Ultrameta',
      targetValue: teamGoal.ultrameta_valor,
      prize: teamGoal.ultrameta_premio_ifood,
      prizeLabel: `iFood +${formatCurrency(teamGoal.ultrameta_premio_ifood)} (todos)`,
      reached: currentRevenue >= teamGoal.ultrameta_valor,
      icon: <Sparkles className="h-4 w-4" />,
    },
    {
      key: 'divina',
      label: 'Meta Divina',
      targetValue: teamGoal.meta_divina_valor,
      prizeLabel: 'SDR + Closer premiados',
      reached: currentRevenue >= teamGoal.meta_divina_valor,
      icon: <Award className="h-4 w-4" />,
    },
  ];

  const highestReached = goalLevels.filter(g => g.reached).slice(-1)[0];
  const progressPct = teamGoal.meta_valor > 0 
    ? Math.min(100, (currentRevenue / teamGoal.meta_valor) * 100)
    : 0;

  // Identificar melhor SDR e Closer para Meta Divina baseado em % performance (pct_media_global)
  // ALINHADO com a Edge Function que usa pct_media_global para registrar vencedores
  const getPerformancePct = (payout: any) => {
    // Calcular média global: média dos pcts das métricas com valor
    const pcts = [
      payout.pct_reunioes_agendadas,
      payout.pct_reunioes_realizadas,
      payout.pct_tentativas,
      payout.pct_organizacao,
    ].filter((v: number) => v > 0);
    return pcts.length > 0 ? pcts.reduce((a: number, b: number) => a + b, 0) / pcts.length : 0;
  };

  // Filtrar payouts por BU
  const buPayouts = payouts?.filter(p => {
    const sdrData = p.sdr as any;
    return sdrData?.squad === bu;
  }) || [];

  const sdrPayouts = buPayouts.filter(p => (p.sdr as any)?.role_type !== 'closer');
  const closerPayouts = buPayouts.filter(p => (p.sdr as any)?.role_type === 'closer');

  const bestSdr = sdrPayouts.length > 0
    ? sdrPayouts.reduce((max, p) => getPerformancePct(p) > getPerformancePct(max) ? p : max)
    : null;
  const bestCloser = closerPayouts.length > 0
    ? closerPayouts.reduce((max, p) => getPerformancePct(p) > getPerformancePct(max) ? p : max)
    : null;

  // Buscar vencedores já registrados
  const sdrWinner = winners?.find(w => w.tipo_premio === 'divina_sdr');
  const closerWinner = winners?.find(w => w.tipo_premio === 'divina_closer');

  // Formatar mês para exibição
  const monthLabel = format(parse(anoMes, 'yyyy-MM', new Date()), "MMMM 'de' yyyy", { locale: ptBR });

  const divinaBatida = currentRevenue >= teamGoal.meta_divina_valor;
  const ultrametaBatida = currentRevenue >= teamGoal.ultrameta_valor;

  return (
    <Card className={cn(
      "border transition-colors",
      divinaBatida 
        ? "bg-gradient-to-r from-amber-500/10 via-yellow-500/5 to-amber-500/10 border-amber-500/30" 
        : ultrametaBatida 
          ? "bg-gradient-to-r from-primary/10 to-primary/5 border-primary/30"
          : "bg-card/50 border-border"
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Metas do Time - {monthLabel}
          </CardTitle>
          <div className="text-right">
            <span className="text-sm text-muted-foreground">Faturamento</span>
            <p className="text-xl font-bold text-foreground">
              {formatCurrency(currentRevenue)}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Goal Levels */}
        <div className="flex flex-wrap gap-3">
          {goalLevels.map((level) => (
            <div
              key={level.key}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg border transition-all",
                level.reached
                  ? level.key === 'divina'
                    ? "bg-amber-500/20 border-amber-500/50 text-amber-400"
                    : "bg-green-500/20 border-green-500/50 text-green-400"
                  : "bg-muted/30 border-muted text-muted-foreground"
              )}
            >
              {level.reached ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <Circle className="h-4 w-4" />
              )}
              <div className="flex flex-col">
                <span className="text-sm font-medium">{level.label}</span>
                <span className="text-xs opacity-80">
                  {formatCurrency(level.targetValue)}
                </span>
              </div>
              {level.reached && level.prizeLabel && (
                <Badge 
                  variant="secondary" 
                  className={cn(
                    "ml-2 text-xs",
                    level.key === 'divina' 
                      ? "bg-amber-500/30 text-amber-300"
                      : level.key === 'ultrameta'
                        ? "bg-primary/30 text-primary"
                        : "bg-green-500/30 text-green-300"
                  )}
                >
                  {level.prizeLabel}
                </Badge>
              )}
            </div>
          ))}
        </div>

        {/* Ultrameta Notification */}
        {ultrametaBatida && !divinaBatida && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/10 border border-primary/30">
            <UtensilsCrossed className="h-5 w-5 text-primary" />
            <div>
              <span className="font-medium text-primary">Ultrameta Batida!</span>
              <p className="text-sm text-muted-foreground">
                iFood de {formatCurrency(teamGoal.ultrameta_premio_ifood)} liberado para todos da equipe
              </p>
            </div>
          </div>
        )}

        {/* Meta Divina Winners Section */}
        {divinaBatida && (
          <div className="p-4 rounded-lg bg-gradient-to-r from-amber-500/20 to-yellow-500/10 border border-amber-500/30 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-400" />
              <span className="font-bold text-amber-300 text-lg">🌟 Meta Divina Batida!</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Best SDR */}
              {bestSdr && (
                <div className="p-3 rounded-lg bg-card/50 border border-amber-500/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs text-muted-foreground">Melhor SDR</span>
                      <p className="font-semibold">{(bestSdr.sdr as any)?.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Performance: {getPerformancePct(bestSdr).toFixed(1)}%
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-amber-400">
                        {formatCurrency(teamGoal.meta_divina_premio_sdr)}
                      </p>
                      {sdrWinner?.autorizado ? (
                        <Badge variant="secondary" className="bg-green-500/30 text-green-300">
                          Autorizado
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-amber-500/50 text-amber-300 hover:bg-amber-500/20"
                          onClick={() => sdrWinner && authorizeWinner.mutate(sdrWinner.id)}
                          disabled={authorizeWinner.isPending || !sdrWinner}
                        >
                          Autorizar
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Best Closer */}
              {bestCloser && (
                <div className="p-3 rounded-lg bg-card/50 border border-amber-500/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs text-muted-foreground">Melhor Closer</span>
                      <p className="font-semibold">{(bestCloser.sdr as any)?.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Performance: {getPerformancePct(bestCloser).toFixed(1)}%
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-amber-400">
                        {formatCurrency(teamGoal.meta_divina_premio_closer)}
                      </p>
                      {closerWinner?.autorizado ? (
                        <Badge variant="secondary" className="bg-green-500/30 text-green-300">
                          Autorizado
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-amber-500/50 text-amber-300 hover:bg-amber-500/20"
                          onClick={() => closerWinner && authorizeWinner.mutate(closerWinner.id)}
                          disabled={authorizeWinner.isPending || !closerWinner}
                        >
                          Autorizar
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
