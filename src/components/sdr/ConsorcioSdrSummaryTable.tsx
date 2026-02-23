import { useNavigate, useSearchParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { SdrSummaryRow } from "@/hooks/useTeamMeetingsData";
import { ChevronRight, FileText } from "lucide-react";

interface ConsorcioSdrSummaryTableProps {
  data: SdrSummaryRow[];
  isLoading?: boolean;
  disableNavigation?: boolean;
  sdrMetaMap?: Map<string, number>;
  diasUteisNoPeriodo?: number;
  propostasEnviadasBySdr?: Map<string, number>;
  propostasFechadasBySdr?: Map<string, number>;
}

export function ConsorcioSdrSummaryTable({
  data,
  isLoading,
  disableNavigation = false,
  sdrMetaMap,
  diasUteisNoPeriodo,
  propostasEnviadasBySdr,
  propostasFechadasBySdr,
}: ConsorcioSdrSummaryTableProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const handleRowClick = (sdrEmail: string) => {
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
              <TableHead className="text-muted-foreground text-center font-medium">Meta</TableHead>
              <TableHead className="text-muted-foreground text-center font-medium">Agendamento</TableHead>
              <TableHead className="text-muted-foreground text-center font-medium">R1 Agendada</TableHead>
              <TableHead className="text-muted-foreground text-center font-medium">R1 Realizada</TableHead>
              <TableHead className="text-muted-foreground text-center font-medium">No-show</TableHead>
              <TableHead className="text-muted-foreground text-center font-medium">
                <span className="inline-flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5" />
                  Proposta Env.
                </span>
              </TableHead>
              <TableHead className="text-muted-foreground text-center font-medium">Proposta Fech.</TableHead>
              <TableHead className="text-muted-foreground text-center font-medium">Taxa Venda</TableHead>
              {!disableNavigation && <TableHead className="text-muted-foreground w-10"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => {
              const metaDiaria = sdrMetaMap?.get(row.sdrEmail.toLowerCase()) || 10;
              const metaPeriodo = metaDiaria * (diasUteisNoPeriodo || 1);
              const bateuMeta = row.agendamentos >= metaPeriodo;

              const propostas = propostasEnviadasBySdr?.get(row.sdrEmail.toLowerCase()) || 0;
              const fechadas = propostasFechadasBySdr?.get(row.sdrEmail.toLowerCase()) || 0;

              // Taxa Venda = Contratos / R1 Realizada
              const taxaVenda = row.r1Realizada > 0
                ? (row.contratos / row.r1Realizada) * 100
                : 0;
              const taxaVendaColor = taxaVenda >= 20
                ? 'text-green-400'
                : taxaVenda >= 10
                  ? 'text-amber-400'
                  : 'text-red-400';

              // No-show %
              const noShowPct = row.r1Agendada > 0
                ? (row.noShows / row.r1Agendada) * 100
                : 0;
              const noShowColor = noShowPct <= 20
                ? 'text-green-400'
                : noShowPct <= 35
                  ? 'text-amber-400'
                  : 'text-red-400';


              return (
                <TableRow
                  key={row.sdrEmail}
                  className={disableNavigation ? "transition-colors" : "cursor-pointer transition-colors hover:bg-muted/30"}
                  onClick={disableNavigation ? undefined : () => handleRowClick(row.sdrEmail)}
                >
                  <TableCell className="font-medium">
                    <div className="flex flex-col">
                      <span className="text-foreground">{row.sdrName}</span>
                      <span className="text-xs text-muted-foreground">{row.sdrEmail.split('@')[0]}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className={`font-medium ${bateuMeta ? 'text-green-400' : 'text-amber-400'}`}>
                      {metaPeriodo}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                      {row.agendamentos}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30">
                      {row.r1Agendada}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="text-green-400 font-medium">{row.r1Realizada}</span>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex flex-col items-center">
                      <span className="text-red-400 font-medium">{row.noShows}</span>
                      {row.r1Agendada > 0 && (
                        <span className={`text-xs ${noShowColor}`}>
                          ({noShowPct.toFixed(1)}%)
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/30">
                      {propostas}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="bg-orange-500/10 text-orange-400 border-orange-500/30">
                      {fechadas}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className={`font-medium ${taxaVendaColor}`}>{taxaVenda.toFixed(1)}%</span>
                  </TableCell>
                  {!disableNavigation && (
                    <TableCell>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
