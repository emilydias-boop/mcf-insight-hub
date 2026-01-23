import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { CostDistribution } from "@/hooks/useChairmanMetrics";
import { PieChartIcon } from "lucide-react";

interface CostsDistributionChartProps {
  data: CostDistribution[];
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

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-popover border border-border rounded-lg shadow-xl p-3 min-w-[160px]">
        <p className="font-medium text-sm mb-1">{data.label}</p>
        <p className="text-lg font-bold">{formatCurrency(data.value)}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {data.percentage.toFixed(1)}% do total
        </p>
      </div>
    );
  }
  return null;
};

const CustomLegend = ({ payload }: any) => {
  return (
    <div className="flex flex-wrap justify-center gap-4 mt-4">
      {payload?.map((entry: any, index: number) => (
        <div key={`legend-${index}`} className="flex items-center gap-2">
          <div 
            className="w-3 h-3 rounded-full" 
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-sm text-muted-foreground">{entry.value}</span>
        </div>
      ))}
    </div>
  );
};

export const CostsDistributionChart = ({ data, isLoading }: CostsDistributionChartProps) => {
  if (isLoading) {
    return (
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardHeader>
          <div className="h-6 w-48 bg-muted rounded animate-pulse" />
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center">
            <div className="w-48 h-48 bg-muted rounded-full animate-pulse" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <PieChartIcon className="h-5 w-5 text-primary" />
          Distribuição de Custos
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
                nameKey="label"
              >
                {data.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.color}
                    className="hover:opacity-80 transition-opacity cursor-pointer"
                    stroke="hsl(var(--background))"
                    strokeWidth={2}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend content={<CustomLegend />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        
        {/* Center label */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ marginTop: '-60px' }}>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-lg font-bold">{formatCurrency(total)}</p>
          </div>
        </div>
        
        {/* Detail list */}
        <div className="mt-4 space-y-2">
          {data.map((item) => (
            <div key={item.category} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div 
                  className="w-2 h-2 rounded-full" 
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-muted-foreground">{item.label}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-medium">{formatCurrency(item.value)}</span>
                <span className="text-muted-foreground w-12 text-right">
                  {item.percentage.toFixed(0)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
