import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ComparisonEntry } from '@/hooks/useCloserComparison';
import { BarChart3 } from 'lucide-react';

interface Props {
  data: ComparisonEntry[];
  highlightId: string | null;
}

export function InvestigationRankingChart({ data, highlightId }: Props) {
  if (data.length === 0) return null;

  const chartData = data.slice(0, 15).map(d => ({
    name: d.name.length > 15 ? d.name.substring(0, 15) + '…' : d.name,
    fullName: d.name,
    contratos: d.contratosPagos,
    realizadas: d.realizadas,
    id: d.id,
    taxaConversao: d.taxaConversao.toFixed(1),
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          Ranking de Closers (Contratos Pagos)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={Math.max(250, chartData.length * 40)}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
            <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
            <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} width={120} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                color: 'hsl(var(--foreground))',
              }}
              formatter={(value: number, name: string, props: any) => {
                return [`${value} (Conv: ${props.payload.taxaConversao}%)`, 'Contratos Pagos'];
              }}
              labelFormatter={(label: string, payload: any) => payload?.[0]?.payload?.fullName || label}
            />
            <Bar dataKey="contratos" radius={[0, 4, 4, 0]}>
              {chartData.map((entry) => (
                <Cell
                  key={entry.id}
                  fill={entry.id === highlightId ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground) / 0.3)'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
