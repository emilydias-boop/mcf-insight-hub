import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Row = { event_type: string; route: string | null; message: string | null; duration_ms: number | null; user_id: string; created_at: string };

const pct = (arr: number[], p: number) => {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};
const fmtMs = (v: number | null) => (v == null ? "—" : v >= 1000 ? `${(v / 1000).toFixed(1)} s` : `${v} ms`);

export default function Telemetria() {
  const [dias, setDias] = useState("7");
  const { data = [], isLoading, error } = useQuery({
    queryKey: ["app_telemetry", dias],
    queryFn: async () => {
      const desde = new Date(Date.now() - Number(dias) * 86400000).toISOString();
      const all: Row[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await (supabase as any)
          .from("app_telemetry")
          .select("event_type, route, message, duration_ms, user_id, created_at")
          .gte("created_at", desde)
          .order("created_at", { ascending: false })
          .range(from, from + 999);
        if (error) throw error;
        all.push(...(data ?? []));
        if (!data || data.length < 1000 || all.length >= 20000) break;
      }
      return all;
    },
  });

  const { uso, lentas, erros } = useMemo(() => {
    const u = new Map<string, { total: number; users: Set<string> }>();
    const l = new Map<string, number[]>();
    const e = new Map<string, { route: string; message: string; count: number; last: string }>();
    for (const r of data) {
      const route = r.route ?? "(desconhecida)";
      if (r.event_type === "page_view") {
        const x = u.get(route) ?? { total: 0, users: new Set() };
        x.total++; x.users.add(r.user_id); u.set(route, x);
      } else if (r.event_type === "page_load" && r.duration_ms != null) {
        l.set(route, [...(l.get(route) ?? []), r.duration_ms]);
      } else if (r.event_type === "error") {
        const msg = r.message ?? "(sem mensagem)";
        const k = route + "|" + msg;
        const x = e.get(k) ?? { route, message: msg, count: 0, last: r.created_at };
        x.count++; if (r.created_at > x.last) x.last = r.created_at; e.set(k, x);
      }
    }
    return {
      uso: [...u.entries()].map(([route, x]) => ({ route, total: x.total, pessoas: x.users.size })).sort((a, b) => b.total - a.total),
      lentas: [...l.entries()].map(([route, v]) => ({ route, n: v.length, p50: pct(v, 50), p95: pct(v, 95), max: Math.max(...v) })).sort((a, b) => (b.p50 ?? 0) - (a.p50 ?? 0)),
      erros: [...e.values()].sort((a, b) => b.count - a.count),
    };
  }, [data]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Telemetria do app</h1>
          <p className="text-sm text-muted-foreground">Uso das telas, tempo de abertura e erros registrados.</p>
        </div>
        <Select value={dias} onValueChange={setDias}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Últimas 24 h</SelectItem>
            <SelectItem value="7">Últimos 7 dias</SelectItem>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {isLoading && <p className="text-muted-foreground">Carregando…</p>}
      {error && <p className="text-destructive">Não foi possível carregar os registros.</p>}

      <Card>
        <CardHeader><CardTitle>Telas mais usadas</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Tela</TableHead><TableHead className="text-right">Aberturas</TableHead><TableHead className="text-right">Pessoas</TableHead></TableRow></TableHeader>
            <TableBody>
              {uso.length === 0 && <TableRow><TableCell colSpan={3} className="text-muted-foreground">Sem registros no período.</TableCell></TableRow>}
              {uso.map((r) => <TableRow key={r.route}><TableCell className="font-mono text-xs">{r.route}</TableCell><TableCell className="text-right">{r.total}</TableCell><TableCell className="text-right">{r.pessoas}</TableCell></TableRow>)}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Tempo de abertura (mais lentas primeiro)</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Tela</TableHead><TableHead className="text-right">Registros</TableHead><TableHead className="text-right">Típico</TableHead><TableHead className="text-right">95% abaixo de</TableHead><TableHead className="text-right">Máximo</TableHead></TableRow></TableHeader>
            <TableBody>
              {lentas.length === 0 && <TableRow><TableCell colSpan={5} className="text-muted-foreground">Sem registros no período.</TableCell></TableRow>}
              {lentas.map((r) => <TableRow key={r.route}><TableCell className="font-mono text-xs">{r.route}</TableCell><TableCell className="text-right">{r.n}</TableCell><TableCell className="text-right">{fmtMs(r.p50)}</TableCell><TableCell className="text-right">{fmtMs(r.p95)}</TableCell><TableCell className="text-right">{fmtMs(r.max)}</TableCell></TableRow>)}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Erros</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Tela</TableHead><TableHead>Mensagem</TableHead><TableHead className="text-right">Vezes</TableHead><TableHead className="text-right">Último</TableHead></TableRow></TableHeader>
            <TableBody>
              {erros.length === 0 && <TableRow><TableCell colSpan={4} className="text-muted-foreground">Nenhum erro no período.</TableCell></TableRow>}
              {erros.map((r) => <TableRow key={r.route + r.message}><TableCell className="font-mono text-xs">{r.route}</TableCell><TableCell className="text-xs max-w-md break-words">{r.message}</TableCell><TableCell className="text-right">{r.count}</TableCell><TableCell className="text-right text-xs">{new Date(r.last).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</TableCell></TableRow>)}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
