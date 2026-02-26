import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { TrendingUp, Settings2 } from "lucide-react";

function getProgressColor(percent: number): string {
  if (percent >= 80) return "bg-success";
  if (percent >= 50) return "bg-warning";
  return "bg-destructive";
}

interface PeriodMetricsProps {
  label: string;
  totalCartas: number;
  meta: number;
  comissaoTotal: number;
}

function PeriodMetrics({ label, totalCartas, meta, comissaoTotal }: PeriodMetricsProps) {
  const percent = meta > 0 ? Math.min((totalCartas / meta) * 100, 100) : 0;
  const percentDisplay = meta > 0 ? (totalCartas / meta) * 100 : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground uppercase tracking-wider font-medium">
          {label}
        </span>
        <span className={cn(
          "font-semibold",
          percentDisplay >= 80 ? "text-success" : percentDisplay >= 50 ? "text-warning" : "text-destructive"
        )}>
          {percentDisplay.toFixed(0)}%
        </span>
      </div>
      <Progress
        value={percent}
        className="h-2"
        indicatorClassName={getProgressColor(percentDisplay)}
      />
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Apurado: <span className="text-foreground font-medium">{formatCurrency(totalCartas)}</span></span>
        <span>Meta: {formatCurrency(meta)}</span>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Comissão Total:</span>
        <span className="font-semibold text-success">{formatCurrency(comissaoTotal)}</span>
      </div>
    </div>
  );
}

interface EfeitoAlavancaRowProps {
  semanaLabel: string;
  mesLabel: string;
  totalCartasSemanal: number;
  comissaoSemanal: number;
  metaSemanal: number;
  totalCartasMensal: number;
  comissaoMensal: number;
  metaMensal: number;
  totalCartasAnual: number;
  comissaoAnual: number;
  metaAnual: number;
  isLoading?: boolean;
  onEditGoals?: () => void;
  canEdit?: boolean;
}

export function EfeitoAlavancaRow({
  semanaLabel,
  mesLabel,
  totalCartasSemanal,
  comissaoSemanal,
  metaSemanal,
  totalCartasMensal,
  comissaoMensal,
  metaMensal,
  totalCartasAnual,
  comissaoAnual,
  metaAnual,
  isLoading = false,
  onEditGoals,
  canEdit = false,
}: EfeitoAlavancaRowProps) {
  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <div className="h-6 w-40 bg-muted animate-pulse rounded" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                <div className="h-2 w-full bg-muted animate-pulse rounded" />
                <div className="h-3 w-32 bg-muted animate-pulse rounded" />
              </div>
            ))}
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
            <TrendingUp className="h-4 w-4 text-primary" />
          </div>
          <span className="flex-1">Efeito Alavanca</span>
          {canEdit && onEditGoals && (
            <button
              onClick={onEditGoals}
              className="p-1.5 rounded-md hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors"
              title="Editar metas"
            >
              <Settings2 className="h-4 w-4" />
            </button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6">
          <PeriodMetrics
            label={semanaLabel}
            totalCartas={totalCartasSemanal}
            meta={metaSemanal}
            comissaoTotal={comissaoSemanal}
          />
          <PeriodMetrics
            label={mesLabel}
            totalCartas={totalCartasMensal}
            meta={metaMensal}
            comissaoTotal={comissaoMensal}
          />
          <PeriodMetrics
            label="Ano 2026"
            totalCartas={totalCartasAnual}
            meta={metaAnual}
            comissaoTotal={comissaoAnual}
          />
        </div>
      </CardContent>
    </Card>
  );
}
