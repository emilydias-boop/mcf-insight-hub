import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { usePendingMetrics } from "@/hooks/usePendingMetrics";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PendingMetricsAlertProps {
  onReviewClick: () => void;
}

export function PendingMetricsAlert({ onReviewClick }: PendingMetricsAlertProps) {
  const { pendingMetrics, isEmily, hasPendingMetrics } = usePendingMetrics();

  if (!isEmily || !hasPendingMetrics) {
    return null;
  }

  const formatWeekLabel = (metric: { start_date: string; end_date: string; week_label?: string }) => {
    if (metric.week_label) return metric.week_label;
    const start = parseISO(metric.start_date);
    const end = parseISO(metric.end_date);
    return `${format(start, "dd/MM", { locale: ptBR })} - ${format(end, "dd/MM/yyyy", { locale: ptBR })}`;
  };

  return (
    <Alert className="mb-4 border-amber-500/50 bg-amber-500/10">
      <AlertCircle className="h-4 w-4 text-amber-500" />
      <AlertTitle className="text-amber-500">Métricas Aguardando Aprovação</AlertTitle>
      <AlertDescription className="flex items-center justify-between">
        <span className="text-muted-foreground">
          {pendingMetrics.length === 1
            ? `A semana ${formatWeekLabel(pendingMetrics[0])} foi fechada automaticamente e aguarda sua revisão.`
            : `${pendingMetrics.length} semanas foram fechadas automaticamente e aguardam sua revisão.`}
        </span>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onReviewClick}
          className="ml-4 border-amber-500/50 text-amber-500 hover:bg-amber-500/20"
        >
          Revisar Agora
        </Button>
      </AlertDescription>
    </Alert>
  );
}
