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
  AlertCircle,
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
import type { PendentesBreakdown } from "@/lib/pendentesBreakdown";

interface TeamKPICardsProps {
  kpis: TeamKPIs;
  isLoading?: boolean;
  isToday?: boolean;
  pendentesHoje?: number;
  bu?: string;
  semStatus?: number;
  /** Breakdown REAL dos pendentes (vindo da agenda deduplicada). Quando
   *  fornecido, substitui o cálculo aritmético R1 − Realizada − No-Show. */
  pendentesBreakdown?: PendentesBreakdown | null;
  onCardClick?: (bucket: KpiBucket, title: string) => void;
  /** true quando o range inclui hoje/futuro — muda o rótulo de Sem Status */
  isFutureWindow?: boolean;
  /** Médias por SDR e por Closer p/ breakdown nas taxas */
  taxaConversaoBreakdown?: { sdrAvg: number; closerAvg: number } | null;
  taxaNoShowBreakdown?: { sdrAvg: number; closerAvg: number } | null;
}

export function TeamKPICards({
  kpis,
  isLoading,
  isToday,
  pendentesHoje,
  bu,
  semStatus,
  pendentesBreakdown,
  onCardClick,
  isFutureWindow = true,
  taxaConversaoBreakdown,
  taxaNoShowBreakdown,
}: TeamKPICardsProps) {
  const isConsorcio = (bu || '').toLowerCase() === 'consorcio';
  const semStatusLabel = isFutureWindow ? "Sem Status" : "Backlog Histórico";
  const semStatusTooltip = isFutureWindow
    ? "Pendentes vivos: reuniões cuja hora já passou e ainda estão sem desfecho (convidada/remarcada/sem sucesso). Cap de 2 por lead."
    : "Backlog histórico: reuniões do período que ficaram sem desfecho registrado (convidada/remarcada/sem sucesso). Cap de 2 por lead.";
  // Pendentes / Sem Desfecho — quando temos o breakdown real (vindo da agenda
  // deduplicada) usamos ele. Caso contrário, fallback para o cálculo
  // aritmético antigo (R1 − Realizada − No-Show).
  const pendentesArit =
    (kpis.totalR1Agendada || 0)
    - (kpis.totalRealizadas || 0)
    - (kpis.totalNoShows || 0);
  const pendentesTotal = pendentesBreakdown ? pendentesBreakdown.total : pendentesArit;
  const pendentesTooltip = pendentesBreakdown
    ? `Reuniões marcadas para o período que não viraram Realizada nem No-Show:\n• Futuras (ainda vão acontecer): ${pendentesBreakdown.futuras}\n• Vencidas s/ desfecho (já passaram e ninguém atualizou): ${pendentesBreakdown.vencidas}\n• Remanejados/Restituídos: ${pendentesBreakdown.canceladas}\nClique para destrinchar.`
    : "R1 Agendada − (Realizada + No-Show). Inclui futuras (ainda vão acontecer), vencidas sem desfecho registrado e canceladas/remarcadas. Clique para destrinchar.";
  const cards: Array<{
    title: string;
    value: string | number;
    icon: typeof Calendar;
    color: string;
    bgColor: string;
    tooltip: string;
    bucket?: KpiBucket;
    subline?: string;
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
      tooltip: "Reuniões criadas (booked_at) no período. Fato consumado — só conta o que já foi criado até hoje.",
      bucket: "agendamentos" as KpiBucket,
    },
    {
      title: "R1 Agendada",
      value: kpis.totalR1Agendada,
      icon: CalendarCheck,
      color: "text-cyan-500",
      bgColor: "bg-cyan-500/10",
      tooltip: "Reuniões marcadas PARA o período (scheduled_at). Inclui datas futuras dentro do range — visão de planejamento.",
      bucket: "r1_agendada" as KpiBucket,
    },
    {
      title: "R1 Realizada",
      value: kpis.totalRealizadas,
      icon: CheckCircle,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
      tooltip: "Reuniões efetivamente realizadas no período. Fato consumado — não inclui reuniões futuras.",
      bucket: "realizada" as KpiBucket,
    },
    {
      title: "No-Shows",
      value: kpis.totalNoShows,
      icon: XCircle,
      color: "text-red-500",
      bgColor: "bg-red-500/10",
      tooltip: "No-shows ocorridos (cap de 1/lead antes de 28/04, cap de 2/lead a partir de 28/04). Fato consumado — não inclui futuro.",
      bucket: "no_show" as KpiBucket,
    },
    // Card unificado: Pendentes / Sem Desfecho
    ...(pendentesTotal > 0 ? [{
      title: "Pendentes / Sem Desfecho",
      value: pendentesTotal,
      icon: AlertCircle,
      color: "text-yellow-500",
      bgColor: "bg-yellow-500/10",
      tooltip: pendentesTooltip,
      bucket: "pendentes" as KpiBucket,
      subline: pendentesBreakdown
        ? `${pendentesBreakdown.futuras} futuras · ${pendentesBreakdown.vencidas} vencidas · ${pendentesBreakdown.canceladas} reman.`
        : undefined,
    }] : []),
    {
      title: isConsorcio ? "Propostas Fechadas" : "Contratos",
      value: kpis.totalContratos || 0,
      icon: FileText,
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
      tooltip: isConsorcio
        ? "Propostas fechadas via R1 (contract_paid_at no período). Fato consumado."
        : "Total comercial da tabela Closers: Contrato Pago + Outside. Não depende apenas de atribuição ao SDR.",
      bucket: "contratos" as KpiBucket,
    },
    ...(isConsorcio ? [] : [{
      title: "Outside",
      value: kpis.totalOutside || 0,
      icon: ExternalLink,
      color: "text-rose-400",
      bgColor: "bg-rose-400/10",
      tooltip: "Contratos pagos sem R1 anterior. Fato consumado no período."
    }]),
    {
      title: "Taxa Conversão",
      value: `${kpis.taxaConversao.toFixed(1)}%`,
      icon: TrendingUp,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
      tooltip: "Global agregada: Σ Contratos / Σ R1 Realizada × 100.",
    },
    {
      title: "Taxa No-Show",
      value: `${kpis.taxaNoShow.toFixed(1)}%`,
      icon: AlertTriangle,
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
      tooltip: "Global agregada: Σ No-Shows / Σ R1 Agendada × 100.",
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
                      {card.subline && !isLoading && (
                        <p className="text-[9px] text-muted-foreground/80 truncate mt-0.5">
                          {card.subline}
                        </p>
                      )}
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
