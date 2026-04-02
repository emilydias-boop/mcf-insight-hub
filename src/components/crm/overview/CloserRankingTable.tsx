import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { CloserRankingRow } from '@/hooks/useCRMOverviewData';
import { Target } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  data: CloserRankingRow[] | undefined;
  isLoading: boolean;
}

export function CloserRankingTable({ data, isLoading }: Props) {
  if (isLoading) {
    return <Skeleton className="h-64 w-full rounded-lg" />;
  }

  if (!data || data.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-foreground flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Ranking Closer
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-6 text-sm">Nenhum dado de closer disponível</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-foreground flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          Ranking Closer
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Closer</TableHead>
                <TableHead className="text-xs text-center">R1 Receb.</TableHead>
                <TableHead className="text-xs text-center">R1 Realiz.</TableHead>
                <TableHead className="text-xs text-center">No-Show</TableHead>
                <TableHead className="text-xs text-center">Contratos</TableHead>
                <TableHead className="text-xs text-center">R2 Agend.</TableHead>
                <TableHead className="text-xs text-center">R2 Realiz.</TableHead>
                <TableHead className="text-xs text-center">Vendas</TableHead>
                <TableHead className="text-xs text-center">Taxa Conv.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map(row => (
                <TableRow key={row.closerId}>
                  <TableCell className="font-medium text-sm text-foreground truncate max-w-[150px]">
                    {row.closerName}
                  </TableCell>
                  <TableCell className="text-center text-sm">{row.r1Recebidas}</TableCell>
                  <TableCell className="text-center text-sm">{row.r1Realizadas}</TableCell>
                  <TableCell className={cn("text-center text-sm", row.noShow > 3 && "text-destructive font-semibold")}>
                    {row.noShow}
                  </TableCell>
                  <TableCell className="text-center text-sm font-semibold text-success">{row.contratos}</TableCell>
                  <TableCell className="text-center text-sm">{row.r2Agendadas}</TableCell>
                  <TableCell className="text-center text-sm">{row.r2Realizadas}</TableCell>
                  <TableCell className="text-center text-sm font-semibold">{row.vendas}</TableCell>
                  <TableCell className={cn(
                    "text-center text-sm font-semibold",
                    row.taxaConversao < 20 ? "text-destructive" : row.taxaConversao > 40 ? "text-success" : "text-foreground"
                  )}>
                    {row.taxaConversao}%
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
