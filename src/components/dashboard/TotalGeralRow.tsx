import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatCurrency } from "@/lib/formatters";
import { Sigma, TrendingUp, TrendingDown, Minus } from "lucide-react";

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

function PeriodTotal({ label, apurado, meta }: PeriodTotalProps) {
  const percent = meta > 0 ? Math.min((apurado / meta) * 100, 100) : 0;
  const percentDisplay = meta > 0 ? (apurado / meta) * 100 : 0;
  const isComplete = percentDisplay >= 100;

  return (
    <div className="flex-1 space-y-3">
      <div className="text-sm text-primary-foreground/70 uppercase tracking-wider font-semibold">
        {label}
      </div>
      
      <div className="space-y-2">
        <Progress 
          value={percent} 
          className="h-3 bg-primary-foreground/20" 
          indicatorClassName={getProgressColor(percentDisplay)}
        />
        
        <div className="flex items-center justify-between text-sm">
          <span className="text-primary-foreground/60">
            {percentDisplay.toFixed(0)}%
          </span>
          {isComplete && (
            <span className="text-xs font-bold text-success bg-success/20 px-2 py-0.5 rounded-full">
              META BATIDA!
            </span>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-sm text-primary-foreground/70">Apurado:</span>
          <span className="text-xl font-bold text-primary-foreground">
            {formatCurrency(apurado)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-primary-foreground/70">Meta:</span>
          <span className="text-base font-medium text-primary-foreground/80">
            {formatCurrency(meta)}
          </span>
        </div>
      </div>
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
  // Calculate overall trend
  const percentMensal = metaMensal > 0 ? (apuradoMensal / metaMensal) * 100 : 0;
  
  const TrendIcon = percentMensal >= 100 
    ? TrendingUp 
    : percentMensal >= 70 
      ? Minus 
      : TrendingDown;
  
  const trendColor = percentMensal >= 100 
    ? "text-success" 
    : percentMensal >= 70 
      ? "text-warning" 
      : "text-destructive";

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-primary to-primary/80 border-primary/50 shadow-lg">
        <CardContent className="p-6 md:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-12 w-12 bg-primary-foreground/20 animate-pulse rounded-xl" />
            <div className="h-8 w-48 bg-primary-foreground/20 animate-pulse rounded" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-3">
                <div className="h-5 w-32 bg-primary-foreground/20 animate-pulse rounded" />
                <div className="h-3 w-full bg-primary-foreground/20 animate-pulse rounded-full" />
                <div className="h-6 w-40 bg-primary-foreground/20 animate-pulse rounded" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-primary via-primary to-primary/90 border-primary/50 shadow-xl hover:shadow-2xl transition-shadow">
      <CardContent className="p-6 md:p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-primary-foreground/15 backdrop-blur-sm">
              <Sigma className="h-7 w-7 text-primary-foreground" />
            </div>
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-primary-foreground tracking-tight">
                Total Geral
              </h2>
              <p className="text-sm text-primary-foreground/60">
                Soma de todos os setores
              </p>
            </div>
          </div>
          
          <div className={`flex items-center gap-2 ${trendColor}`}>
            <TrendIcon className="h-6 w-6" />
            <span className="text-lg font-semibold">
              {percentMensal.toFixed(0)}%
            </span>
          </div>
        </div>

        {/* Period Columns */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          <PeriodTotal 
            label={semanaLabel}
            apurado={apuradoSemanal}
            meta={metaSemanal}
          />
          
          <div className="hidden md:block w-px bg-primary-foreground/20" />
          
          <PeriodTotal 
            label={mesLabel}
            apurado={apuradoMensal}
            meta={metaMensal}
          />
          
          <div className="hidden md:block w-px bg-primary-foreground/20" />
          
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
