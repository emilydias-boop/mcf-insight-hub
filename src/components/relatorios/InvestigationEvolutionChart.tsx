import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { DailyMetric } from '@/hooks/useInvestigationByPeriod';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TrendingUp } from 'lucide-react';

interface Props {
  data: DailyMetric[];
}

export function InvestigationEvolutionChart({ data }: Props) {
  if (data.length === 0) return null;

  const chartData = data.map(d => ({
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
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
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
            <Bar dataKey="agendadas" fill="hsl(var(--primary))" name="Agendadas" radius={[2, 2, 0, 0]} />
            <Bar dataKey="realizadas" fill="hsl(142 71% 45%)" name="Realizadas" radius={[2, 2, 0, 0]} />
            <Bar dataKey="noShows" fill="hsl(var(--destructive))" name="No-Shows" radius={[2, 2, 0, 0]} />
            <Bar dataKey="contratosPagos" fill="hsl(45 93% 47%)" name="Contratos Pagos" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
