import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { MeetingV2 } from "@/hooks/useSdrMetricsV2";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";
import { SdrMeetingActionsDrawer } from "@/components/sdr/SdrMeetingActionsDrawer";

export type KpiBucket =
  | "agendamentos"
  | "r1_agendada"
  | "realizada"
  | "no_show"
  | "sem_status"
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
}

const BUCKET_LABELS: Record<KpiBucket, string> = {
  agendamentos: "Agendamentos (criados no período)",
  r1_agendada: "R1 Agendada (marcadas para o período)",
  realizada: "R1 Realizada",
  no_show: "No-Shows",
  sem_status: "Sem Status (invited / rescheduled / sem_sucesso)",
  contratos: "Contratos pagos",
};

function inRange(iso: string | null | undefined, start: Date | null, end: Date | null): boolean {
  if (!iso || !start || !end) return false;
  const t = new Date(iso).getTime();
  return t >= start.getTime() && t <= end.getTime();
}

function isRealizadaStatus(s?: string | null): boolean {
  const v = (s || "").toLowerCase();
  return v === "completed" || v === "realizada" || v === "show" || v === "attended";
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
function isContratoStage(s?: string | null): boolean {
  const v = (s || "").toLowerCase();
  return v.includes("contrato pago") || v.includes("proposta fechada");
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
      case "contratos":
        return isContratoStage(m.status_atual);
      default:
        return false;
    }
  });
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
}: KpiDrillDownDialogProps) {
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingV2 | null>(null);
  const filtered = (() => {
    if (!bucket) return [] as MeetingV2[];
    // Para o bucket no_show usamos as reuniões SEM dedup global por deal_id
    // e aplicamos o mesmo cap do KPI. Os demais buckets seguem a regra antiga.
    if (bucket === "no_show") {
      const source = meetingsRaw && meetingsRaw.length > 0 ? meetingsRaw : meetings;
      const noShowsInRange = filterByBucket(source, "no_show", startDate, endDate);
      return applyNoShowCap(noShowsInRange);
    }
    return filterByBucket(meetings, bucket, startDate, endDate);
  })();

  return (
    <>
    <Dialog open={open && !selectedMeeting} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-3 border-b border-border shrink-0">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {bucket ? BUCKET_LABELS[bucket] : ""} — {filtered.length} lead(s)
            {" "}· clique numa linha para alterar status
          </DialogDescription>
        </DialogHeader>

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
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Nenhum lead encontrado neste bucket.
                  </TableCell>
                </TableRow>
              ) : (
                filtered
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
