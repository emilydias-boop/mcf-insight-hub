import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Trophy, Medal, Award, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface TeamComparisonItem {
  label: string;
  sdrValue: number;
  teamAvg: number;
  diffPercent: number;
  rank: number;
  totalSdrs: number;
  format?: "number" | "percent";
}

interface SdrTeamComparisonPanelProps {
  data: TeamComparisonItem[];
  isLoading?: boolean;
}

function getRankBadge(rank: number, total: number) {
  if (rank === 1) return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]"><Trophy className="h-3 w-3 mr-0.5" />1º</Badge>;
  if (rank === 2) return <Badge className="bg-slate-400/20 text-slate-300 border-slate-400/30 text-[10px]"><Medal className="h-3 w-3 mr-0.5" />2º</Badge>;
  if (rank === 3) return <Badge className="bg-orange-600/20 text-orange-400 border-orange-600/30 text-[10px]"><Award className="h-3 w-3 mr-0.5" />3º</Badge>;
  return <Badge variant="outline" className="text-muted-foreground text-[10px]">{rank}º</Badge>;
}

export function SdrTeamComparisonPanel({ data, isLoading }: SdrTeamComparisonPanelProps) {
  if (isLoading) {
    return (
      <Card className="bg-card border-border animate-pulse">
        <CardContent className="p-6 h-[200px]" />
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          Comparação com o Time
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {data.map((item) => {
            const isAbove = item.diffPercent >= 0;
            const formatValue = (v: number) => item.format === "percent" ? `${v.toFixed(1)}%` : v.toFixed(0);

            return (
              <div
                key={item.label}
                className="p-3 rounded-lg bg-muted/30 border border-border/50 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground font-medium">{item.label}</span>
                  {getRankBadge(item.rank, item.totalSdrs)}
                </div>

                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-bold text-foreground">{formatValue(item.sdrValue)}</span>
                  <span className="text-xs text-muted-foreground">vs {formatValue(item.teamAvg)}</span>
                </div>

                <div className={cn("flex items-center gap-1 text-[11px] font-medium", isAbove ? "text-green-500" : "text-destructive")}>
                  {isAbove ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {isAbove ? "+" : ""}{item.diffPercent.toFixed(0)}% vs média
                </div>

                <span className="text-[10px] text-muted-foreground">{item.rank}º de {item.totalSdrs}</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
