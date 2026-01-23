import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus, DollarSign, Receipt, PiggyBank, Percent } from "lucide-react";
import { KPIData } from "@/hooks/useChairmanMetrics";
import { cn } from "@/lib/utils";

interface ChairmanKPICardsProps {
  faturamento: KPIData;
  despesas: KPIData;
  lucro: KPIData;
  margem: KPIData;
  isLoading?: boolean;
}

const formatCurrency = (value: number) => {
  if (value >= 1000000) {
    return `R$ ${(value / 1000000).toFixed(2)}M`;
  }
  if (value >= 1000) {
    return `R$ ${(value / 1000).toFixed(1)}K`;
  }
  return `R$ ${value.toFixed(0)}`;
};

const formatPercent = (value: number) => `${value.toFixed(1)}%`;

interface SparklineProps {
  data: number[];
  color: string;
  height?: number;
}

const Sparkline = ({ data, color, height = 40 }: SparklineProps) => {
  if (!data.length) return null;
  
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * 100;
    const y = height - ((value - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width="100%" height={height} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="opacity-60"
      />
    </svg>
  );
};

interface KPICardProps {
  title: string;
  icon: React.ReactNode;
  data: KPIData;
  format: 'currency' | 'percent';
  invertColors?: boolean;
  accentColor: string;
}

const KPICard = ({ title, icon, data, format, invertColors = false, accentColor }: KPICardProps) => {
  const TrendIcon = data.trend === 'up' ? TrendingUp : data.trend === 'down' ? TrendingDown : Minus;
  
  const isPositive = invertColors 
    ? data.trend === 'down' 
    : data.trend === 'up';
  
  const trendColorClass = isPositive 
    ? 'text-emerald-500' 
    : data.trend === 'stable' 
      ? 'text-muted-foreground' 
      : 'text-rose-500';

  const formattedValue = format === 'currency' 
    ? formatCurrency(data.value) 
    : formatPercent(data.value);

  return (
    <Card className="relative overflow-hidden bg-card/50 backdrop-blur-sm border-border/50 p-6 group hover:border-primary/30 transition-all duration-300">
      {/* Background gradient accent */}
      <div 
        className="absolute inset-0 opacity-5 group-hover:opacity-10 transition-opacity"
        style={{ background: `linear-gradient(135deg, ${accentColor} 0%, transparent 60%)` }}
      />
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div 
              className="p-2 rounded-lg"
              style={{ backgroundColor: `${accentColor}20` }}
            >
              {icon}
            </div>
            <span className="text-sm font-medium text-muted-foreground">{title}</span>
          </div>
          <div className={cn("flex items-center gap-1 text-sm font-medium", trendColorClass)}>
            <TrendIcon className="h-4 w-4" />
            <span>{data.changePercent > 0 ? '+' : ''}{data.changePercent.toFixed(1)}%</span>
          </div>
        </div>
        
        <div className="mb-4">
          <span className="text-3xl font-bold tracking-tight">{formattedValue}</span>
        </div>
        
        <div className="h-10">
          <Sparkline 
            data={data.sparklineData} 
            color={accentColor}
          />
        </div>
        
        <div className="mt-2 text-xs text-muted-foreground">
          Período anterior: {format === 'currency' 
            ? formatCurrency(data.previousValue) 
            : formatPercent(data.previousValue)}
        </div>
      </div>
    </Card>
  );
};

export const ChairmanKPICards = ({ faturamento, despesas, lucro, margem, isLoading }: ChairmanKPICardsProps) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="p-6 animate-pulse">
            <div className="h-4 w-24 bg-muted rounded mb-4" />
            <div className="h-8 w-32 bg-muted rounded mb-4" />
            <div className="h-10 w-full bg-muted rounded" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <KPICard
        title="Faturamento Geral"
        icon={<DollarSign className="h-5 w-5 text-emerald-500" />}
        data={faturamento}
        format="currency"
        accentColor="hsl(142, 76%, 36%)"
      />
      <KPICard
        title="Despesas Gerais"
        icon={<Receipt className="h-5 w-5 text-rose-500" />}
        data={despesas}
        format="currency"
        invertColors
        accentColor="hsl(346, 77%, 49%)"
      />
      <KPICard
        title="Lucro Geral"
        icon={<PiggyBank className="h-5 w-5 text-blue-500" />}
        data={lucro}
        format="currency"
        accentColor="hsl(217, 91%, 60%)"
      />
      <KPICard
        title="Margem de Lucro"
        icon={<Percent className="h-5 w-5 text-amber-500" />}
        data={margem}
        format="percent"
        accentColor="hsl(45, 93%, 47%)"
      />
    </div>
  );
};
