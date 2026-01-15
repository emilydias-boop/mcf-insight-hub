import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { R2CloserMetric } from '@/hooks/useR2CloserMetrics';

interface R2CloserSummaryTableProps {
  data: R2CloserMetric[] | undefined;
  isLoading: boolean;
  onCloserClick?: (closerId: string) => void;
}

export function R2CloserSummaryTable({ data, isLoading, onCloserClick }: R2CloserSummaryTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Nenhum closer R2 encontrado. Configure os closers R2 primeiro.
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
      r2_agendada: acc.r2_agendada + row.r2_agendada,
    }),
    { r1_agendada: 0, r1_realizada: 0, noshow: 0, contrato_pago: 0, r2_agendada: 0 }
  );

  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[200px]">Closer R2</TableHead>
            <TableHead className="text-center">
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-xs text-muted-foreground">R1</span>
                <span>Agendada</span>
              </div>
            </TableHead>
            <TableHead className="text-center">
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-xs text-muted-foreground">R1</span>
                <span>Realizada</span>
              </div>
            </TableHead>
            <TableHead className="text-center">No-show</TableHead>
            <TableHead className="text-center">
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-xs text-muted-foreground">Contrato</span>
                <span>Pago</span>
              </div>
            </TableHead>
            <TableHead className="text-center">
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-xs text-muted-foreground">R2</span>
                <span>Agendada</span>
              </div>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => (
            <TableRow 
              key={row.closer_id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => onCloserClick?.(row.closer_id)}
            >
              <TableCell>
                <span className="font-medium">{row.closer_name}</span>
              </TableCell>
              <TableCell className="text-center">
                <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20">
                  {row.r1_agendada}
                </Badge>
              </TableCell>
              <TableCell className="text-center">
                <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                  {row.r1_realizada}
                </Badge>
              </TableCell>
              <TableCell className="text-center">
                <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20">
                  {row.noshow}
                </Badge>
              </TableCell>
              <TableCell className="text-center">
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                  {row.contrato_pago}
                </Badge>
              </TableCell>
              <TableCell className="text-center">
                <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/20">
                  {row.r2_agendada}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
          
          {/* Totals Row */}
          <TableRow className="bg-muted/30 font-semibold hover:bg-muted/30">
            <TableCell>
              <span className="text-muted-foreground">Total</span>
            </TableCell>
            <TableCell className="text-center">
              <Badge variant="secondary" className="bg-blue-500/20 text-blue-700">
                {totals.r1_agendada}
              </Badge>
            </TableCell>
            <TableCell className="text-center">
              <Badge variant="secondary" className="bg-green-500/20 text-green-700">
                {totals.r1_realizada}
              </Badge>
            </TableCell>
            <TableCell className="text-center">
              <Badge variant="secondary" className="bg-red-500/20 text-red-700">
                {totals.noshow}
              </Badge>
            </TableCell>
            <TableCell className="text-center">
              <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-700">
                {totals.contrato_pago}
              </Badge>
            </TableCell>
            <TableCell className="text-center">
              <Badge variant="secondary" className="bg-purple-500/20 text-purple-700">
                {totals.r2_agendada}
              </Badge>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
