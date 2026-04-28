import { 
  Calendar, 
  CheckCircle, 
  XCircle, 
  FileText, 
  TrendingUp, 
  AlertTriangle,
  Clock,
  ExternalLink
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
  /**
   * No-shows contados pela regra do Closer (deduplicado por deal/closer, sem cap por SDR).
   * Quando informado, o card de No-Shows exibe a MÉDIA entre a regra SDR (kpis.totalNoShows)
   * e a regra Closer, e o tooltip detalha os dois valores.
   */
  closerNoShows?: number;
}

export function TeamKPICards({ kpis, isLoading, isToday, pendentesHoje, closerNoShows }: TeamKPICardsProps) {
  // ===== No-Show: média entre regra SDR (com cap) e regra Closer (dedup por deal) =====
  const sdrNoShow = kpis.totalNoShows;
  const hasCloserRule = typeof closerNoShows === "number";
  const avgNoShow = hasCloserRule
    ? Math.round((sdrNoShow + (closerNoShows as number)) / 2)
    : sdrNoShow;

  // Recalcula taxa de no-show usando o valor médio (mantém base = R1 Agendada)
  const taxaNoShowAvg = kpis.totalR1Agendada > 0
    ? (avgNoShow / kpis.totalR1Agendada) * 100
    : 0;

  // ===== Bloco 1: AGENDADO no período (data de criação do agendamento) =====
  const blocoAgendado = [
    ...(isToday ? [{
      title: "Pendentes Hoje",
      value: pendentesHoje ?? 0,
      icon: Clock,
      color: "text-sky-500",
      bgColor: "bg-sky-500/10",
      tooltip: "Reuniões agendadas para hoje que ainda não aconteceram",
    }] : []),
    {
      title: "Agendamentos",
      value: kpis.totalAgendamentos,
      icon: Calendar,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
      tooltip: "Reuniões CRIADAS pelos SDRs no período (data de marcação). A reunião em si pode ocorrer em qualquer data futura.",
    },
  ];

  // ===== Bloco 2: ACONTECEU no período (data em que a reunião estava marcada) =====
  const blocoAconteceu = [
    {
      title: "R1 Realizada",
      value: kpis.totalRealizadas,
      icon: CheckCircle,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
      tooltip: "Reuniões marcadas para este período que foram realizadas (status: completed / contract_paid).",
    },
    {
      title: "No-Shows",
      value: avgNoShow,
      icon: XCircle,
      color: "text-red-500",
      bgColor: "bg-red-500/10",
      tooltip: hasCloserRule
        ? `Média entre regras de contagem:\n• SDR (cap por lead): ${sdrNoShow}\n• Closer (dedup por deal/closer): ${closerNoShows}\n• Média exibida: ${avgNoShow}\nBase: reuniões marcadas para o período com status 'no_show'.`
        : "Reuniões marcadas para o período com status 'no_show' (regra SDR com cap por lead).",
    },
    {
      title: "Contratos",
      value: (kpis.totalContratos || 0) - (kpis.totalOutside || 0),
      icon: FileText,
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
      tooltip: "Contratos pagos via R1 no período (exclui outside).",
    },
    {
      title: "Outside",
      value: kpis.totalOutside || 0,
      icon: ExternalLink,
      color: "text-rose-400",
      bgColor: "bg-rose-400/10",
      tooltip: "Leads que compraram contrato antes da reunião R1.",
    },
    {
      title: "Taxa Conversão",
      value: `${kpis.taxaConversao.toFixed(1)}%`,
      icon: TrendingUp,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
      tooltip: "Contratos ÷ R1 Realizada × 100.",
    },
    {
      title: "Taxa No-Show",
      value: `${taxaNoShowAvg.toFixed(1)}%`,
      icon: AlertTriangle,
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
      tooltip: hasCloserRule
        ? `No-Shows (média) ÷ R1 Agendada × 100.\nValor exibido usa a média das duas regras (SDR com cap e Closer dedup).`
        : "No-Shows ÷ R1 Agendada × 100.",
    },
  ];

  const renderCard = (card: typeof blocoAconteceu[number]) => (
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
      <TooltipContent className="max-w-xs whitespace-pre-line">
        <p>{card.tooltip}</p>
      </TooltipContent>
    </Tooltip>
  );

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Bloco 1 — Agendado no período */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="h-1 w-1 rounded-full bg-blue-500" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Agendado no período
            </h3>
            <span className="text-[10px] text-muted-foreground/70">
              (data em que a reunião foi marcada)
            </span>
          </div>
          <div className={`grid grid-cols-2 md:grid-cols-${isToday ? 2 : 1} lg:grid-cols-${isToday ? 2 : 1} gap-3 ${isToday ? '' : 'max-w-xs'}`}>
            {blocoAgendado.map(renderCard)}
          </div>
        </div>

        {/* Bloco 2 — Aconteceu no período */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="h-1 w-1 rounded-full bg-green-500" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Aconteceu no período
            </h3>
            <span className="text-[10px] text-muted-foreground/70">
              (data em que a reunião estava marcada para ocorrer)
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {blocoAconteceu.map(renderCard)}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
