import { Calendar, CheckCircle, XCircle, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { MeetingSummary } from "@/hooks/useSdrMeetings";

interface MeetingSummaryCardsProps {
  summary: MeetingSummary;
  isLoading?: boolean;
}

export function MeetingSummaryCards({ summary, isLoading }: MeetingSummaryCardsProps) {
  const cards = [
    {
      title: "Agendamentos",
      value: summary.reunioesAgendadas,
      icon: Calendar,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10"
    },
    {
      title: "Realizadas",
      value: summary.reunioesRealizadas,
      icon: CheckCircle,
      color: "text-green-500",
      bgColor: "bg-green-500/10"
    },
    {
      title: "No-Shows",
      value: summary.noShows,
      icon: XCircle,
      color: "text-red-500",
      bgColor: "bg-red-500/10"
    },
    {
      title: "Taxa Conversão",
      value: `${summary.taxaConversao}%`,
      icon: TrendingUp,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10"
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((card) => (
        <Card key={card.title} className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${card.bgColor}`}>
                <card.icon className={`h-5 w-5 ${card.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground truncate">{card.title}</p>
                <p className="text-2xl font-bold text-foreground">
                  {isLoading ? "..." : card.value}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
