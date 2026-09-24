import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Lock, CheckCircle2, ChevronRight, AlertTriangle, Flag } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useMeuPerfilAcademia, useTrilhaDoUsuario, useCatalogo, useAcademiaIsAdmin } from "@/hooks/useAcademia";
import { adb, agruparPorFase, faseConcluida, progresso, diasDesde, MENSAGEM_TRAVA, NIVEIS } from "@/lib/academia";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { MarcoCard } from "@/components/academia/MarcoCard";
import { cn } from "@/lib/utils";

export default function MinhaTrilha() {
  const { user } = useAuth();
  const isAdmin = useAcademiaIsAdmin();
  const { data: perfil, isLoading } = useMeuPerfilAcademia();
  const { data: trilha, isLoading: lt, error } = useTrilhaDoUsuario(perfil ? user?.id : undefined, true);
  const { data: cat } = useCatalogo();
  const { data: turma } = useQuery({
    queryKey: ["academia", "turma", user?.id], enabled: !!perfil,
    queryFn: async () => (await adb.rpc("academia_media_turma")).data as { pessoas: number; media: number },
  });

  if (isLoading || (perfil && lt)) return <div className="text-muted-foreground">Carregando sua trilha…</div>;
  if (!perfil) return (
    <div className="ac-card p-8 max-w-xl">
      <div className="ac-eyebrow mb-2">Academia MCF</div>
      <h1 className="text-2xl mb-2">Você ainda não está em uma trilha</h1>
      <p className="text-muted-foreground">Quando Pessoas & Cultura cadastrar você na Academia, sua trilha de integração aparece aqui.</p>
      {isAdmin && <Button asChild className="mt-4"><Link to="/academia/admin">Ir para Admin RH</Link></Button>}
    </div>
  );
  if (error) return <div className="ac-warn">Não foi possível montar a trilha. Fale com o RH.</div>;

  const principal = trilha!.tracks.find((t) => t.tipo === "principal");
  const tarefas = trilha!.tarefas.filter((t) => t.user_track_id === principal?.id);
  const fases = agruparPorFase(tarefas);
  const fase0ok = fases.find((f) => f.phase.codigo === "fase_0") ? faseConcluida(fases.find((f) => f.phase.codigo === "fase_0")!) : false;
  const dia = diasDesde(perfil.data_inicio);
  const atual = fases.find((f) => !faseConcluida(f));
  const pct = progresso(tarefas);
  const frente = cat?.frentes.find((f) => f.id === perfil.frente_id);
  const prox = NIVEIS.find((n) => n.xp > perfil.xp_total);
  const extensoes = trilha!.tracks.filter((t) => t.tipo === "extensao");

  return (
    <div className="space-y-8 max-w-5xl">
      <section className="ac-card p-6 md:p-8 grid md:grid-cols-[1fr_auto] gap-6">
        <div>
          <div className="ac-eyebrow">Trilha de Integração PJ · {frente?.nome ?? "—"}</div>
          <h1 className="text-3xl md:text-4xl mt-2">Olá, {perfil.nome.split(" ")[0]}.</h1>
          <p className="text-muted-foreground mt-1">Dia {dia} de 90 · {perfil.funcao ?? "Colaborador"}</p>
          <div className="mt-6">
            <div className="flex justify-between text-sm mb-2"><span className="font-semibold">Progresso geral</span><span className="font-bold text-primary">{pct}%</span></div>
            <Progress value={pct} className="h-3" />
            {turma && turma.pessoas > 1 && <p className="text-xs text-muted-foreground mt-2">Média da sua turma de entrada: {turma.media}% ({turma.pessoas} pessoas, sem nomes)</p>}
          </div>
        </div>
        <div className="md:border-l md:pl-6 flex flex-col justify-center min-w-48">
          <div className="ac-eyebrow">Nível</div>
          <div className="text-2xl font-display">{perfil.nivel}</div>
          <div className="text-sm text-muted-foreground">{perfil.xp_total} XP{prox ? ` · faltam ${prox.xp - perfil.xp_total} para ${prox.nome}` : ""}</div>
        </div>
      </section>

      {trilha!.marcos.filter((m) => !m.fechado_em).map((m) => <MarcoCard key={m.id} marco={m} papel="colaborador" nome={perfil.nome} />)}

      <section className="relative pl-8">
        <div className="absolute left-3 top-2 bottom-2 w-px bg-border" />
        {fases.map((f) => {
          const ok = faseConcluida(f);
          const travada = f.phase.codigo !== "fase_0" && !fase0ok;
          const ehAtual = atual?.phase.id === f.phase.id;
          const fp = progresso(f.tarefas);
          const atrasada = !ok && f.phase.dia_fim != null && dia > f.phase.dia_fim;
          const atrasadas = atrasada ? f.tarefas.filter((t) => t.task.obrigatoria && t.status !== "aprovada").length : 0;
          return (
            <div key={f.phase.id} className="relative mb-5">
              <div className={cn("absolute -left-8 top-5 h-6 w-6 rounded-full border-2 grid place-items-center bg-background",
                ok ? "border-primary bg-primary text-primary-foreground" : ehAtual ? "border-primary" : "border-border")}>
                {ok ? <CheckCircle2 className="h-4 w-4" /> : travada ? <Lock className="h-3 w-3 text-muted-foreground" /> : null}
              </div>
              <div className={cn("ac-card p-5", travada && "opacity-60")}>
                <div className="flex flex-wrap items-center gap-3">
                  <div>
                    <div className="ac-eyebrow">{f.phase.codigo.replace("_", " ").toUpperCase()} · {f.phase.periodo_label}{f.phase.bloqueante ? " · bloqueante" : ""}</div>
                    <h2 className="text-xl mt-1">{f.phase.titulo}</h2>
                    <p className="text-sm text-muted-foreground">{f.phase.foco} · Conduz: {f.phase.quem_conduz}</p>
                  </div>
                  <div className="ml-auto flex items-center gap-3">
                    <span className="text-sm font-bold">{fp}%</span>
                    {!travada && <Button asChild size="sm" variant={ehAtual ? "default" : "outline"}><Link to={`/academia/fase/${f.phase.id}?trilha=${principal!.id}`}>Abrir <ChevronRight className="h-4 w-4" /></Link></Button>}
                  </div>
                </div>
                {travada && <div className="mt-4 text-sm rounded-xl border p-3 ac-warn-bg flex gap-2"><Lock className="h-4 w-4 ac-warn shrink-0 mt-0.5" />{MENSAGEM_TRAVA}</div>}
                {atrasada && !travada && <div className="mt-3 text-sm ac-warn flex items-center gap-2"><AlertTriangle className="h-4 w-4" />Atrasada: {atrasadas} tarefa(s) obrigatória(s) após o dia {f.phase.dia_fim}.</div>}
                {ehAtual && !travada && (
                  <div className="mt-4 grid sm:grid-cols-2 gap-2">
                    {f.modulos.map((m) => {
                      const mp = progresso(m.tarefas);
                      return (
                        <div key={m.module.id} className="rounded-xl border p-3">
                          <div className="text-xs text-muted-foreground">{m.module.numero_label} · {m.module.janela_label}</div>
                          <div className="font-semibold">{m.module.titulo}</div>
                          <Progress value={mp} className="h-1.5 mt-2" />
                        </div>);
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </section>

      {extensoes.length > 0 && (
        <section>
          <h2 className="text-xl mb-3 flex items-center gap-2"><Flag className="h-5 w-5 text-primary" />Trilhas de extensão</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {extensoes.map((e) => {
              const ts = trilha!.tarefas.filter((t) => t.user_track_id === e.id);
              const fr = cat?.frentes.find((f) => f.id === e.frente_id);
              const ph = ts[0]?.task.module?.phase;
              return (
                <Link key={e.id} to={ph ? `/academia/fase/${ph.id}?trilha=${e.id}` : "#"} className="ac-card p-4 block hover:border-primary">
                  <div className="font-semibold">{fr?.nome}</div>
                  <Progress value={progresso(ts)} className="h-1.5 mt-2" />
                </Link>);
            })}
          </div>
        </section>
      )}
    </div>
  );
}
