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
import { CloserMetricsRow } from "@/hooks/useCloserMetrics";

interface CloserSummaryTableProps {
  data: CloserMetricsRow[];
  isLoading?: boolean;
}

export function CloserSummaryTable({ data, isLoading }: CloserSummaryTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  // Check if there's any activity
  const hasActivity = data.some(row => 
    row.r1Realizadas > 0 || row.r2Agendadas > 0 || row.contratosPagos > 0 || row.vendasRealizadas > 0 || row.noShows > 0
  );

  if (!hasActivity) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <p>Nenhum Closer com atividade no período.</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow className="hover:bg-muted/50">
              <TableHead className="text-muted-foreground font-medium">Closer</TableHead>
              <TableHead className="text-muted-foreground text-center font-medium">R1 Realizadas</TableHead>
              <TableHead className="text-muted-foreground text-center font-medium">Contratos</TableHead>
              <TableHead className="text-muted-foreground text-center font-medium">R2 Agendadas</TableHead>
              <TableHead className="text-muted-foreground text-center font-medium">R2 Realizadas</TableHead>
              <TableHead className="text-muted-foreground text-center font-medium">Vendas</TableHead>
              <TableHead className="text-muted-foreground text-center font-medium">No-Shows</TableHead>
              <TableHead className="text-muted-foreground text-center font-medium">Taxa Conv.</TableHead>
              <TableHead className="text-muted-foreground text-center font-medium">Taxa R2</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => (
              <TableRow key={row.closerName} className="transition-colors hover:bg-muted/30">
                <TableCell className="font-medium text-foreground">
                  {row.closerName}
                </TableCell>
                <TableCell className="text-center">
                  <span className="text-blue-400">{row.r1Realizadas}</span>
                </TableCell>
                <TableCell className="text-center">
                  <span className="text-amber-400 font-medium">{row.contratosPagos}</span>
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/30">
                    {row.r2Agendadas}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  <span className="text-green-400">{row.r2Realizadas}</span>
                </TableCell>
                <TableCell className="text-center">
                  <span className="text-emerald-400 font-medium">{row.vendasRealizadas}</span>
                </TableCell>
                <TableCell className="text-center">
                  <span className="text-red-400">{row.noShows}</span>
                </TableCell>
                <TableCell className="text-center">
                  <Badge 
                    variant="outline" 
                    className={
                      row.taxaConversao >= 70 
                        ? 'bg-green-500/10 text-green-400 border-green-500/30' 
                        : row.taxaConversao >= 50 
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          : 'bg-red-500/10 text-red-400 border-red-500/30'
                    }
                  >
                    {row.taxaConversao.toFixed(1)}%
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  <Badge 
                    variant="outline" 
                    className={
                      row.taxaR2 >= 80 
                        ? 'bg-green-500/10 text-green-400 border-green-500/30' 
                        : row.taxaR2 >= 60 
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          : 'bg-red-500/10 text-red-400 border-red-500/30'
                    }
                  >
                    {row.taxaR2.toFixed(1)}%
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
