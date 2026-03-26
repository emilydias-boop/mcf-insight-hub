import { useMemo } from "react";
import { format, eachDayOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { MeetingV2 } from "@/hooks/useSdrMetricsV2";
import { BarChart3 } from "lucide-react";

interface SdrMeetingsChartProps {
  meetings: MeetingV2[];
  startDate: Date;
  endDate: Date;
  isLoading?: boolean;
  metaDiaria?: number;
}

export function SdrMeetingsChart({ meetings, startDate, endDate, isLoading, metaDiaria }: SdrMeetingsChartProps) {
  const chartData = useMemo(() => {
    if (!meetings.length) return [];

    const days = eachDayOfInterval({ start: startDate, end: endDate });
    const dayMap = new Map<string, { date: string; agendamentos: number }>();

    days.forEach(day => {
      const key = format(day, "yyyy-MM-dd");
      dayMap.set(key, {
        date: format(day, "dd/MM", { locale: ptBR }),
        agendamentos: 0,
      });
    });

    meetings.forEach(meeting => {
      if (!meeting.data_agendamento || !meeting.conta) return;
      const key = meeting.data_agendamento.substring(0, 10);
      if (dayMap.has(key)) {
        dayMap.get(key)!.agendamentos++;
      }
    });

    return Array.from(dayMap.values());
  }, [meetings, startDate, endDate]);

  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="p-6 h-[300px] flex items-center justify-center">
          <div className="animate-pulse text-muted-foreground">Carregando...</div>
        </CardContent>
      </Card>
    );
  }

  if (chartData.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            Evolução Diária
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 h-[250px] flex items-center justify-center text-muted-foreground">
          Nenhum dado para o período selecionado
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          Evolução Diária
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="date"
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: 'hsl(var(--border))' }}
            />
            <YAxis
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: 'hsl(var(--border))' }}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                color: 'hsl(var(--foreground))'
              }}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
            />
            {metaDiaria && (
              <ReferenceLine
                y={metaDiaria}
                stroke="hsl(var(--destructive))"
                strokeDasharray="6 3"
                label={{ value: `Meta: ${metaDiaria}`, position: 'right', fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              />
            )}
            <Bar dataKey="agendamentos" name="Agendamentos" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
