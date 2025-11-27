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
export function SdrRanking({
  topSdrs
}: SdrRankingProps) {
  const medals = ["🥇", "🥈", "🥉", "🏅"];
  return <div className="flex flex-col gap-1 h-full min-h-0">
      {topSdrs.slice(0, 4).map((sdr, index) => <Card key={sdr.email} className="bg-gradient-to-br from-card to-muted/30 border border-primary/20 flex-1">
          <CardContent className="p-1 h-full gap-1.5 flex items-center justify-start">
            <span className="text-base">{medals[index]}</span>
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              <h3 className="font-bold text-sm text-foreground truncate leading-tight">{sdr.nome}</h3>
              <div className="text-xs font-bold text-primary leading-tight">{sdr.score}pts</div>
            </div>
          </CardContent>
        </Card>)}
    </div>;
}