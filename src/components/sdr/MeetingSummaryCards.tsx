import { Calendar, CheckCircle, XCircle, TrendingUp, FileText, RotateCcw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface MeetingSummaryV2 {
  primeiroAgendamento: number;
  reagendamento: number;
  totalAgendamentos: number;
  noShows: number;
  realizadas: number;
  contratos: number;
  taxaConversao: number;
  taxaNoShow: number;
}

// Compatibilidade com interface antiga
export interface MeetingSummary {
  reunioesAgendadas: number;
  reunioesRealizadas: number;
  noShows: number;
  taxaConversao: number;
}

interface MeetingSummaryCardsProps {
  summary: MeetingSummaryV2 | MeetingSummary;
  isLoading?: boolean;
}

// Type guard para verificar se é a nova interface
function isSummaryV2(summary: MeetingSummaryV2 | MeetingSummary): summary is MeetingSummaryV2 {
  return 'primeiroAgendamento' in summary;
}

export function MeetingSummaryCards({ summary, isLoading }: MeetingSummaryCardsProps) {
  // Normalizar para nova interface
  const normalizedSummary: MeetingSummaryV2 = isSummaryV2(summary) 
    ? summary 
    : {
        primeiroAgendamento: summary.reunioesAgendadas,
        reagendamento: 0,
        totalAgendamentos: summary.reunioesAgendadas,
        noShows: summary.noShows,
        realizadas: summary.reunioesRealizadas,
        contratos: 0,
        taxaConversao: summary.taxaConversao,
        taxaNoShow: summary.reunioesAgendadas > 0 
          ? (summary.noShows / summary.reunioesAgendadas) * 100 
          : 0
      };

  const cards = [
    {
      title: "Total Agendamentos",
      value: normalizedSummary.totalAgendamentos,
      icon: Calendar,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
      tooltip: `1º Agendamento: ${normalizedSummary.primeiroAgendamento}\nReagendamento: ${normalizedSummary.reagendamento}`
    },
    {
      title: "Realizadas",
      value: normalizedSummary.realizadas,
      icon: CheckCircle,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
      tooltip: "Reuniões realizadas (por intermediação)"
    },
    {
      title: "No-Shows",
      value: normalizedSummary.noShows,
      icon: XCircle,
      color: "text-red-500",
      bgColor: "bg-red-500/10",
      tooltip: "No-shows (creditado ao owner no momento)"
    },
    {
      title: "Taxa Conversão",
      value: `${normalizedSummary.taxaConversao.toFixed(1)}%`,
      icon: TrendingUp,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
      tooltip: "Realizadas / Total Agendamentos × 100"
    },
    {
      title: "Contratos",
      value: normalizedSummary.contratos,
      icon: FileText,
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
      tooltip: "Contratos fechados (por intermediação)"
    }
  ];

  // Filtrar cards se for interface antiga (sem contratos)
  const visibleCards = isSummaryV2(summary) ? cards : cards.filter(c => c.title !== "Contratos");

  return (
    <TooltipProvider>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-4">
        {visibleCards.map((card) => (
          <Tooltip key={card.title}>
            <TooltipTrigger asChild>
              <Card className="bg-card border-border cursor-help">
                <CardContent className="p-2 sm:p-4">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className={`p-1.5 sm:p-2 rounded-lg ${card.bgColor}`}>
                      <card.icon className={`h-4 w-4 sm:h-5 sm:w-5 ${card.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{card.title}</p>
                      <p className="text-lg sm:text-2xl font-bold text-foreground">
                        {isLoading ? "..." : card.value}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent>
              <p className="whitespace-pre-line">{card.tooltip}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}
