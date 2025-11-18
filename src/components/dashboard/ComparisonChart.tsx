import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { ComparisonPeriod } from "@/types/dashboard";
import { formatCurrency } from "@/lib/formatters";
import { formatCustomWeekRange } from "@/lib/dateHelpers";

interface ComparisonChartProps {
  periodoA: ComparisonPeriod;
  periodoB: ComparisonPeriod;
}

export function ComparisonChart({ periodoA, periodoB }: ComparisonChartProps) {
  // Mock data - em produção, buscar dados reais baseado nos períodos
  const data = [
    {
      name: 'Faturamento',
      periodoA: 180000,
      periodoB: 200000,
    },
    {
      name: 'Custos',
      periodoA: 120000,
      periodoB: 110000,
    },
    {
      name: 'Lucro',
      periodoA: 60000,
      periodoB: 90000,
    },
    {
      name: 'Vendas A010',
      periodoA: 45,
      periodoB: 52,
    },
    {
      name: 'Vendas Contratos',
      periodoA: 12,
      periodoB: 15,
    },
  ];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload) return null;

    return (
      <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
        <p className="font-semibold text-foreground mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: {label.includes('Vendas') 
              ? entry.value 
              : formatCurrency(entry.value)}
          </p>
        ))}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gráfico Comparativo</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis 
              dataKey="name" 
              stroke="hsl(var(--muted-foreground))"
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
            />
            <YAxis 
              stroke="hsl(var(--muted-foreground))"
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              payload={[
                { 
                  value: `Período A (${formatCustomWeekRange(periodoA.inicio)})`, 
                  type: 'rect', 
                  color: 'hsl(var(--primary))' 
                },
                { 
                  value: `Período B (${formatCustomWeekRange(periodoB.inicio)})`, 
                  type: 'rect', 
                  color: 'hsl(var(--success))' 
                },
              ]}
            />
            <Bar 
              dataKey="periodoA" 
              fill="hsl(var(--primary))" 
              name={`Período A`}
              radius={[4, 4, 0, 0]}
            />
            <Bar 
              dataKey="periodoB" 
              fill="hsl(var(--success))" 
              name={`Período B`}
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
