import { Card, CardContent } from '@/components/ui/card';
import { CalendarCheck, CalendarClock, AlertCircle, TrendingUp } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { Skeleton } from '@/components/ui/skeleton';

export interface MonthKPIData {
  parcelasDoMes: number;
  parcelasPagas: number;
  parcelasAtrasadas: number;
  parcelasPendentes: number;
  valorAReceber: number;
  valorRecebido: number;
  valorAtrasado: number;
  taxaRecebimento: number;
}

interface CobrancaMonthKPIsProps {
  data: MonthKPIData | undefined;
  isLoading: boolean;
  monthLabel: string;
}

export const CobrancaMonthKPIs = ({ data, isLoading, monthLabel }: CobrancaMonthKPIsProps) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    );
  }

  if (!data) return null;

  const cards = [
    {
      label: `Recebido em ${monthLabel}`,
      value: formatCurrency(data.valorRecebido),
      subtitle: `${data.parcelasPagas} parcelas pagas`,
      icon: CalendarCheck,
      color: 'text-green-500',
      bg: 'bg-green-500/10',
    },
    {
      label: 'Pendente no mês',
      value: formatCurrency(data.valorAReceber - data.valorRecebido - data.valorAtrasado),
      subtitle: `${data.parcelasPendentes} parcelas a vencer`,
      icon: CalendarClock,
      color: 'text-amber-500',
      bg: 'bg-amber-500/10',
    },
    {
      label: 'Atrasado no mês',
      value: formatCurrency(data.valorAtrasado),
      subtitle: `${data.parcelasAtrasadas} parcelas vencidas`,
      icon: AlertCircle,
      color: 'text-red-500',
      bg: 'bg-red-500/10',
    },
    {
      label: 'Taxa de recebimento',
      value: `${data.taxaRecebimento.toFixed(1)}%`,
      subtitle: `${data.parcelasPagas} de ${data.parcelasDoMes} parcelas`,
      icon: TrendingUp,
      color: data.taxaRecebimento >= 80 ? 'text-green-500' : data.taxaRecebimento >= 50 ? 'text-amber-500' : 'text-red-500',
      bg: data.taxaRecebimento >= 80 ? 'bg-green-500/10' : data.taxaRecebimento >= 50 ? 'bg-amber-500/10' : 'bg-red-500/10',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {cards.map((card) => (
        <Card key={card.label} className="border-border/50">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1.5">
              <div className={`p-1 rounded-md ${card.bg}`}>
                <card.icon className={`h-3.5 w-3.5 ${card.color}`} />
              </div>
              <span className="text-[11px] text-muted-foreground">{card.label}</span>
            </div>
            <div className="text-base font-bold text-foreground">{card.value}</div>
            <div className="text-[11px] text-muted-foreground">{card.subtitle}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
