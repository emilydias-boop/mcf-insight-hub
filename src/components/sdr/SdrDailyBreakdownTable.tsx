import { useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, XCircle, MinusCircle, CalendarDays } from "lucide-react";
import { DailyRow } from "@/hooks/useSdrPerformanceData";
import { cn } from "@/lib/utils";

interface SdrDailyBreakdownTableProps {
  dailyRows: DailyRow[];
  isLoading?: boolean;
}

export const SdrDailyBreakdownTable = ({
  dailyRows,
  isLoading = false,
}: SdrDailyBreakdownTableProps) => {
  const filteredRows = useMemo(
    () => dailyRows.filter((r) => r.isBusinessDay || r.realized > 0),
    [dailyRows]
  );

  const totals = useMemo(() => {
    const last = filteredRows[filteredRows.length - 1];
    return {
      realized: last?.accumulated || 0,
      metaAcc: last?.metaAccumulated || 0,
      gap: last?.gapAccumulated || 0,
    };
  }, [filteredRows]);

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
                <TableHead className="text-center">Realizado</TableHead>
                <TableHead className="text-center">Meta Dia</TableHead>
                <TableHead className="text-center">% Dia</TableHead>
                <TableHead className="text-center">Acumulado</TableHead>
                <TableHead className="text-center">Meta Acum.</TableHead>
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
                    <TableCell
                      className={cn(
                        "text-center font-bold",
                        row.realized > 0 &&
                          (row.realized >= row.metaDiaria
                            ? "text-green-500"
                            : "text-destructive")
                      )}
                    >
                      {row.realized}
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground text-xs">
                      {row.metaDiaria}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-center text-xs font-medium",
                        row.percentDay >= 100
                          ? "text-green-500"
                          : row.percentDay >= 70
                            ? "text-yellow-500"
                            : row.isBusinessDay
                              ? "text-destructive"
                              : "text-muted-foreground"
                      )}
                    >
                      {row.isBusinessDay ? `${row.percentDay.toFixed(0)}%` : "—"}
                    </TableCell>
                    <TableCell className="text-center font-medium text-xs">
                      {row.accumulated}
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground text-xs">
                      {row.metaAccumulated}
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
                <TableCell className="text-center font-bold">{totals.realized}</TableCell>
                <TableCell className="text-center text-muted-foreground">—</TableCell>
                <TableCell className="text-center text-muted-foreground">—</TableCell>
                <TableCell className="text-center font-bold">{totals.realized}</TableCell>
                <TableCell className="text-center text-muted-foreground">{totals.metaAcc}</TableCell>
                <TableCell
                  className={cn(
                    "text-center font-bold",
                    totals.gap >= 0 ? "text-green-500" : "text-destructive"
                  )}
                >
                  {totals.gap > 0 ? "+" : ""}
                  {totals.gap}
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
