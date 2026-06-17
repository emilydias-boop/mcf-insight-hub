import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, RefreshCw, Play, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

type ReconcileLog = {
  id: string;
  status: string;
  event_data: any;
  created_at: string;
  processed_at: string | null;
  processing_time_ms: number | null;
};

export default function KiwifyReconcile() {
  const [logs, setLogs] = useState<ReconcileLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  async function loadLogs() {
    setLoading(true);
    const { data, error } = await supabase
      .from("hubla_webhook_logs")
      .select("id, status, event_data, created_at, processed_at, processing_time_ms")
      .eq("event_type", "kiwify:reconcile")
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) toast.error("Erro ao carregar logs: " + error.message);
    else setLogs((data || []) as ReconcileLog[]);
    setLoading(false);
  }

  useEffect(() => { loadLogs(); }, []);

  async function runNow() {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("kiwify-daily-reconcile", {
        body: { lookbackDays: 3, trigger: "manual" },
      });
      if (error) throw error;
      const c = data?.counters || {};
      toast.success(
        `Reconciliação concluída: ${c.fetched ?? 0} vendas, ${c.inserted ?? 0} inseridas, ${c.dealsCreated ?? 0} deals criados, ${c.errors ?? 0} erros`,
      );
      await loadLogs();
    } catch (e: any) {
      toast.error("Falha: " + (e?.message || String(e)));
    } finally {
      setRunning(false);
    }
  }

  const last = logs[0];
  const last24h = logs.filter((l) => {
    const t = new Date(l.created_at).getTime();
    return Date.now() - t < 24 * 60 * 60 * 1000;
  });
  const last7d = logs.filter((l) => {
    const t = new Date(l.created_at).getTime();
    return Date.now() - t < 7 * 24 * 60 * 60 * 1000;
  });

  const sum = (arr: ReconcileLog[], key: string) =>
    arr.reduce((acc, l) => acc + (l.event_data?.counters?.[key] || 0), 0);

  const sample = last?.event_data?.recovered_sample || [];

  return (
    <div className="space-y-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reconciliação Kiwify</h1>
          <p className="text-sm text-muted-foreground">
            Job diário (03:00 BRT) que recupera vendas Kiwify que não chegaram pelo webhook em tempo real.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadLogs} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </Button>
          <Button size="sm" onClick={runNow} disabled={running}>
            {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
            Executar agora
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard title="Última execução" value={last ? new Date(last.created_at).toLocaleString("pt-BR") : "—"}
          sub={last ? <StatusBadge status={last.status} /> : null} />
        <StatCard title="Inseridas (24h)" value={sum(last24h, "inserted").toString()}
          sub={<span className="text-xs text-muted-foreground">{last24h.length} execuções</span>} />
        <StatCard title="Deals criados (24h)" value={sum(last24h, "dealsCreated").toString()} />
        <StatCard title="Inseridas (7d)" value={sum(last7d, "inserted").toString()}
          sub={<span className="text-xs text-muted-foreground">{sum(last7d, "errors")} erros</span>} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Últimas recuperações (execução mais recente)</CardTitle>
        </CardHeader>
        <CardContent>
          {sample.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma recuperação na última execução.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order ID</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Data venda</TableHead>
                  <TableHead>Deal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sample.map((r: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-xs">{r.order_id}</TableCell>
                    <TableCell className="text-sm">{r.email || "—"}</TableCell>
                    <TableCell className="text-sm">{r.product}</TableCell>
                    <TableCell><Badge variant="outline">{r.category}</Badge></TableCell>
                    <TableCell className="text-xs">{new Date(r.sale_date).toLocaleString("pt-BR")}</TableCell>
                    <TableCell className="text-xs">
                      {r.deal_id ? <Badge variant="default">✓</Badge> : <Badge variant="secondary">—</Badge>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico de execuções</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quando</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Buscadas</TableHead>
                <TableHead>Inseridas</TableHead>
                <TableHead>Deals</TableHead>
                <TableHead>Erros</TableHead>
                <TableHead>Tempo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((l) => {
                const c = l.event_data?.counters || {};
                return (
                  <TableRow key={l.id}>
                    <TableCell className="text-xs">{new Date(l.created_at).toLocaleString("pt-BR")}</TableCell>
                    <TableCell><StatusBadge status={l.status} /></TableCell>
                    <TableCell>{c.fetched ?? "—"}</TableCell>
                    <TableCell>{c.inserted ?? "—"}</TableCell>
                    <TableCell>{c.dealsCreated ?? "—"}</TableCell>
                    <TableCell>{c.errors ?? "—"}</TableCell>
                    <TableCell className="text-xs">{l.processing_time_ms ? `${l.processing_time_ms}ms` : "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ title, value, sub }: { title: string; value: string; sub?: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {sub && <div className="mt-1">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "success") return <Badge variant="default" className="gap-1"><CheckCircle2 className="h-3 w-3" /> ok</Badge>;
  if (status === "partial") return <Badge variant="secondary" className="gap-1"><AlertCircle className="h-3 w-3" /> parcial</Badge>;
  if (status === "error") return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" /> erro</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}