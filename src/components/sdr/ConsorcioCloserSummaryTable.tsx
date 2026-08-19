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
import { ChevronRight } from "lucide-react";
import { R1CloserMetric } from "@/hooks/useR1CloserMetrics";

interface ConsorcioCloserSummaryTableProps {
  data?: R1CloserMetric[];
  isLoading?: boolean;
  onCloserClick?: (closerId: string) => void;
  propostasEnviadasByCloser?: Map<string, number>;
  /** Cotas contratadas (consortium_cards, tipo_registro='contratacao') por closer. */
  cotasByCloser?: Map<string, number>;
  /** Cotas contratadas cujo vendedor não casou com nenhum closer da BU. */
  cotasSemCloser?: number;
  /** Fatos da agenda sem closer identificável. */
  agendaUnassigned?: {
    r1Agendada: number;
    r1Realizada: number;
    noShows: number;
    contratos: number;
  } | null;
}

export function ConsorcioCloserSummaryTable({
  data,
  isLoading,
  onCloserClick,
  propostasEnviadasByCloser,
  cotasByCloser,
  cotasSemCloser = 0,
  agendaUnassigned,
}: ConsorcioCloserSummaryTableProps) {
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

  const closerRows = data.filter(row => !row.is_unassigned);
  const unassignedRow = agendaUnassigned
    ? {
        r1_agendada: agendaUnassigned.r1Agendada,
        r1_realizada: agendaUnassigned.r1Realizada,
        noshow: agendaUnassigned.noShows,
        contratos: agendaUnassigned.contratos,
      }
    : null;

  const baseTotals = closerRows.reduce(
    (acc, row) => ({
      r1_agendada: acc.r1_agendada + row.r1_agendada,
      r1_realizada: acc.r1_realizada + row.r1_realizada,
      noshow: acc.noshow + row.noshow,
      cotas: acc.cotas + (cotasByCloser?.get(row.closer_id) || 0),
    }),
    { r1_agendada: 0, r1_realizada: 0, noshow: 0, cotas: 0 }
  );

  const totals = {
    r1_agendada: baseTotals.r1_agendada + (unassignedRow?.r1_agendada || 0),
    r1_realizada: baseTotals.r1_realizada + (unassignedRow?.r1_realizada || 0),
    noshow: baseTotals.noshow + (unassignedRow?.noshow || 0),
    cotas: baseTotals.cotas + cotasSemCloser,
  };

  const totalPropostas = data.reduce(
    (acc, row) => acc + (propostasEnviadasByCloser?.get(row.closer_id) || 0),
    0
  );

  const totalTaxaVenda = totals.r1_realizada > 0
    ? (totals.cotas / totals.r1_realizada) * 100
    : 0;

  const getTaxaColor = (taxa: number, thresholds: { green: number; amber: number }) => {
    if (taxa >= thresholds.green) return "text-green-400";
    if (taxa >= thresholds.amber) return "text-amber-400";
    return "text-red-400";
  };

  const unassignedTooltip =
    'Fatos da agenda sem closer identificável nesta BU. Aparecem aqui para que o Total nunca divirja do card.';

  return (
    <div className="rounded-md border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow className="hover:bg-muted/50">
              <TableHead className="text-muted-foreground font-medium">Closer</TableHead>
              <TableHead className="text-muted-foreground text-center font-medium">R1 Agendada</TableHead>
              <TableHead className="text-muted-foreground text-center font-medium">R1 Realizada</TableHead>
              <TableHead className="text-muted-foreground text-center font-medium">No-show</TableHead>
              <TableHead className="text-muted-foreground text-center font-medium">Proposta Env.</TableHead>
              <TableHead
                className="text-muted-foreground text-center font-medium whitespace-nowrap"
                title="Cotas efetivamente contratadas (Controle Consórcio, tipo de registro 'contratação'), pela data de contratação. Atribuídas ao vendedor da cota."
              >
                Cotas Contratadas
              </TableHead>
              <TableHead
                className="text-muted-foreground text-center font-medium whitespace-nowrap"
                title="Cotas Contratadas ÷ R1 Realizada, no período."
              >
                Cotas / R1 Realiz.
              </TableHead>
              {onCloserClick && <TableHead className="w-8" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {closerRows.map((row) => {
              const propostas = propostasEnviadasByCloser?.get(row.closer_id) || 0;
              const cotas = cotasByCloser?.get(row.closer_id) || 0;
              const taxaVenda = row.r1_realizada > 0
                ? (cotas / row.r1_realizada) * 100
                : 0;
              const noshowPct = row.r1_agendada > 0
                ? (row.noshow / row.r1_agendada) * 100
                : 0;

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
                    <span className="text-green-400 font-medium">{row.r1_realizada}</span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="text-red-400">
                      {row.noshow}
                      {row.r1_agendada > 0 && (
                        <span className="text-muted-foreground text-xs ml-1">({noshowPct.toFixed(0)}%)</span>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/30">
                      {propostas}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="bg-cyan-500/10 text-cyan-400 border-cyan-500/30">
                      {cotas}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className={`font-medium ${getTaxaColor(taxaVenda, { green: 20, amber: 10 })}`}>
                      {taxaVenda.toFixed(1)}%
                    </span>
                  </TableCell>
                  {onCloserClick && (
                    <TableCell className="text-center px-2">
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                  )}
                </TableRow>
              );
            })}

            {/* Não atribuído: reuniões sem closer identificável nesta BU */}
            {unassignedRow && (
              <TableRow className="italic text-muted-foreground hover:bg-muted/20" title={unassignedTooltip}>
                <TableCell className="font-normal underline decoration-dotted">Não atribuído</TableCell>
                <TableCell className="text-center">{unassignedRow.r1_agendada}</TableCell>
                <TableCell className="text-center">{unassignedRow.r1_realizada}</TableCell>
                <TableCell className="text-center">{unassignedRow.noshow}</TableCell>
                <TableCell className="text-center">—</TableCell>
                <TableCell className="text-center">—</TableCell>
                <TableCell className="text-center">—</TableCell>
                {onCloserClick && <TableCell />}
              </TableRow>
            )}

            {/* Totals Row */}
            <TableRow className="bg-muted/30 font-semibold border-t-2 border-border">
              <TableCell className="text-foreground">Total</TableCell>
              <TableCell className="text-center">
                <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30">
                  {totals.r1_agendada}
                </Badge>
              </TableCell>
              <TableCell className="text-center">
                <span className="text-green-400">{totals.r1_realizada}</span>
              </TableCell>
              <TableCell className="text-center">
                <span className="text-red-400">
                  {totals.noshow}
                  {totals.r1_agendada > 0 && (
                    <span className="text-muted-foreground text-xs ml-1">
                      ({((totals.noshow / totals.r1_agendada) * 100).toFixed(0)}%)
                    </span>
                  )}
                </span>
              </TableCell>
              <TableCell className="text-center">
                <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/30">
                  {totalPropostas}
                </Badge>
              </TableCell>
              <TableCell className="text-center">
                <Badge variant="outline" className="bg-cyan-500/10 text-cyan-400 border-cyan-500/30">
                  {totals.cotas}
                </Badge>
              </TableCell>
              <TableCell className="text-center">
                <span className={`font-medium ${getTaxaColor(totalTaxaVenda, { green: 20, amber: 10 })}`}>
                  {totalTaxaVenda.toFixed(1)}%
                </span>
              </TableCell>
              {onCloserClick && <TableCell />}
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
