import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { GRMetrics, GR_PRODUCTS } from '@/types/gr-types';
import { useGRProductDistribution } from '@/hooks/useGRDetailMetrics';
import { formatCurrency, formatPercent } from '@/lib/formatters';
import { Users, TrendingUp, Clock, Target, DollarSign, Loader2 } from 'lucide-react';

interface GRPerformanceTabProps {
  walletId: string;
  metrics?: GRMetrics | null;
}

export const GRPerformanceTab = ({ walletId, metrics }: GRPerformanceTabProps) => {
  const { data: productDistribution, isLoading } = useGRProductDistribution(walletId);
  
  const metricCards = [
    {
      title: 'Total de Leads',
      value: metrics?.total_entries || 0,
      icon: Users,
      color: 'text-blue-500',
    },
    {
      title: 'Leads Ativos',
      value: metrics?.ativos || 0,
      icon: Target,
      color: 'text-primary',
    },
    {
      title: 'Taxa de Conversão',
      value: `${metrics?.taxa_conversao || 0}%`,
      icon: TrendingUp,
      color: 'text-emerald-500',
    },
    {
      title: 'Tempo Médio',
      value: `${metrics?.tempo_medio_dias || 0} dias`,
      icon: Clock,
      color: 'text-amber-500',
    },
    {
      title: 'Receita Gerada',
      value: formatCurrency(metrics?.receita_gerada || 0),
      icon: DollarSign,
      color: 'text-green-500',
    },
  ];
  
  const productColors: Record<string, string> = {
    consorcio: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    he: 'bg-green-500/20 text-green-400 border-green-500/30',
    ip: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    cp: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    clube: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
    leilao: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    outro: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  };
  
  return (
    <div className="space-y-6">
      {/* Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {metricCards.map((card) => (
          <Card key={card.title}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <card.icon className={`h-4 w-4 ${card.color}`} />
                <span className="text-sm text-muted-foreground">{card.title}</span>
              </div>
              <p className="text-2xl font-bold">{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {/* Product Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Distribuição por Produto</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : !productDistribution || productDistribution.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum produto registrado ainda
            </p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {productDistribution.map((product) => {
                const productInfo = GR_PRODUCTS.find(p => p.code === product.code);
                return (
                  <div 
                    key={product.code}
                    className="flex flex-col items-center p-4 rounded-lg border bg-card"
                  >
                    <Badge 
                      variant="outline" 
                      className={productColors[product.code] || productColors.outro}
                    >
                      {productInfo?.name || product.code}
                    </Badge>
                    <p className="text-2xl font-bold mt-2">{product.count}</p>
                    <p className="text-sm text-muted-foreground">
                      {product.percentage.toFixed(1)}%
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Status Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Distribuição por Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex flex-col items-center p-4 rounded-lg border bg-emerald-500/10">
              <span className="text-sm text-muted-foreground">Ativos</span>
              <p className="text-2xl font-bold text-emerald-500">{metrics?.ativos || 0}</p>
            </div>
            <div className="flex flex-col items-center p-4 rounded-lg border bg-blue-500/10">
              <span className="text-sm text-muted-foreground">Em Negociação</span>
              <p className="text-2xl font-bold text-blue-500">{metrics?.em_negociacao || 0}</p>
            </div>
            <div className="flex flex-col items-center p-4 rounded-lg border bg-primary/10">
              <span className="text-sm text-muted-foreground">Convertidos</span>
              <p className="text-2xl font-bold text-primary">{metrics?.convertidos || 0}</p>
            </div>
            <div className="flex flex-col items-center p-4 rounded-lg border bg-muted">
              <span className="text-sm text-muted-foreground">Inativos</span>
              <p className="text-2xl font-bold text-muted-foreground">{metrics?.inativos || 0}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
