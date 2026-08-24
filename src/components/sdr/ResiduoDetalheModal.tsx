import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Download, ExternalLink, FileWarning, Link2, ShieldCheck, UserCog } from "lucide-react";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/formatters";
import type { CotaResiduoItem } from "@/hooks/useConsorcioCotasContratadas";
import { formatMeetingStatus } from "@/utils/formatMeetingStatus";
import { useState } from "react";
import { CorrigirVinculoCotaModal } from "@/components/consorcio/CorrigirVinculoCotaModal";
import { InformarAgendadorModal } from "@/components/consorcio/InformarAgendadorModal";
import { ReconhecerForaFunilModal } from "@/components/consorcio/ReconhecerForaFunilModal";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useProfileName } from "@/hooks/useCorrigirVinculoCota";
import { CheckCircle2, Info } from "lucide-react";

export interface AgendaResiduoItem {
  dealId: string | null;
  meetingDay: string;
  closerName: string | null;
  attendeeStatus: string | null;
  motivo: string;
}

type Props =
  | {
      open: boolean;
      onOpenChange: (open: boolean) => void;
      kind: "cota";
      titulo: string;
      descricao: string;
      items: CotaResiduoItem[];
      esperado: number;
      /** Habilita a coluna de correção do vínculo cota → lead. */
      permitirCorrigirVinculo?: boolean;
      /** Habilita reconhecer a venda como fora do funil de R1 de Consórcio. */
      permitirForaFunil?: boolean;
      /** Habilita a ação de abrir a cota para corrigir o vendedor. */
      permitirCorrigirVendedor?: boolean;

    }
  | {
      open: boolean;
      onOpenChange: (open: boolean) => void;
      kind: "agenda";
      titulo: string;
      descricao: string;
      items: AgendaResiduoItem[];
      esperado: number;
    };

function fmtDate(value?: string | null): string {
  if (!value) return "—";
  try {
    const d = value.length <= 10 ? new Date(`${value}T12:00:00`) : new Date(value);
    return format(d, "dd/MM/yyyy");
  } catch {
    return value;
  }
}

function baixarCsv(header: string[], rows: (string | number)[][], filename: string) {
  const escape = (c: string | number) => {
    const s = String(c ?? "");
    // Proteção contra injeção de fórmula em planilha.
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const csv = [header, ...rows].map(r => r.map(escape).join(",")).join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Selo de autoria da última correção manual do vínculo. */
function SeloAutoria({ ajuste }: { ajuste: NonNullable<CotaResiduoItem["ajuste"]> }) {
  const { data: nome } = useProfileName(ajuste.porId);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="secondary" className="text-[10px] gap-1">
          <ShieldCheck className="h-3 w-3" />
          ajustado
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="text-xs">
        Vínculo ajustado por {nome || "usuário"}
        {ajuste.em ? ` em ${fmtDate(ajuste.em)}` : ""}
        {ajuste.dealAnterior ? " (havia outro lead antes)" : ""}
      </TooltipContent>
    </Tooltip>
  );
}

export function ResiduoDetalheModal(props: Props) {
  const { open, onOpenChange, kind, titulo, descricao, items, esperado } = props;
  const permitirCorrigirVinculo = kind === "cota" && props.permitirCorrigirVinculo === true;
  const permitirCorrigirVendedor = kind === "cota" && props.permitirCorrigirVendedor === true;
  const permitirForaFunil = kind === "cota" && props.permitirForaFunil === true;
  const temAcaoCota = permitirCorrigirVinculo || permitirCorrigirVendedor;
  const [corrigindo, setCorrigindo] = useState<CotaResiduoItem | null>(null);
  const [informandoAgendador, setInformandoAgendador] = useState<CotaResiduoItem | null>(null);
  const [reconhecendo, setReconhecendo] = useState<CotaResiduoItem | null>(null);

  /** Cota corrigida nesta sessão do modal — base do feedback honesto pós-gravação. */
  const [ultimaCorrecao, setUltimaCorrecao] = useState<
    { cardId: string; acao: "vinculo" | "agendador" } | null
  >(null);

  const itemDaCorrecao =
    ultimaCorrecao && kind === "cota"
      ? (items as CotaResiduoItem[]).find((i) => i.cardId === ultimaCorrecao.cardId) || null
      : null;
  const resolvido = !!ultimaCorrecao && !itemDaCorrecao;

  // Só rótulo: o número já vem da mesma fonte que produziu a linha clicada.
  const dealIds = useMemo(
    () => kind === "agenda"
      ? [...new Set((items as AgendaResiduoItem[]).map(i => i.dealId).filter(Boolean) as string[])]
      : [],
    [kind, items],
  );
  const { data: leadNames } = useQuery({
    queryKey: ["residuo-lead-names", dealIds.sort().join("|")],
    queryFn: async () => {
      const map = new Map<string, string>();
      if (dealIds.length === 0) return map;
      const { data, error } = await supabase.from("crm_deals").select("id, name").in("id", dealIds);
      if (error) throw error;
      (data || []).forEach((d: any) => map.set(String(d.id), d.name || "—"));
      return map;
    },
    enabled: open && kind === "agenda" && dealIds.length > 0,
    staleTime: 60000,
  });

  const divergente = items.length !== esperado;

  const exportar = () => {
    const stamp = format(new Date(), "yyyyMMdd-HHmm");
    if (kind === "cota") {
      baixarCsv(
        ["Cliente", "Grupo/Cota", "Data de contratação", "Valor do crédito", "Vendedor", "Motivo"],
        (items as CotaResiduoItem[]).map(i => [
          i.cliente,
          [i.grupo, i.cota].filter(Boolean).join("/") || "—",
          fmtDate(i.dataContratacao),
          i.valorCredito != null ? i.valorCredito : "",
          i.vendedorName || "",
          i.motivo,
        ]),
        `residuo-cotas-${stamp}.csv`,
      );
    } else {
      baixarCsv(
        ["Lead", "Data da reunião", "Closer", "Status do attendee", "Motivo"],
        (items as AgendaResiduoItem[]).map(i => [
          (i.dealId && leadNames?.get(i.dealId)) || "—",
          fmtDate(i.meetingDay),
          i.closerName || "—",
          formatMeetingStatus(i.attendeeStatus),
          i.motivo,
        ]),
        `residuo-agenda-${stamp}.csv`,
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            {titulo}
            <Badge variant="outline">{items.length} registro{items.length === 1 ? "" : "s"}</Badge>
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed">{descricao}</DialogDescription>
        </DialogHeader>

        {divergente && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-500">
            Atenção: o detalhamento trouxe {items.length} registros e a linha mostra {esperado}. Reporte esta divergência.
          </div>
        )}

        {ultimaCorrecao && (
          resolvido ? (
            <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-2 text-xs text-emerald-600 dark:text-emerald-400 flex items-start gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              {ultimaCorrecao.acao === "agendador"
                ? "Agendador informado. A venda passou a ser creditada e esta cota saiu da lista."
                : "Vínculo salvo. Esta cota saiu da lista."}
            </div>
          ) : (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-600 dark:text-amber-400 flex items-start gap-2">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>
                {ultimaCorrecao.acao === "agendador"
                  ? "Agendador salvo, mas o caso continua na lista: "
                  : "Vínculo salvo, mas o caso continua na lista: "}
                {itemDaCorrecao?.motivo || "reavaliando o cliente."}
              </span>
            </div>
          )
        )}

        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={exportar}>
            <Download className="h-4 w-4 mr-1" />
            Exportar CSV
          </Button>
        </div>

        <div className="overflow-auto border rounded-md flex-1">
          {items.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Nenhum registro por trás deste número.
            </div>
          ) : (
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  {kind === "cota" ? (
                    <>
                      <TableHead className="whitespace-nowrap">Cliente</TableHead>
                      <TableHead className="whitespace-nowrap">Grupo/Cota</TableHead>
                      <TableHead className="whitespace-nowrap">Data de contratação</TableHead>
                      <TableHead className="text-right whitespace-nowrap">Valor do crédito</TableHead>
                      <TableHead className="whitespace-nowrap">Vendedor</TableHead>
                      <TableHead className="min-w-[280px]">Motivo</TableHead>
                      {temAcaoCota && <TableHead className="text-right whitespace-nowrap">Ação</TableHead>}
                    </>
                  ) : (
                    <>
                      <TableHead>Lead</TableHead>
                      <TableHead>Data da reunião</TableHead>
                      <TableHead>Closer</TableHead>
                      <TableHead>Status do attendee</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead className="text-right">Ação</TableHead>
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {kind === "cota"
                  ? (items as CotaResiduoItem[]).map((i, idx) => (
                      <TableRow key={`${i.cardId}-${idx}`}>
                        <TableCell className="text-sm whitespace-nowrap">
                          <a
                            href={`/consorcio/crm/venda-consorcio?tab=cotas&qCo=${encodeURIComponent(i.cliente)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 hover:underline"
                            title="Abrir a cota no Controle Consórcio"
                          >
                            {i.cliente}
                            <ExternalLink className="h-3 w-3 text-muted-foreground" />
                          </a>
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          {[i.grupo, i.cota].filter(Boolean).join("/") || "—"}
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{fmtDate(i.dataContratacao)}</TableCell>
                        <TableCell className="text-right tabular-nums text-xs whitespace-nowrap">
                          {i.valorCredito != null ? formatCurrency(i.valorCredito) : "—"}
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{i.vendedorName || <span className="italic text-muted-foreground">vazio</span>}</TableCell>
                        <TableCell className="text-xs min-w-[280px] align-top">
                          <span className="inline-flex items-center gap-2">
                            {i.motivo}
                            {i.atribuidoA && (
                              <Badge variant="outline" className="text-[10px]">
                                {i.problema === "sem_reuniao_bu"
                                  ? `Crédito já está com ${i.atribuidoA} — falta esta cota apontar para o lead que teve a R1.`
                                  : `Crédito já está com ${i.atribuidoA} por outra cota deste cliente — falta o vínculo desta cota.`}
                              </Badge>
                            )}

                            {i.ajuste && <SeloAutoria ajuste={i.ajuste} />}
                          </span>
                        </TableCell>
                        {temAcaoCota && (
                          <TableCell className="text-right whitespace-nowrap align-top">
                            {permitirCorrigirVinculo ? (
                              permitirForaFunil && i.semSaidaPorVinculo ? (
                                // Nenhum lead deste cliente tem R1 de Consórcio:
                                // trocar o lead não credita ninguém. O desfecho
                                // honesto é reconhecer a venda como fora do funil,
                                // e a troca de lead vira ação secundária.
                                <div className="flex flex-col items-end gap-1">
                                  <Button size="sm" onClick={() => setReconhecendo(i)}>
                                    <FileWarning className="h-3.5 w-3.5 mr-1" />
                                    Reconhecer fora do funil
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 text-[11px] text-muted-foreground"
                                    onClick={() =>
                                      i.problema === "sem_agendador"
                                        ? setInformandoAgendador(i)
                                        : setCorrigindo(i)
                                    }
                                  >
                                    {i.problema === "sem_agendador"
                                      ? "Informar agendador"
                                      : "Trocar lead"}
                                  </Button>
                                </div>
                              ) : // Regra: botão que não resolve o caso não aparece.
                              i.problema === "sem_agendador" ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setInformandoAgendador(i)}
                                >
                                  <UserCog className="h-3.5 w-3.5 mr-1" />
                                  Informar agendador
                                </Button>
                              ) : i.problema === "sem_reuniao_bu" ? (
                                // O lead existe, só não é o que teve a reunião:
                                // a correção é trocar de lead, não criar vínculo.
                                <Button size="sm" variant="outline" onClick={() => setCorrigindo(i)}>
                                  <Link2 className="h-3.5 w-3.5 mr-1" />
                                  Trocar lead
                                </Button>
                              ) : i.problema === undefined ||
                                i.problema === "sem_cadastro" ||
                                i.problema === "sem_lead" ||
                                i.problema === "deal_inexistente" ? (
                                <Button size="sm" variant="outline" onClick={() => setCorrigindo(i)}>
                                  <Link2 className="h-3.5 w-3.5 mr-1" />
                                  Vincular lead
                                </Button>
                              ) : permitirForaFunil ? (
                                <Button size="sm" variant="outline" onClick={() => setReconhecendo(i)}>
                                  <FileWarning className="h-3.5 w-3.5 mr-1" />
                                  Reconhecer fora do funil
                                </Button>
                              ) : (
                                <span className="text-[11px] text-muted-foreground italic">
                                  sem correção por vínculo
                                </span>
                              )


                            ) : (
                              <Button size="sm" variant="outline" asChild>
                                <a
                                  href={`/consorcio/crm/venda-consorcio?tab=cotas&editCard=${i.cardId}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="Abrir a cota para informar o vendedor"
                                >
                                  <UserCog className="h-3.5 w-3.5 mr-1" />
                                  Corrigir vendedor
                                </a>
                              </Button>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  : (items as AgendaResiduoItem[]).map((i, idx) => (
                      <TableRow key={`${i.dealId || "sem-deal"}-${i.meetingDay}-${idx}`}>
                        <TableCell className="text-sm">
                          {i.dealId ? (
                            <a
                              href={`/consorcio/crm/negocios?deal=${i.dealId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 hover:underline"
                              title="Abrir o lead no CRM"
                            >
                              {leadNames?.get(i.dealId) || "Abrir lead"}
                              <ExternalLink className="h-3 w-3 text-muted-foreground" />
                            </a>
                          ) : (
                            <span className="italic text-muted-foreground">sem negócio vinculado</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{fmtDate(i.meetingDay)}</TableCell>
                        <TableCell className="text-xs">{i.closerName || "—"}</TableCell>
                        <TableCell className="text-xs">{formatMeetingStatus(i.attendeeStatus)}</TableCell>
                        <TableCell className="text-xs">{i.motivo}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" asChild>
                            <a
                              href={`/consorcio/crm/agenda?date=${i.meetingDay}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Abrir a reunião na Agenda R1 para informar quem agendou"
                            >
                              <UserCog className="h-3.5 w-3.5 mr-1" />
                              Corrigir agendador
                            </a>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
              </TableBody>
            </Table>
          )}
        </div>

        <div className="text-xs text-muted-foreground border-t pt-2">
          Total: <span className="font-semibold text-foreground">{items.length}</span> · deve bater com o número da linha ({esperado})
        </div>

        {permitirCorrigirVinculo && (
          <>
            <CorrigirVinculoCotaModal
              item={corrigindo}
              open={!!corrigindo}
              onOpenChange={(o) => !o && setCorrigindo(null)}
              onCorrigido={() =>
                corrigindo && setUltimaCorrecao({ cardId: corrigindo.cardId, acao: "vinculo" })
              }
            />
            <InformarAgendadorModal
              item={informandoAgendador}
              open={!!informandoAgendador}
              onOpenChange={(o) => !o && setInformandoAgendador(null)}
              onCorrigido={() =>
                informandoAgendador &&
                setUltimaCorrecao({ cardId: informandoAgendador.cardId, acao: "agendador" })
              }
            />
          </>
        )}

        {permitirForaFunil && (
          <ReconhecerForaFunilModal
            item={reconhecendo}
            open={!!reconhecendo}
            onOpenChange={(o) => !o && setReconhecendo(null)}
          />
        )}

      </DialogContent>
    </Dialog>
  );
}
