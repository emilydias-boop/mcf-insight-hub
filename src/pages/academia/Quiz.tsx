import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, XCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { adb, erroAcademia } from "@/lib/academia";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface Q { id: string; enunciado: string; alternativas: string[] }

export default function Quiz() {
  const { quizId } = useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["academia", "quiz", quizId, user?.id],
    queryFn: async () => {
      const [q, p, a] = await Promise.all([
        adb.from("academia_quizzes").select("*").eq("id", quizId).single(),
        adb.rpc("academia_quiz_perguntas", { _quiz_id: quizId }),
        adb.from("academia_quiz_attempts").select("*").eq("quiz_id", quizId).eq("user_id", user!.id).order("criado_em"),
      ]);
      return { quiz: q.data, perguntas: (p.data ?? []) as Q[], tentativas: a.data ?? [] };
    },
    enabled: !!user?.id,
  });
  const [idx, setIdx] = useState(0);
  const [resp, setResp] = useState<Record<string, number>>({});
  const [conf, setConf] = useState<{ acertou: boolean; correta: number; explicacao: string } | null>(null);
  const [final, setFinal] = useState<{ nota: number; aprovado: boolean; tentativas_restantes: number } | null>(null);
  const [iniciado, setIniciado] = useState(false);

  if (!data) return <div className="text-muted-foreground">Carregando quiz…</div>;
  const { quiz, perguntas, tentativas } = data;
  const aprovadoAntes = tentativas.some((t: { aprovado: boolean }) => t.aprovado);
  const restantes = quiz.tentativas_max - tentativas.length;

  const reiniciar = () => { setIdx(0); setResp({}); setConf(null); setFinal(null); setIniciado(true); };

  if (!iniciado || final) {
    return (
      <div className="ac-card p-8 max-w-xl space-y-4">
        <div className="ac-eyebrow">Quiz · nível {quiz.nivel}</div>
        <h1 className="text-2xl">{quiz.titulo}</h1>
        {final ? (
          <div className="space-y-2">
            <div className={cn("text-5xl font-display", final.aprovado ? "text-primary" : "ac-warn")}>{final.nota}</div>
            <p>{final.aprovado ? "Aprovado! A tarefa foi concluída." : `Abaixo da nota mínima (${quiz.nota_minima}). Tentativas restantes: ${final.tentativas_restantes}.`}</p>
          </div>
        ) : (
          <p className="text-muted-foreground">{perguntas.length} questões · nota mínima {quiz.nota_minima} · {restantes} de {quiz.tentativas_max} tentativas restantes.</p>
        )}
        {aprovadoAntes && !final && <p className="text-primary font-semibold">Você já foi aprovado neste quiz.</p>}
        <div className="flex gap-2">
          {restantes - (final ? 0 : 0) > 0 && !(final?.aprovado) && (!final || final.tentativas_restantes > 0) &&
            <Button onClick={reiniciar}>{final ? "Tentar de novo" : "Começar"}</Button>}
          <Button asChild variant="outline"><Link to="/academia">Voltar à trilha</Link></Button>
        </div>
      </div>
    );
  }

  const q = perguntas[idx];
  const responder = async (i: number) => {
    if (conf) return;
    setResp((r) => ({ ...r, [q.id]: i }));
    const { data: c } = await adb.rpc("academia_quiz_conferir", { _question_id: q.id, _resposta: i });
    setConf(c);
  };
  const proxima = async () => {
    if (idx < perguntas.length - 1) { setIdx(idx + 1); setConf(null); return; }
    const { data: r, error } = await adb.rpc("academia_quiz_finalizar", { _quiz_id: quizId, _respostas: resp });
    if (error) return toast.error(erroAcademia(error));
    setFinal(r);
    qc.invalidateQueries({ queryKey: ["academia"] });
  };

  return (
    <div className="max-w-2xl space-y-4">
      <Progress value={((idx + (conf ? 1 : 0)) / perguntas.length) * 100} className="h-2" />
      <div className="ac-card p-6">
        <div className="ac-eyebrow">Questão {idx + 1} de {perguntas.length}</div>
        <h2 className="text-xl mt-2">{q.enunciado}</h2>
        <div className="mt-4 space-y-2">
          {q.alternativas.map((a, i) => {
            const escolhida = resp[q.id] === i;
            const certa = conf && conf.correta === i;
            return (
              <button key={i} onClick={() => responder(i)} disabled={!!conf}
                className={cn("w-full text-left p-4 rounded-xl border transition-colors",
                  !conf && "hover:border-primary", certa && "border-primary bg-primary/10", conf && escolhida && !certa && "ac-warn-bg")}>
                {a}
              </button>);
          })}
        </div>
        {conf && (
          <div className="mt-4 rounded-xl border p-4 text-sm">
            <div className={cn("flex items-center gap-2 font-semibold mb-1", conf.acertou ? "text-primary" : "ac-warn")}>
              {conf.acertou ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}{conf.acertou ? "Correto" : "Incorreto"}
            </div>
            {conf.explicacao}
          </div>
        )}
        {conf && <Button className="mt-4" onClick={proxima}>{idx < perguntas.length - 1 ? "Próxima" : "Ver nota"}</Button>}
      </div>
    </div>
  );
}
