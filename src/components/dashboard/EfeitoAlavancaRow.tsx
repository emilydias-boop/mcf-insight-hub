import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/formatters";
import { TrendingUp } from "lucide-react";

interface PeriodMetricsProps {
  label: string;
  totalCartas: number;
  comissaoTotal: number;
}

function PeriodMetrics({ label, totalCartas, comissaoTotal }: PeriodMetricsProps) {
  return (
    <div className="space-y-3">
      <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
        {label}
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Total em Cartas:</span>
          <span className="text-sm font-semibold text-foreground">{formatCurrency(totalCartas)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Comissão Total:</span>
          <span className="text-sm font-semibold text-success">{formatCurrency(comissaoTotal)}</span>
        </div>
      </div>
    </div>
  );
}

interface EfeitoAlavancaRowProps {
  semanaLabel: string;
  mesLabel: string;
  // Semana
  totalCartasSemanal: number;
  comissaoSemanal: number;
  // Mês
  totalCartasMensal: number;
  comissaoMensal: number;
  // Ano
  totalCartasAnual: number;
  comissaoAnual: number;
  isLoading?: boolean;
}

export function EfeitoAlavancaRow({
  semanaLabel,
  mesLabel,
  totalCartasSemanal,
  comissaoSemanal,
  totalCartasMensal,
  comissaoMensal,
  totalCartasAnual,
  comissaoAnual,
  isLoading = false,
}: EfeitoAlavancaRowProps) {
  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <div className="h-6 w-40 bg-muted animate-pulse rounded" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                <div className="h-3 w-32 bg-muted animate-pulse rounded" />
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
          Efeito Alavanca
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <PeriodMetrics 
            label={semanaLabel}
            totalCartas={totalCartasSemanal}
            comissaoTotal={comissaoSemanal}
          />
          <PeriodMetrics 
            label={mesLabel}
            totalCartas={totalCartasMensal}
            comissaoTotal={comissaoMensal}
          />
          <PeriodMetrics 
            label="Ano 2026"
            totalCartas={totalCartasAnual}
            comissaoTotal={comissaoAnual}
          />
        </div>
      </CardContent>
    </Card>
  );
}
