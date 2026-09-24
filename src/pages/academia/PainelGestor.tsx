import { useQuery } from "@tanstack/react-query";
import { Lock } from "lucide-react";
import { useAcademiaIsAdmin, useCatalogo } from "@/hooks/useAcademia";
import { useMeusVinculados } from "./AcademiaLayout";
import { adb, USER_TASK_SELECT, agruparPorFase, faseConcluida, progresso, diasDesde, type AUserTask, type APerfil } from "@/lib/academia";
import { Progress } from "@/components/ui/progress";

export default function PainelGestor() {
  const isAdmin = useAcademiaIsAdmin();
  const { data: vinc = [] } = useMeusVinculados();
  const { data: cat } = useCatalogo();
  const { data } = useQuery({
    queryKey: ["academia", "painel", isAdmin],
    queryFn: async () => {
      const [p, t, tr] = await Promise.all([
        isAdmin ? adb.from("academia_perfis").select("*").order("nome") : Promise.resolve({ data: null }),
        adb.from("academia_user_tasks").select(USER_TASK_SELECT),
        adb.from("academia_user_tracks").select("*").eq("tipo", "principal"),
      ]);
      return { perfis: p.data as APerfil[] | null, tarefas: (t.data ?? []) as AUserTask[], tracks: tr.data ?? [] };
    },
  });
  const pessoas: APerfil[] = data?.perfis ?? (vinc as APerfil[]);

  return (
    <div className="max-w-5xl space-y-6">
      <div><div className="ac-eyebrow">Acompanhamento</div><h1 className="text-3xl">{isAdmin ? "Todos os colaboradores" : "Sua equipe"}</h1></div>
      {pessoas.length === 0 && <p className="text-muted-foreground">Nenhum colaborador vinculado a você.</p>}
      <div className="grid gap-3">
        {pessoas.map((p) => {
          const tr = data?.tracks.find((t: { user_id: string }) => t.user_id === p.id);
          const ts = (data?.tarefas ?? []).filter((t) => t.user_track_id === tr?.id);
          const fases = agruparPorFase(ts);
          const atual = fases.find((f) => !faseConcluida(f));
          const f0 = fases.find((f) => f.phase.codigo === "fase_0");
          const travado = f0 && !faseConcluida(f0);
          const aguardando = ts.filter((t) => t.status === "enviada").length;
          const devolvidas = ts.filter((t) => t.status === "pendente" && t.comentario_validador).length;
          const dia = diasDesde(p.data_inicio);
          const atrasada = atual && atual.phase.dia_fim != null && dia > atual.phase.dia_fim;
          return (
            <div key={p.id} className="ac-card p-5 grid md:grid-cols-[1.5fr_1fr_1fr] gap-4 items-center">
              <div>
                <div className="font-bold">{p.nome}</div>
                <div className="text-xs text-muted-foreground">{cat?.frentes.find((f) => f.id === p.frente_id)?.nome} · {p.funcao ?? "—"} · {p.nivel}</div>
              </div>
              <div>
                <div className="text-sm">{tr ? (atual ? atual.phase.titulo : "Trilha concluída") : "Ainda não acessou"}</div>
                <div className="text-xs text-muted-foreground">Dia {dia} de 90</div>
                <Progress value={progresso(ts)} className="h-1.5 mt-1" />
              </div>
              <div className="text-sm space-y-1">
                {travado && <div className="ac-warn flex items-center gap-1"><Lock className="h-3.5 w-3.5" />Fase 0 aberta</div>}
                {atrasada && <div className="ac-warn">Fase atual atrasada</div>}
                {aguardando > 0 && <div>{aguardando} aguardando validação</div>}
                {devolvidas > 0 && <div className="ac-warn">{devolvidas} devolvida(s)</div>}
              </div>
            </div>);
        })}
      </div>
    </div>
  );
}
