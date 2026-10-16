import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check, ChevronDown, Lock, Paperclip, X } from "lucide-react";
import { useAcademiaIsAdmin, useCatalogo, useNomes, useTrilhaDoUsuario } from "@/hooks/useAcademia";
import { adb, agruparPorFase, faseConcluida, progresso, diasDesde, TIPO_LABEL, type APerfil, type AUserTask } from "@/lib/academia";
import { abrirEvidencia } from "@/components/academia/TarefaItem";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const STATUS: Record<string, string> = { pendente: "Pendente", enviada: "Aguardando validação", aprovada: "Aprovada", reprovada: "Reprovada" };
const dt = (s?: string | null) => (s ? new Date(s).toLocaleString("pt-BR") : "—");

interface Tentativa { id: string; quiz_id: string; nota: number; aprovado: boolean; respostas: Record<string, number> | null; criado_em: string }
interface Pergunta { id: string; quiz_id: string; ordem: number; enunciado: string; alternativas: unknown[]; correta: number }
const altTexto = (a: unknown) => (typeof a === "string" ? a : (a as { texto?: string })?.texto ?? JSON.stringify(a));

function Tarefa({ ut, nomes }: { ut: AUserTask; nomes: Record<string, string> }) {
  const vp = (ut as AUserTask & { validada_por?: string | null }).validada_por;
  return (
    <div className="py-3 border-t border-border first:border-t-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{ut.task.titulo}</span>
        <span className={cn("text-xs px-2 py-0.5 rounded-full border", ut.status === "aprovada" ? "border-primary text-primary" : ut.status === "enviada" ? "ac-warn" : "text-muted-foreground")}>{STATUS[ut.status]}</span>
        <span className="text-xs text-muted-foreground">{TIPO_LABEL[ut.task.tipo_validacao]}</span>
      </div>
      <div className="text-xs text-muted-foreground mt-1">
        Enviada: {dt(ut.enviada_em ?? ut.marcada_em)} · Validada: {dt(ut.validada_em)}{vp ? ` por ${nomes[vp] ?? "—"}` : ""}{ut.reprovacoes ? ` · devolvida ${ut.reprovacoes}x` : ""}
      </div>
      {ut.comentario_validador && <div className="text-sm mt-1 italic">"{ut.comentario_validador}"</div>}
      {ut.evidencia_url && <button className="mt-1 text-sm underline inline-flex items-center gap-1" onClick={() => abrirEvidencia(ut.evidencia_url!)}><Paperclip className="h-4 w-4" />Ver evidência</button>}
    </div>
  );
}

export default function ColaboradorDetalhe() {
  const { userId } = useParams();
  const isAdmin = useAcademiaIsAdmin();
  const { data: cat } = useCatalogo();
  const { data: trilha } = useTrilhaDoUsuario(userId);
  const [aberta, setAberta] = useState<string | null>(null);
  const [tentAberta, setTentAberta] = useState<string | null>(null);

  const { data: perfil } = useQuery({
    queryKey: ["academia", "perfil-de", userId], enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await adb.from("academia_perfis").select("*").eq("id", userId).maybeSingle();
      if (error) throw error; return data as APerfil | null;
    },
  });
  const { data: quiz } = useQuery({
    queryKey: ["academia", "quiz-de", userId, isAdmin], enabled: !!userId,
    queryFn: async () => {
      const { data: t, error } = await adb.from("academia_quiz_attempts").select("*").eq("user_id", userId).order("criado_em", { ascending: false });
      if (error) throw error;
      const ids = [...new Set((t ?? []).map((x: Tentativa) => x.quiz_id))];
      const [qz, qq] = ids.length ? await Promise.all([
        adb.from("academia_quizzes").select("id, titulo").in("id", ids),
        isAdmin ? adb.from("academia_quiz_questions").select("*").in("quiz_id", ids).order("ordem") : Promise.resolve({ data: [] }),
      ]) : [{ data: [] }, { data: [] }];
      return { tentativas: (t ?? []) as Tentativa[], quizzes: (qz.data ?? []) as { id: string; titulo: string }[], perguntas: (qq.data ?? []) as Pergunta[] };
    },
  });

  const tarefas = (trilha?.tarefas ?? []).filter((t) => trilha?.tracks.some((tr) => tr.id === t.user_track_id && tr.tipo === "principal"));
  const fases = agruparPorFase(tarefas);
  const f0 = fases.find((f) => f.phase.codigo === "fase_0");
  const travado = f0 && !faseConcluida(f0);
  const nomes = useNomes([perfil?.gestor_id, perfil?.padrinho_id, ...tarefas.map((t) => (t as AUserTask & { validada_por?: string }).validada_por), ...(trilha?.marcos ?? []).map(() => null)]).data ?? {};

  if (!perfil) return <div className="max-w-5xl"><Link to="/academia/equipe" className="text-sm underline">Voltar</Link><p className="mt-4 text-muted-foreground">Colaborador não encontrado ou sem acesso.</p></div>;

  return (
    <div className="max-w-5xl space-y-6">
      <Link to="/academia/equipe" className="text-sm inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Painel do gestor</Link>
      <div className="ac-card p-6 grid md:grid-cols-[2fr_1fr] gap-4">
        <div>
          <div className="ac-eyebrow">Ficha do colaborador</div>
          <h1 className="text-3xl">{perfil.nome}</h1>
          <div className="text-sm text-muted-foreground mt-1">{cat?.frentes.find((f) => f.id === perfil.frente_id)?.nome ?? "—"} · {perfil.funcao ?? "—"} · {perfil.nivel} · {perfil.xp_total} XP</div>
          <div className="text-sm text-muted-foreground">Gestor: {nomes[perfil.gestor_id ?? ""] ?? "—"} · Padrinho: {nomes[perfil.padrinho_id ?? ""] ?? "—"}</div>
        </div>
        <div>
          <div className="text-sm">Início {new Date(perfil.data_inicio + "T00:00:00").toLocaleDateString("pt-BR")} · Dia {diasDesde(perfil.data_inicio)} de 90</div>
          <div className="text-2xl font-bold mt-1">{progresso(tarefas)}%</div>
          <Progress value={progresso(tarefas)} className="h-2 mt-1" />
          {travado && <div className="ac-warn text-sm mt-2 flex items-center gap-1"><Lock className="h-4 w-4" />Fase 0 ainda aberta</div>}
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg">Evolução por fase</h2>
        {fases.length === 0 && <p className="text-sm text-muted-foreground">Ainda não acessou a trilha.</p>}
        {fases.map((f) => (
          <div key={f.phase.id} className="ac-card p-5">
            <button className="w-full flex items-center gap-3 text-left" onClick={() => setAberta(aberta === f.phase.id ? null : f.phase.id)}>
              <div className="flex-1">
                <div className="font-bold">{f.phase.titulo}</div>
                <div className="text-xs text-muted-foreground">{f.tarefas.filter((t) => t.status === "aprovada").length} de {f.tarefas.length} aprovadas</div>
              </div>
              <div className="w-32"><Progress value={progresso(f.tarefas)} className="h-1.5" /></div>
              <span className="text-sm w-10 text-right">{progresso(f.tarefas)}%</span>
              <ChevronDown className={cn("h-4 w-4 transition-transform", aberta === f.phase.id && "rotate-180")} />
            </button>
            {aberta === f.phase.id && <div className="mt-3">{f.modulos.map((m) => (
              <div key={m.module.id} className="mt-3">
                <div className="text-xs ac-eyebrow">{m.module.titulo}</div>
                {m.tarefas.map((ut) => <Tarefa key={ut.id} ut={ut} nomes={nomes} />)}
              </div>))}</div>}
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg">Respostas dos quizzes</h2>
        {!quiz?.tentativas.length && <p className="text-sm text-muted-foreground">Nenhum quiz respondido ainda.</p>}
        {!isAdmin && !!quiz?.tentativas.length && <p className="text-xs text-muted-foreground">As respostas pergunta a pergunta ficam visíveis só para admin/RH.</p>}
        {quiz?.tentativas.map((t) => {
          const pergs = quiz.perguntas.filter((q) => q.quiz_id === t.quiz_id);
          return (
            <div key={t.id} className="ac-card p-5">
              <button className="w-full flex items-center gap-3 text-left" onClick={() => setTentAberta(tentAberta === t.id ? null : t.id)} disabled={!isAdmin}>
                <div className="flex-1">
                  <div className="font-bold">{quiz.quizzes.find((q) => q.id === t.quiz_id)?.titulo ?? "Quiz"}</div>
                  <div className="text-xs text-muted-foreground">{dt(t.criado_em)}</div>
                </div>
                <span className="font-bold">{t.nota}</span>
                <span className={cn("text-xs px-2 py-0.5 rounded-full border", t.aprovado ? "border-primary text-primary" : "ac-warn")}>{t.aprovado ? "Aprovado" : "Não passou"}</span>
                {isAdmin && <ChevronDown className={cn("h-4 w-4 transition-transform", tentAberta === t.id && "rotate-180")} />}
              </button>
              {tentAberta === t.id && <ol className="mt-4 space-y-4">{pergs.map((q, i) => {
                const r = t.respostas?.[q.id];
                const ok = r === q.correta;
                return (
                  <li key={q.id}>
                    <div className="font-semibold flex gap-2">{ok ? <Check className="h-4 w-4 text-primary mt-1" /> : <X className="h-4 w-4 text-destructive mt-1" />}{i + 1}. {q.enunciado}</div>
                    <div className="text-sm ml-6">Resposta: {r != null ? altTexto(q.alternativas[r]) : "não respondida"}</div>
                    {!ok && <div className="text-sm ml-6 text-muted-foreground">Correta: {altTexto(q.alternativas[q.correta])}</div>}
                  </li>);
              })}</ol>}
            </div>);
        })}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg">Marcos</h2>
        {!trilha?.marcos.length && <p className="text-sm text-muted-foreground">Nenhum marco aberto ainda.</p>}
        {trilha?.marcos.map((m) => (
          <div key={m.id} className="ac-card p-5 text-sm">
            <div className="font-bold">{m.codigo === "marco_30" ? "Marco 30 dias" : "Conclusão 90 dias"}{m.fechado_em ? " · fechado" : ""}</div>
            <div className="text-muted-foreground">Gestor: {dt(m.assinatura_gestor_em)} · Padrinho: {dt(m.assinatura_padrinho_em)}{m.codigo === "conclusao_90" ? ` · Colaborador: ${dt(m.assinatura_colaborador_em)}` : ""}</div>
          </div>))}
      </section>
    </div>
  );
}
