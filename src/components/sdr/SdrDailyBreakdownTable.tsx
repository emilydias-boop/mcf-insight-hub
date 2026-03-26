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

interface DayRow {
  date: Date;
  agendamentos: number;
  r1Agendada: number;
  r1Realizada: number;
  noShow: number;
  isWeekend: boolean;
}

export const SdrDailyBreakdownTable = ({
  meetings,
  startDate,
  endDate,
  metaDiaria,
  isLoading = false,
}: SdrDailyBreakdownTableProps) => {
  const rows = useMemo((): DayRow[] => {
    const days = eachDayOfInterval({ start: startDate, end: endDate });

    return days.map((date) => {
      const dateStr = format(date, 'yyyy-MM-dd');

      const dayMeetings = meetings.filter((m) => {
        const mDate = m.data_agendamento?.substring(0, 10);
        return mDate === dateStr;
      });

      let agendamentos = 0;
      let r1Agendada = 0;
      let r1Realizada = 0;
      let noShow = 0;

      for (const m of dayMeetings) {
        agendamentos++;
        const status = (m.status_atual || '').toLowerCase();
        if (status.includes('agendada')) r1Agendada++;
        if (status.includes('realizada') || status.includes('contrato')) r1Realizada++;
        if (status.includes('no-show') || status.includes('noshow') || status.includes('no show')) noShow++;
      }

      return {
        date,
        agendamentos,
        r1Agendada,
        r1Realizada,
        noShow,
        isWeekend: isWeekend(date),
      };
    });
  }, [meetings, startDate, endDate]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => ({
        agendamentos: acc.agendamentos + r.agendamentos,
        r1Agendada: acc.r1Agendada + r.r1Agendada,
        r1Realizada: acc.r1Realizada + r.r1Realizada,
        noShow: acc.noShow + r.noShow,
      }),
      { agendamentos: 0, r1Agendada: 0, r1Realizada: 0, noShow: 0 }
    );
  }, [rows]);

  // Only show business days that have data or are not weekends
  const filteredRows = rows.filter((r) => !r.isWeekend || r.agendamentos > 0);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-40 w-full" />
        </CardContent>
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
                <TableHead className="text-center">R1 Agendada</TableHead>
                <TableHead className="text-center">R1 Realizada</TableHead>
                <TableHead className="text-center">No-Show</TableHead>
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
                    <TableCell className="text-center font-semibold">
                      {row.agendamentos}
                    </TableCell>
                    <TableCell className="text-center">{row.r1Agendada}</TableCell>
                    <TableCell className="text-center">{row.r1Realizada}</TableCell>
                    <TableCell className="text-center">
                      {row.noShow > 0 ? (
                        <span className="text-destructive font-medium">{row.noShow}</span>
                      ) : (
                        row.noShow
                      )}
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
              {/* Total row */}
              <TableRow className="bg-muted/50 font-bold border-t-2">
                <TableCell className="font-bold text-xs">TOTAL</TableCell>
                <TableCell className="text-center font-bold">{totals.agendamentos}</TableCell>
                <TableCell className="text-center font-bold">{totals.r1Agendada}</TableCell>
                <TableCell className="text-center font-bold">{totals.r1Realizada}</TableCell>
                <TableCell className="text-center font-bold">
                  {totals.noShow > 0 ? (
                    <span className="text-destructive">{totals.noShow}</span>
                  ) : (
                    totals.noShow
                  )}
                </TableCell>
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
