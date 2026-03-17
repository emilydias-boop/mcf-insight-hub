import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { PeriodSummary } from '@/hooks/useInvestigationByPeriod';
import { PieChartIcon } from 'lucide-react';

interface Props {
  summary: PeriodSummary;
}

const COLORS = [
  'hsl(142 71% 45%)',   // Realizadas - green
  'hsl(0 84% 60%)',     // No-Shows - red
  'hsl(45 93% 47%)',    // Contratos Pagos - amber
  'hsl(217 91% 60%)',   // Agendadas - blue
];

export function InvestigationDistributionChart({ summary }: Props) {
  const data = [
    { name: 'Realizadas', value: summary.realizadas },
    { name: 'No-Shows', value: summary.noShows },
    { name: 'Contratos Pagos', value: summary.contratosPagos },
    { name: 'Agendadas', value: summary.agendadas },
  ].filter(d => d.value > 0);

  if (data.length === 0) return null;

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <PieChartIcon className="h-4 w-4" />
          Distribuição de Status
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={320}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={110}
              paddingAngle={3}
              dataKey="value"
              label={({ name, value }) => `${name}: ${value} (${((value / total) * 100).toFixed(0)}%)`}
              labelLine={false}
            >
              {data.map((entry, index) => (
                <Cell key={entry.name} fill={COLORS[['Realizadas', 'No-Shows', 'Contratos Pagos', 'Agendadas'].indexOf(entry.name)] || COLORS[0]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                color: 'hsl(var(--foreground))',
              }}
              formatter={(value: number, name: string) => [`${value} (${((value / total) * 100).toFixed(1)}%)`, name]}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
