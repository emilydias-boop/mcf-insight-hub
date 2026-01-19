import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Phone, PhoneIncoming, PhoneMissed, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CallMetricsCardsProps {
  totalCalls: number;
  answered: number;
  unanswered: number;
  avgDurationSeconds: number;
  isLoading?: boolean;
  className?: string;
}

const formatDuration = (seconds: number): string => {
  if (seconds === 0) return '0s';
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (minutes === 0) return `${secs}s`;
  return `${minutes}m ${secs}s`;
};

export const CallMetricsCards = ({
  totalCalls,
  answered,
  unanswered,
  avgDurationSeconds,
  isLoading = false,
  className,
}: CallMetricsCardsProps) => {
  const cards = [
    {
      title: 'Total Ligações',
      value: totalCalls,
      icon: Phone,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: 'Contatos',
      value: answered,
      icon: PhoneIncoming,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
      subtitle: totalCalls > 0 ? `${((answered / totalCalls) * 100).toFixed(0)}%` : '0%',
    },
    {
      title: 'Não Atendidas',
      value: unanswered,
      icon: PhoneMissed,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
      subtitle: totalCalls > 0 ? `${((unanswered / totalCalls) * 100).toFixed(0)}%` : '0%',
    },
    {
      title: 'Tempo Médio',
      value: formatDuration(avgDurationSeconds),
      icon: Clock,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
      isFormatted: true,
    },
  ];

  if (isLoading) {
    return (
      <div className={cn("space-y-3", className)}>
        <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
          <Phone className="h-4 w-4" />
          Minhas Ligações
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="p-3">
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="h-6 w-12" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
        <Phone className="h-4 w-4" />
        Minhas Ligações
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map((card) => (
          <Card 
            key={card.title} 
            className="p-3 flex items-center gap-3 hover:shadow-sm transition-shadow"
          >
            <div className={cn("p-2 rounded-lg", card.bgColor)}>
              <card.icon className={cn("h-4 w-4", card.color)} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground truncate">{card.title}</p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-bold">
                  {card.isFormatted ? card.value : card.value.toLocaleString('pt-BR')}
                </span>
                {card.subtitle && (
                  <span className={cn("text-xs", card.color)}>{card.subtitle}</span>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
