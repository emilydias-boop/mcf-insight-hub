import { Fragment, useMemo } from "react";
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

interface MetricValues {
  agendamento: number;
  r1Agendada: number;
  r1Realizada: number;
  noShow: number;
  contrato: number;
  r2Agendada: number;
  r2Realizada: number;
  vendaRealizada: number;
}

interface MetricTargets {
  agendamento: number;
  r1Agendada: number;
  r1Realizada: number;
  noShow: number;
  contrato: number;
  r2Agendada: number;
  r2Realizada: number;
  vendaRealizada: number;
}

interface GoalsMatrixTableProps {
  dayValues: MetricValues;
  weekValues: MetricValues;
  monthValues: MetricValues;
  dayTargets: MetricTargets;
  weekTargets: MetricTargets;
  monthTargets: MetricTargets;
  /** Sub-linhas por segmento ICP (opcional, apenas realizado — sem meta própria) */
  segmentAValues?: { day: MetricValues; week: MetricValues; month: MetricValues };
  segmentBValues?: { day: MetricValues; week: MetricValues; month: MetricValues };
}

const METRIC_LABELS: { key: keyof MetricValues; label: string }[] = [
  { key: "agendamento", label: "Agendamento" },
  { key: "r1Agendada", label: "R1 Agendada" },
  { key: "r1Realizada", label: "R1 Realizada" },
  { key: "noShow", label: "No-Show" },
  { key: "contrato", label: "Contrato Pago" },
  { key: "r2Agendada", label: "R2 Agendada" },
  { key: "r2Realizada", label: "R2 Realizada" },
  { key: "vendaRealizada", label: "Vendas Realizadas" },
];

export function GoalsMatrixTable({
  dayValues,
  weekValues,
  monthValues,
  dayTargets,
  weekTargets,
  monthTargets,
  segmentAValues,
  segmentBValues,
}: GoalsMatrixTableProps) {
  const rows = useMemo(() => {
    return METRIC_LABELS.map(({ key, label }) => ({
      label,
      key,
      day: { value: dayValues[key], target: dayTargets[key] },
      week: { value: weekValues[key], target: weekTargets[key] },
      month: { value: monthValues[key], target: monthTargets[key] },
    }));
  }, [dayValues, weekValues, monthValues, dayTargets, weekTargets, monthTargets]);

  const segments = useMemo(() => {
    const list: {
      label: string;
      countsForTarget: boolean;
      values: { day: MetricValues; week: MetricValues; month: MetricValues };
    }[] = [];
    // Regra de negócio: só Lead A conta para meta. Lead B mostra apenas o realizado.
    if (segmentAValues) list.push({ label: "Lead A", countsForTarget: true, values: segmentAValues });
    if (segmentBValues) list.push({ label: "Lead B", countsForTarget: false, values: segmentBValues });
    return list;
  }, [segmentAValues, segmentBValues]);

  const splitBySegment = segments.length > 0;

  return (
    <div className="rounded-lg border border-border overflow-hidden bg-card">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground w-[140px] sticky left-0 bg-muted/50 z-10">
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
            {splitBySegment
              ? rows.flatMap((row, index) =>
                  segments.map((seg) => (
                    <TableRow
                      key={`${row.label}-${seg.label}`}
                      className={index % 2 === 0 ? "bg-background" : "bg-muted/20"}
                    >
                      <TableCell className="font-medium text-sm text-foreground sticky left-0 z-10 bg-inherit whitespace-nowrap">
                        {row.label} · {seg.label}
                      </TableCell>
                      <TableCell className="text-center px-3 py-2.5">
                        <div className="flex justify-center">
                          {seg.countsForTarget ? (
                            <MetricProgressCell value={seg.values.day[row.key]} target={row.day.target} compact />
                          ) : (
                            <span className="text-sm font-semibold text-foreground">{seg.values.day[row.key]}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center px-3 py-2.5">
                        <div className="flex justify-center">
                          {seg.countsForTarget ? (
                            <MetricProgressCell value={seg.values.week[row.key]} target={row.week.target} compact />
                          ) : (
                            <span className="text-sm font-semibold text-foreground">{seg.values.week[row.key]}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center px-3 py-2.5">
                        <div className="flex justify-center">
                          {seg.countsForTarget ? (
                            <MetricProgressCell value={seg.values.month[row.key]} target={row.month.target} compact />
                          ) : (
                            <span className="text-sm font-semibold text-foreground">{seg.values.month[row.key]}</span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )),
                )
              : rows.map((row, index) => (
              <Fragment key={row.label}>
              <TableRow 
                key={row.label} 
                className={index % 2 === 0 ? "bg-background" : "bg-muted/20"}
              >
                <TableCell className="font-medium text-sm text-foreground sticky left-0 z-10 bg-inherit">
                  {row.label}
                </TableCell>
                <TableCell className="text-center px-3 py-2.5">
                  <div className="flex justify-center">
                    <MetricProgressCell
                      value={row.day.value}
                      target={row.day.target}
                      compact
                    />
                  </div>
                </TableCell>
                <TableCell className="text-center px-3 py-2.5">
                  <div className="flex justify-center">
                    <MetricProgressCell
                      value={row.week.value}
                      target={row.week.target}
                      compact
                    />
                  </div>
                </TableCell>
                <TableCell className="text-center px-3 py-2.5">
                  <div className="flex justify-center">
                    <MetricProgressCell
                      value={row.month.value}
                      target={row.month.target}
                      compact
                    />
                  </div>
                </TableCell>
              </TableRow>
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
