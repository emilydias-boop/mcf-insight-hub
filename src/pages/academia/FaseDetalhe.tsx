import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Lock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useMeuPerfilAcademia, useTrilhaDoUsuario } from "@/hooks/useAcademia";
import { agruparPorFase, faseConcluida, progresso, MENSAGEM_TRAVA } from "@/lib/academia";
import { TarefaItem } from "@/components/academia/TarefaItem";
import { Progress } from "@/components/ui/progress";

export default function FaseDetalhe() {
  const { phaseId } = useParams();
  const [sp] = useSearchParams();
  const trilhaId = sp.get("trilha");
  const { user } = useAuth();
  const { data: perfil } = useMeuPerfilAcademia();
  const { data, isLoading } = useTrilhaDoUsuario(user?.id);
  if (isLoading || !data) return <div className="text-muted-foreground">Carregando…</div>;

  const track = data.tracks.find((t) => t.id === trilhaId) ?? data.tracks.find((t) => t.tipo === "principal");
  const fases = agruparPorFase(data.tarefas.filter((t) => t.user_track_id === track?.id));
  const fase = fases.find((f) => f.phase.id === phaseId);
  if (!fase) return <div>Fase não encontrada.</div>;
  const f0 = fases.find((f) => f.phase.codigo === "fase_0");
  const travada = track?.tipo === "principal" && fase.phase.codigo !== "fase_0" && !!f0 && !faseConcluida(f0);

  return (
    <div className="max-w-4xl space-y-6">
      <Link to="/academia" className="text-sm text-muted-foreground inline-flex items-center gap-1 hover:text-foreground"><ArrowLeft className="h-4 w-4" />Minha Trilha</Link>
      <div className="ac-card p-6">
        <div className="ac-eyebrow">{fase.phase.periodo_label} · Conduz: {fase.phase.quem_conduz}</div>
        <h1 className="text-3xl mt-1">{fase.phase.titulo}</h1>
        <p className="text-muted-foreground mt-1">{fase.phase.foco}</p>
        <Progress value={progresso(fase.tarefas)} className="h-2 mt-4" />
      </div>
      {travada && <div className="rounded-2xl border p-4 ac-warn-bg flex gap-2 text-sm"><Lock className="h-4 w-4 ac-warn mt-0.5" />{MENSAGEM_TRAVA}</div>}
      {fase.modulos.map((m) => (
        <section key={m.module.id} className="space-y-3">
          <div>
            <div className="ac-eyebrow">{m.module.numero_label} · {m.module.janela_label}</div>
            <h2 className="text-xl">{m.module.titulo}</h2>
            {m.module.objetivo && <p className="text-sm text-muted-foreground">{m.module.objetivo}</p>}
          </div>
          {m.tarefas.map((ut) => <TarefaItem key={ut.id} ut={ut} travada={travada} atuacao={perfil?.atuacao_funil} />)}
        </section>
      ))}
      {fase.phase.codigo === "fase_0" && (
        <Link to="/academia/combinado-pj" className="block ac-card p-4 hover:border-primary text-sm">Consulte a página de referência do <b>Combinado PJ</b> →</Link>
      )}
    </div>
  );
}
