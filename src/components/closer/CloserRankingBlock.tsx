import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Target, TrendingUp, XCircle, DollarSign } from "lucide-react";
import { CloserRanking, CloserTeamAverages } from "@/hooks/useCloserDetailData";
import { R1CloserMetric } from "@/hooks/useR1CloserMetrics";

interface CloserRankingBlockProps {
  closerMetrics: R1CloserMetric | null;
  ranking: CloserRanking;
  teamAverages: CloserTeamAverages;
  isLoading: boolean;
}

function RankingItem({
  label,
  rank,
  total,
  icon: Icon,
  color,
}: {
  label: string;
  rank: number;
  total: number;
  icon: React.ElementType;
  color: string;
}) {
  const isTop3 = rank <= 3;
  const position = rank === 0 ? '-' : `#${rank}`;

  return (
    <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className={`text-lg font-bold ${isTop3 ? 'text-amber-400' : 'text-foreground'}`}>
          {position}
        </span>
        {rank > 0 && (
          <span className="text-xs text-muted-foreground">/ {total}</span>
        )}
        {isTop3 && rank > 0 && (
          <Trophy className="h-4 w-4 text-amber-400" />
        )}
      </div>
    </div>
  );
}

export function CloserRankingBlock({
  closerMetrics,
  ranking,
  teamAverages,
  isLoading,
}: CloserRankingBlockProps) {
  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center justify-between py-3 border-b border-border last:border-0">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-6 w-12" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-400" />
          Ranking no Time
        </CardTitle>
      </CardHeader>
      <CardContent>
        <RankingItem
          label="R1 Realizada"
          rank={ranking.r1Realizada}
          total={ranking.total}
          icon={Target}
          color="bg-green-500/10 text-green-400"
        />
        <RankingItem
          label="Contrato Pago"
          rank={ranking.contratoPago}
          total={ranking.total}
          icon={DollarSign}
          color="bg-amber-500/10 text-amber-400"
        />
        <RankingItem
          label="Taxa de Conversão"
          rank={ranking.taxaConversao}
          total={ranking.total}
          icon={TrendingUp}
          color="bg-blue-500/10 text-blue-400"
        />
        <RankingItem
          label="Taxa No-Show (menor melhor)"
          rank={ranking.taxaNoShow}
          total={ranking.total}
          icon={XCircle}
          color="bg-red-500/10 text-red-400"
        />
      </CardContent>
    </Card>
  );
}
