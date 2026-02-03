import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/formatters';
import { DollarSign, TrendingUp, Wallet, Target } from 'lucide-react';

interface ConsorcioPayoutSummaryProps {
  ote: number;
  fixo: number;
  variavel: number;
  totalConta: number;
}

export function ConsorcioPayoutSummary({ 
  ote, 
  fixo, 
  variavel, 
  totalConta 
}: ConsorcioPayoutSummaryProps) {
  const cards = [
    { 
      label: 'OTE', 
      value: ote, 
      sublabel: '(RH)', 
      icon: Target,
      color: 'text-muted-foreground' 
    },
    { 
      label: 'Fixo', 
      value: fixo, 
      sublabel: '70%', 
      icon: DollarSign,
      color: 'text-blue-400' 
    },
    { 
      label: 'Variável', 
      value: variavel, 
      sublabel: '30%', 
      icon: TrendingUp,
      color: 'text-green-400' 
    },
    { 
      label: 'Total Conta', 
      value: totalConta, 
      sublabel: '', 
      icon: Wallet,
      color: 'text-primary' 
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((card) => (
        <Card key={card.label} className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <card.icon className={`h-5 w-5 ${card.color}`} />
              {card.sublabel && (
                <span className="text-xs text-muted-foreground">{card.sublabel}</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{card.label}</p>
            <p className={`text-lg font-bold ${card.color}`}>
              {formatCurrency(card.value)}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
