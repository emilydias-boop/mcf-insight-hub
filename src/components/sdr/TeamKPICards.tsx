import { 
  Calendar, 
  CalendarCheck,
  CheckCircle, 
  XCircle, 
  FileText, 
  TrendingUp, 
  AlertTriangle,
  Clock,
  ExternalLink,
  AlertCircle
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TeamKPIs } from "@/hooks/useTeamMeetingsData";
import type { KpiBucket } from "@/components/sdr/KpiDrillDownDialog";

interface TeamKPICardsProps {
  kpis: TeamKPIs;
  isLoading?: boolean;
  isToday?: boolean;
  pendentesHoje?: number;
  bu?: string;
  semStatus?: number;
  onCardClick?: (bucket: KpiBucket, title: string) => void;
}

export function TeamKPICards({ kpis, isLoading, isToday, pendentesHoje, bu, semStatus, onCardClick }: TeamKPICardsProps) {
  const isConsorcio = (bu || '').toLowerCase() === 'consorcio';
  const cards: Array<{
    title: string;
    value: string | number;
    icon: typeof Calendar;
    color: string;
    bgColor: string;
    tooltip: string;
    bucket?: KpiBucket;
  }> = [
    // Card condicional: Pendentes Hoje (1ª posição)
    ...(isToday ? [{
      title: "Pendentes Hoje",
      value: pendentesHoje ?? 0,
      icon: Clock,
      color: "text-sky-500",
      bgColor: "bg-sky-500/10",
      tooltip: "Reuniões agendadas para hoje que ainda não aconteceram"
    }] : []),
    {
      title: "Agendamentos",
      value: kpis.totalAgendamentos,
      icon: Calendar,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
      tooltip: "Total de reuniões agendadas no período",
      bucket: "agendamentos" as KpiBucket,
    },
    {
      title: "R1 Agendada",
      value: kpis.totalR1Agendada,
      icon: CalendarCheck,
      color: "text-cyan-500",
      bgColor: "bg-cyan-500/10",
      tooltip: "Reuniões marcadas PARA o período (independente de quando foram criadas)",
      bucket: "r1_agendada" as KpiBucket,
    },
    {
      title: "R1 Realizada",
      value: kpis.totalRealizadas,
      icon: CheckCircle,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
      tooltip: "Reuniões realizadas (por intermediação)",
      bucket: "realizada" as KpiBucket,
    },
    {
      title: "No-Shows",
      value: kpis.totalNoShows,
      icon: XCircle,
      color: "text-red-500",
      bgColor: "bg-red-500/10",
      tooltip: "Total de no-shows no período",
      bucket: "no_show" as KpiBucket,
    },
    // Card condicional: Sem Status — reuniões com status pendente (invited/rescheduled/sem_sucesso)
    ...((semStatus ?? 0) > 0 ? [{
      title: "Sem Status",
      value: semStatus ?? 0,
      icon: AlertCircle,
      color: "text-yellow-500",
      bgColor: "bg-yellow-500/10",
      tooltip: "Reuniões com status pendente (convidada/remarcada/sem sucesso). Cap de 2 por lead. Diferença entre R1 Agendada e o somatório de Realizadas + No-Shows + Contratos.",
      bucket: "sem_status" as KpiBucket,
    }] : []),
    {
      title: isConsorcio ? "Propostas Fechadas" : "Contratos",
      value: isConsorcio
        ? (kpis.totalContratos || 0)
        : ((kpis.totalContratos || 0) - (kpis.totalOutside || 0)),
      icon: FileText,
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
      tooltip: isConsorcio
        ? "Propostas fechadas atribuídas via R1 (deal_produtos_adquiridos + stages de fechamento)"
        : "Contratos pagos via R1 (exclui outside)",
      bucket: "contratos" as KpiBucket,
    },
    ...(isConsorcio ? [] : [{
      title: "Outside",
      value: kpis.totalOutside || 0,
      icon: ExternalLink,
      color: "text-rose-400",
      bgColor: "bg-rose-400/10",
      tooltip: "Leads que compraram contrato antes da reunião R1"
    }]),
    {
      title: "Taxa Conversão",
      value: `${kpis.taxaConversao.toFixed(1)}%`,
      icon: TrendingUp,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
      tooltip: "Contratos / Realizadas × 100"
    },
    {
      title: "Taxa No-Show",
      value: `${kpis.taxaNoShow.toFixed(1)}%`,
      icon: AlertTriangle,
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
      tooltip: "No-Shows / R1 Agendada × 100"
    },
  ];

  // Tailwind precisa de classes estáticas — mapa seguro por contagem
  const lgColsClass: Record<number, string> = {
    5: "lg:grid-cols-5",
    6: "lg:grid-cols-6",
    7: "lg:grid-cols-7",
    8: "lg:grid-cols-8",
    9: "lg:grid-cols-9",
    10: "lg:grid-cols-10",
  };
  const lgCols = lgColsClass[cards.length] || "lg:grid-cols-7";

  return (
    <TooltipProvider>
      <div className={`grid grid-cols-2 md:grid-cols-4 ${lgCols} gap-3`}>
        {cards.map((card) => (
          <Tooltip key={card.title}>
            <TooltipTrigger asChild>
              <Card
                className={`bg-card border-border transition-colors ${
                  card.bucket && onCardClick
                    ? "cursor-pointer hover:border-primary/60 hover:bg-muted/30"
                    : "cursor-help hover:border-primary/30"
                }`}
                onClick={() => {
                  if (card.bucket && onCardClick) onCardClick(card.bucket, card.title);
                }}
              >
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-lg ${card.bgColor}`}>
                      <card.icon className={`h-4 w-4 ${card.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-muted-foreground truncate uppercase tracking-wide">
                        {card.title}
                      </p>
                      <p className="text-xl font-bold text-foreground">
                        {isLoading ? "..." : card.value}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent>
              <p>{card.tooltip}{card.bucket && onCardClick ? " — clique para ver leads" : ""}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}
