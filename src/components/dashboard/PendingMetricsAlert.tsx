import { AlertCircle, Calendar, Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { usePendingMetrics } from "@/hooks/usePendingMetrics";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getCustomWeekStart, getCustomWeekEnd, formatDateForDB } from "@/lib/dateHelpers";
import { useQueryClient } from "@tanstack/react-query";

interface PendingMetricsAlertProps {
  onReviewClick: () => void;
}

export function PendingMetricsAlert({ onReviewClick }: PendingMetricsAlertProps) {
  const { pendingMetrics, isEmily, hasPendingMetrics, refetch } = usePendingMetrics();
  const [isClosingWeek, setIsClosingWeek] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const formatWeekLabel = (metric: { start_date: string; end_date: string; week_label?: string }) => {
    if (metric.week_label) return metric.week_label;
    const start = parseISO(metric.start_date);
    const end = parseISO(metric.end_date);
    return `${format(start, "dd/MM", { locale: ptBR })} - ${format(end, "dd/MM/yyyy", { locale: ptBR })}`;
  };

  // Calcular semana atual
  const hoje = new Date();
  const inicioSemana = getCustomWeekStart(hoje);
  const fimSemana = getCustomWeekEnd(hoje);
  const weekLabel = `${format(inicioSemana, "dd/MM", { locale: ptBR })} - ${format(fimSemana, "dd/MM/yyyy", { locale: ptBR })}`;

  // Verificar se semana atual já existe em weekly_metrics
  const semanaAtualPendente = pendingMetrics.find(m => m.start_date === formatDateForDB(inicioSemana));

  const handleFecharSemanaAtual = async () => {
    setIsClosingWeek(true);
    try {
      const weekStart = formatDateForDB(inicioSemana);
      const weekEnd = formatDateForDB(fimSemana);

      console.log(`🔄 Fechando semana atual: ${weekStart} a ${weekEnd}`);

      // Chamar edge function para calcular métricas
      const { data, error } = await supabase.functions.invoke('calculate-weekly-metrics', {
        body: { week_start: weekStart, week_end: weekEnd }
      });

      if (error) throw error;

      // Marcar como pendente de aprovação
      await supabase
        .from('weekly_metrics')
        .update({ approval_status: 'pending' })
        .eq('start_date', weekStart)
        .eq('end_date', weekEnd);

      toast({
        title: '✅ Semana fechada com sucesso!',
        description: `Métricas calculadas para ${weekLabel}. Revise agora.`,
      });

      // Invalidar queries e recarregar
      await queryClient.invalidateQueries({ queryKey: ['pending-metrics'] });
      await queryClient.invalidateQueries({ queryKey: ['evolution-data'] });
      await refetch();
      
      // Abrir modal de revisão automaticamente
      onReviewClick();

    } catch (err) {
      console.error('❌ Erro ao fechar semana:', err);
      toast({
        title: 'Erro ao fechar semana',
        description: err instanceof Error ? err.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setIsClosingWeek(false);
    }
  };

  if (!isEmily) {
    return null;
  }

  return (
    <div className="space-y-2 mb-4">
      {/* Botão para fechar semana atual (sempre visível para Emily) */}
      {!semanaAtualPendente && (
        <Alert className="border-blue-500/50 bg-blue-500/10">
          <Calendar className="h-4 w-4 text-blue-500" />
          <AlertTitle className="text-blue-500">Fechar Semana Atual</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span className="text-muted-foreground">
              Semana atual: <strong>{weekLabel}</strong>. Calcule e revise as métricas agora.
            </span>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleFecharSemanaAtual}
              disabled={isClosingWeek}
              className="ml-4 border-blue-500/50 text-blue-500 hover:bg-blue-500/20"
            >
              {isClosingWeek ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Calculando...
                </>
              ) : (
                'Fechar Semana'
              )}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Alerta de métricas pendentes */}
      {hasPendingMetrics && (
        <Alert className="border-amber-500/50 bg-amber-500/10">
          <AlertCircle className="h-4 w-4 text-amber-500" />
          <AlertTitle className="text-amber-500">Métricas Aguardando Aprovação</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span className="text-muted-foreground">
              {pendingMetrics.length === 1
                ? `A semana ${formatWeekLabel(pendingMetrics[0])} foi fechada e aguarda sua revisão.`
                : `${pendingMetrics.length} semanas foram fechadas e aguardam sua revisão.`}
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
      )}
    </div>
  );
}
