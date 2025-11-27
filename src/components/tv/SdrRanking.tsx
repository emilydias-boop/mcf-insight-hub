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
    <div className="grid grid-cols-4 gap-4">
      {topSdrs.slice(0, 4).map((sdr, index) => (
        <Card key={sdr.email} className="bg-gradient-to-br from-card to-muted/30 border-2 border-primary/20">
          <CardContent className="p-6 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-4xl">{medals[index]}</span>
              <TrendingUp className="h-5 w-5 text-success" />
            </div>
            
            <div>
              <h3 className="font-bold text-lg text-foreground line-clamp-1">{sdr.nome}</h3>
              <p className="text-2xl font-bold text-primary mt-1">{sdr.score} pts</p>
            </div>
            
            <div className="flex gap-2 text-xs text-muted-foreground">
              <div className="flex-1 bg-muted/50 rounded px-2 py-1">
                <div className="font-semibold text-foreground">{sdr.r1Agendada}</div>
                <div>R1A</div>
              </div>
              <div className="flex-1 bg-muted/50 rounded px-2 py-1">
                <div className="font-semibold text-foreground">{sdr.r1Realizada}</div>
                <div>R1R</div>
              </div>
              <div className="flex-1 bg-muted/50 rounded px-2 py-1">
                <div className="font-semibold text-success">{sdr.convRate}%</div>
                <div>Conv</div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
