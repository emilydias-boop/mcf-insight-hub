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
    <div className="space-y-2">
      {topSdrs.slice(0, 4).map((sdr, index) => (
        <Card key={sdr.email} className="bg-gradient-to-br from-card to-muted/30 border border-primary/20">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">{medals[index]}</span>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-sm text-foreground truncate">{sdr.nome}</h3>
                <p className="text-lg font-bold text-primary">{sdr.score} pts</p>
              </div>
            </div>
            
            <div className="flex gap-1 text-xs">
              <div className="flex-1 bg-muted/50 rounded px-1 py-1 text-center">
                <div className="font-semibold text-foreground">{sdr.r1Agendada}</div>
                <div className="text-[10px]">R1A</div>
              </div>
              <div className="flex-1 bg-muted/50 rounded px-1 py-1 text-center">
                <div className="font-semibold text-foreground">{sdr.r1Realizada}</div>
                <div className="text-[10px]">R1R</div>
              </div>
              <div className="flex-1 bg-muted/50 rounded px-1 py-1 text-center">
                <div className="font-semibold text-success">{sdr.convRate}%</div>
                <div className="text-[10px]">Conv</div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
