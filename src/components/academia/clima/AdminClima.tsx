import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Copy, ArrowUp, ArrowDown, Download } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from "recharts";
import { adb, erroAcademia } from "@/lib/academia";
import { type ClimaPergunta, type ClimaPesquisa, type ClimaResposta, type NivelSatisfacao, NIVEL_INFO, mediaNotas, nivelPorMedia } from "@/lib/clima";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const K = ["clima", "admin"];

export default function AdminClima() {
  const qc = useQueryClient();
  const { data: pesquisas = [] } = useQuery({ queryKey: [...K, "lista"], queryFn: async () => ((await adb.from("clima_pesquisas").select("*").order("created_at", { ascending: false })).data ?? []) as ClimaPesquisa[] });
  const [selId, setSelId] = useState<string | null>(null);
  const sel = pesquisas.find((p) => p.id === selId) ?? pesquisas[0];
  const refresh = () => qc.invalidateQueries({ queryKey: ["clima"] });

  const nova = async () => {
    const { data, error } = await adb.from("clima_pesquisas").insert({ titulo: "Nova pesquisa" }).select().single();
    if (error) return toast.error(erroAcademia(error));
    setSelId(data.id); refresh();
  };
  const duplicar = async (p: ClimaPesquisa) => {
    const { data: n, error } = await adb.from("clima_pesquisas").insert({ titulo: `${p.titulo} (cópia)`, descricao: p.descricao }).select().single();
    if (error) return toast.error(erroAcademia(error));
    const { data: qs } = await adb.from("clima_perguntas").select("*").eq("pesquisa_id", p.id);
    if (qs?.length) await adb.from("clima_perguntas").insert(qs.map(({ id, created_at, updated_at, ...q }: any) => ({ ...q, pesquisa_id: n.id })));
    setSelId(n.id); refresh(); toast.success("Pesquisa duplicada");
  };
  const alternar = async (p: ClimaPesquisa, v: boolean) => {
    const { error } = await adb.from("clima_pesquisas").update({ ativa: v }).eq("id", p.id);
    if (error) return toast.error(erroAcademia(error));
    toast.success(v ? "Pesquisa habilitada na trilha dos colaboradores" : "Pesquisa desabilitada"); refresh();
  };
  const excluir = async (p: ClimaPesquisa) => {
    if (!confirm(`Excluir "${p.titulo}" e todas as respostas?`)) return;
    const { error } = await adb.from("clima_pesquisas").delete().eq("id", p.id);
    if (error) return toast.error(erroAcademia(error));
    setSelId(null); refresh();
  };

  return (
    <div className="grid lg:grid-cols-[280px_1fr] gap-6">
      <div className="space-y-2">
        <Button onClick={nova} className="w-full"><Plus className="h-4 w-4 mr-1" />Nova pesquisa</Button>
        {pesquisas.map((p) => (
          <div key={p.id} className={`ac-card p-3 cursor-pointer ${sel?.id === p.id ? "border-primary" : ""}`} onClick={() => setSelId(p.id)}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-sm">{p.titulo}</span>
              <Switch checked={p.ativa} onClick={(e) => e.stopPropagation()} onCheckedChange={(v) => alternar(p, v)} />
            </div>
            <div className="text-xs text-muted-foreground mt-1">{p.ativa ? "Habilitada" : "Desabilitada"}</div>
            <div className="flex gap-1 mt-2">
              <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); duplicar(p); }}><Copy className="h-3.5 w-3.5" /></Button>
              <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); excluir(p); }}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          </div>
        ))}
      </div>
      {sel ? (
        <Tabs defaultValue="resultados" key={sel.id}>
          <TabsList><TabsTrigger value="resultados">Resultados</TabsTrigger><TabsTrigger value="editar">Perguntas</TabsTrigger></TabsList>
          <TabsContent value="editar" className="mt-4"><Editor pesquisa={sel} /></TabsContent>
          <TabsContent value="resultados" className="mt-4"><Resultados pesquisa={sel} /></TabsContent>
        </Tabs>
      ) : <div className="text-muted-foreground">Crie uma pesquisa para começar.</div>}
    </div>
  );
}

function usePerguntas(id: string) {
  return useQuery({ queryKey: [...K, "perguntas", id], queryFn: async () => ((await adb.from("clima_perguntas").select("*").eq("pesquisa_id", id).order("ordem")).data ?? []) as ClimaPergunta[] });
}

function Editor({ pesquisa }: { pesquisa: ClimaPesquisa }) {
  const qc = useQueryClient();
  const { data: perguntas = [] } = usePerguntas(pesquisa.id);
  const [titulo, setTitulo] = useState(pesquisa.titulo);
  const [descricao, setDescricao] = useState(pesquisa.descricao ?? "");
  const refresh = () => qc.invalidateQueries({ queryKey: ["clima"] });
  const salvarCab = async () => {
    const { error } = await adb.from("clima_pesquisas").update({ titulo, descricao: descricao || null }).eq("id", pesquisa.id);
    if (error) return toast.error(erroAcademia(error)); toast.success("Salvo"); refresh();
  };
  const upd = async (id: string, patch: Partial<ClimaPergunta>) => {
    const { error } = await adb.from("clima_perguntas").update(patch).eq("id", id);
    if (error) toast.error(erroAcademia(error)); refresh();
  };
  const add = async () => {
    const { error } = await adb.from("clima_perguntas").insert({ pesquisa_id: pesquisa.id, ordem: (perguntas.at(-1)?.ordem ?? 0) + 1, enunciado: "Nova pergunta", tipo: "escala_0_10" });
    if (error) toast.error(erroAcademia(error)); refresh();
  };
  const mover = async (i: number, d: -1 | 1) => {
    const a = perguntas[i], b = perguntas[i + d]; if (!a || !b) return;
    await adb.from("clima_perguntas").update({ ordem: b.ordem }).eq("id", a.id);
    await adb.from("clima_perguntas").update({ ordem: a.ordem }).eq("id", b.id); refresh();
  };
  const del = async (id: string) => { await adb.from("clima_perguntas").delete().eq("id", id); refresh(); };

  return (
    <div className="space-y-4">
      <div className="ac-card p-4 space-y-2">
        <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título" />
        <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Descrição (aparece para o colaborador)" rows={2} />
        <Button size="sm" onClick={salvarCab}>Salvar título</Button>
      </div>
      {perguntas.map((q, i) => (
        <div key={q.id} className="ac-card p-4 space-y-2">
          <Textarea defaultValue={q.enunciado} rows={2} onBlur={(e) => e.target.value !== q.enunciado && upd(q.id, { enunciado: e.target.value })} />
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Select value={q.tipo} onValueChange={(v) => upd(q.id, { tipo: v as any })}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="escala_0_10">Medidor 0 a 10</SelectItem><SelectItem value="texto">Discursiva</SelectItem></SelectContent>
            </Select>
            {q.tipo === "escala_0_10" && <label className="flex items-center gap-2"><Switch checked={q.permite_comentario} onCheckedChange={(v) => upd(q.id, { permite_comentario: v })} />Campo de texto extra</label>}
            <label className="flex items-center gap-2"><Switch checked={q.obrigatoria} onCheckedChange={(v) => upd(q.id, { obrigatoria: v })} />Obrigatória</label>
            <div className="ml-auto flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => mover(i, -1)}><ArrowUp className="h-3.5 w-3.5" /></Button>
              <Button size="sm" variant="ghost" onClick={() => mover(i, 1)}><ArrowDown className="h-3.5 w-3.5" /></Button>
              <Button size="sm" variant="ghost" onClick={() => del(q.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          </div>
        </div>
      ))}
      <Button variant="outline" onClick={add}><Plus className="h-4 w-4 mr-1" />Adicionar pergunta</Button>
    </div>
  );
}

function Resultados({ pesquisa }: { pesquisa: ClimaPesquisa }) {
  const { data: perguntas = [] } = usePerguntas(pesquisa.id);
  const { data: respostas = [] } = useQuery({ queryKey: [...K, "respostas", pesquisa.id], queryFn: async () => ((await adb.from("clima_respostas").select("*").eq("pesquisa_id", pesquisa.id)).data ?? []) as ClimaResposta[] });
  const ids = respostas.map((r) => r.user_id);
  const { data: perfis = {} } = useQuery({
    queryKey: [...K, "perfis", ids.join(",")], enabled: ids.length > 0,
    queryFn: async () => {
      const { data } = await adb.from("academia_perfis").select("id, nome, funcao, frente:academia_frentes(nome)").in("id", ids);
      const m: Record<string, { nome: string; funcao: string | null; area: string | null }> = {};
      (data ?? []).forEach((p: any) => { m[p.id] = { nome: p.nome, funcao: p.funcao, area: p.frente?.nome ?? null }; });
      return m;
    },
  });
  const [filtro, setFiltro] = useState<"todos" | NivelSatisfacao>("todos");
  const [aberto, setAberto] = useState<string | null>(null);
  const escalas = perguntas.filter((q) => q.tipo === "escala_0_10");
  const textos = perguntas.filter((q) => q.tipo === "texto" || q.permite_comentario);

  const linhas = useMemo(() => respostas.map((r) => {
    const media = mediaNotas(perguntas, r.respostas);
    const p = perfis[r.user_id];
    return { r, media, nivel: media == null ? null : nivelPorMedia(media), nome: p?.nome ?? "Colaborador", funcao: p?.funcao ?? "—", area: p?.area ?? "—" };
  }).sort((a, b) => (a.media ?? 99) - (b.media ?? 99)), [respostas, perguntas, perfis]);
  const visiveis = linhas.filter((l) => filtro === "todos" || l.nivel === filtro);
  const total = linhas.filter((l) => l.nivel).length;
  const cont = (n: NivelSatisfacao) => linhas.filter((l) => l.nivel === n).length;

  const csv = () => {
    const head = ["Colaborador", "Cargo", "Área", "Média", "Nível", ...perguntas.map((q, i) => `P${i + 1}`), ...perguntas.filter((q) => q.permite_comentario).map((q) => `P${perguntas.indexOf(q) + 1} texto`)];
    const rows = visiveis.map((l) => [l.nome, l.funcao, l.area, l.media ?? "", l.nivel ? NIVEL_INFO[l.nivel].label : "",
      ...perguntas.map((q) => q.tipo === "escala_0_10" ? l.r.respostas[q.id]?.nota ?? "" : l.r.respostas[q.id]?.texto ?? ""),
      ...perguntas.filter((q) => q.permite_comentario).map((q) => l.r.respostas[q.id]?.texto ?? "")]);
    const s = [head, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["\ufeff" + s], { type: "text/csv" })); a.download = `pesquisa-clima-${filtro}.csv`; a.click();
  };

  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-4 gap-3">
        <button className={`ac-card p-4 text-left ${filtro === "todos" ? "border-primary" : ""}`} onClick={() => setFiltro("todos")}>
          <div className="ac-eyebrow">Respostas</div><div className="text-2xl font-bold">{respostas.length}</div></button>
        {(["feliz", "entediado", "triste"] as NivelSatisfacao[]).map((n) => (
          <button key={n} className={`ac-card p-4 text-left ${filtro === n ? "border-primary" : ""}`} onClick={() => setFiltro(n)}>
            <div className="ac-eyebrow">{NIVEL_INFO[n].emoji} {NIVEL_INFO[n].label}</div>
            <div className="text-2xl font-bold">{cont(n)} <span className="text-sm text-muted-foreground font-normal">{total ? Math.round((cont(n) / total) * 100) : 0}%</span></div>
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Nível pela média das perguntas de medidor: 😄 Feliz ≥ 7 · 😐 Entediado 4 a 6,9 · 😢 Triste &lt; 4. Clique em um colaborador para ver o gráfico individual.</p>
      <div className="flex justify-end"><Button variant="outline" size="sm" onClick={csv} disabled={!visiveis.length}><Download className="h-4 w-4 mr-1" />Exportar CSV</Button></div>
      {!visiveis.length && <div className="text-muted-foreground">Nenhuma resposta {filtro !== "todos" ? "neste nível" : "ainda"}.</div>}
      <div className="space-y-3">
        {visiveis.map((l) => {
          const dados = [...escalas.map((q, i) => ({ nome: `P${perguntas.indexOf(q) + 1}`, nota: l.r.respostas[q.id]?.nota ?? 0 })), ...(l.media != null ? [{ nome: "Média", nota: l.media }] : [])];
          return (
            <div key={l.r.id} className="ac-card p-4">
              <button className="w-full flex items-center gap-4 text-left" onClick={() => setAberto(aberto === l.r.id ? null : l.r.id)}>
                <span className="text-3xl">{l.nivel ? NIVEL_INFO[l.nivel].emoji : "—"}</span>
                <div className="flex-1"><div className="font-semibold">{l.nome}</div><div className="text-xs text-muted-foreground">{l.funcao} · {l.area}</div></div>
                <div className="text-right"><div className="text-xl font-bold">{l.media ?? "—"}</div><div className="text-xs text-muted-foreground">{l.nivel ? NIVEL_INFO[l.nivel].label : ""}</div></div>
              </button>
              {aberto === l.r.id && (
                <div className="mt-4 grid md:grid-cols-2 gap-4">
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dados}><CartesianGrid strokeDasharray="3 3" className="stroke-border" /><XAxis dataKey="nome" /><YAxis domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} />
                        <Tooltip /><ReferenceLine y={7} strokeDasharray="4 4" className="stroke-primary" /><ReferenceLine y={4} strokeDasharray="4 4" className="stroke-destructive" />
                        <Bar dataKey="nota" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} /></BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-3 text-sm">
                    {textos.map((q) => l.r.respostas[q.id]?.texto ? (
                      <div key={q.id}><div className="font-medium">P{perguntas.indexOf(q) + 1}. {q.enunciado.slice(0, 80)}{q.enunciado.length > 80 ? "…" : ""}</div>
                        <p className="text-muted-foreground whitespace-pre-wrap">{l.r.respostas[q.id]?.texto}</p></div>
                    ) : null)}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
