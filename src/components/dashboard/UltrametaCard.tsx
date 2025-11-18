import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { Ultrameta } from "@/data/mockData";

interface UltrametaCardProps {
  data: Ultrameta;
}

export function UltrametaCard({ data }: UltrametaCardProps) {
  return (
    <Card className="bg-gradient-to-r from-success/5 to-success/10 border-success/20 col-span-2">
      <CardContent className="p-6">
        <div className="flex items-center gap-6">
          <div className="p-3 rounded-lg bg-success/10 shrink-0">
            <TrendingUp className="h-6 w-6 text-success" />
          </div>
          
          <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-6 divide-x divide-border">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Ultrameta Clint</p>
              <p className="text-xl font-bold text-success">{formatCurrency(data.ultrametaClint)}</p>
            </div>
            
            <div className="space-y-1 md:pl-6">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Faturamento 50k</p>
              <p className="text-xl font-bold text-foreground">{formatCurrency(data.faturamentoIncorporador50k)}</p>
              <p className="text-[10px] text-muted-foreground">(Líquido)</p>
            </div>
            
            <div className="space-y-1 md:pl-6">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Faturamento Clint</p>
              <p className="text-xl font-bold text-foreground">{formatCurrency(data.faturamentoClintBruto)}</p>
              <p className="text-[10px] text-muted-foreground">(Bruto)</p>
            </div>
            
            <div className="space-y-1 md:pl-6">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Ultrameta Líquido</p>
              <p className="text-xl font-bold text-success">{formatCurrency(data.ultrametaLiquido)}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
