import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Mic, CheckCircle2, XCircle, Clock, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

interface CallRow {
  id: string;
  user_id: string | null;
  deal_id: string | null;
  started_at: string | null;
  duration_seconds: number | null;
  outcome: string | null;
  transcript_sid: string | null;
  transcript_status: string | null;
  ai_processed_at: string | null;
  summary: string | null;
  ai_summary: any;
  profiles?: { id: string; full_name: string | null; email: string | null } | null;
}

export default function AuditoriaTranscricoesPage() {
  const today = format(new Date(), "yyyy-MM-dd");
  const sevenDaysAgo = format(new Date(Date.now() - 6 * 24 * 3600 * 1000), "yyyy-MM-dd");
  const [dateFrom, setDateFrom] = useState<string>(sevenDaysAgo);
  const [dateTo, setDateTo] = useState<string>(today);
  const [sdrFilter, setSdrFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: calls, isLoading } = useQuery({
    queryKey: ["auditoria-transcricoes", dateFrom, dateTo, statusFilter],
    queryFn: async (): Promise<CallRow[]> => {
      const start = `${dateFrom}T00:00:00-03:00`;
      const end = `${dateTo}T23:59:59-03:00`;
      let q = supabase
        .from("calls")
        .select("id,user_id,deal_id,started_at,duration_seconds,outcome,transcript_sid,transcript_status,ai_processed_at,summary,ai_summary,profiles:user_id(id,full_name,email)")
        .gte("started_at", start)
        .lte("started_at", end)
        .gte("duration_seconds", 60)
        .order("started_at", { ascending: false })
        .limit(5000);
      if (statusFilter !== "all") q = q.eq("transcript_status", statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as any;
    },
    staleTime: 15_000,
  });

  const dealIds = useMemo(
    () => Array.from(new Set((calls || []).map((c) => c.deal_id).filter(Boolean) as string[])),
    [calls]
  );

  // Notes per attendee (linked to deal) with note_type='call_summary'
  const { data: notesByDeal } = useQuery({
    queryKey: ["auditoria-transc-notes", dealIds.sort().join(",")],
    enabled: dealIds.length > 0,
    queryFn: async () => {
      const { data: attendees } = await supabase
        .from("meeting_slot_attendees")
        .select("id,deal_id")
        .in("deal_id", dealIds);
      const attMap = new Map<string, string>();
      (attendees || []).forEach((a: any) => attMap.set(a.id, a.deal_id));
      const attIds = Array.from(attMap.keys());
      if (attIds.length === 0) return {} as Record<string, number>;
      const { data: notes } = await supabase
        .from("attendee_notes")
        .select("id,attendee_id,note_type,created_at")
        .in("attendee_id", attIds)
        .eq("note_type", "call_summary");
      const counts: Record<string, number> = {};
      (notes || []).forEach((n: any) => {
        const did = attMap.get(n.attendee_id);
        if (did) counts[did] = (counts[did] || 0) + 1;
      });
      return counts;
    },
  });

  // crm_deals custom_fields.callSummaries
  const { data: customByDeal } = useQuery({
    queryKey: ["auditoria-transc-custom", dealIds.sort().join(",")],
    enabled: dealIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("crm_deals")
        .select("id,custom_fields")
        .in("id", dealIds);
      const map: Record<string, Set<string>> = {};
      (data || []).forEach((d: any) => {
        const arr = (d.custom_fields?.callSummaries || []) as any[];
        map[d.id] = new Set(arr.map((s) => s.callId || s.call_id).filter(Boolean));
      });
      return map;
    },
  });

  const sdrOptions = useMemo(() => {
    const m = new Map<string, string>();
    (calls || []).forEach((c) => {
      if (c.user_id) m.set(c.user_id, c.profiles?.full_name || c.profiles?.email || "—");
    });
    return Array.from(m.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [calls]);

  const filtered = useMemo(
    () => (calls || []).filter((c) => sdrFilter === "all" || c.user_id === sdrFilter),
    [calls, sdrFilter]
  );

  const handleExportCsv = () => {
    const headers = [
      "data_hora", "sdr", "email_sdr", "duracao_s", "outcome",
      "transcript_status", "transcript_sid", "tem_summary",
      "em_attendee_notes", "em_custom_fields", "deal_id", "resumo_ia",
    ];
    const rows = filtered.map((c) => {
      const inNotes = c.deal_id ? (notesByDeal?.[c.deal_id] || 0) > 0 : false;
      const inCustom = c.deal_id ? !!customByDeal?.[c.deal_id]?.has(c.id) : false;
      const resumo = (c.summary || "").replace(/\r?\n/g, " ").replace(/"/g, '""');
      return [
        c.started_at ? format(new Date(c.started_at), "yyyy-MM-dd HH:mm:ss") : "",
        c.profiles?.full_name || "",
        c.profiles?.email || "",
        c.duration_seconds ?? 0,
        c.outcome || "",
        c.transcript_status || "",
        c.transcript_sid || "",
        c.summary ? "sim" : "não",
        inNotes ? "sim" : "não",
        inCustom ? "sim" : "não",
        c.deal_id || "",
        resumo,
      ];
    });
    const csv = [headers, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `auditoria-transcricoes-${dateFrom}_a_${dateTo}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Aggregate per SDR
  const perSdr = useMemo(() => {
    const agg = new Map<string, { name: string; total: number; completed: number; pending: number; failed: number; withSummary: number; inNotes: number; inCustom: number }>();
    filtered.forEach((c) => {
      const key = c.user_id || "—";
      const name = c.profiles?.full_name || c.profiles?.email || "—";
      const cur = agg.get(key) || { name, total: 0, completed: 0, pending: 0, failed: 0, withSummary: 0, inNotes: 0, inCustom: 0 };
      cur.total += 1;
      if (c.transcript_status === "completed") cur.completed += 1;
      else if (c.transcript_status === "failed") cur.failed += 1;
      else cur.pending += 1;
      if (c.summary) cur.withSummary += 1;
      if (c.deal_id && (notesByDeal?.[c.deal_id] || 0) > 0) cur.inNotes += 1;
      if (c.deal_id && customByDeal?.[c.deal_id]?.has(c.id)) cur.inCustom += 1;
      agg.set(key, cur);
    });
    return Array.from(agg.values()).sort((a, b) => b.total - a.total);
  }, [filtered, notesByDeal, customByDeal]);

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Mic className="h-6 w-6" /> Auditoria de Transcrições de Ligação
        </h1>
        <p className="text-muted-foreground">
          Veja, por SDR e por dia, quais ligações ≥60s tiveram transcrição e onde o resumo da IA foi gravado.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          <div>
            <Label>De</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div>
            <Label>Até</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <div>
            <Label>SDR</Label>
            <Select value={sdrFilter} onValueChange={setSdrFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {sdrOptions.map(([id, name]) => (
                  <SelectItem key={id} value={id}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Status da transcrição</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Button onClick={handleExportCsv} disabled={!filtered.length} className="w-full gap-2">
              <Download className="h-4 w-4" /> Exportar CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Resumo por SDR</CardTitle>
          <CardDescription>Ligações ≥60s no período selecionado</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : perSdr.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma ligação ≥60s encontrada.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SDR</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Completed</TableHead>
                  <TableHead className="text-right">Pending</TableHead>
                  <TableHead className="text-right">Failed</TableHead>
                  <TableHead className="text-right">calls.summary</TableHead>
                  <TableHead className="text-right">attendee_notes</TableHead>
                  <TableHead className="text-right">custom_fields</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {perSdr.map((r) => (
                  <TableRow key={r.name}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="text-right">{r.total}</TableCell>
                    <TableCell className="text-right">{r.completed}</TableCell>
                    <TableCell className="text-right">{r.pending}</TableCell>
                    <TableCell className="text-right">{r.failed}</TableCell>
                    <TableCell className="text-right">{r.withSummary}</TableCell>
                    <TableCell className="text-right">{r.inNotes}</TableCell>
                    <TableCell className="text-right">{r.inCustom}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ligações ({filtered.length})</CardTitle>
          <CardDescription>Cada linha mostra onde o resumo foi gravado.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem resultados.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hora</TableHead>
                  <TableHead>SDR</TableHead>
                  <TableHead>Dur.</TableHead>
                  <TableHead>Outcome</TableHead>
                  <TableHead>Transcript</TableHead>
                  <TableHead>calls.summary</TableHead>
                  <TableHead>attendee_notes</TableHead>
                  <TableHead>custom_fields</TableHead>
                  <TableHead>Deal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => {
                  const inNotes = c.deal_id ? (notesByDeal?.[c.deal_id] || 0) > 0 : false;
                  const inCustom = c.deal_id ? !!customByDeal?.[c.deal_id]?.has(c.id) : false;
                  const statusBadge =
                    c.transcript_status === "completed" ? (
                      <Badge variant="default" className="gap-1"><CheckCircle2 className="h-3 w-3" />completed</Badge>
                    ) : c.transcript_status === "failed" ? (
                      <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />failed</Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />{c.transcript_status || "—"}</Badge>
                    );
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="whitespace-nowrap text-xs">
                        {c.started_at ? format(new Date(c.started_at), "dd/MM HH:mm", { locale: ptBR }) : "—"}
                      </TableCell>
                      <TableCell className="text-xs">{c.profiles?.full_name || c.profiles?.email || "—"}</TableCell>
                      <TableCell className="text-xs">{c.duration_seconds ?? 0}s</TableCell>
                      <TableCell className="text-xs">{c.outcome || "—"}</TableCell>
                      <TableCell>{statusBadge}</TableCell>
                      <TableCell>{c.summary ? <Badge variant="default">✓</Badge> : <Badge variant="outline">—</Badge>}</TableCell>
                      <TableCell>{inNotes ? <Badge variant="default">✓</Badge> : <Badge variant="outline">—</Badge>}</TableCell>
                      <TableCell>{inCustom ? <Badge variant="default">✓</Badge> : <Badge variant="outline">—</Badge>}</TableCell>
                      <TableCell className="text-xs font-mono">{c.deal_id ? c.deal_id.slice(0, 8) : "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}