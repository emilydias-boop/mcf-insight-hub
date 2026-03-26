import { useMemo } from 'react';
import { format, eachDayOfInterval, isWeekend } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle2, XCircle, CalendarDays } from 'lucide-react';
import { MeetingV2 } from '@/hooks/useSdrMetricsV2';
import { cn } from '@/lib/utils';

interface SdrDailyBreakdownTableProps {
  meetings: MeetingV2[];
  startDate: Date;
  endDate: Date;
  metaDiaria: number;
  isLoading?: boolean;
}

export const SdrDailyBreakdownTable = ({
  meetings,
  startDate,
  endDate,
  metaDiaria,
  isLoading = false,
}: SdrDailyBreakdownTableProps) => {
  const rows = useMemo(() => {
    const days = eachDayOfInterval({ start: startDate, end: endDate });

    return days.map((date) => {
      const dateStr = format(date, 'yyyy-MM-dd');
      const agendamentos = meetings.filter((m) => m.data_agendamento?.substring(0, 10) === dateStr).length;

      return {
        date,
        agendamentos,
        isWeekend: isWeekend(date),
      };
    });
  }, [meetings, startDate, endDate]);

  const total = useMemo(() => rows.reduce((s, r) => s + r.agendamentos, 0), [rows]);
  const filteredRows = rows.filter((r) => !r.isWeekend || r.agendamentos > 0);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3"><Skeleton className="h-5 w-48" /></CardHeader>
        <CardContent><Skeleton className="h-40 w-full" /></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
          <CalendarDays className="h-4 w-4" />
          Performance Diária
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">Data</TableHead>
                <TableHead className="text-center">Agendamentos</TableHead>
                <TableHead className="text-center">Meta</TableHead>
                <TableHead className="text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.map((row) => {
                const bateu = row.agendamentos >= metaDiaria;
                return (
                  <TableRow
                    key={row.date.toISOString()}
                    className={cn(
                      row.isWeekend && 'bg-muted/30',
                      row.agendamentos === 0 && 'opacity-60'
                    )}
                  >
                    <TableCell className="font-medium text-xs">
                      {format(row.date, "dd/MM (EEE)", { locale: ptBR })}
                    </TableCell>
                    <TableCell className={cn(
                      "text-center font-bold text-base",
                      row.agendamentos > 0 && (bateu ? "text-green-500" : "text-destructive")
                    )}>
                      {row.agendamentos}
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground">
                      {metaDiaria}
                    </TableCell>
                    <TableCell className="text-center">
                      {row.agendamentos > 0 || !row.isWeekend ? (
                        bateu ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                        ) : (
                          <XCircle className="h-4 w-4 text-destructive mx-auto" />
                        )
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
              <TableRow className="bg-muted/50 font-bold border-t-2">
                <TableCell className="font-bold text-xs">TOTAL</TableCell>
                <TableCell className="text-center font-bold text-base">{total}</TableCell>
                <TableCell className="text-center text-muted-foreground">—</TableCell>
                <TableCell className="text-center">—</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
