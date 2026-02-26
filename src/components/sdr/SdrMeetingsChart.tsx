import { useMemo } from "react";
import { format, parseISO, eachDayOfInterval, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { MeetingV2 } from "@/hooks/useSdrMetricsV2";
import { BarChart3 } from "lucide-react";

interface SdrMeetingsChartProps {
  meetings: MeetingV2[];
  startDate: Date;
  endDate: Date;
  isLoading?: boolean;
}

export function SdrMeetingsChart({ meetings, startDate, endDate, isLoading }: SdrMeetingsChartProps) {
  // Group meetings by day based on data_agendamento
  const chartData = useMemo(() => {
    if (!meetings.length) return [];

    // Create array of all days in range
    const days = eachDayOfInterval({ start: startDate, end: endDate });
    
    // Initialize counts per day
    const dayMap = new Map<string, { date: string; agendadas: number; realizadas: number; noShow: number }>();
    
    days.forEach(day => {
      const key = format(day, "yyyy-MM-dd");
      dayMap.set(key, {
        date: format(day, "dd/MM", { locale: ptBR }),
        agendadas: 0,
        realizadas: 0,
        noShow: 0,
      });
    });

    // Count meetings by their agendamento date and status
    meetings.forEach(meeting => {
      if (!meeting.data_agendamento || !meeting.conta) return;
      
      const agendDate = startOfDay(parseISO(meeting.data_agendamento));
      const key = format(agendDate, "yyyy-MM-dd");
      
      if (dayMap.has(key)) {
        const entry = dayMap.get(key)!;
        
        // Classify based on status_atual
        const status = meeting.status_atual?.toLowerCase() || '';
        if (status.includes('agendada') || status === 'invited' || status === 'rescheduled') {
          entry.agendadas++;
        } else if (status.includes('realizada') || status === 'completed') {
          entry.realizadas++;
        } else if (status.includes('no-show') || status.includes('noshow') || status === 'no_show') {
          entry.noShow++;
        } else if (status.includes('contrato') || status === 'contract_paid') {
          entry.realizadas++;
        }
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
            <Legend 
              wrapperStyle={{ fontSize: '12px' }}
              iconType="circle"
            />
            <Bar dataKey="agendadas" name="Agendadas" fill="hsl(210, 100%, 60%)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="realizadas" name="Realizadas" fill="hsl(142, 76%, 45%)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="noShow" name="No-Show" fill="hsl(0, 84%, 60%)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
