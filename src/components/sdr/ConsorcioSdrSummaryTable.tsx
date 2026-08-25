import { useState } from "react";
import { CONSORCIO_LABELS } from "@/lib/consorcioLabels";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { SdrSummaryRow, SdrUnassignedBucket } from "@/hooks/useTeamMeetingsData";
import { ChevronRight, Search } from "lucide-react";
import { ResiduoDetalheModal, type AgendaResiduoItem } from "./ResiduoDetalheModal";
import type { CotaResiduoItem } from "@/hooks/useConsorcioCotasContratadas";

interface ConsorcioSdrSummaryTableProps {
  data: SdrSummaryRow[];
  isLoading?: boolean;
  disableNavigation?: boolean;
  /**
   * Quando informado, substitui a navegação legada (/crm/reunioes-equipe) —
   * usado pela BU Consórcio para abrir o detalhe próprio do SDR.
   */
  onSdrClick?: (sdrEmail: string) => void;
  /** Quais linhas são clicáveis. Sem isso, todas são (respeitando disableNavigation). */
  canOpenSdr?: (sdrEmail: string) => boolean;
  sdrMetaMap?: Map<string, number>;
  diasUteisNoPeriodo?: number;
  sdrDiasUteisMap?: Map<string, number>;
  propostasEnviadasBySdr?: Map<string, number>;
  /** Cotas contratadas (consortium_cards, tipo_registro='contratacao') por SDR. */
  cotasBySdr?: Map<string, number>;
  /** Clientes distintos que contrataram ao menos uma cota, por SDR. */
  clientesBySdr?: Map<string, number>;
  /** Clientes distintos em TODO o conjunto filtrado (não é a soma das linhas). */
  totalClientesDistintos?: number;
  /** Soma de valor_credito das cotas contratadas, por SDR. */
  creditoBySdr?: Map<string, number>;
  /** Cotas contratadas sem vínculo com lead — linha própria. */
  cotasSemVinculo?: number;
  /** Clientes distintos e crédito da linha "Sem vínculo com lead". */
  clientesSemVinculo?: number;
  creditoSemVinculo?: number;
  /** Nome exibível por e-mail (para SDR com cota mas sem atividade na agenda). */
  sdrNames?: Map<string, string>;
  /** Quando um SDR está filtrado, restringe as linhas extras a esse e-mail. */
  sdrFilterEmail?: string | null;
  /** Métricas devolvidas pela RPC cujo agendador o front não reconhece. */
  unassigned?: SdrUnassignedBucket | null;
  /** Detalhe das cotas sem vínculo (mesma fonte do número). */
  cotasSemVinculoItems?: CotaResiduoItem[];
  /** Detalhe dos fatos de agenda sem agendador (mesma fonte do número). */
  unassignedItems?: AgendaResiduoItem[];
}

export function ConsorcioSdrSummaryTable({
  data,
  isLoading,
  disableNavigation = false,
  onSdrClick,
  canOpenSdr,
  sdrMetaMap,
  diasUteisNoPeriodo,
  sdrDiasUteisMap,
  propostasEnviadasBySdr,
  cotasBySdr,
  clientesBySdr,
  totalClientesDistintos = 0,
  creditoBySdr,
  cotasSemVinculo = 0,
  clientesSemVinculo = 0,
  creditoSemVinculo = 0,
  sdrNames,
  sdrFilterEmail = null,
  unassigned = null,
  cotasSemVinculoItems = [],
  unassignedItems = [],
}: ConsorcioSdrSummaryTableProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [detalhe, setDetalhe] = useState<null | "semVinculo" | "naoAtribuido">(null);

  // SDRs que têm cota contratada no período mas nenhuma atividade de agenda —
  // sem isto a linha some em silêncio e o Total não fecha com o card do topo.
  const emailsNaTabela = new Set(data.map((r) => r.sdrEmail.toLowerCase()));
  const extraSdrs = Array.from(cotasBySdr?.entries() || [])
    .filter(([email, qtd]) => qtd > 0 && !emailsNaTabela.has(email.toLowerCase()))
    .filter(([email]) => !sdrFilterEmail || email.toLowerCase() === sdrFilterEmail.toLowerCase())
    .sort((a, b) => b[1] - a[1]);
  const extraCotas = extraSdrs.reduce((s, [, qtd]) => s + qtd, 0);
  const extraClientes = extraSdrs.reduce((s, [email]) => s + (clientesBySdr?.get(email) || 0), 0);
  const extraCredito = extraSdrs.reduce((s, [email]) => s + (creditoBySdr?.get(email) || 0), 0);

  const brl = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

  // Total derivado do MESMO array renderizado (respeita filtro de SDR aplicado).
  const baseTotals = data.reduce(
    (acc, row) => {
      const email = row.sdrEmail.toLowerCase();
      return {
        agendamentos: acc.agendamentos + (row.agendamentos || 0),
        r1Agendada: acc.r1Agendada + (row.r1Agendada || 0),
        r1Realizada: acc.r1Realizada + (row.r1Realizada || 0),
        noShows: acc.noShows + (row.noShows || 0),
        propostas: acc.propostas + (propostasEnviadasBySdr?.get(email) || 0),
        cotas: acc.cotas + (cotasBySdr?.get(email) || 0),
        clientes: acc.clientes + (clientesBySdr?.get(email) || 0),
        credito: acc.credito + (creditoBySdr?.get(email) || 0),
      };
    },
    { agendamentos: 0, r1Agendada: 0, r1Realizada: 0, noShows: 0, propostas: 0, cotas: 0, clientes: 0, credito: 0 }
  );
  // O Total inclui a linha "Não atribuído" para fechar com o card do topo.
  const totals = {
    ...baseTotals,
    agendamentos: baseTotals.agendamentos + (unassigned?.agendamentos || 0),
    r1Agendada: baseTotals.r1Agendada + (unassigned?.r1Agendada || 0),
    r1Realizada: baseTotals.r1Realizada + (unassigned?.r1Realizada || 0),
    noShows: baseTotals.noShows + (unassigned?.noShows || 0),
    cotas: baseTotals.cotas + cotasSemVinculo + extraCotas,
    // Contagem de PESSOAS não é somável: o Total usa o distinct global do
    // conjunto filtrado, calculado uma única vez pelo hook. Somar as linhas
    // contaria duas vezes o cliente presente em mais de uma atribuição.
    clientes: totalClientesDistintos,
    credito: baseTotals.credito + creditoSemVinculo + extraCredito,
  };
  const unassignedTooltip = unassigned
    ? `Linhas devolvidas pelas métricas da agenda cujo agendador não está na lista de SDRs/Closers do Consórcio${unassigned.emails.length ? `: ${unassigned.emails.join(', ')}` : ''}.\nCobre apenas o que é visível nesta camada — reuniões que a consulta de origem nunca devolveu não aparecem aqui.`
    : '';
  // Taxa agregada por PESSOA (Σ clientes distintos ÷ Σ R1 realizadas).
  const totalTaxaVenda = totals.r1Realizada > 0
    ? (totals.clientes / totals.r1Realizada) * 100
    : 0;
  const totalTicket = totals.clientes > 0 ? totals.credito / totals.clientes : null;
  const totalTaxaVendaColor = totalTaxaVenda >= 20
    ? 'text-green-400'
    : totalTaxaVenda >= 10
      ? 'text-amber-400'
      : 'text-red-400';
  const totalNoShowPct = totals.r1Agendada > 0
    ? (totals.noShows / totals.r1Agendada) * 100
    : 0;

  const handleRowClick = (sdrEmail: string) => {
    if (onSdrClick) {
      onSdrClick(sdrEmail);
      return;
    }
    const params = new URLSearchParams(searchParams);
    navigate(`/crm/reunioes-equipe/${encodeURIComponent(sdrEmail)}?${params.toString()}`);
  };

  /** Linha clicável? Com `onSdrClick`, quem decide é `canOpenSdr`. */
  const podeAbrir = (sdrEmail: string) => {
    if (onSdrClick) return canOpenSdr ? canOpenSdr(sdrEmail) : true;
    return !disableNavigation;
  };
  /** A coluna do chevron existe se qualquer linha puder ser aberta. */
  const mostrarColunaChevron = onSdrClick ? data.some((r) => podeAbrir(r.sdrEmail)) : !disableNavigation;

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
              <TableHead className="text-muted-foreground text-center font-medium">{CONSORCIO_LABELS.reunioesAgendadas}</TableHead>
              <TableHead className="text-muted-foreground text-center font-medium">{CONSORCIO_LABELS.reunioesRealizadas}</TableHead>
              <TableHead className="text-muted-foreground text-center font-medium">No-show</TableHead>
              <TableHead
                className="text-muted-foreground text-center font-medium whitespace-nowrap"
                title="CLIENTES distintos que contrataram ao menos uma cota no período (identidade pelo CPF/CNPJ do titular, fallback no nome). Diferente de 'Cotas Contratadas': um cliente com 3 cotas conta 1 aqui e 3 ali. A atribuição é por cliente — cada cliente aparece em uma única linha, então as linhas somam o Total."
              >
                Vendas Realizadas
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
              {mostrarColunaChevron && <TableHead className="text-muted-foreground w-10"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => {
              const metaDiaria = sdrMetaMap?.get(row.sdrEmail.toLowerCase()) || 10;
              const diasEfetivos = sdrDiasUteisMap?.get(row.sdrEmail.toLowerCase()) || diasUteisNoPeriodo || 1;
              const metaPeriodo = metaDiaria * diasEfetivos;
              const bateuMeta = row.agendamentos >= metaPeriodo;
              const isProporcional = sdrDiasUteisMap?.has(row.sdrEmail.toLowerCase()) && diasEfetivos < (diasUteisNoPeriodo || 1);

              const cotas = cotasBySdr?.get(row.sdrEmail.toLowerCase()) || 0;
              const clientes = clientesBySdr?.get(row.sdrEmail.toLowerCase()) || 0;
              const credito = creditoBySdr?.get(row.sdrEmail.toLowerCase()) || 0;
              const ticket = clientes > 0 ? credito / clientes : null;

              // Clientes distintos / R1 Realizada
              const taxaVenda = row.r1Realizada > 0
                ? (clientes / row.r1Realizada) * 100
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
                  className={podeAbrir(row.sdrEmail) ? "cursor-pointer transition-colors hover:bg-muted/30" : "transition-colors"}
                  onClick={podeAbrir(row.sdrEmail) ? () => handleRowClick(row.sdrEmail) : undefined}
                >
                  <TableCell className="font-medium">
                    <div className="flex flex-col">
                      <span className="text-foreground">{row.sdrName}</span>
                      <span className="text-xs text-muted-foreground">{row.sdrEmail.split('@')[0]}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex flex-col items-center">
                      <span className={`font-medium ${bateuMeta ? 'text-green-400' : 'text-amber-400'}`}>
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
                        <span className={`text-xs ${noShowColor}`}>
                          ({noShowPct.toFixed(1)}%)
                        </span>
                      )}
                    </div>
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
                    <span className={`font-medium ${taxaVendaColor}`}>{taxaVenda.toFixed(1)}%</span>
                  </TableCell>
                  {mostrarColunaChevron && (
                    <TableCell>
                      {podeAbrir(row.sdrEmail) && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}

            {/* SDR com cota contratada no período, mas sem atividade de agenda */}
            {extraSdrs.map(([email, qtd]) => (
              <TableRow
                key={`extra-${email}`}
                className="hover:bg-muted/20"
                title="SDR com cota contratada no período, mas sem reunião agendada/realizada dentro da janela — a cota é dele, a atividade caiu em outro período."
              >
                <TableCell className="font-medium">
                  {sdrNames?.get(email.toLowerCase()) || email}
                  <span className="ml-2 text-xs text-muted-foreground italic">sem atividade no período</span>
                </TableCell>
                <TableCell className="text-center">—</TableCell>
                <TableCell className="text-center">0</TableCell>
                <TableCell className="text-center">0</TableCell>
                <TableCell className="text-center">0</TableCell>
                <TableCell className="text-center">0</TableCell>
                <TableCell className="text-center">{clientesBySdr?.get(email.toLowerCase()) || 0}</TableCell>
                <TableCell className="text-center">{qtd}</TableCell>
                <TableCell className="text-center whitespace-nowrap">
                  {(creditoBySdr?.get(email.toLowerCase()) || 0) > 0
                    ? brl(creditoBySdr!.get(email.toLowerCase())!)
                    : "—"}
                </TableCell>
                <TableCell className="text-center whitespace-nowrap">
                  {(clientesBySdr?.get(email.toLowerCase()) || 0) > 0
                    ? brl((creditoBySdr?.get(email.toLowerCase()) || 0) / (clientesBySdr!.get(email.toLowerCase())!))
                    : "—"}
                </TableCell>
                <TableCell className="text-center">—</TableCell>
                {mostrarColunaChevron && <TableCell />}
              </TableRow>
            ))}

            {/* Não atribuído: só o que a fonte devolveu e esta tela não soube atribuir */}
            {cotasSemVinculo > 0 && (
              <TableRow
                className="italic text-muted-foreground cursor-pointer hover:bg-muted/30"
                title="Clique para ver quais cotas estão aqui e o que falta preencher em cada uma."
                onClick={() => setDetalhe("semVinculo")}
              >
                <TableCell className="font-normal underline decoration-dotted">
                  <span className="inline-flex items-center gap-1">
                    Sem agendamento de consórcio
                    <Search className="h-3 w-3" />
                  </span>
                </TableCell>
                <TableCell className="text-center">—</TableCell>
                <TableCell className="text-center">—</TableCell>
                <TableCell className="text-center">—</TableCell>
                <TableCell className="text-center">—</TableCell>
                <TableCell className="text-center">—</TableCell>
                <TableCell className="text-center">{clientesSemVinculo}</TableCell>
                <TableCell className="text-center">{cotasSemVinculo}</TableCell>
                <TableCell className="text-center whitespace-nowrap">
                  {creditoSemVinculo > 0 ? brl(creditoSemVinculo) : "—"}
                </TableCell>
                <TableCell className="text-center whitespace-nowrap">
                  {clientesSemVinculo > 0 ? brl(creditoSemVinculo / clientesSemVinculo) : "—"}
                </TableCell>
                <TableCell className="text-center">—</TableCell>
                {mostrarColunaChevron && <TableCell />}
              </TableRow>
            )}

            {unassigned && (
              <TableRow
                className="italic text-muted-foreground cursor-pointer hover:bg-muted/30"
                title={`${unassignedTooltip}\nClique para ver as reuniões que estão aqui.`}
                onClick={() => setDetalhe("naoAtribuido")}
              >
                <TableCell className="font-normal underline decoration-dotted">
                  <span className="inline-flex items-center gap-1">
                    Não atribuído
                    <Search className="h-3 w-3" />
                  </span>
                </TableCell>
                <TableCell className="text-center">—</TableCell>
                <TableCell className="text-center">{unassigned.agendamentos}</TableCell>
                <TableCell className="text-center">{unassigned.r1Agendada}</TableCell>
                <TableCell className="text-center">{unassigned.r1Realizada}</TableCell>
                <TableCell className="text-center">{unassigned.noShows}</TableCell>
                <TableCell className="text-center">—</TableCell>
                <TableCell className="text-center">—</TableCell>
                <TableCell className="text-center">—</TableCell>
                <TableCell className="text-center">—</TableCell>
                <TableCell className="text-center">—</TableCell>
                {mostrarColunaChevron && <TableCell />}
              </TableRow>
            )}

            {/* Linha de Total — soma das linhas exibidas acima */}
            <TableRow className="bg-muted/30 font-semibold border-t-2 border-border hover:bg-muted/30">
              <TableCell className="text-foreground">Total</TableCell>
              <TableCell />
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
                    <span className="text-xs text-muted-foreground">({totalNoShowPct.toFixed(1)}%)</span>
                  )}
                </div>
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
                <span className={`font-medium ${totalTaxaVendaColor}`}>{totalTaxaVenda.toFixed(1)}%</span>
              </TableCell>
              {mostrarColunaChevron && <TableCell />}
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <p className="px-4 py-2 text-xs text-muted-foreground">
        Vendas Realizadas conta pessoas, não cartas: um cliente com 3 cotas soma 1 aqui e 3 em
        Cotas Contratadas. A atribuição é por cliente (todas as cotas dele vão para o SDR do
        última reunião de consórcio agendada), então as linhas somam o Total nas três colunas.
      </p>

      <ResiduoDetalheModal
        open={detalhe === "semVinculo"}
        onOpenChange={(o) => setDetalhe(o ? "semVinculo" : null)}
        kind="cota"
        titulo="Sem agendamento de consórcio"
        descricao="Cotas de clientes que não têm NENHUM agendamento de consórcio em nenhuma das suas cotas — por isso não há SDR a quem creditar a venda. Qualidade de cadastro (cota sem lead vinculado) é o alerta separado acima da tabela."
        items={cotasSemVinculoItems}
        esperado={cotasSemVinculo}
        permitirCorrigirVinculo
      />
      <ResiduoDetalheModal
        open={detalhe === "naoAtribuido"}
        onOpenChange={(o) => setDetalhe(o ? "naoAtribuido" : null)}
        kind="agenda"
        titulo="Não atribuído (agenda)"
        descricao="Fatos de agenda do Consórcio no período que não têm agendador identificado, por isso não entram em nenhuma linha de SDR."
        items={unassignedItems}
        esperado={
          (unassigned?.agendamentos || 0) + (unassigned?.r1Agendada || 0) +
          (unassigned?.r1Realizada || 0) + (unassigned?.noShows || 0) + (unassigned?.contratos || 0)
        }
      />
    </div>
  );
}
