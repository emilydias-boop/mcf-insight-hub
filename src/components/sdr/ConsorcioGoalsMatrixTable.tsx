import { useMemo } from "react";
import { Calendar, CalendarDays, CalendarRange } from "lucide-react";
import { MetricProgressCell } from "./MetricProgressCell";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface ConsorcioMetricRow {
  label: string;
  pipelineGroup?: string; // optional sub-header like "Efeito Alavanca" or "Viver de Aluguel"
  day: { value: number; target: number };
  week: { value: number; target: number };
  month: { value: number; target: number };
}

interface ConsorcioGoalsMatrixTableProps {
  rows: ConsorcioMetricRow[];
}

export function ConsorcioGoalsMatrixTable({ rows }: ConsorcioGoalsMatrixTableProps) {
  // Group rows by pipelineGroup for sub-headers
  const groupedRows = useMemo(() => {
    const result: { type: 'header' | 'row'; label?: string; row?: ConsorcioMetricRow; index?: number }[] = [];
    let lastGroup: string | undefined = undefined;

    rows.forEach((row, index) => {
      if (row.pipelineGroup && row.pipelineGroup !== lastGroup) {
        result.push({ type: 'header', label: row.pipelineGroup });
        lastGroup = row.pipelineGroup;
      }
      result.push({ type: 'row', row, index });
    });

    return result;
  }, [rows]);

  let rowIndex = 0;

  return (
    <div className="rounded-lg border border-border overflow-hidden bg-card">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground w-[160px] sticky left-0 bg-muted/50 z-10">
                Métrica
              </TableHead>
              <TableHead className="text-center font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                <div className="flex items-center justify-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>Dia</span>
                </div>
              </TableHead>
              <TableHead className="text-center font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                <div className="flex items-center justify-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" />
                  <span>Semana</span>
                </div>
              </TableHead>
              <TableHead className="text-center font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                <div className="flex items-center justify-center gap-1.5">
                  <CalendarRange className="h-3.5 w-3.5" />
                  <span>Mês</span>
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groupedRows.map((item, i) => {
              if (item.type === 'header') {
                return (
                  <TableRow key={`header-${item.label}`} className="bg-muted/40 hover:bg-muted/40">
                    <TableCell colSpan={4} className="font-semibold text-xs uppercase tracking-wider text-primary py-1.5 px-3">
                      {item.label}
                    </TableCell>
                  </TableRow>
                );
              }

              const row = item.row!;
              const currentIndex = rowIndex++;
              return (
                <TableRow
                  key={`${row.label}-${i}`}
                  className={currentIndex % 2 === 0 ? "bg-background" : "bg-muted/20"}
                >
                  <TableCell className="font-medium text-sm text-foreground sticky left-0 z-10 bg-inherit">
                    {row.label}
                  </TableCell>
                  <TableCell className="text-center px-3 py-2.5">
                    <div className="flex justify-center">
                      <MetricProgressCell value={row.day.value} target={row.day.target} compact />
                    </div>
                  </TableCell>
                  <TableCell className="text-center px-3 py-2.5">
                    <div className="flex justify-center">
                      <MetricProgressCell value={row.week.value} target={row.week.target} compact />
                    </div>
                  </TableCell>
                  <TableCell className="text-center px-3 py-2.5">
                    <div className="flex justify-center">
                      <MetricProgressCell value={row.month.value} target={row.month.target} compact />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
