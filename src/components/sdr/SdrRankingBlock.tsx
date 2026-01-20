import { Trophy, Medal, Award } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SdrSummaryRow } from "@/hooks/useTeamMeetingsData";
import { SdrRanking, TeamAverages } from "@/hooks/useSdrDetailData";

interface SdrRankingBlockProps {
  sdrMetrics: SdrSummaryRow | null;
  ranking: SdrRanking;
  teamAverages: TeamAverages;
  isLoading?: boolean;
}

function getRankBadge(rank: number, total: number) {
  if (rank === 1) {
    return (
      <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
        <Trophy className="h-3 w-3 mr-1" />
        1º de {total}
      </Badge>
    );
  }
  if (rank === 2) {
    return (
      <Badge className="bg-slate-400/20 text-slate-300 border-slate-400/30">
        <Medal className="h-3 w-3 mr-1" />
        2º de {total}
      </Badge>
    );
  }
  if (rank === 3) {
    return (
      <Badge className="bg-orange-600/20 text-orange-400 border-orange-600/30">
        <Award className="h-3 w-3 mr-1" />
        3º de {total}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-muted-foreground">
      {rank}º de {total}
    </Badge>
  );
}

export function SdrRankingBlock({ sdrMetrics, ranking, teamAverages, isLoading }: SdrRankingBlockProps) {
  if (isLoading || !sdrMetrics) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="p-6 h-[200px] animate-pulse" />
      </Card>
    );
  }

  // Calculate taxa contrato values
  const taxaContratoValue = sdrMetrics.agendamentos > 0 
    ? (sdrMetrics.contratos / sdrMetrics.agendamentos) * 100 
    : 0;
  const avgTaxaContrato = teamAverages.avgAgendamentos > 0 
    ? (teamAverages.avgContratos / teamAverages.avgAgendamentos) * 100 
    : 0;

  const metrics = [
    {
      label: "Agendamentos",
      value: sdrMetrics.agendamentos,
      avg: teamAverages.avgAgendamentos.toFixed(1),
      rank: ranking.agendamentos,
      format: "number",
    },
    {
      label: "R1 Agendada",
      value: sdrMetrics.r1Agendada,
      avg: teamAverages.avgR1Agendada.toFixed(1),
      rank: ranking.r1Agendada,
      format: "number",
    },
    {
      label: "R1 Realizada",
      value: sdrMetrics.r1Realizada,
      avg: teamAverages.avgR1Realizada.toFixed(1),
      rank: ranking.r1Realizada,
      format: "number",
    },
    {
      label: "Contratos",
      value: sdrMetrics.contratos,
      avg: teamAverages.avgContratos.toFixed(1),
      rank: ranking.contratos,
      format: "number",
    },
    {
      label: "Taxa Contrato",
      value: `${taxaContratoValue.toFixed(1)}%`,
      avg: `${avgTaxaContrato.toFixed(1)}%`,
      rank: ranking.taxaContrato,
      format: "percent",
    },
  ];

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Trophy className="h-4 w-4 text-primary" />
          Ranking no Time
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 text-muted-foreground font-medium">Métrica</th>
                <th className="text-center py-2 text-muted-foreground font-medium">Valor</th>
                <th className="text-center py-2 text-muted-foreground font-medium">Média Time</th>
                <th className="text-center py-2 text-muted-foreground font-medium">Posição</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((metric) => (
                <tr key={metric.label} className="border-b border-border/50 last:border-0">
                  <td className="py-3 text-foreground">
                    {metric.label}
                  </td>
                  <td className="py-3 text-center font-medium text-foreground">{metric.value}</td>
                  <td className="py-3 text-center text-muted-foreground">{metric.avg}</td>
                  <td className="py-3 text-center">{getRankBadge(metric.rank, ranking.totalSdrs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
