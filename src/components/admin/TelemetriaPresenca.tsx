import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Pres = { user_id: string; nome: string | null; email: string | null; route: string | null; screen_name: string | null; last_heartbeat: string; last_interaction_at: string | null; tab_visible: boolean | null };
type Ativ = { user_id: string; nome: string | null; email: string | null; ativo_seg: number; ocioso_seg: number; segundo_plano_seg: number; telas: { tela: string; seg: number }[] };
type Status = "ativo" | "ocioso" | "segundo_plano" | "offline";

const OFFLINE_MS = 2 * 60_000;
const ATIVO_MS = 2 * 60_000;
const ROT: Record<Status, string> = { ativo: "Ativo", ocioso: "Ocioso", segundo_plano: "Segundo plano", offline: "Offline" };
const COR: Record<Status, string> = {
  ativo: "bg-success/15 text-success border-success/30",
  ocioso: "bg-warning/15 text-warning border-warning/30",
  segundo_plano: "bg-muted text-muted-foreground border-border",
  offline: "bg-destructive/10 text-destructive border-destructive/30",
};
const fmtDur = (s: number) => { const m = Math.floor(s / 60); return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}min` : `${m} min`; };
const fmtHora = (v: string | null) => (v ? new Date(v).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—");
const hojeSP = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

/** Classificação de presença: Ativo < 2 min sem interação; Ocioso > X min; Segundo plano = aba oculta; Offline = sem heartbeat há > 2 min. */
export function statusPresenca(r: Pick<Pres, "last_heartbeat" | "last_interaction_at" | "tab_visible">, ociosoMin: number, agora = Date.now()): Status {
  if (agora - new Date(r.last_heartbeat).getTime() > OFFLINE_MS) return "offline";
  if (r.tab_visible === false) return "segundo_plano";
  const sem = r.last_interaction_at ? agora - new Date(r.last_interaction_at).getTime() : Infinity;
  if (sem < ATIVO_MS) return "ativo";
  return sem > ociosoMin * 60_000 ? "ocioso" : "ativo";
}

export default function TelemetriaPresenca() {
  const [ociosoMin, setOciosoMin] = useState(5);
  const [dia, setDia] = useState(hojeSP());
  const [verOffline, setVerOffline] = useState(false);

  const pres = useQuery({
    queryKey: ["telemetria_presenca"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("telemetria_presenca");
      if (error) throw error;
      return (data ?? []) as Pres[];
    },
    refetchInterval: 30_000,
  });
  const ativ = useQuery({
    queryKey: ["telemetria_atividade_dia", dia, ociosoMin],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("telemetria_atividade_dia", { p_dia: dia, p_ocioso_min: ociosoMin });
      if (error) throw error;
      return (data ?? []) as Ativ[];
    },
    refetchInterval: 60_000,
  });

  const linhas = useMemo(() => {
    const agora = Date.now();
    return (pres.data ?? []).map((r) => {
      const st = statusPresenca(r, ociosoMin, agora);
      const ocioso = r.last_interaction_at ? Math.max(0, Math.floor((agora - new Date(r.last_interaction_at).getTime()) / 1000)) : null;
      return { ...r, st, ocioso };
    }).sort((a, b) => (a.nome ?? a.email ?? "").localeCompare(b.nome ?? b.email ?? ""));
  }, [pres.data, ociosoMin]);
  const online = linhas.filter((l) => l.st !== "offline");
  const offline = linhas.filter((l) => l.st === "offline");
  const cont = (s: Status) => linhas.filter((l) => l.st === s).length;

  const Linha = (l: (typeof linhas)[number]) => (
    <TableRow key={l.user_id}>
      <TableCell><div className="font-medium">{l.nome ?? "—"}</div><div className="text-xs text-muted-foreground">{l.email}</div></TableCell>
      <TableCell>{l.screen_name ?? <span className="font-mono text-xs">{l.route}</span>}</TableCell>
      <TableCell><Badge variant="outline" className={COR[l.st]}>{ROT[l.st]}</Badge></TableCell>
      <TableCell className="text-right">{l.ocioso == null ? "—" : fmtDur(l.ocioso)}</TableCell>
      <TableCell className="text-right text-xs">{fmtHora(l.last_interaction_at)}</TableCell>
    </TableRow>
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
        <CardTitle>Presença ao vivo</CardTitle>
        <div className="flex items-center gap-2">
          <Label htmlFor="ocioso-min" className="text-xs">Ocioso após (min)</Label>
          <Input id="ocioso-min" type="number" min={1} max={120} className="w-20 h-8" value={ociosoMin}
            onChange={(e) => setOciosoMin(Math.min(120, Math.max(1, Number(e.target.value) || 5)))} />
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="agora">
          <TabsList>
            <TabsTrigger value="agora">Agora</TabsTrigger>
            <TabsTrigger value="pessoa">Atividade por pessoa</TabsTrigger>
          </TabsList>
          <TabsContent value="agora" className="space-y-4">
            {pres.error && <p className="text-destructive text-sm">Não foi possível carregar a presença.</p>}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[["Online agora", online.length], ["Ativos", cont("ativo")], ["Ociosos", cont("ocioso")], ["Em segundo plano", cont("segundo_plano")]].map(([t, v]) => (
                <div key={t as string} className="rounded-lg border p-4"><div className="text-xs text-muted-foreground">{t}</div><div className="text-2xl font-semibold">{v}</div></div>
              ))}
            </div>
            <Table>
              <TableHeader><TableRow><TableHead>Pessoa</TableHead><TableHead>Tela atual</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Tempo ocioso</TableHead><TableHead className="text-right">Última atividade</TableHead></TableRow></TableHeader>
              <TableBody>
                {online.length === 0 && <TableRow><TableCell colSpan={5} className="text-muted-foreground">Ninguém online agora.</TableCell></TableRow>}
                {online.map(Linha)}
                {offline.length > 0 && (
                  <TableRow><TableCell colSpan={5}>
                    <button className="text-xs text-muted-foreground underline" onClick={() => setVerOffline((v) => !v)}>
                      {verOffline ? "Esconder" : "Mostrar"} {offline.length} offline (últimas 2 h)
                    </button>
                  </TableCell></TableRow>
                )}
                {verOffline && offline.map(Linha)}
              </TableBody>
            </Table>
            <p className="text-xs text-muted-foreground">Atualiza a cada 30 s.</p>
          </TabsContent>
          <TabsContent value="pessoa" className="space-y-4">
            <div className="flex items-center gap-2"><Label className="text-xs">Dia</Label><Input type="date" className="w-44 h-8" value={dia} onChange={(e) => e.target.value && setDia(e.target.value)} /></div>
            {ativ.error && <p className="text-destructive text-sm">Não foi possível carregar a atividade.</p>}
            <Table>
              <TableHeader><TableRow><TableHead>Pessoa</TableHead><TableHead className="text-right">Ativo</TableHead><TableHead className="text-right">Ocioso</TableHead><TableHead className="text-right">Segundo plano</TableHead><TableHead>Telas mais usadas</TableHead></TableRow></TableHeader>
              <TableBody>
                {(ativ.data ?? []).length === 0 && <TableRow><TableCell colSpan={5} className="text-muted-foreground">Sem registros nesse dia.</TableCell></TableRow>}
                {(ativ.data ?? []).map((a) => (
                  <TableRow key={a.user_id}>
                    <TableCell><div className="font-medium">{a.nome ?? "—"}</div><div className="text-xs text-muted-foreground">{a.email}</div></TableCell>
                    <TableCell className="text-right">{fmtDur(a.ativo_seg)}</TableCell>
                    <TableCell className="text-right">{fmtDur(a.ocioso_seg)}</TableCell>
                    <TableCell className="text-right">{fmtDur(a.segundo_plano_seg)}</TableCell>
                    <TableCell className="text-xs">{(a.telas ?? []).map((t) => `${t.tela} (${fmtDur(t.seg)})`).join(" · ") || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="text-xs text-muted-foreground">Estimativa: cada registro de presença equivale a cerca de 45 s.</p>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
