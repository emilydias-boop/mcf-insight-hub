import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { LucideIcon, Settings2 } from "lucide-react";

interface MetricColumnProps {
  label: string;
  apurado: number;
  meta: number;
}

function getProgressColor(percent: number): string {
  if (percent >= 80) return "bg-success";
  if (percent >= 50) return "bg-warning";
  return "bg-destructive";
}

function MetricColumn({ label, apurado, meta }: MetricColumnProps) {
  const percent = meta > 0 ? Math.min((apurado / meta) * 100, 100) : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground uppercase tracking-wider font-medium">
          {label}
        </span>
        <span className={cn(
          "font-semibold",
          percent >= 80 ? "text-success" : percent >= 50 ? "text-warning" : "text-destructive"
        )}>
          {percent.toFixed(0)}%
        </span>
      </div>
      <Progress 
        value={percent} 
        className="h-2"
        indicatorClassName={getProgressColor(percent)}
      />
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Apurado: <span className="text-foreground font-medium">{formatCurrency(apurado)}</span></span>
        <span>Meta: {formatCurrency(meta)}</span>
      </div>
    </div>
  );
}

interface SetorRowProps {
  titulo: string;
  icone: LucideIcon;
  // Semana
  metaSemanal: number;
  apuradoSemanal: number;
  semanaLabel: string;
  // Mês
  metaMensal: number;
  apuradoMensal: number;
  mesLabel: string;
  // Ano
  metaAnual: number;
  apuradoAnual: number;
  isLoading?: boolean;
  onEditGoals?: () => void;
  canEdit?: boolean;
}

export function SetorRow({
  titulo,
  icone: Icon,
  metaSemanal,
  apuradoSemanal,
  semanaLabel,
  metaMensal,
  apuradoMensal,
  mesLabel,
  metaAnual,
  apuradoAnual,
  isLoading = false,
  onEditGoals,
  canEdit = false,
}: SetorRowProps) {
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
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <span className="flex-1">{titulo}</span>
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
          <MetricColumn 
            label={semanaLabel}
            apurado={apuradoSemanal}
            meta={metaSemanal}
          />
          <MetricColumn 
            label={mesLabel}
            apurado={apuradoMensal}
            meta={metaMensal}
          />
          <MetricColumn 
            label="Ano 2026"
            apurado={apuradoAnual}
            meta={metaAnual}
          />
        </div>
      </CardContent>
    </Card>
  );
}
