import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatCurrency } from "@/lib/formatters";
import { Sigma } from "lucide-react";

interface PeriodTotalProps {
  label: string;
  apurado: number;
  meta: number;
}

function getProgressColor(percent: number): string {
  if (percent >= 100) return "bg-success";
  if (percent >= 70) return "bg-primary";
  if (percent >= 50) return "bg-warning";
  return "bg-destructive";
}

function getPercentColor(percent: number): string {
  if (percent >= 100) return "text-success";
  if (percent >= 70) return "text-primary";
  if (percent >= 50) return "text-warning";
  return "text-destructive";
}

function PeriodTotal({ label, apurado, meta }: PeriodTotalProps) {
  const percent = meta > 0 ? Math.min((apurado / meta) * 100, 100) : 0;
  const percentDisplay = meta > 0 ? (apurado / meta) * 100 : 0;
  const isComplete = percentDisplay >= 100;

  return (
    <div className="flex-1 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground uppercase tracking-wider font-medium">
          {label}
        </span>
        <span className={`text-2xl font-bold ${getPercentColor(percentDisplay)}`}>
          {percentDisplay.toFixed(0)}%
        </span>
      </div>
      
      <Progress 
        value={percent} 
        className="h-4 bg-muted" 
        indicatorClassName={getProgressColor(percentDisplay)}
      />

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Apurado:</span>
          <span className="text-xl font-bold text-foreground">
            {formatCurrency(apurado)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Meta:</span>
          <span className="text-base font-medium text-muted-foreground">
            {formatCurrency(meta)}
          </span>
        </div>
      </div>

      {isComplete && (
        <div className="text-center">
          <span className="text-xs font-bold text-success bg-success/20 px-3 py-1 rounded-full">
            META BATIDA!
          </span>
        </div>
      )}
    </div>
  );
}

interface TotalGeralRowProps {
  semanaLabel: string;
  mesLabel: string;
  apuradoSemanal: number;
  metaSemanal: number;
  apuradoMensal: number;
  metaMensal: number;
  apuradoAnual: number;
  metaAnual: number;
  isLoading?: boolean;
}

export function TotalGeralRow({
  semanaLabel,
  mesLabel,
  apuradoSemanal,
  metaSemanal,
  apuradoMensal,
  metaMensal,
  apuradoAnual,
  metaAnual,
  isLoading = false,
}: TotalGeralRowProps) {
  if (isLoading) {
    return (
      <Card className="border-2 border-primary/20 shadow-lg">
        <CardContent className="p-6 md:p-8">
          <div className="flex items-center gap-4 mb-8">
            <div className="h-14 w-14 bg-muted animate-pulse rounded-xl" />
            <div className="space-y-2">
              <div className="h-7 w-48 bg-muted animate-pulse rounded" />
              <div className="h-4 w-32 bg-muted animate-pulse rounded" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-4">
                <div className="h-5 w-32 bg-muted animate-pulse rounded" />
                <div className="h-4 w-full bg-muted animate-pulse rounded-full" />
                <div className="h-6 w-40 bg-muted animate-pulse rounded" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-primary/20 shadow-lg bg-card">
      <CardContent className="p-6 md:p-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 rounded-xl bg-primary/10">
            <Sigma className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
              Total Geral
            </h2>
            <p className="text-sm text-muted-foreground">
              Soma de todos os setores
            </p>
          </div>
        </div>

        {/* Period Columns */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
          <PeriodTotal 
            label={semanaLabel}
            apurado={apuradoSemanal}
            meta={metaSemanal}
          />
          
          <PeriodTotal 
            label={mesLabel}
            apurado={apuradoMensal}
            meta={metaMensal}
          />
          
          <PeriodTotal 
            label="Ano 2026"
            apurado={apuradoAnual}
            meta={metaAnual}
          />
        </div>
      </CardContent>
    </Card>
  );
}
