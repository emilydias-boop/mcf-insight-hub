import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';
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

export function InvestigationEvolutionChart({ data, dailyTargets, isIndividual }: Props) {
  if (data.length === 0) return null;

  const chartData = data.map((d) => ({
    ...d,
    label: format(parseISO(d.date), 'dd/MM', { locale: ptBR }),
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
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
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
                stroke="hsl(210 100% 60%)"
                strokeDasharray="8 4"
                strokeWidth={1.5}
                label={{ value: `${isIndividual ? 'Meta Ind.' : 'Meta'} Agend. ${dailyTargets.agendadas}`, position: 'insideTopRight', fontSize: 10, fill: 'hsl(210 100% 60%)' }}
              />
            )}
            {dailyTargets?.realizadas && (
              <ReferenceLine
                y={dailyTargets.realizadas}
                stroke="hsl(142 71% 45%)"
                strokeDasharray="8 4"
                strokeWidth={1.5}
                label={{ value: `${isIndividual ? 'Meta Ind.' : 'Meta'} Realiz. ${dailyTargets.realizadas}`, position: 'insideTopRight', fontSize: 10, fill: 'hsl(142 71% 45%)' }}
              />
            )}
            <Bar dataKey="agendadas" fill="hsl(210 100% 60%)" name="Agendadas" radius={[2, 2, 0, 0]} />
            <Bar dataKey="realizadas" fill="hsl(142 71% 45%)" name="Realizadas" radius={[2, 2, 0, 0]} />
            <Bar dataKey="noShows" fill="hsl(var(--destructive))" name="No-Shows" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
