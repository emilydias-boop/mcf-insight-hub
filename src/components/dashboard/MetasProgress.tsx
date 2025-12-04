import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { TrendingUp, Wallet, Target, DollarSign, Users } from "lucide-react";

interface MetaCard {
  titulo: string;
  valor: number;
  meta: number;
  fonte: string;
  icon: React.ElementType;
}

interface MetasProgressProps {
  ultrametaClint: number;
  metaUltrametaClint: number;
  faturamentoClintBruto: number;
  metaFaturamentoClint: number;
  ultrametaLiquido: number;
  metaUltrametaLiquido: number;
  faturamentoLiquido: number;
  metaFaturamentoLiquido: number;
  sdrIa: number;
  onSdrIaChange: (value: number) => void;
  vendasA010: number;
  isLoading?: boolean;
}

function MetaProgressCard({ titulo, valor, meta, fonte, icon: Icon }: MetaCard) {
  const percentual = meta > 0 ? (valor / meta) * 100 : 0;
  const progressColor = percentual >= 100 
    ? "bg-success" 
    : percentual >= 80 
      ? "bg-warning" 
      : "bg-destructive";

  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground text-sm">{titulo}</h3>
            <p className="text-[10px] text-muted-foreground">{fonte}</p>
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-foreground">
              {formatCurrency(valor)}
            </span>
            <span className="text-xs text-muted-foreground">
              de {formatCurrency(meta)}
            </span>
          </div>
          
          <div className="relative">
            <Progress 
              value={Math.min(percentual, 100)} 
              className="h-2 bg-secondary"
            />
            <div 
              className={cn("absolute top-0 left-0 h-2 rounded-full transition-all", progressColor)}
              style={{ width: `${Math.min(percentual, 100)}%` }}
            />
          </div>
          
          <div className="flex justify-between items-center">
            <span className={cn(
              "text-xs font-medium",
              percentual >= 100 ? "text-success" : percentual >= 80 ? "text-warning" : "text-destructive"
            )}>
              {percentual.toFixed(1)}% atingido
            </span>
            {percentual >= 100 && (
              <span className="text-[10px] bg-success/20 text-success px-2 py-0.5 rounded-full">
                META BATIDA!
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function MetasProgress({
  ultrametaClint,
  metaUltrametaClint,
  faturamentoClintBruto,
  metaFaturamentoClint,
  ultrametaLiquido,
  metaUltrametaLiquido,
  faturamentoLiquido,
  metaFaturamentoLiquido,
  sdrIa,
  onSdrIaChange,
  vendasA010,
  isLoading,
}: MetasProgressProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-28 bg-card animate-pulse rounded-lg border border-border" />
        ))}
      </div>
    );
  }

  const metas: MetaCard[] = [
    {
      titulo: "ULTRAMETA CLINT",
      valor: ultrametaClint,
      meta: metaUltrametaClint,
      fonte: `Fonte: (${vendasA010} A010 × R$1.680) + (${sdrIa} SDR IA × R$700)`,
      icon: Target,
    },
    {
      titulo: "FATURAMENTO CLINT (Bruto)",
      valor: faturamentoClintBruto,
      meta: metaFaturamentoClint,
      fonte: "Fonte: Clint / Vendas novas",
      icon: DollarSign,
    },
    {
      titulo: "ULTRAMETA LÍQUIDO",
      valor: ultrametaLiquido,
      meta: metaUltrametaLiquido,
      fonte: `Fonte: ${vendasA010} Vendas A010 × R$1.400`,
      icon: TrendingUp,
    },
    {
      titulo: "FATURAMENTO LÍQUIDO",
      valor: faturamentoLiquido,
      meta: metaFaturamentoLiquido,
      fonte: "Fonte: Pagamentos recebidos",
      icon: Wallet,
    },
  ];

  return (
    <div className="space-y-3">
      {/* SDR IA Input */}
      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Users className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1">
              <Label htmlFor="sdr-ia" className="text-sm font-semibold text-foreground">
                SDR IA + IG (Manual)
              </Label>
              <p className="text-[10px] text-muted-foreground">
                Quantidade de leads SDR IA × R$700
              </p>
            </div>
            <Input
              id="sdr-ia"
              type="number"
              min={0}
              value={sdrIa}
              onChange={(e) => onSdrIaChange(parseInt(e.target.value) || 0)}
              className="w-20 h-8 text-center font-semibold"
            />
          </div>
        </CardContent>
      </Card>

      {metas.map((meta) => (
        <MetaProgressCard key={meta.titulo} {...meta} />
      ))}
    </div>
  );
}
