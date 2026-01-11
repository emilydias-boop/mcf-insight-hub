import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface SetorCardProps {
  titulo: string;
  icone: LucideIcon;
  metaMensal: number;
  apuradoMensal: number;
  metaAnual: number;
  apuradoAnual: number;
  periodoLabel?: string;
  isLoading?: boolean;
}

function getProgressColor(percent: number): string {
  if (percent >= 80) return "bg-success";
  if (percent >= 50) return "bg-warning";
  return "bg-destructive";
}

export function SetorCard({
  titulo,
  icone: Icon,
  metaMensal,
  apuradoMensal,
  metaAnual,
  apuradoAnual,
  periodoLabel = "Mês Atual",
  isLoading = false,
}: SetorCardProps) {
  const percentMensal = metaMensal > 0 ? Math.min((apuradoMensal / metaMensal) * 100, 100) : 0;
  const percentAnual = metaAnual > 0 ? Math.min((apuradoAnual / metaAnual) * 100, 100) : 0;

  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <div className="h-6 w-32 bg-muted animate-pulse rounded" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="h-4 w-24 bg-muted animate-pulse rounded" />
            <div className="h-2 w-full bg-muted animate-pulse rounded" />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-24 bg-muted animate-pulse rounded" />
            <div className="h-2 w-full bg-muted animate-pulse rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border hover:border-primary/50 transition-colors">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          {titulo}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Período (Mês ou Filtrado) */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground uppercase tracking-wider font-medium">
              {periodoLabel}
            </span>
            <span className={cn(
              "font-semibold",
              percentMensal >= 80 ? "text-success" : percentMensal >= 50 ? "text-warning" : "text-destructive"
            )}>
              {percentMensal.toFixed(0)}%
            </span>
          </div>
          <Progress 
            value={percentMensal} 
            className="h-2"
            indicatorClassName={getProgressColor(percentMensal)}
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Apurado: <span className="text-foreground font-medium">{formatCurrency(apuradoMensal)}</span></span>
            <span>Meta: {formatCurrency(metaMensal)}</span>
          </div>
        </div>

        {/* Ano */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground uppercase tracking-wider font-medium">
              Ano 2026
            </span>
            <span className={cn(
              "font-semibold",
              percentAnual >= 80 ? "text-success" : percentAnual >= 50 ? "text-warning" : "text-destructive"
            )}>
              {percentAnual.toFixed(0)}%
            </span>
          </div>
          <Progress 
            value={percentAnual} 
            className="h-2"
            indicatorClassName={getProgressColor(percentAnual)}
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Apurado: <span className="text-foreground font-medium">{formatCurrency(apuradoAnual)}</span></span>
            <span>Meta: {formatCurrency(metaAnual)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
