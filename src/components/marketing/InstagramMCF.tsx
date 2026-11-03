import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts";
import { Image as ImageIcon, Info, ExternalLink, ArrowUpDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

const COLS_MIDIA = "media_id, publicado_em, publicado_brt, hora_brt, produto, tipo, alcance, views, salvamentos, compartilhamentos, interacoes, curtidas, comentarios, taxa_pulo, tempo_medio_ms, thumbnail_url, legenda, permalink, roteiro_id, roteiro_tema" as const;
type Midia = Pick<Database["public"]["Views"]["vw_ig_midias"]["Row"], "media_id" | "publicado_em" | "publicado_brt" | "hora_brt" | "produto" | "tipo" | "alcance" | "views" | "salvamentos" | "compartilhamentos" | "interacoes" | "curtidas" | "comentarios" | "taxa_pulo" | "tempo_medio_ms" | "thumbnail_url" | "legenda" | "permalink" | "roteiro_id" | "roteiro_tema">;
type ErroCorpo = { motivo?: string; erro?: string; error?: string };

/** Lê todas as páginas (PostgREST corta em 1.000 linhas). */
async function fetchAll<T>(page: (i: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; ; i += 1000) {
    const { data, error } = await page(i);
    if (error) throw error;
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < 1000) return out;
  }
}
type ContaDia = Database["public"]["Tables"]["ig_conta_dia"]["Row"];

const nf = new Intl.NumberFormat("pt-BR");
const nf1 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmt = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? "—" : nf.format(Math.round(v)));
const fmtPct = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? "—" : `${nf1.format(v)}%`);

function median(values: (number | null | undefined)[]): number | null {
  const xs = values.filter((v): v is number => v != null && Number.isFinite(v)).sort((a, b) => a - b);
  if (!xs.length) return null;
  const m = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[m] : (xs[m - 1] + xs[m]) / 2;
}
function sum(values: (number | null | undefined)[]): number | null {
  const xs = values.filter((v): v is number => v != null);
  return xs.length ? xs.reduce((a, b) => a + b, 0) : null;
}
const ratio = (a: number | null, b: number | null) => (a == null || !b ? null : (a / b) * 100);
const ddmm = (d: string) => { const [, m, dia] = d.slice(0, 10).split("-"); return `${dia}/${m}`; };
const ddmmhhmm = (s: string | null) => (s ? `${ddmm(s)} ${s.slice(11, 16)}` : "—");
const fmtBrt = (iso: string | null) => {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso)).replace(",", "");
};
const run0Rodando = (s: string | undefined) => s === "rodando";
const isReels = (m: Midia) => m.produto === "REELS";
const formato = (m: Midia) => (isReels(m) ? "Reels" : m.tipo === "CAROUSEL_ALBUM" ? "Carrossel" : m.tipo === "IMAGE" ? "Imagem" : m.tipo ?? "—");

function Kpi({ label, value, tip, note }: { label: string; value: string; tip: string; note?: string }) {
  return (
    <Card className="min-w-0">
      <CardContent className="space-y-[4px] p-[14px]">
        <div className="flex items-center gap-[6px] text-[12px] text-muted-foreground">
          {label}
          <Tooltip><TooltipTrigger asChild><button type="button" aria-label={`Sobre ${label}`}><Info className="h-[12px] w-[12px]" /></button></TooltipTrigger><TooltipContent className="max-w-[260px] text-[12px]">{tip}</TooltipContent></Tooltip>
        </div>
        <div className="text-[20px] font-semibold tabular-nums">{value}</div>
        {note && <div className="text-[11px] text-muted-foreground">{note}</div>}
      </CardContent>
    </Card>
  );
}

function Thumb({ url }: { url: string | null }) {
  const [falhou, setFalhou] = useState(false);
  if (!url || falhou) return <div className="flex h-[40px] w-[40px] items-center justify-center rounded bg-muted"><ImageIcon className="h-[16px] w-[16px] text-muted-foreground" /></div>;
  return <img src={url} alt="" className="h-[40px] w-[40px] rounded object-cover" loading="lazy" onError={() => setFalhou(true)} />;
}

function ErroCard({ msg, onRetry }: { msg: string; onRetry: () => void }) {
  return (
    <Card><CardContent className="flex flex-col gap-[8px] p-[16px] text-[13px] sm:flex-row sm:items-center sm:justify-between">
      <span className="text-destructive">Erro ao carregar os números do Instagram: {msg}</span>
      <Button variant="outline" onClick={onRetry} className="h-[32px] px-[10px] text-[12px]">Tentar de novo</Button>
    </CardContent></Card>
  );
}

type SortKey = "publicado_em" | "views" | "alcance" | "salvamentos" | "compartilhamentos" | "interacoes" | "taxa_pulo" | "tempo_medio_ms";

function Th({ k, sortKey, sortDesc, ordenar, children }: { k: SortKey; sortKey: SortKey; sortDesc: boolean; ordenar: (k: SortKey) => void; children: React.ReactNode }) {
  return (
    <TableHead className="whitespace-nowrap text-right text-[12px]" aria-sort={k === sortKey ? (sortDesc ? "descending" : "ascending") : "none"}><button type="button" onClick={() => ordenar(k)} className="inline-flex items-center gap-[4px]">{children}<ArrowUpDown className="h-[11px] w-[11px]" /></button></TableHead>
  );
}

export function InstagramMCF({ from, to }: { from: string; to: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("alcance");
  const [sortDesc, setSortDesc] = useState(true);
  const [page, setPage] = useState(0);
  const [abertoId, setAbertoId] = useState<string | null>(null);

  const pode = useQuery({
    queryKey: ["ig-pode", user?.id],
    enabled: !!user?.id,
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("ig_pode", { p_user: user!.id });
      if (error) throw error;
      return !!data;
    },
  });
  const ok = pode.data === true;

  const conta = useQuery({ queryKey: ["ig", "conta"], enabled: ok, queryFn: async () => {
    const { data, error } = await supabase.from("ig_contas").select("*").eq("ativo", true).maybeSingle();
    if (error) throw error; return data;
  } });
  const sync = useQuery({ queryKey: ["ig", "sync"], enabled: ok, queryFn: async () => {
    const { data, error } = await supabase.from("ig_sync_runs").select("*").order("iniciado_em", { ascending: false }).limit(1).maybeSingle();
    if (error) throw error; return data;
  } });
  const ultimaConcluida = useQuery({ queryKey: ["ig", "sync-concluida"], enabled: ok, queryFn: async () => {
    const { data, error } = await supabase.from("ig_sync_runs").select("terminado_em").not("terminado_em", "is", null).order("terminado_em", { ascending: false }).limit(1).maybeSingle();
    if (error) throw error; return data;
  } });
  const dias = useQuery({ queryKey: ["ig", "dias", from, to], enabled: ok, queryFn: () =>
    fetchAll<ContaDia>(i => supabase.from("ig_conta_dia").select("*").gte("data", from).lte("data", to).order("data").range(i, i + 999)) });
  const fim = useQuery({ queryKey: ["ig", "fim", to], enabled: ok, queryFn: async () => {
    const { data, error } = await supabase.from("ig_conta_dia").select("data, seguidores").not("seguidores", "is", null).lte("data", to).order("data", { ascending: false }).limit(1).maybeSingle();
    if (error) throw error; return data;
  } });
  const inicio = useQuery({ queryKey: ["ig", "inicio", from], enabled: ok, queryFn: async () => {
    const { data, error } = await supabase.from("ig_conta_dia").select("data, seguidores").not("seguidores", "is", null).lte("data", from).order("data", { ascending: false }).limit(1).maybeSingle();
    if (error) throw error; return data;
  } });
  const primeiraFoto = useQuery({ queryKey: ["ig", "primeira"], enabled: ok, queryFn: async () => {
    const { data, error } = await supabase.from("ig_conta_dia").select("data").not("seguidores", "is", null).order("data").limit(1).maybeSingle();
    if (error) throw error; return data;
  } });
  const midias = useQuery({ queryKey: ["ig", "midias", from, to], enabled: ok, queryFn: () =>
    fetchAll<Midia>(i => supabase.from("vw_ig_midias").select(COLS_MIDIA).gte("publicado_brt", `${from}T00:00:00`).lte("publicado_brt", `${to}T23:59:59`).order("publicado_em", { ascending: false }).order("media_id").range(i, i + 999)) });
  const posts = midias.data ?? [];
  const aberto = abertoId ? posts.find(p => p.media_id === abertoId) ?? null : null;
  const curva = useQuery({ queryKey: ["ig", "curva", aberto?.media_id], enabled: ok && !!aberto?.media_id, queryFn: async () => {
    const { data, error } = await supabase.from("ig_midia_dia").select("*").eq("media_id", aberto!.media_id!).order("dias_desde_post");
    if (error) throw error; return data ?? [];
  } });

  const atualizar = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("ig-sync", { body: {} });
      if (error) {
        let msg = error.message;
        try { const body = await (error as { context?: { json?: () => Promise<ErroCorpo> } }).context?.json?.(); msg = body?.motivo ?? body?.erro ?? body?.error ?? error.message; } catch { /* sem corpo */ }
        toast.error(msg);
      } else if (data?.ok && data.status === "parcial") {
        toast.warning(`Carga parcial: ${nf.format(data.dias_lidos ?? 0)} dias e ${nf.format(data.midias_lidas ?? 0)} posts; a próxima rodada continua`, data.erro ? { description: data.erro } : undefined);
      } else if (data?.ok && data.status === "ok") {
        toast.success(`Atualizado: ${nf.format(data.dias_lidos ?? 0)} dias e ${nf.format(data.midias_lidas ?? 0)} posts`);
      } else if (data?.ok) {
        toast.message(`Status da atualização: ${data.status ?? "—"}`);
      } else {
        toast.error(data?.motivo ?? data?.erro ?? "Falha ao atualizar");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao atualizar");
    } finally {
      setSyncing(false);
      qc.invalidateQueries({ queryKey: ["ig"] });
    }
  };

  const d = dias.data ?? [];
  /** Escala da taxa de pulo decidida uma vez para o conjunto. */
  const puloEmPct = posts.some(p => p.taxa_pulo != null && p.taxa_pulo > 1);
  const pulo = (v: number | null | undefined) => (v == null ? null : puloEmPct ? v : v * 100);

  const calc = useMemo(() => {
    const reels = posts.filter(isReels);
    const grupos = [
      { nome: "Reels", itens: reels, reels: true },
      { nome: "Carrossel", itens: posts.filter(p => p.tipo === "CAROUSEL_ALBUM"), reels: false },
      { nome: "Imagem", itens: posts.filter(p => p.tipo === "IMAGE" && !isReels(p)), reels: false },
    ];
    const horas = new Map<number, Midia[]>();
    posts.forEach(p => { if (p.hora_brt != null) horas.set(p.hora_brt, [...(horas.get(p.hora_brt) ?? []), p]); });
    const porHora = [...horas.entries()].filter(([, v]) => v.length >= 3).map(([h, v]) => ({ h, n: v.length, alc: median(v.map(x => x.alcance)), pulo: median(v.filter(isReels).map(x => pulo(x.taxa_pulo))) })).sort((a, b) => a.h - b.h);
    const comAlc = porHora.filter(x => x.alc != null);
    const maxH = comAlc.length ? comAlc.reduce((a, b) => (b.alc! > a.alc! ? b : a)) : null;
    const minH = comAlc.length ? comAlc.reduce((a, b) => (b.alc! < a.alc! ? b : a)) : null;
    const distintos = !!maxH && !!minH && maxH.alc! > minH.alc!;
    const melhor = distintos ? maxH!.h : null;
    const pior = distintos ? minH!.h : null;
    return {
      alcance: sum(d.map(x => x.alcance)), views: sum(d.map(x => x.views)), interacoes: sum(d.map(x => x.interacoes)),
      salv: sum(d.map(x => x.salvamentos)), comp: sum(d.map(x => x.compartilhamentos)),
      alcMed: median(posts.map(p => p.alcance)),
      salvAlc: median(posts.map(p => ratio(p.salvamentos, p.alcance))),
      puloMed: median(reels.map(p => pulo(p.taxa_pulo))),
      grupos, porHora, melhor, pior,
      chart: d.map(x => ({ dia: ddmm(x.data), alcance: x.alcance, views: x.views, seguidores: x.seguidores })),
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d, posts, puloEmPct]);

  const ordenados = useMemo(() => {
    const val = (p: Midia) => (sortKey === "publicado_em" ? (p.publicado_em ? Date.parse(p.publicado_em) : null) : sortKey === "taxa_pulo" ? pulo(p.taxa_pulo) : (p[sortKey] as number | null));
    return [...posts].sort((a, b) => {
      const va = val(a), vb = val(b);
      if (va == null && vb == null) return 0; if (va == null) return 1; if (vb == null) return -1;
      return sortDesc ? vb - va : va - vb;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posts, sortKey, sortDesc, puloEmPct]);
  const paginas = Math.max(1, Math.ceil(ordenados.length / 25));
  const pagina = Math.min(page, paginas - 1);
  const visiveis = ordenados.slice(pagina * 25, pagina * 25 + 25);
  const ordenar = (k: SortKey) => { if (k === sortKey) setSortDesc(!sortDesc); else { setSortKey(k); setSortDesc(true); } setPage(0); };

  if (pode.isLoading || (!user && !pode.data)) return <Skeleton className="h-[200px] w-full" />;
  if (pode.error) return <ErroCard msg={(pode.error as Error).message} onRetry={() => pode.refetch()} />;
  if (pode.data === false) return <Card><CardContent className="p-[16px] text-[13px] text-muted-foreground">Sem acesso aos números do Instagram</CardContent></Card>;

  const falhas = [conta, dias, midias, fim, inicio].filter(q => q.error);
  if (falhas.length) return <ErroCard msg={(falhas[0].error as Error).message} onRetry={() => falhas.forEach(q => q.refetch())} />;
  const carregando = conta.isLoading || dias.isLoading || midias.isLoading || fim.isLoading || inicio.isLoading;
  const rodando = run0Rodando(sync.data?.status);
  const semDados = !carregando && !conta.data && !d.length && !posts.length;
  const run = sync.data;
  const segIni = inicio.data?.seguidores ?? null;
  const segFim = fim.data?.seguidores ?? null;
  const variacao = segFim != null && segIni != null ? segFim - segIni : null;
  const thp = { sortKey, sortDesc, ordenar };

  return (
    <TooltipProvider delayDuration={150}>
      <div className="min-w-0 space-y-[20px]">
        <Card>
          <CardContent className="flex flex-col gap-[12px] p-[16px] sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-[12px]">
              {conta.data?.foto_url ? <img src={conta.data.foto_url} alt="" className="h-[48px] w-[48px] rounded-full object-cover" /> : <div className="flex h-[48px] w-[48px] items-center justify-center rounded-full bg-muted"><ImageIcon className="h-[20px] w-[20px] text-muted-foreground" /></div>}
              <div>
                <div className="text-[15px] font-semibold">@{conta.data?.username ?? "mcf_capital"}</div>
                <div className="text-[12px] text-muted-foreground">{fmt(conta.data?.seguidores)} seguidores · {fmt(conta.data?.posts)} posts</div>
              </div>
            </div>
            <div className="flex flex-col items-start gap-[6px] sm:items-end">
              <div className="text-[12px] text-muted-foreground">{ultimaConcluida.data?.terminado_em ? `Atualizado em ${fmtBrt(ultimaConcluida.data.terminado_em)}` : "Ainda não sincronizado"}</div>
              {rodando && <div className="text-[12px] text-muted-foreground">Atualização em andamento</div>}
              {run?.status === "erro" && run.erro && <div className="max-w-[360px] text-[12px] text-destructive">{run.erro}</div>}
              {run?.status === "parcial" && <div className="text-[12px] text-muted-foreground">Carga em andamento: a próxima rodada continua</div>}
              <Button onClick={atualizar} disabled={syncing || rodando} className="h-[36px] px-[12px] text-[12px]">{syncing ? "Atualizando…" : "Atualizar agora"}</Button>
            </div>
          </CardContent>
        </Card>

        {carregando ? <Skeleton className="h-[300px] w-full" /> : semDados ? (
          <Card><CardContent className="p-[16px] text-[13px] text-muted-foreground">Ainda não há números do Instagram. Clique em Atualizar agora.</CardContent></Card>
        ) : <>
          <div className="grid grid-cols-1 gap-[12px] sm:grid-cols-2 lg:grid-cols-5">
            <Kpi label="Seguidores" value={fmt(segFim)}
              tip="Último total de seguidores registrado até o fim do período, comparado com a última foto até o início."
              note={variacao != null ? `${variacao >= 0 ? "+" : ""}${nf.format(variacao)} no período` : !inicio.data && primeiraFoto.data?.data ? `histórico começa em ${ddmm(primeiraFoto.data.data)}` : undefined} />
            <Kpi label="Alcance diário somado" value={fmt(calc.alcance)} tip="Soma do alcance de cada dia: a mesma pessoa em dias diferentes conta mais de uma vez." />
            <Kpi label="Views" value={fmt(calc.views)} tip="Soma das visualizações diárias da conta no período." />
            <Kpi label="Interações" value={fmt(calc.interacoes)} tip="Soma das interações diárias da conta (curtidas, comentários, salvamentos, compartilhamentos)." />
            <Kpi label="Salvamentos" value={fmt(calc.salv)} tip="Soma dos salvamentos diários da conta no período." />
            <Kpi label="Compartilhamentos" value={fmt(calc.comp)} tip="Soma dos compartilhamentos diários da conta no período." />
            <Kpi label="Posts no período" value={fmt(posts.length)} tip="Quantidade de posts publicados no período (hora de Brasília). Stories não entram." />
            <Kpi label="Alcance mediano por post" value={fmt(calc.alcMed)} tip="Mediana do alcance dos posts publicados no período." />
            <Kpi label="Salvamentos/alcance mediano" value={fmtPct(calc.salvAlc)} tip="Mediana, por post, de salvamentos divididos pelo alcance." />
            <Kpi label="Taxa de pulo mediana (Reels)" value={fmtPct(calc.puloMed)} tip="Mediana da taxa de pulo dos Reels do período: quem saiu nos primeiros segundos." />
          </div>

          <Card>
            <CardHeader className="p-[16px] pb-[8px]"><CardTitle className="text-[15px]">Por dia</CardTitle><CardDescription className="text-[12px]">Alcance e views da conta; seguidores só nos dias com foto.</CardDescription></CardHeader>
            <CardContent className="h-[280px] p-[16px] pt-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={calc.chart}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="l" tick={{ fontSize: 11 }} tickFormatter={v => nf.format(v)} />
                  <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11 }} tickFormatter={v => nf.format(v)} domain={["auto", "auto"]} />
                  <RTooltip formatter={(v: number) => fmt(v)} contentStyle={{ fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line yAxisId="l" dataKey="alcance" name="Alcance" stroke="hsl(var(--primary))" dot={false} />
                  <Line yAxisId="l" dataKey="views" name="Views" stroke="hsl(var(--muted-foreground))" dot={false} />
                  <Line yAxisId="r" dataKey="seguidores" name="Seguidores" stroke="hsl(var(--destructive))" dot={{ r: 2 }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-[16px] pb-[8px]"><CardTitle className="text-[15px]">Por formato</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto p-[16px] pt-0">
              <Table>
                <TableHeader><TableRow>{["Formato", "Posts", "% do total", "Alcance mediano", "Views mediano", "Salv./alcance", "Comp./alcance", "Taxa de pulo"].map(h => <TableHead key={h} className="whitespace-nowrap text-[12px]">{h}</TableHead>)}</TableRow></TableHeader>
                <TableBody>{calc.grupos.map(g => (
                  <TableRow key={g.nome} className="text-[12px]">
                    <TableCell>{g.nome}</TableCell>
                    <TableCell className="tabular-nums">{fmt(g.itens.length)}</TableCell>
                    <TableCell className="tabular-nums">{posts.length ? fmtPct((g.itens.length / posts.length) * 100) : "—"}</TableCell>
                    <TableCell className="tabular-nums">{fmt(median(g.itens.map(p => p.alcance)))}</TableCell>
                    <TableCell className="tabular-nums">{fmt(median(g.itens.map(p => p.views)))}</TableCell>
                    <TableCell className="tabular-nums">{fmtPct(median(g.itens.map(p => ratio(p.salvamentos, p.alcance))))}</TableCell>
                    <TableCell className="tabular-nums">{fmtPct(median(g.itens.map(p => ratio(p.compartilhamentos, p.alcance))))}</TableCell>
                    <TableCell className="tabular-nums">{g.reels ? fmtPct(median(g.itens.map(p => pulo(p.taxa_pulo)))) : "—"}</TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-[16px] pb-[8px]"><CardTitle className="text-[15px]">Por horário</CardTitle><CardDescription className="text-[12px]">Hora de Brasília; só horas com 3 posts ou mais.</CardDescription></CardHeader>
            <CardContent className="overflow-x-auto p-[16px] pt-0">
              {calc.porHora.length ? <Table>
                <TableHeader><TableRow>{["Hora", "Posts", "Alcance mediano", "Taxa de pulo mediana"].map(h => <TableHead key={h} className="whitespace-nowrap text-[12px]">{h}</TableHead>)}</TableRow></TableHeader>
                <TableBody>{calc.porHora.map(h => (
                  <TableRow key={h.h} className="text-[12px]">
                    <TableCell className="flex items-center gap-[6px]">{String(h.h).padStart(2, "0")}h{h.h === calc.melhor && <Badge className="text-[10px]">Melhor</Badge>}{h.h === calc.pior && <Badge variant="destructive" className="text-[10px]">Pior</Badge>}</TableCell>
                    <TableCell className="tabular-nums">{fmt(h.n)}</TableCell>
                    <TableCell className="tabular-nums">{fmt(h.alc)}</TableCell>
                    <TableCell className="tabular-nums">{fmtPct(h.pulo)}</TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table> : <p className="text-[12px] text-muted-foreground">—</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-[16px] pb-[8px]"><CardTitle className="text-[15px]">Posts</CardTitle></CardHeader>
            <CardContent className="space-y-[12px] overflow-x-auto p-[16px] pt-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="text-[12px]" />
                  <TableHead className="whitespace-nowrap text-[12px]"><button type="button" onClick={() => ordenar("publicado_em")} className="inline-flex items-center gap-[4px]">Data<ArrowUpDown className="h-[11px] w-[11px]" /></button></TableHead>
                  <TableHead className="text-[12px]">Formato</TableHead>
                  <TableHead className="text-[12px]">Legenda</TableHead>
                  <Th {...thp} k="views">Views</Th><Th {...thp} k="alcance">Alcance</Th><Th {...thp} k="salvamentos">Salv.</Th><Th {...thp} k="compartilhamentos">Comp.</Th><Th {...thp} k="interacoes">Interações</Th><Th {...thp} k="taxa_pulo">Pulo</Th><Th {...thp} k="tempo_medio_ms">Tempo médio (s)</Th>
                  <TableHead className="text-[12px]" />
                </TableRow></TableHeader>
                <TableBody>{visiveis.map(p => (
                  <TableRow key={p.media_id ?? p.permalink ?? ""} className="cursor-pointer text-[12px]" onClick={() => setAbertoId(p.media_id)}>
                    <TableCell><Thumb url={p.thumbnail_url} /></TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">{ddmmhhmm(p.publicado_brt)}</TableCell>
                    <TableCell className="whitespace-nowrap">{formato(p)}</TableCell>
                    <TableCell className="max-w-[260px]">
                      <div className="truncate">{p.legenda ?? "—"}</div>
                      {p.roteiro_id && <Badge variant="secondary" className="mt-[4px] text-[10px]">Pauta Viral: {p.roteiro_tema ?? "—"}</Badge>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(p.views)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(p.alcance)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(p.salvamentos)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(p.compartilhamentos)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(p.interacoes)}</TableCell>
                    <TableCell className="text-right tabular-nums">{isReels(p) ? fmtPct(pulo(p.taxa_pulo)) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{isReels(p) && p.tempo_medio_ms != null ? nf1.format(p.tempo_medio_ms / 1000) : "—"}</TableCell>
                    <TableCell>{p.permalink && <a href={p.permalink} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} aria-label="Abrir no Instagram"><ExternalLink className="h-[14px] w-[14px]" /></a>}</TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
              {!posts.length && <p className="text-[12px] text-muted-foreground">Nenhum post no período.</p>}
              {paginas > 1 && <div className="flex items-center justify-end gap-[8px] text-[12px]">
                <Button variant="outline" disabled={pagina === 0} onClick={() => setPage(pagina - 1)} className="h-[32px] px-[10px] text-[12px]">Anterior</Button>
                <span>{pagina + 1} / {paginas}</span>
                <Button variant="outline" disabled={pagina >= paginas - 1} onClick={() => setPage(pagina + 1)} className="h-[32px] px-[10px] text-[12px]">Próxima</Button>
              </div>}
            </CardContent>
          </Card>
        </>}

        <p className="text-[11px] text-muted-foreground">A Meta guarda as métricas da conta por 90 dias e as dos posts por 2 anos. O total de seguidores só tem histórico a partir da primeira sincronização. Cliques no link da bio não são mais entregues pela API. Stories não entram.</p>

        <Sheet open={!!aberto} onOpenChange={o => { if (!o) setAbertoId(null); }}>
          <SheetContent className="w-full overflow-y-auto sm:max-w-[520px]">
            {aberto && <>
              <SheetHeader><SheetTitle className="text-[15px]">{formato(aberto)} · {ddmmhhmm(aberto.publicado_brt)}</SheetTitle></SheetHeader>
              <div className="mt-[16px] space-y-[16px] text-[12px]">
                {aberto.roteiro_id && <Badge variant="secondary" className="text-[10px]">Pauta Viral: {aberto.roteiro_tema ?? "—"}</Badge>}
                <div className="grid grid-cols-2 gap-[8px]">
                  {([["Views", fmt(aberto.views)], ["Alcance", fmt(aberto.alcance)], ["Salvamentos", fmt(aberto.salvamentos)], ["Compartilhamentos", fmt(aberto.compartilhamentos)], ["Interações", fmt(aberto.interacoes)], ["Curtidas", fmt(aberto.curtidas)], ["Comentários", fmt(aberto.comentarios)], ["Taxa de pulo", isReels(aberto) ? fmtPct(pulo(aberto.taxa_pulo)) : "—"], ["Tempo médio (s)", isReels(aberto) && aberto.tempo_medio_ms != null ? nf1.format(aberto.tempo_medio_ms / 1000) : "—"]] as const).map(([k, v]) => (
                    <div key={k} className="rounded border p-[8px]"><div className="text-muted-foreground">{k}</div><div className="text-[14px] font-semibold tabular-nums">{v}</div></div>
                  ))}
                </div>
                <p className="whitespace-pre-wrap">{aberto.legenda ?? "—"}</p>
                {aberto.permalink && <a href={aberto.permalink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-[4px] underline">Abrir no Instagram<ExternalLink className="h-[12px] w-[12px]" /></a>}
                <div className="h-[220px]">
                  {curva.isLoading ? <Skeleton className="h-full w-full" /> : curva.data?.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={curva.data}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="dias_desde_post" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={v => nf.format(v)} />
                        <RTooltip formatter={(v: number) => fmt(v)} labelFormatter={l => `Dia ${l}`} contentStyle={{ fontSize: 12 }} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Line dataKey="views" name="Views" stroke="hsl(var(--muted-foreground))" dot={false} />
                        <Line dataKey="alcance" name="Alcance" stroke="hsl(var(--primary))" dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : <p className="text-muted-foreground">Sem curva diária para este post.</p>}
                </div>
              </div>
            </>}
          </SheetContent>
        </Sheet>
      </div>
    </TooltipProvider>
  );
}
