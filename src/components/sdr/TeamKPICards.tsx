import { 
  Users, 
  Calendar, 
  CheckCircle, 
  XCircle, 
  FileText, 
  TrendingUp, 
  AlertTriangle,
  Clock
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TeamKPIs } from "@/hooks/useTeamMeetingsData";

interface TeamKPICardsProps {
  kpis: TeamKPIs;
  isLoading?: boolean;
  isToday?: boolean;
  pendentesHoje?: number;
}

export function TeamKPICards({ kpis, isLoading, isToday, pendentesHoje }: TeamKPICardsProps) {
  const cards = [
    {
      title: "SDRs Ativos",
      value: kpis.sdrCount,
      icon: Users,
      color: "text-cyan-500",
      bgColor: "bg-cyan-500/10",
      tooltip: "SDRs com atividade no período"
    },
    // Card condicional: Pendentes Hoje (2ª posição)
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
      tooltip: "Total de reuniões agendadas no período"
    },
    {
      title: "Realizadas",
      value: kpis.totalRealizadas,
      icon: CheckCircle,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
      tooltip: "Reuniões realizadas (por intermediação)"
    },
    {
      title: "No-Shows",
      value: kpis.totalNoShows,
      icon: XCircle,
      color: "text-red-500",
      bgColor: "bg-red-500/10",
      tooltip: "Total de no-shows no período"
    },
    {
      title: "Contratos",
      value: kpis.totalContratos,
      icon: FileText,
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
      tooltip: "Contratos fechados (por intermediação)"
    },
    {
      title: "Taxa Conversão",
      value: `${kpis.taxaConversao.toFixed(1)}%`,
      icon: TrendingUp,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
      tooltip: "Realizadas / Total Agendamentos × 100"
    },
    {
      title: "Taxa No-Show",
      value: `${kpis.taxaNoShow.toFixed(1)}%`,
      icon: AlertTriangle,
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
      tooltip: "No-Shows / Total Agendamentos × 100"
    },
  ];

  return (
    <TooltipProvider>
      <div className={`grid grid-cols-2 md:grid-cols-4 ${isToday ? 'lg:grid-cols-8' : 'lg:grid-cols-7'} gap-3`}>
        {cards.map((card) => (
          <Tooltip key={card.title}>
            <TooltipTrigger asChild>
              <Card className="bg-card border-border cursor-help hover:border-primary/30 transition-colors">
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
              <p>{card.tooltip}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}
