import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { adb, erroAcademia, type APerfil, type AProduto } from "@/lib/academia";
import { useCatalogo, useNomes } from "@/hooks/useAcademia";
import { UsuarioPicker, type UsuarioApp } from "@/components/academia/UsuarioPicker";
import AdminTemplates from "./AdminTemplates";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function Pessoas() {
  const qc = useQueryClient();
  const { data: cat } = useCatalogo();
  const { data: perfis = [] } = useQuery({ queryKey: ["academia", "admin-perfis"], queryFn: async () => ((await adb.from("academia_perfis").select("*").order("created_at", { ascending: false })).data ?? []) as APerfil[] });
  const { data: nomes = {} } = useNomes(perfis.flatMap((p) => [p.gestor_id, p.padrinho_id]));
  const [pessoa, setPessoa] = useState<UsuarioApp | null>(null);
  const [gestor, setGestor] = useState<UsuarioApp | null>(null);
  const [padrinho, setPadrinho] = useState<UsuarioApp | null>(null);
  const [frente, setFrente] = useState("");
  const [funcao, setFuncao] = useState("");
  const [atuacao, setAtuacao] = useState("nenhuma");
  const [inicio, setInicio] = useState(new Date().toISOString().slice(0, 10));
  const [cnpj, setCnpj] = useState("");

  const convidar = async () => {
    if (!pessoa || !frente || !gestor || !padrinho) return toast.error("Preencha pessoa, frente, gestor e padrinho.");
    const prod = cat?.produtos.find((p) => p.frente_id === frente);
    const { error } = await adb.from("academia_perfis").insert({
      id: pessoa.id, nome: pessoa.full_name ?? pessoa.email, email: pessoa.email, cnpj: cnpj || null,
      frente_id: frente, produto_principal_id: prod?.id ?? null, funcao: funcao || null,
      atuacao_funil: atuacao === "nenhuma" ? null : atuacao, data_inicio: inicio, gestor_id: gestor.id, padrinho_id: padrinho.id,
    });
    if (error) return toast.error(error.code === "23505" ? "Essa pessoa já está na Academia." : erroAcademia(error));
    await adb.from("academia_notifications").insert({ user_id: pessoa.id, tipo: "convite", titulo: "Bem-vindo à Academia MCF", corpo: "Sua trilha de integração está pronta.", link: "/academia" });
    toast.success("Convite registrado. A trilha é montada no primeiro acesso.");
    setPessoa(null); setCnpj(""); setFuncao("");
    qc.invalidateQueries({ queryKey: ["academia"] });
  };
  const encerrar = async (id: string) => {
    const { error } = await adb.from("academia_perfis").update({ status: "encerrado" }).eq("id", id);
    if (error) toast.error(erroAcademia(error)); else qc.invalidateQueries({ queryKey: ["academia"] });
  };

  return (
    <div className="grid lg:grid-cols-[420px_1fr] gap-6">
      <div className="ac-card p-5 space-y-3">
        <h3 className="text-lg">Convidar colaborador</h3>
        <div><Label>Pessoa (usuário do app)</Label><UsuarioPicker valor={pessoa} onChange={setPessoa} /></div>
        <div><Label>CNPJ</Label><Input value={cnpj} onChange={(e) => setCnpj(e.target.value)} /></div>
        <div><Label>Frente (BU) principal</Label>
          <Select value={frente} onValueChange={setFrente}><SelectTrigger><SelectValue placeholder="Escolha" /></SelectTrigger>
            <SelectContent>{cat?.frentes.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}</SelectContent></Select></div>
        <div><Label>Função</Label><Input value={funcao} onChange={(e) => setFuncao(e.target.value)} placeholder="SDR, Closer, Analista…" /></div>
        <div><Label>Atuação no funil</Label>
          <Select value={atuacao} onValueChange={setAtuacao}><SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="nenhuma">Não se aplica</SelectItem><SelectItem value="r01">R01</SelectItem><SelectItem value="r02">R02</SelectItem></SelectContent></Select></div>
        <div><Label>Data de início</Label><Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} /></div>
        <div><Label>Gestor</Label><UsuarioPicker valor={gestor} onChange={setGestor} /></div>
        <div><Label>Padrinho (Pessoas & Cultura)</Label><UsuarioPicker valor={padrinho} onChange={setPadrinho} /></div>
        <Button className="w-full" onClick={convidar}>Convidar</Button>
      </div>
      <div className="space-y-2">
        {perfis.map((p) => (
          <div key={p.id} className="ac-card p-4 flex flex-wrap items-center gap-3 text-sm">
            <div className="flex-1 min-w-48"><div className="font-bold">{p.nome}</div>
              <div className="text-xs text-muted-foreground">{cat?.frentes.find((f) => f.id === p.frente_id)?.nome} · início {new Date(p.data_inicio + "T00:00").toLocaleDateString("pt-BR")} · gestor {nomes[p.gestor_id ?? ""] ?? "—"} · padrinho {nomes[p.padrinho_id ?? ""] ?? "—"}</div></div>
            <span className="text-xs rounded-full border px-2 py-0.5">{p.status}</span>
            <span className="text-xs">{p.xp_total} XP</span>
            {p.status !== "encerrado" && <Button size="sm" variant="ghost" onClick={() => encerrar(p.id)}>Encerrar</Button>}
          </div>))}
      </div>
    </div>
  );
}

function Frentes() {
  const qc = useQueryClient();
  const { data: cat } = useCatalogo();
  const [edit, setEdit] = useState<Record<string, Partial<AProduto>>>({});
  const salvar = async (p: AProduto) => {
    const { error } = await adb.from("academia_produtos").update(edit[p.id]).eq("id", p.id);
    if (error) return toast.error(erroAcademia(error));
    toast.success("Produto salvo."); qc.invalidateQueries({ queryKey: ["academia"] });
  };
  return (
    <div className="grid md:grid-cols-2 gap-4">
      {cat?.produtos.map((p) => {
        const v = { ...p, ...edit[p.id] };
        const set = (k: keyof AProduto, val: string) => setEdit((e) => ({ ...e, [p.id]: { ...e[p.id], [k]: val } }));
        return (
          <div key={p.id} className="ac-card p-5 space-y-2">
            <Input value={v.nome} onChange={(e) => set("nome", e.target.value)} className="font-bold" />
            <Label>O que é</Label><Textarea value={v.resumo ?? ""} onChange={(e) => set("resumo", e.target.value)} />
            <Label>Para quem</Label><Textarea value={v.para_quem ?? ""} onChange={(e) => set("para_quem", e.target.value)} />
            <Label>Você precisa saber</Label><Textarea value={v.voce_precisa_saber ?? ""} onChange={(e) => set("voce_precisa_saber", e.target.value)} />
            <Label>Material da Academia</Label><Textarea value={v.material ?? ""} onChange={(e) => set("material", e.target.value)} />
            <Button size="sm" disabled={!edit[p.id]} onClick={() => salvar(p)}>Salvar</Button>
          </div>);
      })}
    </div>
  );
}

interface Pergunta { id?: string; enunciado: string; alternativas: string[]; correta: number; explicacao: string; ordem: number }

function Quizzes() {
  const qc = useQueryClient();
  const { data: cat } = useCatalogo();
  const { data: quizzes = [] } = useQuery({ queryKey: ["academia", "admin-quizzes"], queryFn: async () => (await adb.from("academia_quizzes").select("*").order("titulo")).data ?? [] });
  const [sel, setSel] = useState<string>("");
  const { data: perguntas = [], refetch } = useQuery({
    queryKey: ["academia", "admin-perguntas", sel], enabled: !!sel,
    queryFn: async () => ((await adb.from("academia_quiz_questions").select("*").eq("quiz_id", sel).order("ordem")).data ?? []) as Pergunta[],
  });
  const [novo, setNovo] = useState<Pergunta>({ enunciado: "", alternativas: ["", "", "", ""], correta: 0, explicacao: "", ordem: 0 });
  const quiz = quizzes.find((q: { id: string }) => q.id === sel);

  const criarQuiz = async () => {
    const prod = cat?.produtos[0];
    const { data, error } = await adb.from("academia_quizzes").insert({ titulo: "Novo quiz", produto_id: prod?.id, nivel: 1 }).select().single();
    if (error) return toast.error(erroAcademia(error));
    qc.invalidateQueries({ queryKey: ["academia", "admin-quizzes"] }); setSel(data.id);
  };
  const salvarQuiz = async (patch: Record<string, unknown>) => {
    const { error } = await adb.from("academia_quizzes").update(patch).eq("id", sel);
    if (error) toast.error(erroAcademia(error)); else qc.invalidateQueries({ queryKey: ["academia", "admin-quizzes"] });
  };
  const addPergunta = async () => {
    if (!novo.enunciado.trim() || novo.alternativas.some((a) => !a.trim())) return toast.error("Preencha o enunciado e as alternativas.");
    const { error } = await adb.from("academia_quiz_questions").insert({ ...novo, quiz_id: sel, ordem: perguntas.length + 1 });
    if (error) return toast.error(erroAcademia(error));
    setNovo({ enunciado: "", alternativas: ["", "", "", ""], correta: 0, explicacao: "", ordem: 0 }); refetch();
  };
  const del = async (id: string) => { await adb.from("academia_quiz_questions").delete().eq("id", id); refetch(); };

  return (
    <div className="grid lg:grid-cols-[280px_1fr] gap-6">
      <div className="space-y-2">
        <Button size="sm" onClick={criarQuiz}><Plus className="h-4 w-4 mr-1" />Novo quiz</Button>
        {quizzes.map((q: { id: string; titulo: string; nivel: number }) => (
          <button key={q.id} onClick={() => setSel(q.id)} className={`block w-full text-left p-3 rounded-xl border text-sm ${sel === q.id ? "border-primary" : ""}`}>{q.titulo} <span className="text-muted-foreground">· nível {q.nivel}</span></button>))}
      </div>
      {quiz && (
        <div className="space-y-4">
          <div className="ac-card p-5 grid sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2"><Label>Título</Label><Input defaultValue={quiz.titulo} onBlur={(e) => salvarQuiz({ titulo: e.target.value })} /></div>
            <div><Label>Produto</Label>
              <Select value={quiz.produto_id ?? ""} onValueChange={(v) => salvarQuiz({ produto_id: v })}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{cat?.produtos.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Nível</Label><Input type="number" min={1} max={4} defaultValue={quiz.nivel} onBlur={(e) => salvarQuiz({ nivel: Number(e.target.value) })} /></div>
            <div><Label>Nota mínima</Label><Input type="number" defaultValue={quiz.nota_minima} onBlur={(e) => salvarQuiz({ nota_minima: Number(e.target.value) })} /></div>
            <div><Label>Tentativas máximas</Label><Input type="number" defaultValue={quiz.tentativas_max} onBlur={(e) => salvarQuiz({ tentativas_max: Number(e.target.value) })} /></div>
          </div>
          {perguntas.map((q, i) => (
            <div key={q.id} className="ac-card p-4 text-sm">
              <div className="flex justify-between"><b>{i + 1}. {q.enunciado}</b><button onClick={() => del(q.id!)} aria-label="Excluir"><Trash2 className="h-4 w-4" /></button></div>
              <ol className="list-[upper-alpha] ml-5 mt-1">{q.alternativas.map((a, j) => <li key={j} className={j === q.correta ? "text-primary font-semibold" : ""}>{a}</li>)}</ol>
              {q.explicacao && <p className="text-muted-foreground mt-1">{q.explicacao}</p>}
            </div>))}
          <div className="ac-card p-5 space-y-2">
            <h4 className="font-bold">Nova pergunta</h4>
            <Textarea placeholder="Enunciado" value={novo.enunciado} onChange={(e) => setNovo({ ...novo, enunciado: e.target.value })} />
            {novo.alternativas.map((a, j) => (
              <div key={j} className="flex gap-2 items-center">
                <input type="radio" checked={novo.correta === j} onChange={() => setNovo({ ...novo, correta: j })} aria-label="Correta" />
                <Input placeholder={`Alternativa ${String.fromCharCode(65 + j)}`} value={a}
                  onChange={(e) => { const alt = [...novo.alternativas]; alt[j] = e.target.value; setNovo({ ...novo, alternativas: alt }); }} />
              </div>))}
            <Textarea placeholder="Explicação exibida após responder" value={novo.explicacao} onChange={(e) => setNovo({ ...novo, explicacao: e.target.value })} />
            <Button size="sm" onClick={addPergunta}>Adicionar</Button>
          </div>
        </div>)}
    </div>
  );
}

function Relatorios() {
  const { data, error } = useQuery({ queryKey: ["academia", "relatorios"], queryFn: async () => { const r = await adb.rpc("academia_relatorios"); if (r.error) throw r.error; return r.data; } });
  if (error) return <p className="ac-warn">{erroAcademia(error)}</p>;
  if (!data) return <p className="text-muted-foreground">Carregando…</p>;
  const t3 = data.teste_3min;
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="ac-card p-5"><div className="ac-eyebrow">Pessoas</div>
        <p className="text-sm mt-2">Total {data.pessoas.total} · em trilha {data.pessoas.em_trilha} · concluídas {data.pessoas.concluido}</p></div>
      <div className="ac-card p-5"><div className="ac-eyebrow">Teste dos 3 Minutos</div>
        <div className="text-4xl font-display mt-2">{t3.total ? Math.round((t3.primeira / t3.total) * 100) : 0}%</div>
        <p className="text-sm text-muted-foreground">aprovados na primeira tentativa ({t3.primeira} de {t3.total})</p></div>
      <div className="ac-card p-5"><div className="ac-eyebrow">Tempo médio por fase (dias desde o início)</div>
        {data.tempo_medio_fase.length === 0 ? <p className="text-sm text-muted-foreground mt-2">Sem fases concluídas ainda.</p> :
          data.tempo_medio_fase.map((f: { codigo: string; dias: number }) => <div key={f.codigo} className="flex justify-between text-sm mt-2"><span>{f.codigo.replace("_", " ")}</span><b>{f.dias}</b></div>)}</div>
      <div className="ac-card p-5"><div className="ac-eyebrow">Tarefas que mais reprovam</div>
        {data.mais_reprovadas.length === 0 ? <p className="text-sm text-muted-foreground mt-2">Nenhuma reprovação.</p> :
          data.mais_reprovadas.map((r: { titulo: string; reprovacoes: number }) => <div key={r.titulo} className="flex justify-between gap-3 text-sm mt-2"><span>{r.titulo}</span><b>{r.reprovacoes}</b></div>)}</div>
    </div>
  );
}

export default function AcademiaAdmin() {
  return (
    <div className="space-y-6">
      <div><div className="ac-eyebrow">Pessoas & Cultura</div><h1 className="text-3xl">Admin RH</h1></div>
      <Tabs defaultValue="pessoas">
        <TabsList><TabsTrigger value="pessoas">Convites e pessoas</TabsTrigger><TabsTrigger value="templates">Templates de trilha</TabsTrigger>
          <TabsTrigger value="frentes">Produtos</TabsTrigger><TabsTrigger value="quizzes">Quizzes</TabsTrigger><TabsTrigger value="relatorios">Relatórios</TabsTrigger></TabsList>
        <TabsContent value="pessoas" className="mt-6"><Pessoas /></TabsContent>
        <TabsContent value="templates" className="mt-6"><AdminTemplates /></TabsContent>
        <TabsContent value="frentes" className="mt-6"><Frentes /></TabsContent>
        <TabsContent value="quizzes" className="mt-6"><Quizzes /></TabsContent>
        <TabsContent value="relatorios" className="mt-6"><Relatorios /></TabsContent>
      </Tabs>
    </div>
  );
}
