import { Link, useParams } from "react-router-dom";
import { Lock, ArrowLeft } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useCatalogo, useTrilhaDoUsuario, useAcademiaIsAdmin, useAcademiaRpc } from "@/hooks/useAcademia";
import { adb, agruparPorFase, faseConcluida } from "@/lib/academia";
import { Button } from "@/components/ui/button";

function useAcesso() {
  const { user } = useAuth();
  const isAdmin = useAcademiaIsAdmin();
  const { data } = useTrilhaDoUsuario(user?.id);
  const principal = data?.tracks.find((t) => t.tipo === "principal");
  const fases = agruparPorFase((data?.tarefas ?? []).filter((t) => t.user_track_id === principal?.id));
  const ok = (c: string) => { const f = fases.find((x) => x.phase.codigo === c); return !!f && faseConcluida(f); };
  const concluiu90 = !!data?.marcos.some((m) => m.codigo === "conclusao_90" && m.fechado_em);
  return { liberada: isAdmin || (ok("fase_0") && ok("fase_1")), concluiu90, tracks: data?.tracks ?? [] };
}

export default function Biblioteca() {
  const { slug } = useParams();
  const { data: cat } = useCatalogo();
  const { liberada, concluiu90, tracks } = useAcesso();
  const abrir = useAcademiaRpc("academia_abrir_extensao", "Trilha de extensão aberta. Ela aparece em Minha Trilha.");
  const prod = cat?.produtos.find((p) => p.slug === slug);
  const { data: quiz } = useQuery({
    queryKey: ["academia", "quiz-produto", prod?.id], enabled: !!prod,
    queryFn: async () => (await adb.from("academia_quizzes").select("*").eq("produto_id", prod!.id).order("nivel")).data ?? [],
  });

  if (!cat) return <div className="text-muted-foreground">Carregando…</div>;
  if (!liberada) return (
    <div className="ac-card p-8 max-w-xl"><Lock className="h-6 w-6 ac-warn mb-2" />
      <h1 className="text-2xl">Biblioteca das 5 frentes</h1>
      <p className="text-muted-foreground mt-2">A biblioteca abre a partir da Fase 2, depois que as Fases 0 e 1 estiverem concluídas.</p></div>
  );

  if (!slug) return (
    <div className="space-y-6 max-w-5xl">
      <div><div className="ac-eyebrow">Ecossistema de alavancagem</div><h1 className="text-3xl">Biblioteca das 5 frentes</h1></div>
      <div className="grid md:grid-cols-2 gap-4">
        {cat.produtos.map((p) => { const f = cat.frentes.find((x) => x.id === p.frente_id);
          return (
            <Link key={p.id} to={`/academia/biblioteca/${p.slug}`} className="ac-card p-5 hover:border-primary block">
              <span className="h-2 w-10 rounded-full block mb-3" style={{ background: f?.cor ?? undefined }} />
              <h2 className="text-xl">{p.nome}</h2>
              <p className="text-sm text-muted-foreground mt-1">{p.resumo}</p>
            </Link>); })}
      </div>
    </div>
  );
  if (!prod) return <div>Frente não encontrada.</div>;
  const temExt = tracks.some((t) => t.tipo === "extensao" && t.frente_id === prod.frente_id) || tracks.some((t) => t.tipo === "principal" && t.frente_id === prod.frente_id);

  return (
    <div className="max-w-3xl space-y-5">
      <Link to="/academia/biblioteca" className="text-sm text-muted-foreground inline-flex items-center gap-1"><ArrowLeft className="h-4 w-4" />Biblioteca</Link>
      <h1 className="text-3xl">{prod.nome}</h1>
      {[["O que é", prod.resumo], ["Para quem", prod.para_quem], ["Você precisa saber", prod.voce_precisa_saber], ["Material da Academia", prod.material]].map(([t, v]) => v && (
        <div key={t} className="ac-card p-5"><div className="ac-eyebrow mb-1">{t}</div><p className="whitespace-pre-wrap">{v}</p></div>
      ))}
      <div className="flex flex-wrap gap-2">
        {(quiz ?? []).map((q: { id: string; nivel: number }) => <Button key={q.id} asChild variant="outline"><Link to={`/academia/quiz/${q.id}`}>Quiz nível {q.nivel}</Link></Button>)}
        {concluiu90 && !temExt && <Button onClick={() => abrir.mutate({ _frente_id: prod.frente_id })} disabled={abrir.isPending}>Abrir trilha de extensão</Button>}
      </div>
      {!concluiu90 && <p className="text-xs text-muted-foreground">Trilhas de extensão em outras frentes abrem após a conclusão dos 90 dias.</p>}
    </div>
  );
}
