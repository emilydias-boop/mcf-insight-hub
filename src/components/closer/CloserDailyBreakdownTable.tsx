import { useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, XCircle, MinusCircle, CalendarDays } from "lucide-react";
import { CloserDailyRow } from "@/hooks/useCloserPerformanceData";
import { cn } from "@/lib/utils";

interface CloserDailyBreakdownTableProps {
  dailyRows: CloserDailyRow[];
  isLoading?: boolean;
}

export const CloserDailyBreakdownTable = ({
  dailyRows,
  isLoading = false,
}: CloserDailyBreakdownTableProps) => {
  const filteredRows = useMemo(
    () => dailyRows.filter((r) => r.isBusinessDay || r.contratos > 0 || r.agendados > 0),
    [dailyRows]
  );

  const totals = useMemo(() => {
    return filteredRows.reduce(
      (acc, r) => ({
        agendados: acc.agendados + r.agendados,
        realizados: acc.realizados + r.realizados,
        noShows: acc.noShows + r.noShows,
        contratos: acc.contratos + r.contratos,
      }),
      { agendados: 0, realizados: 0, noShows: 0, contratos: 0 }
    );
  }, [filteredRows]);

  const lastRow = filteredRows[filteredRows.length - 1];
  const totalGap = lastRow?.gapAccumulated || 0;

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
          Performance Diária Detalhada
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Data</TableHead>
                <TableHead className="text-center">Agendados</TableHead>
                <TableHead className="text-center">Realizados</TableHead>
                <TableHead className="text-center">No-Show</TableHead>
                <TableHead className="text-center">Contratos</TableHead>
                <TableHead className="text-center">Meta Dia</TableHead>
                <TableHead className="text-center">Gap Acum.</TableHead>
                <TableHead className="text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.map((row) => {
                const StatusIcon =
                  row.status === "above"
                    ? CheckCircle2
                    : row.status === "on_track"
                      ? MinusCircle
                      : XCircle;
                const statusColor =
                  row.status === "above"
                    ? "text-green-500"
                    : row.status === "on_track"
                      ? "text-yellow-500"
                      : "text-destructive";

                return (
                  <TableRow
                    key={row.dateStr}
                    className={cn(!row.isBusinessDay && "bg-muted/20 opacity-60")}
                  >
                    <TableCell className="font-medium text-xs">
                      {format(row.date, "dd/MM (EEE)", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-center text-xs">
                      {row.agendados}
                    </TableCell>
                    <TableCell className="text-center text-xs">
                      {row.realizados}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-center text-xs",
                        row.noShows > 0 && "text-destructive font-medium"
                      )}
                    >
                      {row.noShows}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-center font-bold",
                        row.contratos > 0 &&
                          (row.contratos >= row.metaDiaria
                            ? "text-green-500"
                            : "text-destructive")
                      )}
                    >
                      {row.contratos}
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground text-xs">
                      {row.isBusinessDay ? row.metaDiaria : "—"}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-center font-medium text-xs",
                        row.gapAccumulated >= 0 ? "text-green-500" : "text-destructive"
                      )}
                    >
                      {row.gapAccumulated > 0 ? "+" : ""}
                      {row.gapAccumulated}
                    </TableCell>
                    <TableCell className="text-center">
                      <StatusIcon className={cn("h-4 w-4 mx-auto", statusColor)} />
                    </TableCell>
                  </TableRow>
                );
              })}

              {/* Total row */}
              <TableRow className="bg-muted/50 font-bold border-t-2">
                <TableCell className="font-bold text-xs">TOTAL</TableCell>
                <TableCell className="text-center font-bold">{totals.agendados}</TableCell>
                <TableCell className="text-center font-bold">{totals.realizados}</TableCell>
                <TableCell className={cn("text-center font-bold", totals.noShows > 0 && "text-destructive")}>
                  {totals.noShows}
                </TableCell>
                <TableCell className="text-center font-bold">{totals.contratos}</TableCell>
                <TableCell className="text-center text-muted-foreground">—</TableCell>
                <TableCell
                  className={cn(
                    "text-center font-bold",
                    totalGap >= 0 ? "text-green-500" : "text-destructive"
                  )}
                >
                  {totalGap > 0 ? "+" : ""}
                  {totalGap}
                </TableCell>
                <TableCell className="text-center">—</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
