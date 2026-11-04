import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronDown, Copy, ExternalLink, Newspaper, Printer, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { Tables } from "@/integrations/supabase/types";

type Config = Tables<"pauta_viral_config">;
type Coleta = Tables<"pauta_viral_coletas">;
type Noticia = Tables<"pauta_viral_referencias">;
type Referencia = Pick<Noticia, "url" | "dono" | "tipo" | "titulo" | "cobertura" | "fontes_noticia" | "views" | "views_estimadas" | "curtidas" | "comentarios" | "publicado_em">;
type Roteiro = Tables<"pauta_viral_roteiros"> & { referencia: Referencia | null; coleta?: { gatilho: string } | null };

const ABERTAS = ["iniciando", "coletando", "importando", "importada", "gerando"];
const PILARES: Record<string, string> = { boletim_credito: "Boletim do Crédito", obra_com_numero: "Obra com número", o_que_eu_nao_faria: "O que eu não faria" };
const STATUS: Record<string, string> = { nova: "Nova", aprovada: "Aprovada", gravada: "Gravada", publicada: "Publicada", descartada: "Descartada" };
const FILTROS_STATUS = [
  { value: "abertas", label: "Novas e aprovadas" }, { value: "gravada", label: "Gravadas" }, { value: "publicada", label: "Publicadas" },
  { value: "descartada", label: "Descartadas" }, { value: "todas", label: "Todas" },
];
const LIMITES = { hashtags: 20, perfis: 30, termos_noticias: 15 } as const;

const RECOLHIDOS_KEY = "pauta-viral:lotes-recolhidos";
const lerRecolhidos = (): string[] | null => {
  try {
    const bruto = localStorage.getItem(RECOLHIDOS_KEY);
    if (!bruto) return null;
    const l = JSON.parse(bruto);
    return Array.isArray(l) ? l.filter((x): x is string => typeof x === "string") : null;
  } catch { return null; }
};
const gravarRecolhidos = (lotes: string[]) => {
  try { localStorage.setItem(RECOLHIDOS_KEY, JSON.stringify(lotes.slice(0, 30))); } catch { /* sem localStorage */ }
};
const resumoStatus = (itens: Roteiro[]) => Object.entries(STATUS)
  .map(([k, rot]) => { const n = itens.filter(r => r.status === k).length; return n ? `${n} ${rot.toLowerCase()}${n > 1 ? "s" : ""}` : null; })
  .filter(Boolean).join(" · ");

const ddmm = (iso?: string | null) => iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" }) : "";
const ddmmData = (d: string) => { const [, m, dia] = d.split("-"); return `${dia}/${m}`; };
const hhmm = (iso?: string | null) => iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }) : "";
const fmtNum = (n?: number | null) => (n ?? 0).toLocaleString("pt-BR");
const lista = (v: unknown): string[] => Array.isArray(v) ? v.map(x => typeof x === "string" ? x : JSON.stringify(x)) : [];

type Fonte = { titulo: string; url?: string; veiculo?: string };
const fontes = (v: unknown): Fonte[] => Array.isArray(v) ? v.map(x => {
  if (typeof x === "string") return { titulo: x };
  const o = (x ?? {}) as Record<string, unknown>;
  return { titulo: String(o.titulo ?? o.title ?? o.manchete ?? ""), url: o.url ? String(o.url) : undefined, veiculo: (o.veiculo ?? o.fonte ?? o.dono) ? String(o.veiculo ?? o.fonte ?? o.dono) : undefined };
}).filter(f => f.titulo) : [];

async function chamar(body: Record<string, unknown>): Promise<boolean> {
  const { data, error } = await supabase.functions.invoke("pauta-viral", { body });
  if (error) {
    let msg = "Não foi possível falar com a Pauta Viral. Tente de novo.";
    try {
      const ctx = (error as { context?: { json?: () => Promise<{ error?: string; motivo?: string }> } }).context;
      const j = ctx?.json ? await ctx.json() : null;
      if (j?.error || j?.motivo) msg = String(j.error ?? j.motivo);
    } catch { /* mensagem genérica */ }
    toast.error(msg);
    return false;
  }
  if (data?.ok === false) { toast.error(data.motivo ?? "A ação não foi feita."); return false; }
  return true;
}

const RE_LINK_COM_PERFIL = /instagram\.com\/[^/?#]+\/(p|reel|reels|tv)\//i;

function RoteiroDoLink({ travado, ocupado, setOcupado, refazer }: { travado: boolean; ocupado: boolean; setOcupado: (v: boolean) => void; refazer: () => void }) {
  const [url, setUrl] = useState("");
  const [autor, setAutor] = useState("");
  const [pedido, setPedido] = useState("");
  const [texto, setTexto] = useState("");
  const [abrirTexto, setAbrirTexto] = useState(false);
  const [pedirAutor, setPedirAutor] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const autorRef = useRef<HTMLInputElement>(null);
  const linkSemPerfil = url.trim() !== "" && !RE_LINK_COM_PERFIL.test(url.trim());
  const mostrarAutor = linkSemPerfil || pedirAutor;

  const enviar = async () => {
    setEnviando(true); setOcupado(true);
    try {
      const body: Record<string, unknown> = { acao: "link", url: url.trim() };
      const a = autor.trim().replace(/^@/, "");
      if (a) body.autor = a;
      if (texto.trim()) body.texto = texto.trim();
      if (pedido.trim()) body.pedido = pedido.trim();
      const { data, error } = await supabase.functions.invoke("pauta-viral", { body });
      if (error) {
        let msg = "Não foi possível falar com a Pauta Viral. Tente de novo.";
        try {
          const ctx = (error as { context?: { json?: () => Promise<{ error?: string; motivo?: string }> } }).context;
          const j = ctx?.json ? await ctx.json() : null;
          if (j?.error || j?.motivo) msg = String(j.error ?? j.motivo);
        } catch { /* mensagem genérica */ }
        toast.error(msg);
        return;
      }
      if (data?.ok === false) {
        toast.error(data.motivo ?? "Não foi possível ler o link.");
        if (data.campo === "autor") { setPedirAutor(true); setTimeout(() => autorRef.current?.focus(), 0); }
        return;
      }
      const avisos = Array.isArray(data?.avisos) ? data.avisos.join(" · ") : data?.avisos ? String(data.avisos) : "";
      const leu = data?.leu as { lido?: boolean; fala?: boolean; sem_video?: boolean; buscando_fala?: boolean } | undefined;
      const msg = leu?.buscando_fala
        ? (leu.lido ? "Post lido. Baixando o vídeo para ouvir a fala (1 a 3 min)…" : "Buscando o post pelo Apify (1 a 3 min)…")
        : (leu?.fala === false ? "Post lido. Gerando o roteiro… (sem a fala do vídeo)" : "Post lido. Gerando o roteiro…");
      toast.success(msg, avisos ? { description: avisos } : undefined);
      setUrl(""); setAutor(""); setPedido(""); setTexto(""); setPedirAutor(false); setAbrirTexto(false);
      refazer();
    } finally { setEnviando(false); setOcupado(false); }
  };

  return <Card>
    <CardHeader className="p-[16px] pb-[8px]"><CardTitle className="text-[15px]">Roteiro a partir de link</CardTitle></CardHeader>
    <CardContent className="space-y-[12px] p-[16px] pt-0 text-[13px]">
      <div className="flex flex-col gap-[12px] md:flex-row">
        <label className="flex min-w-0 flex-1 flex-col gap-[4px]">
          <span className="text-[12px] text-muted-foreground">Link do post ou Reel</span>
          <Input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://www.instagram.com/reel/…" className="h-[36px] text-[13px]" />
        </label>
        {mostrarAutor && <label className="flex flex-col gap-[4px] md:w-[200px]">
          <span className="text-[12px] text-muted-foreground">@ do perfil</span>
          <Input ref={autorRef} value={autor} onChange={e => setAutor(e.target.value)} placeholder="perfil, sem @ (opcional)" className="h-[36px] text-[13px]" />
        </label>}
      </div>
      <label className="flex flex-col gap-[4px]">
        <span className="text-[12px] text-muted-foreground">Orientação para a IA (opcional)</span>
        <Input value={pedido} maxLength={400} onChange={e => setPedido(e.target.value.slice(0, 400))} placeholder="Ex.: foca em crédito para quem constrói" className="h-[36px] text-[13px]" />
      </label>
      <Collapsible open={abrirTexto} onOpenChange={setAbrirTexto}>
        <CollapsibleTrigger className="inline-flex items-center gap-[4px] text-[12px] text-primary">
          <ChevronDown className={`h-[14px] w-[14px] transition-transform ${abrirTexto ? "rotate-180" : ""}`} />Colar o texto do vídeo
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-[6px] pt-[8px]">
          <p className="text-[12px] text-muted-foreground">Use se o perfil for pessoal, se a música for licenciada ou se a leitura falhar: cole a legenda e/ou o que a pessoa fala.</p>
          <Textarea value={texto} maxLength={6000} onChange={e => setTexto(e.target.value.slice(0, 6000))} rows={5} className="text-[13px]" />
          <p className="text-right text-[11px] text-muted-foreground">{texto.length.toLocaleString("pt-BR")}/6.000</p>
        </CollapsibleContent>
      </Collapsible>
      <Button disabled={!url.trim() || enviando || travado || ocupado} onClick={enviar} className="h-[36px] px-[12px] text-[12px]">
        {enviando ? "Lendo o post… (até 1 min)" : "Gerar roteiro do link"}
      </Button>
    </CardContent>
  </Card>;
}

function textoRoteiro(r: Roteiro) {
  const pts = lista(r.pontos).map((p, i) => `${i + 1}. ${p}`).join("\n");
  const conf = lista(r.conferir);
  return [
    `TEMA: ${r.tema}`, `GANCHO A: ${r.gancho_a}`, `GANCHO B: ${r.gancho_b}`, `PONTOS:\n${pts}`,
    `FECHAMENTO: ${r.fechamento}`, `CTA: ${r.cta}`, `TEXTO NA TELA: ${r.texto_tela}`, `LEGENDA: ${r.legenda}`,
    conf.length ? `CONFERIR:\n${conf.map(c => `- ${c}`).join("\n")}` : "",
  ].filter(Boolean).join("\n\n");
}

const copiar = async (texto: string, ok = "Copiado") => {
  try { await navigator.clipboard.writeText(texto); toast.success(ok); } catch { toast.error("Não foi possível copiar."); }
};

function linhaColeta(c: Coleta) {
  if (c.status === "iniciando") return "Iniciando…";
  if (c.gatilho === "link" && c.status === "importando") return "Lendo o post do link…";
  if (c.gatilho === "link" && (c.status === "importada" || c.status === "gerando")) return "Gerando o roteiro do link…";
  if (c.gatilho === "link" && c.status === "coletando") return "Lendo o vídeo do link…";
  if (c.status === "coletando" || c.status === "importando") return "Coletando no Instagram e nas notícias…";
  if (c.status === "importada" || c.status === "gerando") return "Gerando roteiros…";
  if (c.status === "concluida") return (c.roteiros_gerados ?? 0) === 0 ? `Nenhuma referência nova · ${hhmm(c.atualizada_em)}` : `Pronta: ${c.roteiros_gerados} roteiros às ${hhmm(c.atualizada_em)}`;
  return c.status;
}

export function PautaViral() {
  const { user } = useAuth();
  const { data: pode, isLoading } = useQuery({
    queryKey: ["pauta-viral-pode", user?.id],
    enabled: !!user?.id,
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("pauta_viral_pode", { p_user: user!.id });
      if (error) throw error;
      return data === true;
    },
  });
  if (isLoading || !user) return <Skeleton className="h-[120px] w-full" />;
  if (!pode) return <Card><CardContent className="p-[24px] text-[13px] text-muted-foreground">Sem acesso à Pauta Viral</CardContent></Card>;
  return <PautaViralConteudo />;
}

function PautaViralConteudo() {
  const qc = useQueryClient();
  const [filtroStatus, setFiltroStatus] = useState("abertas");
  const [filtroPilar, setFiltroPilar] = useState("todos");
  const [ocupado, setOcupado] = useState(false);
  const [imprimir, setImprimir] = useState(false);
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const [pronto, setPronto] = useState(false);

  const configQ = useQuery({
    queryKey: ["pauta-viral", "config"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pauta_viral_config").select("*").eq("id", 1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const config = configQ.data;

  const coletaQ = useQuery({
    queryKey: ["pauta-viral", "coleta"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pauta_viral_coletas").select("*").order("iniciada_em", { ascending: false }).limit(1);
      if (error) throw error;
      return (data?.[0] ?? null) as Coleta | null;
    },
  });
  const coleta = coletaQ.data;
  const aberta = !!coleta && ABERTAS.includes(coleta.status);

  const roteirosQ = useQuery({
    queryKey: ["pauta-viral", "roteiros"],
    queryFn: async () => {
      const desde = new Date(Date.now() - 60 * 86400000).toISOString();
      const { data, error } = await supabase.from("pauta_viral_roteiros")
        .select("*, referencia:pauta_viral_referencias(url, dono, tipo, titulo, cobertura, fontes_noticia, views, views_estimadas, curtidas, comentarios, publicado_em), coleta:pauta_viral_coletas(gatilho)")
        .gte("criado_em", desde)
        .order("lote", { ascending: false }).order("criado_em", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Roteiro[];
    },
  });

  const noticiasQ = useQuery({
    queryKey: ["pauta-viral", "noticias", config?.janela_noticias_dias],
    enabled: !!config,
    queryFn: async () => {
      const desde = new Date(Date.now() - (config!.janela_noticias_dias ?? 3) * 86400000).toISOString();
      const { data, error } = await supabase.from("pauta_viral_referencias").select("*")
        .eq("tipo", "noticia").gte("publicado_em", desde).order("score", { ascending: false }).limit(30);
      if (error) throw error;
      return (data ?? []) as Noticia[];
    },
  });

  const refazer = () => qc.invalidateQueries({ queryKey: ["pauta-viral"] });

  useEffect(() => {
    if (!aberta) return;
    const t = window.setInterval(async () => {
      await supabase.functions.invoke("pauta-viral", { body: { acao: "tick" } }).catch(() => null);
      refazer();
    }, 20000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberta]);

  const acao = async (body: Record<string, unknown>, ok: string) => {
    setOcupado(true);
    try { if (await chamar(body)) toast.success(ok); } finally { setOcupado(false); refazer(); }
  };

  const roteiros = roteirosQ.data ?? [];
  const filtrados = roteiros.filter(r =>
    (filtroStatus === "todas" || (filtroStatus === "abertas" ? r.status === "nova" || r.status === "aprovada" : r.status === filtroStatus)) &&
    (filtroPilar === "todos" || r.pilar === filtroPilar));
  const lotes = useMemo(() => {
    const m = new Map<string, Roteiro[]>();
    filtrados.forEach(r => { const k = r.lote; m.set(k, [...(m.get(k) ?? []), r]); });
    return [...m.entries()];
  }, [filtrados]);
  const lotesTodos = useMemo(() => {
    const vistos = new Set<string>(); const ordem: string[] = [];
    roteiros.forEach(r => { if (!vistos.has(r.lote)) { vistos.add(r.lote); ordem.push(r.lote); } });
    return ordem;
  }, [roteiros]);

  useEffect(() => {
    if (pronto || lotesTodos.length === 0) return;
    const recolhidos = lerRecolhidos();
    setAbertos(recolhidos ? new Set(lotesTodos.filter(l => !recolhidos.includes(l))) : new Set(lotesTodos.slice(0, 1)));
    setPronto(true);
  }, [lotesTodos, pronto]);

  const topo = lotesTodos[0] ?? "";
  useEffect(() => {
    if (!pronto || !topo) return;
    setAbertos(prev => prev.has(topo) ? prev : new Set(prev).add(topo));
  }, [topo, pronto]);

  useEffect(() => {
    if (!pronto) return;
    gravarRecolhidos(lotesTodos.filter(l => !abertos.has(l)));
  }, [abertos, lotesTodos, pronto]);

  const alternarLote = (lote: string) => setAbertos(prev => {
    const s = new Set(prev);
    if (s.has(lote)) s.delete(lote); else s.add(lote);
    return s;
  });
  const algumAberto = lotes.some(([l]) => abertos.has(l));
  const alternarTodos = () => setAbertos(prev => {
    const s = new Set(prev);
    lotes.forEach(([l]) => { if (algumAberto) s.delete(l); else s.add(l); });
    return s;
  });

  const aprovados = roteiros.filter(r => r.status === "aprovada");
  const travado = aberta || ocupado;

  if (imprimir) return <VisaoImpressao roteiros={aprovados} onFechar={() => setImprimir(false)} />;

  return <div className="space-y-[20px]">
    <header className="flex flex-wrap items-start justify-between gap-[16px]">
      <div className="min-w-0 space-y-[6px]">
        <h2 className="text-[20px] font-semibold leading-tight">Pauta Viral</h2>
        <p className="text-[13px] leading-[1.6] text-muted-foreground">Os vídeos que mais viralizaram no nicho e as notícias do mercado, adaptados para o Diego gravar</p>
      </div>
      <div className="flex flex-wrap gap-[8px]">
        <Button disabled={travado} onClick={() => acao({ acao: "coletar" }, "Coleta iniciada")} className="h-[36px] px-[12px] text-[12px]">Buscar virais e notícias agora</Button>
        <Button variant="outline" disabled={travado} onClick={() => acao({ acao: "gerar" }, "Gerando roteiros")} className="h-[36px] px-[12px] text-[12px]">Gerar roteiros com o que já tenho</Button>
      </div>
    </header>

    <RoteiroDoLink travado={travado} ocupado={ocupado} setOcupado={setOcupado} refazer={refazer} />

    {coleta && <div className="space-y-[4px] text-[12px]">
      {coleta.status === "erro"
        ? <p className="text-destructive">Erro: {coleta.erro}</p>
        : <p className="text-foreground">{linhaColeta(coleta)}</p>}
      {coleta.status === "concluida" && coleta.erro && <p className="text-amber-600 dark:text-amber-400">{coleta.erro}</p>}
      {coleta.avisos && <p className="text-muted-foreground">{coleta.avisos}</p>}
    </div>}

    <div className="flex flex-wrap items-center gap-[12px]">
      <Select value={filtroStatus} onValueChange={setFiltroStatus}>
        <SelectTrigger aria-label="Status" className="h-[36px] w-[190px] px-[10px] text-[12px]"><SelectValue /></SelectTrigger>
        <SelectContent>{FILTROS_STATUS.map(f => <SelectItem key={f.value} value={f.value} className="py-[8px] text-[12px]">{f.label}</SelectItem>)}</SelectContent>
      </Select>
      <Select value={filtroPilar} onValueChange={setFiltroPilar}>
        <SelectTrigger aria-label="Pilar" className="h-[36px] w-[190px] px-[10px] text-[12px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="todos" className="py-[8px] text-[12px]">Todos</SelectItem>
          {Object.entries(PILARES).map(([v, l]) => <SelectItem key={v} value={v} className="py-[8px] text-[12px]">{l}</SelectItem>)}
        </SelectContent>
      </Select>
      <Button variant="outline" disabled={!aprovados.length} onClick={() => setImprimir(true)} className="h-[36px] px-[12px] text-[12px]"><Printer className="mr-[6px] h-[14px] w-[14px]" />Imprimir aprovados</Button>
      <Button variant="ghost" onClick={alternarTodos} className="h-[36px] px-[12px] text-[12px]">{algumAberto ? "Recolher todos" : "Abrir todos"}</Button>
    </div>

    {roteirosQ.isLoading ? <Skeleton className="h-[200px] w-full" />
      : roteiros.length === 0 ? <Card><CardContent className="p-[24px] text-[13px] text-muted-foreground">Nenhum roteiro ainda. Clique em Buscar virais e notícias agora.</CardContent></Card>
      : lotes.length === 0 ? <p className="text-[13px] text-muted-foreground">Nenhum roteiro com esses filtros.</p>
      : lotes.map(([lote, itens]) => {
        const aberto = abertos.has(lote);
        const resumo = resumoStatus(itens);
        return <Collapsible key={lote} open={aberto} onOpenChange={() => alternarLote(lote)}>
          <CollapsibleTrigger asChild>
            <button aria-expanded={aberto} className="flex w-full items-start gap-[8px] text-left">
              <span className="min-w-0 flex-1">
                <span className="text-[15px] font-semibold">Lote de {ddmmData(lote)} · {itens.length} roteiro{itens.length > 1 ? "s" : ""}</span>
                {resumo && <span className="ml-[6px] text-[12px] font-normal text-muted-foreground">{resumo}</span>}
              </span>
              <ChevronDown className={`mt-[3px] h-[16px] w-[16px] shrink-0 transition-transform ${aberto ? "rotate-180" : ""}`} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="grid grid-cols-1 gap-[16px] pt-[12px] xl:grid-cols-2">{itens.map(r => <RoteiroCard key={r.id} r={r} onMudou={refazer} />)}</div>
          </CollapsibleContent>
        </Collapsible>;
      })}

    <Noticias noticias={noticiasQ.data ?? []} loading={configQ.isLoading || noticiasQ.isLoading} travado={travado}
      onVirar={code => acao({ acao: "gerar", referencias: [code] }, "Gerando roteiro da notícia")} />

    {config && <Fontes config={config} onSalvo={refazer} />}
  </div>;
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return <div className="space-y-[6px]"><p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{titulo}</p>{children}</div>;
}

function RoteiroCard({ r, onMudou }: { r: Roteiro; onMudou: () => void }) {
  const [modo, setModo] = useState<null | "publicada" | "descartada">(null);
  const [campo, setCampo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const ref = r.referencia;
  const pontos = lista(r.pontos);
  const conferir = lista(r.conferir);

  const mudar = async (status: string, url?: string, obs?: string) => {
    setSalvando(true);
    const { error } = await supabase.rpc("pauta_viral_mudar_status", { p_roteiro_id: r.id, p_status: status, p_url: url, p_observacao: obs });
    setSalvando(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Marcado como ${STATUS[status]?.toLowerCase() ?? status}`);
    setModo(null); setCampo(""); onMudou();
  };

  return <Card className="min-w-0">
    <CardHeader className="space-y-[8px] p-[16px] pb-[8px]">
      <div className="flex flex-wrap items-center gap-[6px]">
        <Badge variant="secondary" className="text-[11px]">{PILARES[r.pilar] ?? r.pilar}</Badge>
        {r.coleta?.gatilho === "link" && <Badge variant="outline" className="text-[11px]">Do link</Badge>}
        {r.duracao_estimada_s != null && <span className="text-[11px] text-muted-foreground">~{r.duracao_estimada_s} s</span>}
        <Badge variant={r.status === "descartada" ? "outline" : "default"} className="ml-auto text-[11px]">{STATUS[r.status] ?? r.status}</Badge>
      </div>
      <CardTitle className="text-[16px] leading-snug">{r.tema}</CardTitle>
    </CardHeader>
    <CardContent className="space-y-[14px] p-[16px] pt-0 text-[13px] leading-[1.55]">
      {ref && <Bloco titulo="Referência">
        <a href={ref.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-start gap-[6px] text-primary underline-offset-2 hover:underline">
          {ref.tipo === "noticia"
            ? <><Newspaper className="mt-[3px] h-[14px] w-[14px] shrink-0" /><span>Notícia · {ref.dono} · {ref.cobertura ?? 1} veículos{ref.titulo ? <> — {ref.titulo}</> : null}</span></>
            : ref.views == null ? <span>@{ref.dono}</span> : <span>@{ref.dono} · {ref.views_estimadas ? `~${fmtNum(ref.views)} views (estimado)` : `${fmtNum(ref.views)} views`}</span>}
          <ExternalLink className="mt-[3px] h-[12px] w-[12px] shrink-0" />
        </a>
        {r.por_que_viralizou && <p className="text-[12px] text-muted-foreground"><span className="font-medium">Por que viralizou:</span> {r.por_que_viralizou}</p>}
        {r.o_que_adaptamos && <p className="text-[12px] text-muted-foreground"><span className="font-medium">O que adaptamos:</span> {r.o_que_adaptamos}</p>}
      </Bloco>}

      <Bloco titulo="Ele fala">
        <p><span className="text-muted-foreground">Gancho A: </span><strong>{r.gancho_a}</strong></p>
        <p><span className="text-muted-foreground">Gancho B: </span><strong>{r.gancho_b}</strong></p>
        {pontos.length > 0 && <ol className="list-decimal space-y-[2px] pl-[20px]">{pontos.map((p, i) => <li key={i}>{p}</li>)}</ol>}
        <p><span className="text-muted-foreground">Fechamento: </span>{r.fechamento}</p>
        <p><span className="text-muted-foreground">CTA: </span><strong>{r.cta}</strong></p>
      </Bloco>

      <Bloco titulo="Operador depois">
        <p><span className="text-muted-foreground">Texto na tela: </span>{r.texto_tela}</p>
        <div className="flex items-start gap-[8px]">
          <p className="min-w-0 flex-1 whitespace-pre-wrap"><span className="text-muted-foreground">Legenda: </span>{r.legenda}</p>
          <Button size="sm" variant="ghost" aria-label="Copiar legenda" onClick={() => copiar(r.legenda, "Legenda copiada")} className="h-[28px] px-[8px]"><Copy className="h-[13px] w-[13px]" /></Button>
        </div>
      </Bloco>

      {conferir.length > 0 && <div className="rounded-md border border-amber-300 bg-amber-50 p-[10px] text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
        <p className="mb-[4px] text-[12px] font-semibold">Conferir antes de gravar</p>
        <ul className="list-disc space-y-[2px] pl-[18px] text-[12px]">{conferir.map((c, i) => <li key={i}>{c}</li>)}</ul>
      </div>}

      {modo && <div className="space-y-[8px] rounded-md border border-border p-[10px]">
        <Input autoFocus value={campo} onChange={e => setCampo(e.target.value)} placeholder={modo === "publicada" ? "Cole a URL do post" : "Observação (opcional)"} className="h-[36px] text-[12px]" />
        <div className="flex gap-[8px]">
          <Button size="sm" disabled={salvando || (modo === "publicada" && !campo.trim())}
            onClick={() => modo === "publicada" ? mudar("publicada", campo.trim()) : mudar("descartada", undefined, campo.trim() || undefined)}
            className="h-[32px] text-[12px]">Confirmar</Button>
          <Button size="sm" variant="ghost" onClick={() => { setModo(null); setCampo(""); }} className="h-[32px] text-[12px]">Cancelar</Button>
        </div>
      </div>}

      <div className="flex flex-wrap gap-[6px] border-t border-border pt-[12px]">
        <Button size="sm" variant="outline" disabled={salvando || r.status === "aprovada"} onClick={() => mudar("aprovada")} className="h-[32px] text-[12px]">Aprovar</Button>
        <Button size="sm" variant="outline" disabled={salvando || r.status === "gravada"} onClick={() => mudar("gravada")} className="h-[32px] text-[12px]">Gravado</Button>
        <Button size="sm" variant="outline" disabled={salvando} onClick={() => { setModo("publicada"); setCampo(r.url_publicada ?? ""); }} className="h-[32px] text-[12px]">Publicado</Button>
        <Button size="sm" variant="outline" disabled={salvando} onClick={() => { setModo("descartada"); setCampo(""); }} className="h-[32px] text-[12px]">Descartar</Button>
        <Button size="sm" variant="ghost" onClick={() => copiar(textoRoteiro(r), "Roteiro copiado")} className="ml-auto h-[32px] text-[12px]"><Copy className="mr-[6px] h-[13px] w-[13px]" />Copiar roteiro</Button>
      </div>
    </CardContent>
  </Card>;
}

function Noticias({ noticias, loading, travado, onVirar }: { noticias: Noticia[]; loading: boolean; travado: boolean; onVirar: (code: string) => void }) {
  const [aberto, setAberto] = useState(true);
  return <Collapsible open={aberto} onOpenChange={setAberto}>
    <Card>
      <CollapsibleTrigger asChild>
        <button className="flex w-full items-center justify-between p-[16px] text-left">
          <span className="text-[15px] font-semibold">Notícias do mercado</span>
          <ChevronDown className={`h-[16px] w-[16px] transition-transform ${aberto ? "rotate-180" : ""}`} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <CardContent className="p-[16px] pt-0">
          {loading ? <Skeleton className="h-[80px] w-full" />
            : noticias.length === 0 ? <p className="text-[13px] text-muted-foreground">Nenhuma notícia na janela configurada.</p>
            : <TooltipProvider delayDuration={200}><ul className="divide-y divide-border">{noticias.map(n => <NoticiaLinha key={n.id} n={n} travado={travado} onVirar={onVirar} />)}</ul></TooltipProvider>}
        </CardContent>
      </CollapsibleContent>
    </Card>
  </Collapsible>;
}

function NoticiaLinha({ n, travado, onVirar }: { n: Noticia; travado: boolean; onVirar: (code: string) => void }) {
  const [mais, setMais] = useState(false);
  const outras = fontes(n.fontes_noticia).filter(f => f.titulo !== n.titulo);
  return <li className="flex flex-col gap-[8px] py-[10px] text-[13px] sm:flex-row sm:items-start">
    <span className="w-[44px] shrink-0 text-[12px] text-muted-foreground">{ddmm(n.publicado_em)}</span>
    <div className="min-w-0 flex-1 space-y-[4px]">
      <a href={n.url} target="_blank" rel="noopener noreferrer" className="text-primary underline-offset-2 hover:underline">{n.titulo ?? n.url}</a>
      <div className="flex flex-wrap items-center gap-[6px] text-[12px] text-muted-foreground">
        {n.dono && <span>{n.dono}</span>}
        {(n.cobertura ?? 0) >= 2 && <Badge variant="secondary" className="text-[11px]">{n.cobertura} veículos</Badge>}
        {outras.length > 0 && <button className="underline underline-offset-2" onClick={() => setMais(v => !v)}>{mais ? "ver menos" : "ver mais"}</button>}
      </div>
      {mais && <ul className="space-y-[2px] pl-[12px] text-[12px] text-muted-foreground">{outras.map((f, i) => <li key={i}>
        {f.url ? <a href={f.url} target="_blank" rel="noopener noreferrer" className="hover:underline">{f.titulo}</a> : f.titulo}{f.veiculo ? ` · ${f.veiculo}` : ""}
      </li>)}</ul>}
    </div>
    <div className="flex shrink-0 flex-wrap items-center gap-[6px]">
      {n.usada && <Badge className="text-[11px]">Virou roteiro</Badge>}
      {n.descartada && <Tooltip><TooltipTrigger asChild><span tabIndex={0}><Badge variant="outline" className="text-[11px] text-muted-foreground">Descartada pela IA</Badge></span></TooltipTrigger>
        <TooltipContent className="max-w-[300px] text-[11px]">{n.motivo_descarte ?? "Sem motivo registrado"}</TooltipContent></Tooltip>}
      {!n.usada && <Button size="sm" variant="outline" disabled={travado} onClick={() => onVirar(n.short_code)} className="h-[30px] text-[12px]">Virar roteiro</Button>}
    </div>
  </li>;
}

function VisaoImpressao({ roteiros, onFechar }: { roteiros: Roteiro[]; onFechar: () => void }) {
  return <div className="space-y-[16px]">
    <div className="flex gap-[8px] print:hidden">
      <Button onClick={() => window.print()} className="h-[36px] text-[12px]"><Printer className="mr-[6px] h-[14px] w-[14px]" />Imprimir</Button>
      <Button variant="ghost" onClick={onFechar} className="h-[36px] text-[12px]"><X className="mr-[6px] h-[14px] w-[14px]" />Voltar</Button>
    </div>
    {roteiros.map(r => {
      const conferir = lista(r.conferir);
      return <article key={r.id} className="space-y-[12px] text-[16px] leading-[1.6] [break-after:page]">
        <h2 className="text-[22px] font-semibold">{r.tema}</h2>
        <p><strong>Gancho A:</strong> {r.gancho_a}</p>
        <p><strong>Gancho B:</strong> {r.gancho_b}</p>
        <ol className="list-decimal pl-[24px]">{lista(r.pontos).map((p, i) => <li key={i}>{p}</li>)}</ol>
        <p><strong>Fechamento:</strong> {r.fechamento}</p>
        <p><strong>CTA:</strong> {r.cta}</p>
        <p><strong>Texto na tela:</strong> {r.texto_tela}</p>
        {conferir.length > 0 && <div><strong>Conferir:</strong><ul className="list-disc pl-[24px]">{conferir.map((c, i) => <li key={i}>{c}</li>)}</ul></div>}
      </article>;
    })}
  </div>;
}

type Form = Pick<Config, "ativo" | "hora_lote" | "roteiros_por_lote" | "min_noticias_por_lote" | "instagram_ativo" | "hashtags" | "perfis" | "min_views" | "janela_dias" | "posts_por_hashtag" | "posts_por_perfil" | "noticias_ativo" | "termos_noticias" | "janela_noticias_dias">;
const paraForm = (c: Config): Form => ({
  ativo: c.ativo, hora_lote: c.hora_lote, roteiros_por_lote: c.roteiros_por_lote, min_noticias_por_lote: c.min_noticias_por_lote,
  instagram_ativo: c.instagram_ativo, hashtags: c.hashtags ?? [], perfis: c.perfis ?? [], min_views: c.min_views, janela_dias: c.janela_dias,
  posts_por_hashtag: c.posts_por_hashtag, posts_por_perfil: c.posts_por_perfil, noticias_ativo: c.noticias_ativo,
  termos_noticias: c.termos_noticias ?? [], janela_noticias_dias: c.janela_noticias_dias,
});

function Chips({ valores, onChange, limpar, limite, rotulo }: { valores: string[]; onChange: (v: string[]) => void; limpar: (s: string) => string; limite: number; rotulo: string }) {
  const [novo, setNovo] = useState("");
  const add = () => {
    const v = limpar(novo.trim()); if (!v) return;
    if (!valores.includes(v)) onChange([...valores, v]);
    setNovo("");
  };
  return <div className="space-y-[6px]">
    <p className="text-[12px] text-muted-foreground">{rotulo} ({valores.length}/{limite})</p>
    <div className="flex flex-wrap gap-[6px]">{valores.map(v => <Badge key={v} variant="secondary" className="gap-[4px] text-[11px]">{v}
      <button aria-label={`Remover ${v}`} onClick={() => onChange(valores.filter(x => x !== v))}><X className="h-[11px] w-[11px]" /></button></Badge>)}</div>
    <div className="flex gap-[6px]">
      <Input value={novo} onChange={e => setNovo(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(); } }} className="h-[34px] max-w-[260px] text-[12px]" placeholder="Adicionar e Enter" />
      <Button size="sm" variant="outline" onClick={add} className="h-[34px] text-[12px]">Adicionar</Button>
    </div>
    {valores.length > limite && <p className="text-[11px] text-destructive">Máximo de {limite}. Remova {valores.length - limite} para salvar.</p>}
  </div>;
}

function Num({ rotulo, valor, min, max, onChange }: { rotulo: string; valor: number; min: number; max?: number; onChange: (n: number) => void }) {
  return <label className="space-y-[4px] text-[12px] text-muted-foreground">{rotulo}{max != null ? ` (${min}–${max})` : ` (≥ ${min})`}
    <Input type="number" min={min} max={max} value={valor} onChange={e => onChange(Number(e.target.value))} className="h-[34px] w-[140px] text-[12px] text-foreground" />
  </label>;
}

function Liga({ rotulo, valor, onChange }: { rotulo: string; valor: boolean; onChange: (b: boolean) => void }) {
  return <label className="flex items-center gap-[8px] text-[13px]"><Switch checked={valor} onCheckedChange={onChange} />{rotulo}</label>;
}

function Fontes({ config, onSalvo }: { config: Config; onSalvo: () => void }) {
  const [form, setForm] = useState<Form>(() => paraForm(config));
  const [salvando, setSalvando] = useState(false);
  useEffect(() => { setForm(paraForm(config)); }, [config.atualizado_em]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm(f => ({ ...f, [k]: v }));
  const dentro = (n: number, a: number, b?: number) => Number.isInteger(n) && n >= a && (b == null || n <= b);
  const valido = dentro(form.hora_lote, 0, 23) && dentro(form.roteiros_por_lote, 1, 10) && dentro(form.min_noticias_por_lote, 0, 5)
    && dentro(form.min_views, 0) && dentro(form.janela_dias, 1, 60) && dentro(form.posts_por_hashtag, 5, 100) && dentro(form.posts_por_perfil, 3, 50)
    && dentro(form.janela_noticias_dias, 1, 7)
    && form.hashtags.length <= LIMITES.hashtags && form.perfis.length <= LIMITES.perfis && form.termos_noticias.length <= LIMITES.termos_noticias;

  const salvar = async () => {
    setSalvando(true);
    const { error } = await supabase.from("pauta_viral_config").update(form).eq("id", 1);
    setSalvando(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Fontes salvas");
    onSalvo();
  };

  return <Collapsible>
    <Card>
      <CollapsibleTrigger asChild>
        <button className="flex w-full items-center justify-between p-[16px] text-left"><span className="text-[15px] font-semibold">Fontes</span><ChevronDown className="h-[16px] w-[16px]" /></button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <CardContent className="space-y-[20px] p-[16px] pt-0">
          <Bloco titulo="Geral">
            <Liga rotulo="Coleta diária automática" valor={form.ativo} onChange={v => set("ativo", v)} />
            <div className="flex flex-wrap gap-[12px]">
              <Num rotulo="Hora do lote (Brasília)" valor={form.hora_lote} min={0} max={23} onChange={v => set("hora_lote", v)} />
              <Num rotulo="Roteiros por lote" valor={form.roteiros_por_lote} min={1} max={10} onChange={v => set("roteiros_por_lote", v)} />
              <Num rotulo="Mín. roteiros de notícia" valor={form.min_noticias_por_lote} min={0} max={5} onChange={v => set("min_noticias_por_lote", v)} />
            </div>
          </Bloco>
          <Bloco titulo="Instagram">
            <Liga rotulo="Instagram ligado" valor={form.instagram_ativo} onChange={v => set("instagram_ativo", v)} />
            <Chips rotulo="Hashtags (sem #)" valores={form.hashtags} limite={LIMITES.hashtags} limpar={s => s.replace(/^#+/, "")} onChange={v => set("hashtags", v)} />
            <Chips rotulo="Perfis (sem @)" valores={form.perfis} limite={LIMITES.perfis} limpar={s => s.replace(/^@+/, "")} onChange={v => set("perfis", v)} />
            <div className="flex flex-wrap gap-[12px]">
              <Num rotulo="Views mínimas" valor={form.min_views} min={0} onChange={v => set("min_views", v)} />
              <Num rotulo="Janela em dias" valor={form.janela_dias} min={1} max={60} onChange={v => set("janela_dias", v)} />
              <Num rotulo="Posts por hashtag" valor={form.posts_por_hashtag} min={5} max={100} onChange={v => set("posts_por_hashtag", v)} />
              <Num rotulo="Posts por perfil" valor={form.posts_por_perfil} min={3} max={50} onChange={v => set("posts_por_perfil", v)} />
            </div>
          </Bloco>
          <Bloco titulo="Notícias">
            <Liga rotulo="Notícias ligadas" valor={form.noticias_ativo} onChange={v => set("noticias_ativo", v)} />
            <Chips rotulo='Termos de busca (aspas buscam a frase exata)' valores={form.termos_noticias} limite={LIMITES.termos_noticias} limpar={s => s} onChange={v => set("termos_noticias", v)} />
            <Num rotulo="Janela em dias" valor={form.janela_noticias_dias} min={1} max={7} onChange={v => set("janela_noticias_dias", v)} />
          </Bloco>
          <div className="flex flex-wrap items-center gap-[12px]">
            <Button disabled={!valido || salvando} onClick={salvar} className="h-[36px] text-[12px]">Salvar fontes</Button>
            {!valido && <span className="text-[11px] text-destructive">Corrija os campos fora do limite.</span>}
          </div>
          <p className="text-[11px] text-muted-foreground">Alterado em {ddmm(config.atualizado_em)} {hhmm(config.atualizado_em)}</p>
        </CardContent>
      </CollapsibleContent>
    </Card>
  </Collapsible>;
}
