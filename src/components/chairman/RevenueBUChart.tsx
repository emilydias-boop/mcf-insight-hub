import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { BURevenueData } from "@/hooks/useChairmanMetrics";
import { Building2 } from "lucide-react";

interface RevenueBUChartProps {
  data: BURevenueData[];
  isLoading?: boolean;
}

const formatCurrency = (value: number) => {
  if (value >= 1000000) {
    return `R$ ${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `R$ ${(value / 1000).toFixed(0)}K`;
  }
  return `R$ ${value.toFixed(0)}`;
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-popover border border-border rounded-lg shadow-xl p-3 min-w-[180px]">
        <p className="font-medium text-sm mb-1">{data.label}</p>
        <p className="text-lg font-bold text-primary">{formatCurrency(data.value)}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {data.percentage.toFixed(1)}% do total
        </p>
      </div>
    );
  }
  return null;
};

export const RevenueBUChart = ({ data, isLoading }: RevenueBUChartProps) => {
  if (isLoading) {
    return (
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardHeader>
          <div className="h-6 w-48 bg-muted rounded animate-pulse" />
        </CardHeader>
        <CardContent>
          <div className="h-[300px] bg-muted/50 rounded animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  const chartData = data.slice(0, 8); // Top 8 BUs

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Building2 className="h-5 w-5 text-primary" />
          Faturamento por Linha de Negócio
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
            >
              <XAxis 
                type="number" 
                tickFormatter={(value) => formatCurrency(value)}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
              />
              <YAxis 
                type="category" 
                dataKey="label" 
                tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                width={90}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted)/0.3)' }} />
              <Bar 
                dataKey="value" 
                radius={[0, 4, 4, 0]}
                maxBarSize={35}
              >
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.color}
                    className="hover:opacity-80 transition-opacity cursor-pointer"
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        
        {/* Legend */}
        <div className="mt-4 flex flex-wrap gap-3">
          {chartData.slice(0, 5).map((bu) => (
            <div key={bu.bu} className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-sm" 
                style={{ backgroundColor: bu.color }}
              />
              <span className="text-xs text-muted-foreground">{bu.label}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
