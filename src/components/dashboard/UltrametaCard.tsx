import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { Ultrameta } from "@/data/mockData";

interface UltrametaCardProps {
  data: Ultrameta;
}

export function UltrametaCard({ data }: UltrametaCardProps) {
  return (
    <Card className="bg-gradient-to-b from-success/5 to-success/10 border-success/20 h-full">
      <CardContent className="p-4">
        <div className="space-y-2">
          {/* Header com ícone e título */}
          <div className="flex items-center gap-3 pb-2 border-b border-border">
            <div className="p-2 rounded-lg bg-success/10 shrink-0">
              <TrendingUp className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Ultrameta Clint</p>
              <p className="text-xl font-bold text-success">{formatCurrency(data.ultrametaClint)}</p>
            </div>
          </div>
          
          {/* Métricas empilhadas verticalmente */}
          <div className="space-y-2 pt-1">
            <div className="space-y-1 pt-2 border-t border-border/50">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Faturamento Incorporador 50k</p>
              <p className="text-lg font-bold text-foreground">{formatCurrency(data.faturamentoIncorporador50k)}</p>
              <p className="text-[10px] text-muted-foreground">(Líquido)</p>
            </div>
            
            <div className="space-y-1 pt-2 border-t border-border/50">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Faturamento Clint</p>
              <p className="text-lg font-bold text-foreground">{formatCurrency(data.faturamentoClintBruto)}</p>
              <p className="text-[10px] text-muted-foreground">(Bruto)</p>
            </div>
            
            <div className="space-y-1 pt-2 border-t border-border/50">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Ultrameta Líquido</p>
              <p className="text-lg font-bold text-success">{formatCurrency(data.ultrametaLiquido)}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
