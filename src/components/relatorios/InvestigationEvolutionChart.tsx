import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';
import { DailyMetric } from '@/hooks/useInvestigationByPeriod';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TrendingUp } from 'lucide-react';

export interface DailyTargets {
  agendadas?: number;
  realizadas?: number;
  contratosPagos?: number;
}

interface Props {
  data: DailyMetric[];
  dailyTargets?: DailyTargets;
  isIndividual?: boolean;
}

function movingAvg(arr: number[], window: number): (number | null)[] {
  return arr.map((_, i) => {
    if (i < window - 1) return null;
    const slice = arr.slice(i - window + 1, i + 1);
    return slice.reduce((a, b) => a + b, 0) / window;
  });
}

export function InvestigationEvolutionChart({ data, dailyTargets }: Props) {
  if (data.length === 0) return null;

  const totals = data.map(d => d.agendadas);
  const avg3 = movingAvg(totals, 3);

  const chartData = data.map((d, i) => ({
    ...d,
    label: format(parseISO(d.date), 'dd/MM', { locale: ptBR }),
    mediaMovel: avg3[i] !== null ? Number(avg3[i]!.toFixed(1)) : undefined,
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Evolução Dia a Dia
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                color: 'hsl(var(--foreground))',
              }}
            />
            <Legend />
            {dailyTargets?.agendadas && (
              <ReferenceLine
                y={dailyTargets.agendadas}
                stroke="hsl(var(--primary))"
                strokeDasharray="8 4"
                strokeWidth={1.5}
                label={{ value: `Meta Agend. ${dailyTargets.agendadas}`, position: 'insideTopRight', fontSize: 10, fill: 'hsl(var(--primary))' }}
              />
            )}
            {dailyTargets?.realizadas && (
              <ReferenceLine
                y={dailyTargets.realizadas}
                stroke="hsl(142 71% 45%)"
                strokeDasharray="8 4"
                strokeWidth={1.5}
                label={{ value: `Meta Realiz. ${dailyTargets.realizadas}`, position: 'insideTopRight', fontSize: 10, fill: 'hsl(142 71% 45%)' }}
              />
            )}
            {dailyTargets?.contratosPagos && (
              <ReferenceLine
                y={dailyTargets.contratosPagos}
                stroke="hsl(45 93% 47%)"
                strokeDasharray="8 4"
                strokeWidth={1.5}
                label={{ value: `Meta Contr. ${dailyTargets.contratosPagos}`, position: 'insideTopRight', fontSize: 10, fill: 'hsl(45 93% 47%)' }}
              />
            )}
            <Bar dataKey="agendadas" fill="hsl(var(--primary))" name="Agendadas" radius={[2, 2, 0, 0]} />
            <Bar dataKey="realizadas" fill="hsl(142 71% 45%)" name="Realizadas" radius={[2, 2, 0, 0]} />
            <Bar dataKey="noShows" fill="hsl(var(--destructive))" name="No-Shows" radius={[2, 2, 0, 0]} />
            <Bar dataKey="contratosPagos" fill="hsl(45 93% 47%)" name="Contratos Pagos" radius={[2, 2, 0, 0]} />
            {data.length >= 3 && (
              <Line
                type="monotone"
                dataKey="mediaMovel"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                name="Média Móvel (3d)"
                connectNulls={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}