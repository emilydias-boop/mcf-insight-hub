import { Fragment } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { R1CloserMetric } from "@/hooks/useR1CloserMetrics";

interface CloserSummaryTableProps {
  data?: R1CloserMetric[];
  isLoading?: boolean;
  onCloserClick?: (closerId: string) => void;
  totalContratosFromKPI?: number;
  /** Aditivo: quando informados, cada closer ganha sub-linhas "↳ Lead A" / "↳ Lead B". */
  segmentAData?: R1CloserMetric[];
  segmentBData?: R1CloserMetric[];
  /** Contratos pagos no período que não puderam ser atribuídos a nenhum closer. */
  unassigned?: { total: number; a: number; b: number };
}

export function CloserSummaryTable({ 
  data, 
  isLoading,
  onCloserClick,
  totalContratosFromKPI,
  segmentAData,
  segmentBData,
  unassigned,
}: CloserSummaryTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <p>Nenhum Closer com atividade no período.</p>
      </div>
    );
  }

  // Calculate totals
  const totals = data.reduce(
    (acc, row) => ({
      r1_agendada: acc.r1_agendada + row.r1_agendada,
      r1_realizada: acc.r1_realizada + row.r1_realizada,
      noshow: acc.noshow + row.noshow,
      contrato_pago: acc.contrato_pago + row.contrato_pago,
      outside: acc.outside + row.outside,
      r2_agendada: acc.r2_agendada + row.r2_agendada,
      reembolsos: acc.reembolsos + (row.reembolsos || 0),
    }),
    { r1_agendada: 0, r1_realizada: 0, noshow: 0, contrato_pago: 0, outside: 0, r2_agendada: 0, reembolsos: 0 }
  );

  // Calculate total conversion rate (Contrato / Realizada)
  const contratoPagoComOrfaos = totals.contrato_pago + (unassigned?.total ?? 0);
  const totalTaxaConversao = totals.r1_realizada > 0 
    ? ((contratoPagoComOrfaos / totals.r1_realizada) * 100)
    : 0;

  // Calculate total no-show rate (No-Show / Agendada)
  const totalTaxaNoShow = totals.r1_agendada > 0 
    ? ((totals.noshow / totals.r1_agendada) * 100)
    : 0;

  const showSegments = !!(segmentAData || segmentBData);
  const byId = (rows?: R1CloserMetric[]) => {
    const m = new Map<string, R1CloserMetric>();
    (rows || []).forEach((r) => m.set(r.closer_id, r));
    return m;
  };
  const segAMap = byId(segmentAData);
  const segBMap = byId(segmentBData);

  type SegKey = 'r1_agendada' | 'outside' | 'r1_realizada' | 'noshow' | 'contrato_pago' | 'r2_agendada';
  const SEG_COLS: { key: SegKey; label: string; cls: string }[] = [
    { key: 'r1_agendada', label: 'R1 Agendada', cls: 'text-blue-400' },
    { key: 'outside', label: 'Outside', cls: 'text-orange-400' },
    { key: 'r1_realizada', label: 'R1 Realizada', cls: 'text-green-400' },
    { key: 'noshow', label: 'No-show', cls: 'text-red-400' },
    { key: 'contrato_pago', label: 'Contrato Pago', cls: 'text-amber-400' },
    { key: 'r2_agendada', label: 'R2 Agendada', cls: 'text-purple-400' },
  ];
  const segValue = (map: Map<string, R1CloserMetric>, closerId: string, key: SegKey) =>
    (map.get(closerId)?.[key] as number | undefined) ?? 0;
  const segTotal = (rows: R1CloserMetric[] | undefined, key: SegKey) =>
    (rows || []).reduce((sum, r) => sum + ((r[key] as number) || 0), 0);

  const un = unassigned && unassigned.total > 0 ? unassigned : null;
  const unFor = (key: SegKey, seg?: 'a' | 'b') =>
    key === 'contrato_pago' ? (seg ? (un?.[seg] ?? 0) : (un?.total ?? 0)) : 0;

  return (
    <div className="rounded-md border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow className="hover:bg-muted/50">
              <TableHead className="text-muted-foreground font-medium">Closer</TableHead>
              {showSegments
                ? SEG_COLS.flatMap((c) => [`${c.label} A`, `${c.label} B`]).map((h) => (
                    <TableHead key={h} className="text-muted-foreground text-center font-medium whitespace-nowrap">
                      {h}
                    </TableHead>
                  ))
                : SEG_COLS.map((c) => (
                    <TableHead key={c.key} className="text-muted-foreground text-center font-medium whitespace-nowrap">
                      {c.label}
                    </TableHead>
                  ))}
              <TableHead className="text-muted-foreground text-center font-medium">Taxa No-Show</TableHead>
              <TableHead className="text-muted-foreground text-center font-medium">Reembolsos</TableHead>
              <TableHead className="text-muted-foreground text-center font-medium">Taxa Conv.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => {
              // Calculate taxa de conversão (Contrato Pago / R1 Realizada)
              const taxaConversao = row.r1_realizada > 0 
                ? ((row.contrato_pago / row.r1_realizada) * 100)
                : 0;
              const taxaConversaoFormatted = taxaConversao.toFixed(1);

              // Calculate taxa de no-show (No-Show / R1 Agendada)
              const taxaNoShow = row.r1_agendada > 0 
                ? ((row.noshow / row.r1_agendada) * 100)
                : 0;
              const taxaNoShowFormatted = taxaNoShow.toFixed(1);

              // Taxa conversão color: green >= 20%, amber >= 10%, red < 10%
              const taxaColorClass = taxaConversao >= 20 
                ? 'text-green-400' 
                : taxaConversao >= 10 
                  ? 'text-amber-400' 
                  : 'text-red-400';

              // Taxa no-show color: green <= 20%, amber 21-35%, red > 35%
              const taxaNoShowColorClass = taxaNoShow <= 20 
                ? 'text-green-400' 
                : taxaNoShow <= 35 
                  ? 'text-amber-400' 
                  : 'text-red-400';

              return (
                <Fragment key={row.closer_id}>
                <TableRow
                  className={onCloserClick ? "cursor-pointer transition-colors hover:bg-muted/30" : "transition-colors"}
                  onClick={onCloserClick ? () => onCloserClick(row.closer_id) : undefined}
                >
                  <TableCell className="font-medium">
                    <span className="text-foreground">{row.closer_name}</span>
                  </TableCell>
                  {showSegments
                    ? SEG_COLS.flatMap((c) => [
                        <TableCell key={`${c.key}-a`} className="text-center">
                          <span className={`${c.cls} font-medium`}>{segValue(segAMap, row.closer_id, c.key)}</span>
                        </TableCell>,
                        <TableCell key={`${c.key}-b`} className="text-center">
                          <span className={`${c.cls} font-medium`}>{segValue(segBMap, row.closer_id, c.key)}</span>
                        </TableCell>,
                      ])
                    : SEG_COLS.map((c) => (
                        <TableCell key={c.key} className="text-center">
                          <span className={`${c.cls} font-medium`}>{(row[c.key] as number) || 0}</span>
                        </TableCell>
                      ))}
                  <TableCell className="text-center">
                    <span className={`font-medium ${taxaNoShowColorClass}`}>{taxaNoShowFormatted}%</span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className={`font-medium ${(row.reembolsos || 0) > 0 ? 'text-red-400' : 'text-muted-foreground'}`}>
                      {row.reembolsos || 0}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className={`font-medium ${taxaColorClass}`}>{taxaConversaoFormatted}%</span>
                  </TableCell>
                </TableRow>
                </Fragment>
              );
            })}
            
            {/* Não atribuído: contratos pagos no período sem closer identificável */}
            {un && (
              <TableRow className="italic text-muted-foreground">
                <TableCell className="font-normal">Não atribuído</TableCell>
                {showSegments
                  ? SEG_COLS.flatMap((c) => [
                      <TableCell key={`un-${c.key}-a`} className="text-center">
                        {c.key === 'contrato_pago' ? unFor(c.key, 'a') : '—'}
                      </TableCell>,
                      <TableCell key={`un-${c.key}-b`} className="text-center">
                        {c.key === 'contrato_pago' ? unFor(c.key, 'b') : '—'}
                      </TableCell>,
                    ])
                  : SEG_COLS.map((c) => (
                      <TableCell key={`un-${c.key}`} className="text-center">
                        {c.key === 'contrato_pago' ? unFor(c.key) : '—'}
                      </TableCell>
                    ))}
                <TableCell className="text-center">—</TableCell>
                <TableCell className="text-center">—</TableCell>
                <TableCell className="text-center">—</TableCell>
              </TableRow>
            )}

            {/* Totals Row */}
            <TableRow className="bg-muted/30 font-semibold border-t-2 border-border">
              <TableCell className="text-foreground">Total</TableCell>
              {showSegments
                ? SEG_COLS.flatMap((c) => [
                    <TableCell key={`t-${c.key}-a`} className="text-center">
                      <span className={c.cls}>{segTotal(segmentAData, c.key) + unFor(c.key, 'a')}</span>
                    </TableCell>,
                    <TableCell key={`t-${c.key}-b`} className="text-center">
                      <span className={c.cls}>{segTotal(segmentBData, c.key) + unFor(c.key, 'b')}</span>
                    </TableCell>,
                  ])
                : SEG_COLS.map((c) => (
                    <TableCell key={`t-${c.key}`} className="text-center">
                      <span className={c.cls}>{segTotal(data, c.key) + unFor(c.key)}</span>
                    </TableCell>
                  ))}
              <TableCell className="text-center">
                <span className={`font-medium ${
                  totalTaxaNoShow <= 20 
                    ? 'text-green-400' 
                    : totalTaxaNoShow <= 35 
                      ? 'text-amber-400' 
                      : 'text-red-400'
                }`}>
                  {totalTaxaNoShow.toFixed(1)}%
                </span>
              </TableCell>
              <TableCell className="text-center">
                <span className={`font-medium ${totals.reembolsos > 0 ? 'text-red-400' : 'text-muted-foreground'}`}>
                  {totals.reembolsos}
                </span>
              </TableCell>
              <TableCell className="text-center">
                <span className={`font-medium ${
                  totalTaxaConversao >= 20 
                    ? 'text-green-400' 
                    : totalTaxaConversao >= 10 
                      ? 'text-amber-400' 
                      : 'text-red-400'
                }`}>
                  {totalTaxaConversao.toFixed(1)}%
                </span>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
