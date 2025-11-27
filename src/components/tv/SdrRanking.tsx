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
          <CardContent className="p-2 h-full flex flex-col justify-between">
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="text-xl">{medals[index]}</span>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-xs text-foreground truncate">{sdr.nome}</h3>
                <p className="text-sm font-bold text-primary">{sdr.score} pts</p>
              </div>
            </div>
            
            <div className="flex gap-1 text-xs">
              <div className="flex-1 bg-muted/50 rounded px-1 py-1 text-center">
                <div className="font-semibold text-foreground text-xs">{sdr.r1Agendada}</div>
                <div className="text-[9px] mt-0.5">R1A</div>
              </div>
              <div className="flex-1 bg-muted/50 rounded px-1 py-1 text-center">
                <div className="font-semibold text-foreground text-xs">{sdr.r1Realizada}</div>
                <div className="text-[9px] mt-0.5">R1R</div>
              </div>
              <div className="flex-1 bg-muted/50 rounded px-1 py-1 text-center">
                <div className="font-semibold text-success text-xs">{sdr.convRate}%</div>
                <div className="text-[9px] mt-0.5">Conv</div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
