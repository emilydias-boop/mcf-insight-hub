import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { Ultrameta } from "@/data/mockData";

interface UltrametaCardProps {
  data: Ultrameta;
}

export function UltrametaCard({ data }: UltrametaCardProps) {
  return (
    <Card className="bg-card border-border col-span-2">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-lg bg-success/10">
            <TrendingUp className="h-6 w-6 text-success" />
          </div>
          <div className="flex-1 space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Ultrameta Clint - Hubla</p>
              <p className="text-3xl font-bold text-success">{formatCurrency(data.ultrametaClint)}</p>
            </div>
            
            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Faturamento Incorporador 50k (Líquido)</p>
                <p className="text-lg font-semibold text-foreground">{formatCurrency(data.faturamentoIncorporador50k)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Faturamento Clint (Bruto)</p>
                <p className="text-lg font-semibold text-foreground">{formatCurrency(data.faturamentoClintBruto)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Ultrameta Líquido</p>
                <p className="text-lg font-semibold text-success">{formatCurrency(data.ultrametaLiquido)}</p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
