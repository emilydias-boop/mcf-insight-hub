import { useNavigate, useSearchParams } from "react-router-dom";
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
import { SdrSummaryRow } from "@/hooks/useTeamMeetingsData";
import { ChevronRight } from "lucide-react";

interface SdrSummaryTableProps {
  data: SdrSummaryRow[];
  isLoading?: boolean;
}

export function SdrSummaryTable({ data, isLoading }: SdrSummaryTableProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const handleRowClick = (sdrEmail: string) => {
    // Build query params to preserve filters
    const params = new URLSearchParams(searchParams);
    navigate(`/crm/reunioes-equipe/${encodeURIComponent(sdrEmail)}?${params.toString()}`);
  };
  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <p>Nenhum SDR com atividade no período.</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow className="hover:bg-muted/50">
              <TableHead className="text-muted-foreground font-medium">SDR</TableHead>
              <TableHead className="text-muted-foreground text-center font-medium">1º Agend.</TableHead>
              <TableHead className="text-muted-foreground text-center font-medium">Reagend.</TableHead>
              <TableHead className="text-muted-foreground text-center font-medium">Total</TableHead>
              <TableHead className="text-muted-foreground text-center font-medium">Realizadas</TableHead>
              <TableHead className="text-muted-foreground text-center font-medium">No-Show</TableHead>
              <TableHead className="text-muted-foreground text-center font-medium">Contratos</TableHead>
              <TableHead className="text-muted-foreground text-center font-medium">Taxa Conv.</TableHead>
              <TableHead className="text-muted-foreground text-center font-medium">Taxa No-Show</TableHead>
              <TableHead className="text-muted-foreground w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => {
              return (
                <TableRow
                  key={row.sdrEmail}
                  className="cursor-pointer transition-colors hover:bg-muted/30"
                  onClick={() => handleRowClick(row.sdrEmail)}
                >
                  <TableCell className="font-medium">
                    <div className="flex flex-col">
                      <span className="text-foreground">{row.sdrName}</span>
                      <span className="text-xs text-muted-foreground">{row.sdrEmail.split('@')[0]}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                      {row.primeiroAgendamento}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30">
                      {row.reagendamento}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center font-bold text-foreground">
                    {row.totalAgendamentos}
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="text-green-400">{row.realizadas}</span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="text-red-400">{row.noShows}</span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="text-amber-400 font-medium">{row.contratos}</span>
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
                    <span className={row.taxaNoShow > 30 ? 'text-red-400' : 'text-muted-foreground'}>
                      {row.taxaNoShow.toFixed(1)}%
                    </span>
                  </TableCell>
                  <TableCell>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
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
