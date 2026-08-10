import { Fragment, useMemo } from "react";
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
import { ChevronRight, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export interface SdrSummaryTotalsOverride {
  agendamentos?: number;
  r1Agendada: number;
  r1Realizada: number;
  noShows: number;
  contratos: number;
  reembolsos?: number;
}

export interface SdrSegmentMetricValues {
  agendamentos: number;
  r1Agendada: number;
  r1Realizada: number;
  noShows: number;
  contratos: number;
}

interface SdrSummaryTableProps {
  data: SdrSummaryRow[];
  isLoading?: boolean;
  disableNavigation?: boolean;
  sdrMetaMap?: Map<string, number>;
  diasUteisNoPeriodo?: number;
  sdrDiasUteisMap?: Map<string, number>;
  totaisOverride?: SdrSummaryTotalsOverride;
  bu?: string;
  /** Aditivo: quando informados, cada SDR ganha sub-linhas "↳ Lead A" / "↳ Lead B". */
  segmentAMap?: Map<string, SdrSegmentMetricValues>;
  segmentBMap?: Map<string, SdrSegmentMetricValues>;
  /** Contratos pagos no período que não puderam ser atribuídos a nenhum SDR. */
  unassigned?: { total: number; a: number; b: number };
}

export function SdrSummaryTable({ 
  data, 
  isLoading, 
  disableNavigation = false,
  sdrMetaMap,
  diasUteisNoPeriodo,
  sdrDiasUteisMap,
  totaisOverride,
  bu,
  segmentAMap,
  segmentBMap,
  unassigned,
}: SdrSummaryTableProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isConsorcio = (bu || '').toLowerCase() === 'consorcio';
  const contratoLabel = isConsorcio ? 'Propostas Fechadas' : 'Contrato PAGO';
  const taxaLiquidaLabel = isConsorcio ? 'Taxa Conv. Proposta' : 'Taxa Conv. Contrato';

  const handleRowClick = (sdrEmail: string) => {
    const params = new URLSearchParams(searchParams);
    navigate(`/crm/reunioes-equipe/${encodeURIComponent(sdrEmail)}?${params.toString()}`);
  };

  // Calculate totals
  const totals = useMemo(() => {
    const computed = data.reduce(
      (acc, row) => ({
        agendamentos: acc.agendamentos + row.agendamentos,
        r1Agendada: acc.r1Agendada + row.r1Agendada,
        r1Realizada: acc.r1Realizada + row.r1Realizada,
        noShows: acc.noShows + row.noShows,
        contratos: acc.contratos + row.contratos,
        reembolsos: acc.reembolsos + (row.reembolsos || 0),
      }),
      { agendamentos: 0, r1Agendada: 0, r1Realizada: 0, noShows: 0, contratos: 0, reembolsos: 0 }
    );

    if (totaisOverride) {
      return {
        agendamentos: totaisOverride.agendamentos ?? computed.agendamentos,
        r1Agendada: totaisOverride.r1Agendada,
        r1Realizada: totaisOverride.r1Realizada,
        noShows: totaisOverride.noShows,
        contratos: totaisOverride.contratos,
        reembolsos: computed.reembolsos,
      };
    }
    return computed;
  }, [data, totaisOverride]);

  const totalTaxaNoShow = totals.r1Agendada > 0
    ? ((totals.noShows / totals.r1Agendada) * 100) : 0;

  const showSegments = !!(segmentAMap || segmentBMap);
  const emptySeg: SdrSegmentMetricValues = {
    agendamentos: 0, r1Agendada: 0, r1Realizada: 0, noShows: 0, contratos: 0,
  };
  const getSeg = (map: Map<string, SdrSegmentMetricValues> | undefined, email: string) =>
    map?.get(email.toLowerCase()) ?? emptySeg;

  const sumSeg = (map?: Map<string, SdrSegmentMetricValues>): SdrSegmentMetricValues =>
    data.reduce((acc, row) => {
      const v = getSeg(map, row.sdrEmail);
      return {
        agendamentos: acc.agendamentos + v.agendamentos,
        r1Agendada: acc.r1Agendada + v.r1Agendada,
        r1Realizada: acc.r1Realizada + v.r1Realizada,
        noShows: acc.noShows + v.noShows,
        contratos: acc.contratos + v.contratos,
      };
    }, { ...emptySeg });

  const totalsSegA = sumSeg(segmentAMap);
  const totalsSegB = sumSeg(segmentBMap);

  const un = unassigned && unassigned.total > 0 ? unassigned : null;
  const totalContratos = totals.contratos + (un?.total ?? 0);
  const colSpanBase = showSegments ? 10 : 5;

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
              {(showSegments
                ? [
                    'Agendamento A', 'Agendamento B',
                    'R1 Agendada A', 'R1 Agendada B',
                    'R1 Realizada A', 'R1 Realizada B',
                    'No-show A', 'No-show B',
                    `${contratoLabel} A`, `${contratoLabel} B`,
                  ]
                : ['Agendamento', 'R1 Agendada', 'R1 Realizada', 'No-show', contratoLabel]
              ).map((h) => (
                <TableHead key={h} className="text-muted-foreground text-center font-medium whitespace-nowrap">
                  {h}
                </TableHead>
              ))}
              <TableHead className="text-muted-foreground text-center font-medium">Reembolsos</TableHead>
              <TableHead className="text-muted-foreground text-center font-medium">{taxaLiquidaLabel}</TableHead>
              {!disableNavigation && <TableHead className="text-muted-foreground w-10"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => {
              const metaDiaria = sdrMetaMap?.get(row.sdrEmail.toLowerCase()) || 10;
              const diasEfetivos = sdrDiasUteisMap?.get(row.sdrEmail.toLowerCase()) || diasUteisNoPeriodo || 1;
              const metaPeriodo = Math.round(metaDiaria * diasEfetivos);
              // Regra: só Lead A conta para meta. Com segmentos ativos, comparar apenas o valor A.
              const agendamentosParaMeta = showSegments
                ? getSeg(segmentAMap, row.sdrEmail).agendamentos
                : row.agendamentos;
              const bateuMeta = agendamentosParaMeta >= metaPeriodo;
              const isProporcional = sdrDiasUteisMap?.has(row.sdrEmail.toLowerCase()) && diasEfetivos < (diasUteisNoPeriodo || 1);

              const contratosLiquidos = row.contratos - (row.reembolsos || 0);
              const taxaLiquida = row.r1Realizada > 0
                ? (contratosLiquidos / row.r1Realizada) * 100
                : 0;
              const taxaLiquidaColorClass = taxaLiquida >= 20
                ? 'text-green-400'
                : taxaLiquida >= 10
                  ? 'text-amber-400'
                  : 'text-red-400';

              return (
                <Fragment key={row.sdrEmail}>
                <TableRow
                  className={disableNavigation ? "transition-colors" : "cursor-pointer transition-colors hover:bg-muted/30"}
                  onClick={disableNavigation ? undefined : () => handleRowClick(row.sdrEmail)}
                >
                  <TableCell className="font-medium">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="text-foreground">{row.sdrName}</span>
                        {row.isExSquad && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="outline" className="bg-muted/40 text-muted-foreground border-border text-[10px] px-1.5 py-0 h-4">
                                  ex-squad
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs">
                                  SDR pertencia a este squad no período.
                                  {row.currentSquad && ` Hoje está em: ${row.currentSquad}.`}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
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
                  {showSegments ? (
                    <>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                          {getSeg(segmentAMap, row.sdrEmail).agendamentos}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                          {getSeg(segmentBMap, row.sdrEmail).agendamentos}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30">
                          {getSeg(segmentAMap, row.sdrEmail).r1Agendada}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30">
                          {getSeg(segmentBMap, row.sdrEmail).r1Agendada}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-green-400 font-medium">{getSeg(segmentAMap, row.sdrEmail).r1Realizada}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-green-400 font-medium">{getSeg(segmentBMap, row.sdrEmail).r1Realizada}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-red-400 font-medium">{getSeg(segmentAMap, row.sdrEmail).noShows}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-red-400 font-medium">{getSeg(segmentBMap, row.sdrEmail).noShows}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-amber-400 font-medium">{getSeg(segmentAMap, row.sdrEmail).contratos}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-amber-400 font-medium">{getSeg(segmentBMap, row.sdrEmail).contratos}</span>
                      </TableCell>
                    </>
                  ) : (
                    <>
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
                    </>
                  )}
                  <TableCell className="text-center">
                    <span className={`font-medium ${(row.reembolsos || 0) > 0 ? 'text-red-400' : 'text-muted-foreground'}`}>
                      {row.reembolsos || 0}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className={`font-medium ${taxaLiquidaColorClass}`}>{taxaLiquida.toFixed(1)}%</span>
                  </TableCell>
                  {!disableNavigation && (
                    <TableCell>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                  )}
                </TableRow>
                </Fragment>
              );
            })}

            {/* Não atribuído: contratos pagos no período sem SDR identificável */}
            {un && (
              <TableRow className="italic text-muted-foreground">
                <TableCell className="font-normal">Não atribuído</TableCell>
                <TableCell className="text-center">—</TableCell>
                {showSegments ? (
                  <>
                    <TableCell className="text-center">—</TableCell>
                    <TableCell className="text-center">—</TableCell>
                    <TableCell className="text-center">—</TableCell>
                    <TableCell className="text-center">—</TableCell>
                    <TableCell className="text-center">—</TableCell>
                    <TableCell className="text-center">—</TableCell>
                    <TableCell className="text-center">—</TableCell>
                    <TableCell className="text-center">—</TableCell>
                    <TableCell className="text-center">{un.a}</TableCell>
                    <TableCell className="text-center">{un.b}</TableCell>
                  </>
                ) : (
                  <>
                    <TableCell className="text-center">—</TableCell>
                    <TableCell className="text-center">—</TableCell>
                    <TableCell className="text-center">—</TableCell>
                    <TableCell className="text-center">—</TableCell>
                    <TableCell className="text-center">{un.total}</TableCell>
                  </>
                )}
                <TableCell className="text-center">—</TableCell>
                <TableCell className="text-center">—</TableCell>
                {!disableNavigation && <TableCell />}
              </TableRow>
            )}

            {/* Totals Row */}
            <TableRow className="bg-muted/30 font-semibold border-t-2 border-border">
              <TableCell className="text-foreground">
                <div className="flex items-center gap-1.5">
                  <span>Total</span>
                  {totaisOverride && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p className="text-xs">
                            O total reflete as métricas consolidadas da BU (deduplicadas por deal e incluindo vendas manuais), iguais aos cards do topo e à aba Closers. As linhas individuais mostram o esforço de cada SDR conforme o agendamento via Agenda.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-center text-muted-foreground">—</TableCell>
              {showSegments ? (
                <>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                      {totalsSegA.agendamentos}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                      {totalsSegB.agendamentos}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30">
                      {totalsSegA.r1Agendada}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30">
                      {totalsSegB.r1Agendada}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center"><span className="text-green-400">{totalsSegA.r1Realizada}</span></TableCell>
                  <TableCell className="text-center"><span className="text-green-400">{totalsSegB.r1Realizada}</span></TableCell>
                  <TableCell className="text-center"><span className="text-red-400">{totalsSegA.noShows}</span></TableCell>
                  <TableCell className="text-center"><span className="text-red-400">{totalsSegB.noShows}</span></TableCell>
                  <TableCell className="text-center"><span className="text-amber-400">{totalsSegA.contratos}</span></TableCell>
                  <TableCell className="text-center"><span className="text-amber-400">{totalsSegB.contratos}</span></TableCell>
                </>
              ) : (
                <>
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
                </>
              )}
              <TableCell className="text-center">
                <span className={`${(totals.reembolsos || 0) > 0 ? 'text-red-400' : 'text-muted-foreground'}`}>
                  {totals.reembolsos || 0}
                </span>
              </TableCell>
              <TableCell className="text-center">
                {(() => {
                  const totalLiquida = totals.r1Realizada > 0
                    ? ((totals.contratos - (totals.reembolsos || 0)) / totals.r1Realizada) * 100
                    : 0;
                  const cls = totalLiquida >= 20 ? 'text-green-400'
                    : totalLiquida >= 10 ? 'text-amber-400'
                    : 'text-red-400';
                  return <span className={`font-medium ${cls}`}>{totalLiquida.toFixed(1)}%</span>;
                })()}
              </TableCell>
              {!disableNavigation && <TableCell />}
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
