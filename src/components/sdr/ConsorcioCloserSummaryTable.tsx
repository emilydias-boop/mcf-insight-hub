import { Badge } from "@/components/ui/badge";
import { CONSORCIO_LABELS } from "@/lib/consorcioLabels";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { ChevronRight, Search } from "lucide-react";
import { R1CloserMetric } from "@/hooks/useR1CloserMetrics";
import { ResiduoDetalheModal } from "./ResiduoDetalheModal";
import type { CotaResiduoItem } from "@/hooks/useConsorcioCotasContratadas";
import type { ProducaoGeradaLinha } from "@/hooks/useConsorcioProducaoGerada";

/** Texto aprovado pelo dono — não alterar sem decisão dele. */
export const PRODUCAO_GERADA_TOOLTIP =
  "Soma do crédito de todas as vendas lançadas, de termo de adesão pendente em diante. Conta cada venda uma única vez, no mês em que ela apareceu no sistema. Inclui vendas que ainda não se efetivaram.";

interface ConsorcioCloserSummaryTableProps {
  data?: R1CloserMetric[];
  isLoading?: boolean;
  onCloserClick?: (closerId: string) => void;
  propostasEnviadasByCloser?: Map<string, number>;
  /** Cotas contratadas (consortium_cards, tipo_registro='contratacao') por closer. */
  cotasByCloser?: Map<string, number>;
  /** Clientes distintos que contrataram ao menos uma cota, por closer. */
  clientesByCloser?: Map<string, number>;
  /** Clientes distintos em TODO o conjunto filtrado (não é a soma das linhas). */
  totalClientesDistintos?: number;
  /** Soma de valor_credito das cotas contratadas, por closer. */
  creditoByCloser?: Map<string, number>;
  /** Produção Gerada (perna funil + cotas avulsas, deduplicada) por closer. */
  producaoByCloser?: Map<string, ProducaoGeradaLinha>;
  /** Produção Gerada que não resolveu closer — balde explícito. */
  producaoSemAtribuicao?: ProducaoGeradaLinha;
  /** Cotas contratadas cujo vendedor não casou com nenhum closer da BU. */
  cotasSemCloser?: number;
  /** Clientes distintos e crédito da linha residual de vendedor. */
  clientesSemCloser?: number;
  creditoSemCloser?: number;
  /** Detalhe dessas cotas (mesma fonte do número). */
  cotasSemCloserItems?: CotaResiduoItem[];
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
  clientesByCloser,
  totalClientesDistintos = 0,
  creditoByCloser,
  producaoByCloser,
  producaoSemAtribuicao,

  cotasSemCloser = 0,
  clientesSemCloser = 0,
  creditoSemCloser = 0,
  cotasSemCloserItems = [],
  agendaUnassigned,
}: ConsorcioCloserSummaryTableProps) {
  const [detalheOpen, setDetalheOpen] = useState(false);

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
      clientes: acc.clientes + (clientesByCloser?.get(row.closer_id) || 0),
      credito: acc.credito + (creditoByCloser?.get(row.closer_id) || 0),
    }),
    { r1_agendada: 0, r1_realizada: 0, noshow: 0, cotas: 0, clientes: 0, credito: 0 }
  );

  const totals = {
    r1_agendada: baseTotals.r1_agendada + (unassignedRow?.r1_agendada || 0),
    r1_realizada: baseTotals.r1_realizada + (unassignedRow?.r1_realizada || 0),
    noshow: baseTotals.noshow + (unassignedRow?.noshow || 0),
    cotas: baseTotals.cotas + cotasSemCloser,
    // Pessoas não somam: distinct global do conjunto filtrado, calculado uma
    // única vez no hook — idêntico ao Total da aba SDRs e ao card do topo.
    clientes: totalClientesDistintos,
    credito: baseTotals.credito + creditoSemCloser,
  };

  // Produção Gerada: total isolado das outras colunas. Soma TODAS as linhas do
  // hook (mesmo de closer que não aparece na tabela) mais o balde sem
  // atribuição, para o Total nunca esconder crédito.
  let producaoTotal = producaoSemAtribuicao?.credito || 0;
  producaoByCloser?.forEach((l) => {
    producaoTotal += l.credito;
  });

  // Conversão por PESSOA: um cliente que compra várias cotas conta uma vez.
  const totalTaxaVenda = totals.r1_realizada > 0

    ? (totals.clientes / totals.r1_realizada) * 100
    : 0;
  const totalTicket = totals.clientes > 0 ? totals.credito / totals.clientes : null;

  const brl = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

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
              <TableHead className="text-muted-foreground text-center font-medium">{CONSORCIO_LABELS.reunioesAgendadas}</TableHead>
              <TableHead className="text-muted-foreground text-center font-medium">{CONSORCIO_LABELS.reunioesRealizadas}</TableHead>
              <TableHead className="text-muted-foreground text-center font-medium">No-show</TableHead>
              <TableHead
                className="text-muted-foreground text-center font-medium whitespace-nowrap"
                title="CLIENTES distintos que contrataram ao menos uma cota no período (identidade pelo CPF/CNPJ do titular, fallback no nome). Diferente de 'Cotas Contratadas': um cliente com 3 cotas conta 1 aqui e 3 ali. Cada cliente aparece em uma única linha, então as linhas somam o Total."
              >
                Vendas Realizadas
              </TableHead>
              <TableHead
                className="text-muted-foreground text-center font-medium whitespace-nowrap"
                title={PRODUCAO_GERADA_TOOLTIP}
              >
                Produção Gerada
              </TableHead>
              <TableHead
                className="text-muted-foreground text-center font-medium whitespace-nowrap"
                title="Quantidade de CARTAS contratadas no período (Controle Consórcio, tipo de registro 'contratação', eixo data de contratação). Diferente de 'Vendas Realizadas': um cliente que compra 3 cotas soma 3 aqui e 1 ali."
              >
                Cotas Contratadas
              </TableHead>

              <TableHead
                className="text-muted-foreground text-center font-medium whitespace-nowrap"
                title="Soma do crédito das cotas confirmadas pela Embracon (tipo de registro 'contratação'), pelo mês da data de contratação — não da proposta nem da reserva."
              >
                Consórcio Efetivado
              </TableHead>
              <TableHead
                className="text-muted-foreground text-center font-medium whitespace-nowrap"
                title="Consórcio Efetivado ÷ Vendas Realizadas. Uma venda = um cliente, mesmo que ele contrate várias cotas."
              >
                Ticket Médio
              </TableHead>
              <TableHead
                className="text-muted-foreground text-center font-medium whitespace-nowrap"
                title="Vendas Realizadas ÷ Reuniões Realizadas. Um cliente que contrata várias cotas conta uma vez."
              >
                {CONSORCIO_LABELS.convVendasReuniao}
              </TableHead>
              {onCloserClick && <TableHead className="w-8" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {closerRows.map((row) => {
              const cotas = cotasByCloser?.get(row.closer_id) || 0;
              const clientes = clientesByCloser?.get(row.closer_id) || 0;
              const credito = creditoByCloser?.get(row.closer_id) || 0;
              const producao = producaoByCloser?.get(row.closer_id);

              const ticket = clientes > 0 ? credito / clientes : null;
              const taxaVenda = row.r1_realizada > 0
                ? (clientes / row.r1_realizada) * 100
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
                    <Badge variant="outline" className="bg-teal-500/10 text-teal-400 border-teal-500/30">
                      {clientes}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="bg-cyan-500/10 text-cyan-400 border-cyan-500/30">
                      {cotas}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center whitespace-nowrap">
                    {credito > 0 ? brl(credito) : "—"}
                  </TableCell>
                  <TableCell className="text-center whitespace-nowrap">
                    {ticket !== null ? brl(ticket) : "—"}
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
            {cotasSemCloser > 0 && (
              <TableRow
                className="italic text-muted-foreground cursor-pointer hover:bg-muted/30"
                title="Clique para ver quais cotas estão aqui e o que falta corrigir em cada uma."
                onClick={() => setDetalheOpen(true)}
              >
                <TableCell className="font-normal underline decoration-dotted">
                  <span className="inline-flex items-center gap-1">
                    Sem vendedor identificado
                    <Search className="h-3 w-3" />
                  </span>
                </TableCell>
                <TableCell className="text-center">—</TableCell>
                <TableCell className="text-center">—</TableCell>
                <TableCell className="text-center">—</TableCell>
                <TableCell className="text-center">{clientesSemCloser}</TableCell>
                <TableCell className="text-center">{cotasSemCloser}</TableCell>
                <TableCell className="text-center whitespace-nowrap">
                  {creditoSemCloser > 0 ? brl(creditoSemCloser) : "—"}
                </TableCell>
                <TableCell className="text-center whitespace-nowrap">
                  {clientesSemCloser > 0 ? brl(creditoSemCloser / clientesSemCloser) : "—"}
                </TableCell>
                <TableCell className="text-center">—</TableCell>
                {onCloserClick && <TableCell />}
              </TableRow>
            )}

            {unassignedRow && (
              <TableRow className="italic text-muted-foreground hover:bg-muted/20" title={unassignedTooltip}>
                <TableCell className="font-normal underline decoration-dotted">Não atribuído</TableCell>
                <TableCell className="text-center">{unassignedRow.r1_agendada}</TableCell>
                <TableCell className="text-center">{unassignedRow.r1_realizada}</TableCell>
                <TableCell className="text-center">{unassignedRow.noshow}</TableCell>
                <TableCell className="text-center">—</TableCell>
                <TableCell className="text-center">—</TableCell>
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
                <Badge variant="outline" className="bg-teal-500/10 text-teal-400 border-teal-500/30">
                  {totals.clientes}
                </Badge>
              </TableCell>
              <TableCell className="text-center">
                <Badge variant="outline" className="bg-cyan-500/10 text-cyan-400 border-cyan-500/30">
                  {totals.cotas}
                </Badge>
              </TableCell>
              <TableCell className="text-center whitespace-nowrap">
                {totals.credito > 0 ? brl(totals.credito) : "—"}
              </TableCell>
              <TableCell className="text-center whitespace-nowrap">
                {totalTicket !== null ? brl(totalTicket) : "—"}
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

      <p className="px-4 py-2 text-xs text-muted-foreground">
        Vendas Realizadas conta pessoas, não cartas: um cliente com 3 cotas soma 1 aqui e 3 em
        Cotas Contratadas. O Total é o mesmo nas abas SDRs e Closers.
      </p>

      <ResiduoDetalheModal
        open={detalheOpen}
        onOpenChange={setDetalheOpen}
        kind="cota"
        titulo="Sem vendedor identificado"
        descricao="Cotas contratadas no período (com o filtro de funil ativo) cujo vendedor não casa com nenhum closer da BU Consórcio. A coluna Motivo separa campo vazio de grafia divergente."
        items={cotasSemCloserItems}
        esperado={cotasSemCloser}
        permitirCorrigirVendedor
      />
    </div>
  );
}
