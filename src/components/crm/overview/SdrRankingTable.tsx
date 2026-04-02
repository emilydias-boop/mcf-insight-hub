import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { SdrRankingRow } from '@/hooks/useCRMOverviewData';
import { Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  data: SdrRankingRow[] | undefined;
  isLoading: boolean;
}

export function SdrRankingTable({ data, isLoading }: Props) {
  if (isLoading) {
    return <Skeleton className="h-64 w-full rounded-lg" />;
  }

  if (!data || data.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-foreground flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Ranking SDR
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-6 text-sm">Nenhum dado de SDR disponível</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-foreground flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Ranking SDR
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">SDR</TableHead>
                <TableHead className="text-xs text-center">Recebidos</TableHead>
                <TableHead className="text-xs text-center">Trabalhados</TableHead>
                <TableHead className="text-xs text-center">Sem Mov.</TableHead>
                <TableHead className="text-xs text-center">Agendados</TableHead>
                <TableHead className="text-xs text-center">Perdidos</TableHead>
                <TableHead className="text-xs text-center">Esquecidos</TableHead>
                <TableHead className="text-xs text-center">Taxa Aprov.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map(row => (
                <TableRow key={row.sdrId}>
                  <TableCell className="font-medium text-sm text-foreground truncate max-w-[150px]">
                    {row.sdrName}
                  </TableCell>
                  <TableCell className="text-center text-sm">{row.recebidos}</TableCell>
                  <TableCell className="text-center text-sm">{row.trabalhados}</TableCell>
                  <TableCell className={cn("text-center text-sm", row.semMovimentacao > 5 && "text-destructive font-semibold")}>
                    {row.semMovimentacao}
                  </TableCell>
                  <TableCell className="text-center text-sm">{row.agendados}</TableCell>
                  <TableCell className={cn("text-center text-sm", row.perdidos > 3 && "text-destructive")}>
                    {row.perdidos}
                  </TableCell>
                  <TableCell className={cn("text-center text-sm", row.esquecidos > 5 && "text-destructive font-semibold")}>
                    {row.esquecidos}
                  </TableCell>
                  <TableCell className={cn(
                    "text-center text-sm font-semibold",
                    row.taxaAproveitamento < 30 ? "text-destructive" : row.taxaAproveitamento > 70 ? "text-success" : "text-foreground"
                  )}>
                    {row.taxaAproveitamento}%
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
