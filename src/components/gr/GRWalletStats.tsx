import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GRMetrics } from '@/types/gr-types';
import { Users, Target, Clock, DollarSign, TrendingUp } from 'lucide-react';

interface GRWalletStatsProps {
  metrics: GRMetrics;
  title?: string;
}

export const GRWalletStats = ({ metrics, title = "Estatísticas" }: GRWalletStatsProps) => {
  const stats = [
    {
      label: 'Total de Clientes',
      value: metrics.total_entries,
      icon: Users,
      color: 'text-blue-500',
    },
    {
      label: 'Ativos',
      value: metrics.ativos,
      icon: Users,
      color: 'text-emerald-500',
    },
    {
      label: 'Taxa de Conversão',
      value: `${metrics.taxa_conversao}%`,
      icon: Target,
      color: 'text-primary',
    },
    {
      label: 'Tempo Médio',
      value: `${metrics.tempo_medio_dias} dias`,
      icon: Clock,
      color: 'text-amber-500',
    },
    {
      label: 'Receita Gerada',
      value: `R$ ${(metrics.receita_gerada / 1000).toFixed(0)}k`,
      icon: DollarSign,
      color: 'text-green-500',
    },
  ];
  
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      {stats.map(stat => (
        <Card key={stat.label}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-muted ${stat.color}`}>
                <stat.icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
