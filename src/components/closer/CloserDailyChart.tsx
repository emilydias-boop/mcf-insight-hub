import { useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { TrendingUp } from "lucide-react";

import { CloserDailyRow } from "@/hooks/useCloserPerformanceData";

interface CloserDailyChartProps {
  dailyRows: CloserDailyRow[];
  isLoading?: boolean;
}

export function CloserDailyChart({ dailyRows, isLoading }: CloserDailyChartProps) {
  const chartData = useMemo(() => {
    return dailyRows
      .filter((row) => row.isBusinessDay || row.contratos > 0)
      .map((row) => ({
        date: format(row.date, "dd/MM", { locale: ptBR }),
        contratos: row.contratos,
      }));
  }, [dailyRows]);

  if (isLoading) {
    return (
      <Card className="bg-card border-border animate-pulse">
        <CardContent className="p-6 h-[300px]" />
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          Contratos Diários
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="date"
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                color: "hsl(var(--foreground))",
              }}
            />
            <ReferenceLine
              y={4}
              label={{ value: "Meta (4)", position: "right", fill: "hsl(var(--destructive))", fontSize: 11 }}
              stroke="hsl(var(--destructive))"
              strokeDasharray="6 3"
              strokeWidth={2}
            />
            <Bar
              dataKey="contratos"
              name="Contratos"
              fill="hsl(var(--primary))"
              radius={[4, 4, 0, 0]}
              maxBarSize={32}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
