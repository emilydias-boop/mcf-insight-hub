import { useNavigate, useSearchParams, Link } from "react-router-dom";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { SdrSummaryRow } from "@/hooks/useTeamMeetingsData";
import { GhostCountBySdr } from "@/hooks/useGhostCountBySdr";
import { ChevronRight, Ghost } from "lucide-react";

interface SdrSummaryTableProps {
  data: SdrSummaryRow[];
  isLoading?: boolean;
  ghostCountBySdr?: Record<string, GhostCountBySdr>;
  disableNavigation?: boolean;
  sdrMetaMap?: Map<string, number>;
  diasUteisNoPeriodo?: number;
}

export function SdrSummaryTable({ 
  data, 
  isLoading, 
  ghostCountBySdr, 
  disableNavigation = false,
  sdrMetaMap,
  diasUteisNoPeriodo 
}: SdrSummaryTableProps) {
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
              <TableHead className="text-muted-foreground text-center font-medium">Meta</TableHead>
              <TableHead className="text-muted-foreground text-center font-medium">Agendamento</TableHead>
              <TableHead className="text-muted-foreground text-center font-medium">R1 Agendada</TableHead>
              <TableHead className="text-muted-foreground text-center font-medium">R1 Realizada</TableHead>
              <TableHead className="text-muted-foreground text-center font-medium">No-show</TableHead>
              <TableHead className="text-muted-foreground text-center font-medium">Contrato PAGO</TableHead>
              <TableHead className="text-muted-foreground text-center font-medium">Taxa Contrato</TableHead>
              <TableHead className="text-muted-foreground text-center font-medium">Taxa Conv.</TableHead>
              <TableHead className="text-muted-foreground text-center font-medium">
                <Ghost className="h-4 w-4 inline" />
              </TableHead>
              {!disableNavigation && <TableHead className="text-muted-foreground w-10"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => {
              const ghostData = ghostCountBySdr?.[row.sdrEmail];
              const hasGhostCases = ghostData && ghostData.pending_count > 0;
              const hasCritical = ghostData?.critical_count && ghostData.critical_count > 0;
              const hasHigh = ghostData?.high_count && ghostData.high_count > 0;

              // Calculate meta for this SDR
              const metaDiaria = sdrMetaMap?.get(row.sdrEmail.toLowerCase()) || 10;
              const metaPeriodo = metaDiaria * (diasUteisNoPeriodo || 1);
              const bateuMeta = row.agendamentos >= metaPeriodo;

              // Calculate taxa de conversão (R1 Realizada / R1 Agendada)
              const taxaConversao = row.r1Agendada > 0 
                ? ((row.r1Realizada / row.r1Agendada) * 100)
                : 0;
              const taxaConversaoFormatted = taxaConversao.toFixed(1);

              // Taxa color: green >= 70%, amber >= 40%, red < 40%
              const taxaColorClass = taxaConversao >= 70 
                ? 'text-green-400' 
                : taxaConversao >= 40 
                  ? 'text-amber-400' 
                  : 'text-red-400';

              // Calculate taxa de contrato (Contratos / R1 Realizada)
              const taxaContrato = row.r1Realizada > 0 
                ? ((row.contratos / row.r1Realizada) * 100)
                : 0;
              const taxaContratoFormatted = taxaContrato.toFixed(1);

              // Taxa contrato color: green >= 20%, amber >= 10%, red < 10%
              const taxaContratoColorClass = taxaContrato >= 20 
                ? 'text-green-400' 
                : taxaContrato >= 10 
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
                    <span className="text-red-400">{row.noShows}</span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="text-amber-400 font-medium">{row.contratos}</span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className={`font-medium ${taxaContratoColorClass}`}>{taxaContratoFormatted}%</span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className={`font-medium ${taxaColorClass}`}>{taxaConversaoFormatted}%</span>
                  </TableCell>
                  <TableCell className="text-center">
                    {hasGhostCases ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Link
                              to={`/crm/auditoria-agendamentos?sdr=${encodeURIComponent(row.sdrEmail)}`}
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex"
                            >
                              <Badge
                                variant="outline"
                                className={
                                  hasCritical
                                    ? 'bg-red-500/20 text-red-400 border-red-500/40 animate-pulse'
                                    : hasHigh
                                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                                    : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40'
                                }
                              >
                                <Ghost className="h-3 w-3 mr-1" />
                                {ghostData.pending_count}
                              </Badge>
                            </Link>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{ghostData.pending_count} caso{ghostData.pending_count !== 1 ? 's' : ''} suspeito{ghostData.pending_count !== 1 ? 's' : ''}</p>
                            {hasCritical && <p className="text-red-400">{ghostData.critical_count} crítico{ghostData.critical_count !== 1 ? 's' : ''}</p>}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : (
                      <span className="text-muted-foreground/50">-</span>
                    )}
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
