import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";

interface SdrData {
  nome: string;
  email: string;
  novoLead: number;
  r1Agendada: number;
  r1Realizada: number;
  noShow: number;
  convRate: number;
  score: number;
}

interface SdrRankingProps {
  topSdrs: SdrData[];
}

export function SdrRanking({ topSdrs }: SdrRankingProps) {
  const medals = ["🥇", "🥈", "🥉", "🏅"];

  return (
    <div className="flex flex-col gap-1.5 h-full min-h-0">
      {topSdrs.slice(0, 4).map((sdr, index) => (
        <Card key={sdr.email} className="bg-gradient-to-br from-card to-muted/30 border border-primary/20 flex-1">
          <CardContent className="p-2 h-full flex items-center gap-2">
            <span className="text-2xl">{medals[index]}</span>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-sm text-foreground truncate">{sdr.nome}</h3>
            </div>
            <div className="text-lg font-bold text-primary">{sdr.score} pts</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
