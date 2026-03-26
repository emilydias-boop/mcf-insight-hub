import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from "recharts";
import { BarChart3 } from "lucide-react";
import { MetricWithMeta } from "@/hooks/useSdrPerformanceData";

interface SdrMetaVsRealizadoChartProps {
  metrics: MetricWithMeta[];
  isLoading?: boolean;
}

export function SdrMetaVsRealizadoChart({ metrics, isLoading }: SdrMetaVsRealizadoChartProps) {
  if (isLoading) {
    return (
      <Card className="bg-card border-border animate-pulse">
        <CardContent className="p-6 h-[300px]" />
      </Card>
    );
  }

  // Only show metrics that have a meta > 0
  const chartMetrics = metrics.filter((m) => m.meta > 0 && m.format !== "percent" && m.format !== "duration");

  const data = chartMetrics.map((m) => ({
    name: m.label,
    realizado: m.realized,
    meta: m.meta,
    attainment: m.attainment,
  }));

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          Meta × Realizado
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 60, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
            <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickLine={false} />
            <YAxis type="category" dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickLine={false} width={90} />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                color: "hsl(var(--foreground))",
              }}
              formatter={(value: number, name: string) => [value, name === "realizado" ? "Realizado" : "Meta"]}
            />
            <Bar dataKey="meta" fill="hsl(var(--muted))" radius={[0, 4, 4, 0]} barSize={16} name="Meta" />
            <Bar dataKey="realizado" radius={[0, 4, 4, 0]} barSize={16} name="Realizado">
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.attainment >= 100 ? "hsl(var(--chart-2))" : entry.attainment >= 70 ? "hsl(var(--chart-4))" : "hsl(var(--destructive))"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
