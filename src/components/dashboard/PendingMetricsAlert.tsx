import { AlertCircle, Calendar, Loader2, ChevronDown, History } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { usePendingMetrics } from "@/hooks/usePendingMetrics";
import { format, parseISO, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getCustomWeekStart, getCustomWeekEnd, formatDateForDB, addCustomWeeks } from "@/lib/dateHelpers";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface PendingMetricsAlertProps {
  onReviewClick: () => void;
}

interface WeekOption {
  label: string;
  startDate: Date;
  endDate: Date;
  startStr: string;
  endStr: string;
}

export function PendingMetricsAlert({ onReviewClick }: PendingMetricsAlertProps) {
  const { pendingMetrics, isEmily, hasPendingMetrics, refetch } = usePendingMetrics();
  const [isClosingWeek, setIsClosingWeek] = useState(false);
  const [closingWeekLabel, setClosingWeekLabel] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Buscar semanas já existentes no banco
  const { data: existingWeeks } = useQuery({
    queryKey: ['existing-weeks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('weekly_metrics')
        .select('start_date, end_date')
        .order('start_date', { ascending: false });
      
      if (error) throw error;
      return data?.map(w => w.start_date) || [];
    },
    enabled: isEmily,
  });

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

  // Gerar lista de semanas anteriores que não existem no banco (últimas 8 semanas)
  const missingWeeks = useMemo<WeekOption[]>(() => {
    if (!existingWeeks) return [];
    
    const weeks: WeekOption[] = [];
    
    // Gerar últimas 8 semanas (incluindo atual)
    for (let i = 0; i < 8; i++) {
      const refDate = subDays(hoje, i * 7);
      const start = getCustomWeekStart(refDate);
      const end = getCustomWeekEnd(start);
      const startStr = formatDateForDB(start);
      const endStr = formatDateForDB(end);
      
      // Verificar se já existe no banco
      if (!existingWeeks.includes(startStr)) {
        weeks.push({
          label: `${format(start, "dd/MM", { locale: ptBR })} - ${format(end, "dd/MM/yyyy", { locale: ptBR })}`,
          startDate: start,
          endDate: end,
          startStr,
          endStr,
        });
      }
    }
    
    return weeks;
  }, [existingWeeks, hoje]);

  // Verificar se semana atual já existe em weekly_metrics
  const semanaAtualPendente = pendingMetrics.find(m => m.start_date === formatDateForDB(inicioSemana));

  const handleFecharSemana = async (week: WeekOption) => {
    setIsClosingWeek(true);
    setClosingWeekLabel(week.label);
    try {
      console.log(`🔄 Fechando semana: ${week.startStr} a ${week.endStr}`);

      // Chamar edge function para calcular métricas
      const { data, error } = await supabase.functions.invoke('calculate-weekly-metrics', {
        body: { week_start: week.startStr, week_end: week.endStr }
      });

      if (error) throw error;

      // Marcar como pendente de aprovação
      await supabase
        .from('weekly_metrics')
        .update({ approval_status: 'pending' })
        .eq('start_date', week.startStr)
        .eq('end_date', week.endStr);

      toast({
        title: '✅ Semana fechada com sucesso!',
        description: `Métricas calculadas para ${week.label}. Revise agora.`,
      });

      // Invalidar queries e recarregar
      await queryClient.invalidateQueries({ queryKey: ['pending-metrics'] });
      await queryClient.invalidateQueries({ queryKey: ['existing-weeks'] });
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
      setClosingWeekLabel(null);
    }
  };

  if (!isEmily) {
    return null;
  }

  return (
    <div className="space-y-2 mb-4">
      {/* Botão para fechar semanas (dropdown com opções) */}
      {missingWeeks.length > 0 && (
        <Alert className="border-blue-500/50 bg-blue-500/10">
          <Calendar className="h-4 w-4 text-blue-500" />
          <AlertTitle className="text-blue-500">Fechar Semana</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span className="text-muted-foreground">
              {missingWeeks.length === 1 
                ? `1 semana disponível para fechar: ${missingWeeks[0].label}`
                : `${missingWeeks.length} semanas disponíveis para fechar`
              }
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={isClosingWeek}
                  className="ml-4 border-blue-500/50 text-blue-500 hover:bg-blue-500/20"
                >
                  {isClosingWeek ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {closingWeekLabel ? `Fechando ${closingWeekLabel}...` : 'Calculando...'}
                    </>
                  ) : (
                    <>
                      Fechar Semana
                      <ChevronDown className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {missingWeeks.map((week, idx) => (
                  <DropdownMenuItem
                    key={week.startStr}
                    onClick={() => handleFecharSemana(week)}
                    className="cursor-pointer"
                  >
                    <History className="mr-2 h-4 w-4" />
                    {idx === 0 && formatDateForDB(inicioSemana) === week.startStr 
                      ? `${week.label} (atual)` 
                      : week.label
                    }
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
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
