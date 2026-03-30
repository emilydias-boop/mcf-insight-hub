import { useMemo } from "react";
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
  disableNavigation?: boolean;
  sdrMetaMap?: Map<string, number>;
  diasUteisNoPeriodo?: number;
  sdrDiasUteisMap?: Map<string, number>;
}

export function SdrSummaryTable({ 
  data, 
  isLoading, 
  disableNavigation = false,
  sdrMetaMap,
  diasUteisNoPeriodo,
  sdrDiasUteisMap,
}: SdrSummaryTableProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const handleRowClick = (sdrEmail: string) => {
    const params = new URLSearchParams(searchParams);
    navigate(`/crm/reunioes-equipe/${encodeURIComponent(sdrEmail)}?${params.toString()}`);
  };

  const taxaContratoRanking = useMemo(() => {
    const withTaxa = data.map(row => ({
      email: row.sdrEmail,
      taxa: row.r1Realizada > 0 ? (row.contratos / row.r1Realizada) * 100 : 0
    }));
    
    const sorted = [...withTaxa].sort((a, b) => b.taxa - a.taxa);
    
    const rankMap = new Map<string, number>();
    sorted.forEach((item, index) => {
      rankMap.set(item.email, index + 1);
    });
    
    return rankMap;
  }, [data]);

  // Calculate totals
  const totals = useMemo(() => {
    return data.reduce(
      (acc, row) => ({
        agendamentos: acc.agendamentos + row.agendamentos,
        r1Agendada: acc.r1Agendada + row.r1Agendada,
        r1Realizada: acc.r1Realizada + row.r1Realizada,
        noShows: acc.noShows + row.noShows,
        contratos: acc.contratos + row.contratos,
      }),
      { agendamentos: 0, r1Agendada: 0, r1Realizada: 0, noShows: 0, contratos: 0 }
    );
  }, [data]);

  const totalTaxaContrato = totals.r1Realizada > 0 
    ? ((totals.contratos / totals.r1Realizada) * 100) : 0;

  const totalTaxaNoShow = totals.r1Agendada > 0 
    ? ((totals.noShows / totals.r1Agendada) * 100) : 0;

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
              {!disableNavigation && <TableHead className="text-muted-foreground w-10"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => {
              const metaDiaria = sdrMetaMap?.get(row.sdrEmail.toLowerCase()) || 10;
              const diasEfetivos = sdrDiasUteisMap?.get(row.sdrEmail.toLowerCase()) || diasUteisNoPeriodo || 1;
              const metaPeriodo = metaDiaria * diasEfetivos;
              const bateuMeta = row.agendamentos >= metaPeriodo;
              const isProporcional = sdrDiasUteisMap?.has(row.sdrEmail.toLowerCase()) && diasEfetivos < (diasUteisNoPeriodo || 1);

              const taxaContrato = row.r1Realizada > 0 
                ? ((row.contratos / row.r1Realizada) * 100)
                : 0;
              const taxaContratoFormatted = taxaContrato.toFixed(1);

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
                    <div className="flex flex-col items-center">
                      <span className={`font-medium ${bateuMeta ? 'text-green-400' : 'text-red-400'}`}>
                        {metaPeriodo}
                      </span>
                      {isProporcional && (
                        <span className="text-[10px] text-muted-foreground">
                          {diasEfetivos}/{diasUteisNoPeriodo}d
                        </span>
                      )}
                    </div>
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
                        <span className={`text-xs ${
                          (row.noShows / row.r1Agendada) * 100 <= 20 
                            ? 'text-green-400' 
                            : (row.noShows / row.r1Agendada) * 100 <= 35 
                              ? 'text-amber-400' 
                              : 'text-red-400'
                        }`}>
                          ({((row.noShows / row.r1Agendada) * 100).toFixed(1)}%)
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="text-amber-400 font-medium">{row.contratos}</span>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="text-xs text-muted-foreground font-medium">
                        #{taxaContratoRanking.get(row.sdrEmail)}
                      </span>
                      <span className={`font-medium ${taxaContratoColorClass}`}>{taxaContratoFormatted}%</span>
                    </div>
                  </TableCell>
                  {!disableNavigation && (
                    <TableCell>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                  )}
                </TableRow>
              );
            })}

            {/* Totals Row */}
            <TableRow className="bg-muted/30 font-semibold border-t-2 border-border">
              <TableCell className="text-foreground">Total</TableCell>
              <TableCell className="text-center text-muted-foreground">—</TableCell>
              <TableCell className="text-center">
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                  {totals.agendamentos}
                </Badge>
              </TableCell>
              <TableCell className="text-center">
                <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30">
                  {totals.r1Agendada}
                </Badge>
              </TableCell>
              <TableCell className="text-center">
                <span className="text-green-400">{totals.r1Realizada}</span>
              </TableCell>
              <TableCell className="text-center">
                <div className="flex flex-col items-center">
                  <span className="text-red-400">{totals.noShows}</span>
                  {totals.r1Agendada > 0 && (
                    <span className={`text-xs ${
                      totalTaxaNoShow <= 20 ? 'text-green-400' 
                        : totalTaxaNoShow <= 35 ? 'text-amber-400' 
                        : 'text-red-400'
                    }`}>
                      ({totalTaxaNoShow.toFixed(1)}%)
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-center">
                <span className="text-amber-400">{totals.contratos}</span>
              </TableCell>
              <TableCell className="text-center">
                <span className={`font-medium ${
                  totalTaxaContrato >= 20 ? 'text-green-400' 
                    : totalTaxaContrato >= 10 ? 'text-amber-400' 
                    : 'text-red-400'
                }`}>
                  {totalTaxaContrato.toFixed(1)}%
                </span>
              </TableCell>
              {!disableNavigation && <TableCell />}
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
