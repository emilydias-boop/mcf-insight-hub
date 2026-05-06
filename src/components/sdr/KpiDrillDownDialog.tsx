import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { MeetingV2 } from "@/hooks/useSdrMetricsV2";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";
import { SdrMeetingActionsDrawer } from "@/components/sdr/SdrMeetingActionsDrawer";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { startOfDay } from "date-fns";
import { getPendentesMeetings } from "@/lib/pendentesBreakdown";
import type { PendenteDrillRow } from "@/hooks/usePendentesDrilldown";

export type KpiBucket =
  | "agendamentos"
  | "r1_agendada"
  | "realizada"
  | "no_show"
  | "sem_status"
  | "pendentes"
  | "contratos";

interface KpiDrillDownDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bucket: KpiBucket | null;
  title: string;
  meetings: MeetingV2[];
  /**
   * Reuniões SEM dedup global por deal_id. Quando informado, é usado para
   * o bucket "no_show" espelhar a regra do KPI (cap 1 antes de 2026-04-28,
   * cap 2 depois, por SDR+deal+dia em America/Sao_Paulo).
   */
  meetingsRaw?: MeetingV2[];
  startDate: Date | null;
  endDate: Date | null;
  /** Quando informado e o bucket for "pendentes", substitui o cálculo local
   *  pelos dados do RPC `get_sdr_pendentes_drilldown`. */
  pendentesOverride?: PendenteDrillRow[];
}

const BUCKET_LABELS: Record<KpiBucket, string> = {
  agendamentos: "Agendamentos (criados no período)",
  r1_agendada: "R1 Agendada (marcadas para o período)",
  realizada: "R1 Realizada",
  no_show: "No-Shows",
  sem_status: "Sem Status (invited / rescheduled / sem_sucesso)",
  pendentes: "Pendentes / Sem Desfecho — reuniões que não viraram Realizada nem No-Show",
  contratos: "Contratos pagos no período (por data de pagamento)",
};

function inRange(iso: string | null | undefined, start: Date | null, end: Date | null): boolean {
  if (!iso || !start || !end) return false;
  const t = new Date(iso).getTime();
  return t >= start.getTime() && t <= end.getTime();
}

function isRealizadaStatus(s?: string | null): boolean {
  const v = (s || "").toLowerCase();
  // contract_paid e refunded implicam que a R1 aconteceu (lead pagou ou foi reembolsado depois).
  // Alinhado com get_sdr_metrics_from_agenda, que conta esses como Realizada.
  return (
    v === "completed" ||
    v === "realizada" ||
    v === "show" ||
    v === "attended" ||
    v === "contract_paid" ||
    v === "refunded"
  );
}
function isNoShowStatus(s?: string | null): boolean {
  const v = (s || "").toLowerCase();
  return v === "no_show" || v === "noshow" || v === "no-show";
}

/**
 * Devolve o "dia" do agendamento em America/Sao_Paulo no formato YYYY-MM-DD.
 * Espelha (ms.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date do KPI SQL.
 */
function spDayKey(iso?: string | null): string | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    // pt-BR em SP devolve dd/mm/yyyy
    const parts = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(d);
    const day = parts.find((p) => p.type === "day")?.value;
    const month = parts.find((p) => p.type === "month")?.value;
    const year = parts.find((p) => p.type === "year")?.value;
    if (!day || !month || !year) return null;
    return `${year}-${month}-${day}`;
  } catch {
    return null;
  }
}

const NO_SHOW_CAP_BOUNDARY = "2026-04-28"; // YYYY-MM-DD em America/Sao_Paulo

/**
 * Aplica a regra do KPI (cap 1 antes de 2026-04-28, cap 2 depois) por
 * (sdr_email, deal_id), contando dias distintos em São Paulo.
 */
function applyNoShowCap(meetings: MeetingV2[]): MeetingV2[] {
  // Agrupa por (sdr, deal) -> mapa de dia -> primeira reunião daquele dia
  type Group = Map<string, MeetingV2>;
  const groups = new Map<string, Group>();

  meetings.forEach((m) => {
    const day = spDayKey(m.scheduled_at || m.data_agendamento);
    if (!day) return;
    const sdr = (m.intermediador || m.current_owner || "").toLowerCase();
    const dealKey = m.deal_id || `noid-${m.attendee_id || ""}`;
    const key = `${sdr}::${dealKey}`;
    let g = groups.get(key);
    if (!g) {
      g = new Map();
      groups.set(key, g);
    }
    if (!g.has(day)) g.set(day, m);
  });

  const out: MeetingV2[] = [];
  groups.forEach((dayMap) => {
    const before: MeetingV2[] = [];
    const after: MeetingV2[] = [];
    Array.from(dayMap.entries())
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .forEach(([day, m]) => {
        if (day < NO_SHOW_CAP_BOUNDARY) before.push(m);
        else after.push(m);
      });
    if (before.length > 0) out.push(before[0]); // cap 1
    after.slice(0, 2).forEach((m) => out.push(m)); // cap 2
  });

  return out;
}

function isSemStatusStatus(s?: string | null): boolean {
  const v = (s || "").toLowerCase();
  return v === "invited" || v === "rescheduled" || v === "sem_sucesso" || v === "" || v === "pending";
}
function isCancelledStatus(s?: string | null): boolean {
  const v = (s || "").toLowerCase();
  return v === "cancelled" || v === "canceled" || v === "cancelada";
}
/**
 * "Remanejados/Restituídos": leads que JÁ TIVERAM um status anterior
 * (foram remarcados, cancelados ou marcados sem sucesso) e por isso
 * não viraram Realizada/No-Show. Esses são os que precisam ser ajustados.
 */
function isRemanejadoStatus(s?: string | null): boolean {
  const v = (s || "").toLowerCase();
  return (
    v === "rescheduled" ||
    v === "cancelled" ||
    v === "canceled" ||
    v === "cancelada" ||
    v === "sem_sucesso"
  );
}
function isContratoStage(s?: string | null): boolean {
  const v = (s || "").toLowerCase();
  return v.includes("contrato pago") || v.includes("proposta fechada");
}

function isContratoPagoStatus(s?: string | null): boolean {
  const v = (s || "").toLowerCase();
  return v === "contract_paid" || v === "refunded";
}

function filterByBucket(
  meetings: MeetingV2[],
  bucket: KpiBucket,
  start: Date | null,
  end: Date | null,
): MeetingV2[] {
  return meetings.filter((m) => {
    switch (bucket) {
      case "agendamentos":
        // criadas no período (booked_at)
        return inRange(m.booked_at || null, start, end);
      case "r1_agendada":
        // marcadas para o período (scheduled_at)
        return inRange(m.scheduled_at || m.data_agendamento, start, end);
      case "realizada":
        return (
          inRange(m.scheduled_at || m.data_agendamento, start, end) &&
          isRealizadaStatus(m.attendee_status)
        );
      case "no_show":
        return (
          inRange(m.scheduled_at || m.data_agendamento, start, end) &&
          isNoShowStatus(m.attendee_status)
        );
      case "sem_status":
        return (
          inRange(m.scheduled_at || m.data_agendamento, start, end) &&
          isSemStatusStatus(m.attendee_status) &&
          !isRealizadaStatus(m.attendee_status) &&
          !isNoShowStatus(m.attendee_status)
        );
      case "pendentes":
        // Tudo que está marcado para o período mas não virou Realizada nem No-Show
        return (
          inRange(m.scheduled_at || m.data_agendamento, start, end) &&
          !isRealizadaStatus(m.attendee_status) &&
          !isNoShowStatus(m.attendee_status)
        );
      case "contratos":
        // Alinhado ao KPI (get_sdr_metrics_from_agenda): conta attendees
        // cujo contract_paid_at está dentro do período. Fallback: se a
        // RPC não devolver contract_paid_at mas o status do attendee for
        // contract_paid/refunded e a reunião estiver no período, inclui.
        if (m.contract_paid_at) {
          return inRange(m.contract_paid_at, start, end);
        }
        if (isContratoPagoStatus(m.attendee_status)) {
          return inRange(m.scheduled_at || m.data_agendamento, start, end);
        }
        // Mantém compatibilidade com fontes legadas que só carregam status_atual
        return (
          isContratoStage(m.status_atual) &&
          inRange(m.scheduled_at || m.data_agendamento, start, end)
        );
      default:
        return false;
    }
  });
}

type PendenteSubBucket = "futuras" | "vencidas" | "canceladas";

function classifyPendente(m: MeetingV2): PendenteSubBucket {
  const iso = m.scheduled_at || m.data_agendamento;
  const todayStart = startOfDay(new Date()).getTime();
  const t = iso ? new Date(iso).getTime() : 0;
  if (isRemanejadoStatus(m.attendee_status)) return "canceladas";
  if (t >= todayStart) return "futuras";
  return "vencidas";
}

function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  try {
    return format(parseISO(iso), "dd/MM/yyyy HH:mm", { locale: ptBR });
  } catch {
    return iso;
  }
}

function statusBadge(s?: string | null) {
  const v = (s || "").toLowerCase();
  if (isRealizadaStatus(v)) return <Badge className="bg-green-500/15 text-green-500 border-green-500/30">Realizada</Badge>;
  if (isNoShowStatus(v)) return <Badge className="bg-red-500/15 text-red-500 border-red-500/30">No-Show</Badge>;
  if (v === "invited") return <Badge className="bg-yellow-500/15 text-yellow-500 border-yellow-500/30">Convidada</Badge>;
  if (v === "rescheduled") return <Badge className="bg-yellow-500/15 text-yellow-500 border-yellow-500/30">Remarcada</Badge>;
  if (v === "sem_sucesso") return <Badge className="bg-yellow-500/15 text-yellow-500 border-yellow-500/30">Sem Sucesso</Badge>;
  if (isCancelledStatus(v)) return <Badge className="bg-rose-500/15 text-rose-500 border-rose-500/30">Cancelada</Badge>;
  if (v === "contract_paid") return <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30">Contrato Pago</Badge>;
  if (v === "refunded") return <Badge className="bg-orange-500/15 text-orange-500 border-orange-500/30">Reembolsado</Badge>;
  return <Badge variant="outline">{s || "—"}</Badge>;
}

export function KpiDrillDownDialog({
  open,
  onOpenChange,
  bucket,
  title,
  meetings,
  meetingsRaw,
  startDate,
  endDate,
  pendentesOverride,
}: KpiDrillDownDialogProps) {
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingV2 | null>(null);
  const [pendenteTab, setPendenteTab] = useState<PendenteSubBucket | "todos">("todos");
  const [pendenteReasonTab, setPendenteReasonTab] = useState<"todos" | "sem_desfecho" | "no_show_acima_cap">("todos");
  const filtered = (() => {
    if (!bucket) return [] as MeetingV2[];
    // Para o bucket no_show usamos as reuniões SEM dedup global por deal_id
    // e aplicamos o mesmo cap do KPI. Os demais buckets seguem a regra antiga.
    if (bucket === "no_show") {
      const source = meetingsRaw && meetingsRaw.length > 0 ? meetingsRaw : meetings;
      const noShowsInRange = filterByBucket(source, "no_show", startDate, endDate);
      return applyNoShowCap(noShowsInRange);
    }
    if (bucket === "pendentes") {
      if (pendentesOverride && pendentesOverride.length > 0) return pendentesOverride;
      return getPendentesMeetings(meetingsRaw || meetings, startDate, endDate);
    }
    return filterByBucket(meetings, bucket, startDate, endDate);
  })();

  const pendenteCounts = (() => {
    if (bucket !== "pendentes" || pendentesOverride) return null;
    const c = { futuras: 0, vencidas: 0, canceladas: 0 };
    filtered.forEach((m) => {
      c[classifyPendente(m)]++;
    });
    return c;
  })();

  const reasonCounts = (() => {
    if (bucket !== "pendentes" || !pendentesOverride) return null;
    const c = { sem_desfecho: 0, no_show_acima_cap: 0 };
    filtered.forEach((m) => {
      const r = (m as PendenteDrillRow).pendente_reason;
      if (r === "sem_desfecho") c.sem_desfecho++;
      else if (r === "no_show_acima_cap") c.no_show_acima_cap++;
    });
    return c;
  })();

  const visibleRows = (() => {
    if (bucket !== "pendentes") return filtered;
    if (pendentesOverride) {
      if (pendenteReasonTab === "todos") return filtered;
      return filtered.filter((m) => (m as PendenteDrillRow).pendente_reason === pendenteReasonTab);
    }
    if (pendenteTab === "todos") return filtered;
    return filtered.filter((m) => classifyPendente(m) === pendenteTab);
  })();

  return (
    <>
    <Dialog open={open && !selectedMeeting} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-3 border-b border-border shrink-0">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {bucket ? BUCKET_LABELS[bucket] : ""} — {visibleRows.length} lead(s)
            {" "}· clique numa linha para alterar status
          </DialogDescription>
        </DialogHeader>

        {bucket === "pendentes" && pendenteCounts && (
          <div className="px-6 pt-3 shrink-0">
            <Tabs value={pendenteTab} onValueChange={(v) => setPendenteTab(v as PendenteSubBucket | "todos")}>
              <TabsList>
                <TabsTrigger value="todos">Todos ({filtered.length})</TabsTrigger>
                <TabsTrigger value="futuras">Futuras ({pendenteCounts.futuras})</TabsTrigger>
                <TabsTrigger value="vencidas">Vencidas s/ desfecho ({pendenteCounts.vencidas})</TabsTrigger>
                <TabsTrigger value="canceladas">Remanejados/Restituídos ({pendenteCounts.canceladas})</TabsTrigger>
              </TabsList>
              <TabsContent value={pendenteTab} className="mt-2">
                <p className="text-xs text-muted-foreground">
                  {pendenteTab === "futuras" && "Reuniões agendadas para datas futuras — ainda não aconteceram."}
                  {pendenteTab === "vencidas" && "Já passaram da hora e ninguém marcou Realizada/No-Show."}
                  {pendenteTab === "canceladas" && "Leads que já tiveram status anterior (remarcadas, canceladas, sem sucesso) e foram restituídos sem desfecho final. Clique numa linha para ajustar o status."}
                  {pendenteTab === "todos" && "Soma de futuras + vencidas + remanejados."}
                </p>
              </TabsContent>
            </Tabs>
          </div>
        )}

        {bucket === "pendentes" && reasonCounts && (
          <div className="px-6 pt-3 shrink-0">
            <Tabs value={pendenteReasonTab} onValueChange={(v) => setPendenteReasonTab(v as any)}>
              <TabsList>
                <TabsTrigger value="todos">Todos ({filtered.length})</TabsTrigger>
                <TabsTrigger value="sem_desfecho">Sem desfecho ({reasonCounts.sem_desfecho})</TabsTrigger>
                <TabsTrigger value="no_show_acima_cap">No-Show acima do cap ({reasonCounts.no_show_acima_cap})</TabsTrigger>
              </TabsList>
              <TabsContent value={pendenteReasonTab} className="mt-2">
                <p className="text-xs text-muted-foreground">
                  {pendenteReasonTab === "sem_desfecho" && "Reuniões marcadas para o período sem Realizada/No-Show registrado."}
                  {pendenteReasonTab === "no_show_acima_cap" && "Dias de No-Show do mesmo lead que ultrapassaram o cap (1 antes de 01/05/2026, 2 a partir disso). Contam para a aritmética R1 Agendada = Realizada + No-Show + Pendente."}
                  {pendenteReasonTab === "todos" && "Todos os leads contabilizados como Pendentes / Sem Desfecho."}
                </p>
              </TabsContent>
            </Tabs>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10">
              <TableRow>
                <TableHead>Lead</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>SDR</TableHead>
                <TableHead>Closer</TableHead>
                <TableHead>Agendada para</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Nenhum lead encontrado neste bucket.
                  </TableCell>
                </TableRow>
              ) : (
                visibleRows
                  .slice()
                  .sort((a, b) => {
                    const ad = new Date(a.scheduled_at || a.data_agendamento || 0).getTime();
                    const bd = new Date(b.scheduled_at || b.data_agendamento || 0).getTime();
                    return bd - ad;
                  })
                  .map((m) => (
                    <TableRow
                      key={`${m.deal_id}-${m.attendee_id || ""}`}
                      className="cursor-pointer hover:bg-muted/40"
                      onClick={() => setSelectedMeeting(m)}
                    >
                      <TableCell className="font-medium">{m.contact_name || m.deal_name || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{m.contact_phone || "—"}</TableCell>
                      <TableCell>{m.intermediador || m.current_owner || "—"}</TableCell>
                      <TableCell>{m.closer || "—"}</TableCell>
                      <TableCell>{formatDate(m.scheduled_at || m.data_agendamento)}</TableCell>
                      <TableCell>{statusBadge(m.attendee_status)}</TableCell>
                    </TableRow>
                  ))
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>

    <SdrMeetingActionsDrawer
      meeting={selectedMeeting}
      onClose={() => setSelectedMeeting(null)}
    />
    </>
  );
}
