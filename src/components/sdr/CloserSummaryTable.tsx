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
}

export function CloserSummaryTable({ 
  data, 
  isLoading,
  onCloserClick,
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
    }),
    { r1_agendada: 0, r1_realizada: 0, noshow: 0, contrato_pago: 0, outside: 0, r2_agendada: 0 }
  );

  // Calculate total conversion rate (Contrato / Realizada)
  const totalTaxaConversao = totals.r1_realizada > 0 
    ? ((totals.contrato_pago / totals.r1_realizada) * 100)
    : 0;

  // Calculate total no-show rate (No-Show / Agendada)
  const totalTaxaNoShow = totals.r1_agendada > 0 
    ? ((totals.noshow / totals.r1_agendada) * 100)
    : 0;

  return (
    <div className="rounded-md border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow className="hover:bg-muted/50">
              <TableHead className="text-muted-foreground font-medium">Closer</TableHead>
              <TableHead className="text-muted-foreground text-center font-medium">R1 Agendada</TableHead>
              <TableHead className="text-muted-foreground text-center font-medium">Outside</TableHead>
              <TableHead className="text-muted-foreground text-center font-medium">R1 Realizada</TableHead>
              <TableHead className="text-muted-foreground text-center font-medium">No-show</TableHead>
              <TableHead className="text-muted-foreground text-center font-medium">Taxa No-Show</TableHead>
              <TableHead className="text-muted-foreground text-center font-medium">Contrato Pago</TableHead>
              <TableHead className="text-muted-foreground text-center font-medium">R2 Agendada</TableHead>
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
                <TableRow
                  key={row.closer_id}
                  className={onCloserClick ? "cursor-pointer transition-colors hover:bg-muted/30" : "transition-colors"}
                  onClick={onCloserClick ? () => onCloserClick(row.closer_id) : undefined}
                >
                  <TableCell className="font-medium">
                    <span className="text-foreground">{row.closer_name}</span>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30">
                      {row.r1_agendada}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="text-orange-400 font-medium">{row.outside}</span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="text-green-400 font-medium">{row.r1_realizada}</span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="text-red-400">{row.noshow}</span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className={`font-medium ${taxaNoShowColorClass}`}>{taxaNoShowFormatted}%</span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="text-amber-400 font-medium">{row.contrato_pago}</span>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/30">
                      {row.r2_agendada}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className={`font-medium ${taxaColorClass}`}>{taxaConversaoFormatted}%</span>
                  </TableCell>
                </TableRow>
              );
            })}
            
            {/* Outside Row */}
            <TableRow className="bg-orange-500/5 border-t border-dashed border-orange-500/30">
              <TableCell className="font-medium">
                <Badge variant="outline" className="bg-orange-500/10 text-orange-400 border-orange-500/30">
                  Outside
                </Badge>
              </TableCell>
              <TableCell className="text-center text-muted-foreground">—</TableCell>
              <TableCell className="text-center text-muted-foreground">—</TableCell>
              <TableCell className="text-center text-muted-foreground">—</TableCell>
              <TableCell className="text-center text-muted-foreground">—</TableCell>
              <TableCell className="text-center text-muted-foreground">—</TableCell>
              <TableCell className="text-center">
                <span className="text-orange-400 font-semibold">{totals.outside}</span>
              </TableCell>
              <TableCell className="text-center text-muted-foreground">—</TableCell>
              <TableCell className="text-center text-muted-foreground">—</TableCell>
            </TableRow>

            {/* Totals Row */}
            <TableRow className="bg-muted/30 font-semibold border-t-2 border-border">
              <TableCell className="text-foreground">Total</TableCell>
              <TableCell className="text-center">
                <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30">
                  {totals.r1_agendada}
                </Badge>
              </TableCell>
              <TableCell className="text-center">
                <span className="text-orange-400">{totals.outside}</span>
              </TableCell>
              <TableCell className="text-center">
                <span className="text-green-400">{totals.r1_realizada}</span>
              </TableCell>
              <TableCell className="text-center">
                <span className="text-red-400">{totals.noshow}</span>
              </TableCell>
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
                <span className="text-amber-400">{totals.contrato_pago + totals.outside}</span>
              </TableCell>
              <TableCell className="text-center">
                <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/30">
                  {totals.r2_agendada}
                </Badge>
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
