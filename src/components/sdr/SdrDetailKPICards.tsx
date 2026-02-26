import { Calendar, CheckCircle, XCircle, FileCheck, TrendingUp, TrendingDown, Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { SdrSummaryRow } from "@/hooks/useTeamMeetingsData";
import { TeamAverages } from "@/hooks/useSdrDetailData";

interface SdrDetailKPICardsProps {
  metrics: SdrSummaryRow | null;
  teamAverages: TeamAverages;
  isLoading?: boolean;
}

interface KPICardProps {
  title: string;
  value: number | string;
  teamAverage: number;
  icon: React.ReactNode;
  tooltip?: string;
  format?: "number" | "percent";
  invertComparison?: boolean;
}

function KPICard({ title, value, teamAverage, icon, tooltip, format = "number", invertComparison = false }: KPICardProps) {
  const numValue = typeof value === 'number' ? value : parseFloat(value.toString());
  const diff = numValue - teamAverage;
  const isPositive = invertComparison ? diff < 0 : diff > 0;
  const diffPercent = teamAverage > 0 ? Math.abs((diff / teamAverage) * 100) : 0;
  
  const formattedValue = format === "percent" 
    ? `${numValue.toFixed(1)}%` 
    : numValue.toFixed(0);
    
  const formattedAvg = format === "percent"
    ? `${teamAverage.toFixed(1)}%`
    : teamAverage.toFixed(1);

  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <p className="text-xs text-muted-foreground">{title}</p>
              {tooltip && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground/60 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[220px] text-xs">
                    {tooltip}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
            <p className="text-2xl font-bold text-foreground">{formattedValue}</p>
          </div>
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            {icon}
          </div>
        </div>
        
        <div className="mt-3 pt-3 border-t border-border">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Média do time: {formattedAvg}</span>
            {diffPercent > 0 && (
              <span className={`flex items-center gap-1 ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {diff > 0 ? '+' : ''}{format === "percent" ? diff.toFixed(1) + '%' : diff.toFixed(0)}
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function SdrDetailKPICards({ metrics, teamAverages, isLoading }: SdrDetailKPICardsProps) {
  if (isLoading || !metrics) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="bg-card border-border animate-pulse">
            <CardContent className="p-4 h-[120px]" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <KPICard
          title="Agendamentos"
          value={metrics.agendamentos}
          teamAverage={teamAverages.avgAgendamentos}
          icon={<Calendar className="h-4 w-4" />}
          tooltip="Leads agendados pelo SDR neste período (pela data de criação do agendamento)"
        />
        <KPICard
          title="R1 Agendada"
          value={metrics.r1Agendada}
          teamAverage={teamAverages.avgR1Agendada}
          icon={<Calendar className="h-4 w-4" />}
          tooltip="Reuniões marcadas PARA este período (pela data da reunião)"
        />
        <KPICard
          title="R1 Realizada"
          value={metrics.r1Realizada}
          teamAverage={teamAverages.avgR1Realizada}
          icon={<CheckCircle className="h-4 w-4" />}
          tooltip="Reuniões que de fato aconteceram no período"
        />
        <KPICard
          title="No-Show"
          value={metrics.noShows}
          teamAverage={teamAverages.avgNoShows}
          icon={<XCircle className="h-4 w-4" />}
          invertComparison={true}
          tooltip="Reuniões agendadas para o período que não ocorreram (R1 Agendada − R1 Realizada)"
        />
        <KPICard
          title="Contratos Pagos"
          value={metrics.contratos}
          teamAverage={teamAverages.avgContratos}
          icon={<FileCheck className="h-4 w-4" />}
          tooltip="Contratos pagos no período"
        />
      </div>
    </TooltipProvider>
  );
}
