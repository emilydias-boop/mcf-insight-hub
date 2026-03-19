import { Card, CardContent } from '@/components/ui/card';
import { DollarSign, AlertTriangle, CheckCircle, Clock, CreditCard, Flame, PhoneOff } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { BillingKPIs } from '@/types/billing';

interface CobrancaKPIsProps {
  kpis: BillingKPIs | undefined;
  isLoading: boolean;
}

export const CobrancaKPIs = ({ kpis, isLoading }: CobrancaKPIsProps) => {
  const cards = [
    {
      label: 'Total Contratado',
      value: kpis ? formatCurrency(kpis.valorTotalContratado) : '-',
      icon: DollarSign,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'Total Pago',
      value: kpis ? formatCurrency(kpis.valorTotalPago) : '-',
      icon: CheckCircle,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      label: 'Saldo Devedor',
      value: kpis ? formatCurrency(kpis.saldoDevedor) : '-',
      icon: AlertTriangle,
      color: 'text-red-600',
      bg: 'bg-red-50',
    },
    {
      label: 'Assinaturas Ativas',
      value: kpis ? `${kpis.assinaturasAtivas}` : '-',
      subtitle: kpis ? `${kpis.assinaturasAtrasadas} atrasadas · ${kpis.assinaturasQuitadas} quitadas` : '',
      icon: CreditCard,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
    {
      label: 'Parcelas',
      value: kpis ? `${kpis.parcelasPagas} / ${kpis.parcelasTotais}` : '-',
      subtitle: 'pagas / total',
      icon: Clock,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      label: 'Clientes em Risco',
      value: kpis?.clientesEmRisco != null ? `${kpis.clientesEmRisco}` : '-',
      subtitle: '3+ parcelas atrasadas',
      icon: Flame,
      color: 'text-red-600',
      bg: 'bg-red-50',
    },
    {
      label: 'Nunca Contatados',
      value: kpis?.nuncaContatados != null ? `${kpis.nuncaContatados}` : '-',
      subtitle: 'atrasados sem contato',
      icon: PhoneOff,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
      {cards.map((card) => (
        <Card key={card.label} className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className={`p-1.5 rounded-md ${card.bg}`}>
                <card.icon className={`h-4 w-4 ${card.color}`} />
              </div>
              <span className="text-xs text-muted-foreground">{card.label}</span>
            </div>
            <div className="text-lg font-bold text-foreground">
              {isLoading ? '...' : card.value}
            </div>
            {card.subtitle && (
              <div className="text-xs text-muted-foreground mt-0.5">{card.subtitle}</div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};