import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ListPlus } from "lucide-react";
import { toast } from "sonner";
import { adb, erroAcademia, progresso, type APerfil } from "@/lib/academia";
import { disponibilidadeTrilha, type TemplateAtribuicao } from "@/lib/academiaAtribuicao";
import { useTrilhaDoUsuario } from "@/hooks/useAcademia";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";

const SITUACAO = { ja_atribuida: "Já atribuída", ja_contemplada: "Já contemplada na trilha atual", frente_ja_atribuida: "Já possui trilha desta frente", sem_tarefas: "Sem tarefas", disponivel: "" };

export default function AtribuirTrilhas() {
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [userId, setUserId] = useState("");
  const [selecionadas, setSelecionadas] = useState<string[]>([]);
  const { data, isLoading, error } = useQuery({
    queryKey: ["academia", "atribuicao-catalogo"],
    queryFn: async () => {
      const [p, t, tasks] = await Promise.all([
        adb.from("academia_perfis").select("*").neq("status", "encerrado").order("nome"),
        adb.from("academia_track_templates").select("id,nome,frente_id,descricao").eq("publicado", true).order("nome"),
        adb.from("academia_tasks").select("id,module:academia_modules(phase:academia_phases(track_template_id))"),
      ]);
      if (p.error) throw p.error;
      if (t.error) throw t.error;
      if (tasks.error) throw tasks.error;
      const porTemplate: Record<string, string[]> = {};
      for (const task of tasks.data ?? []) {
        const templateId = task.module?.phase?.track_template_id;
        if (templateId) (porTemplate[templateId] ??= []).push(task.id);
      }
      return { pessoas: p.data as APerfil[], templates: t.data as TemplateAtribuicao[], porTemplate };
    },
  });
  const { data: trilha, isLoading: carregandoTrilha, error: erroTrilha } = useTrilhaDoUsuario(userId || undefined);
  const existentes = new Set(trilha?.tarefas.map((t) => t.task_id) ?? []);
  const situacao = (t: TemplateAtribuicao) => disponibilidadeTrilha(t, trilha?.tracks ?? [], data?.porTemplate[t.id] ?? [], existentes);
  const atribuir = useMutation({
    mutationFn: async () => {
      const { data: result, error: err } = await adb.rpc("academia_atribuir_trilhas", { _user_id: userId, _template_ids: selecionadas });
      if (err) throw err;
      return result as { resultado: string }[];
    },
    onSuccess: (result) => {
      setSelecionadas([]);
      qc.invalidateQueries({ queryKey: ["academia"] });
      const novas = result.filter((r) => r.resultado === "atribuida").length;
      toast.success(novas ? `${novas} trilha(s) atribuída(s).` : "As trilhas selecionadas já estão contempladas.");
    },
    onError: (err) => toast.error(erroAcademia(err)),
  });
  if (isLoading) return <p className="text-muted-foreground">Carregando colaboradores e trilhas…</p>;
  if (error) return <p className="ac-warn">{erroAcademia(error)}</p>;
  const pessoas = data?.pessoas.filter((p) => `${p.nome} ${p.email ?? ""}`.toLocaleLowerCase("pt-BR").includes(busca.toLocaleLowerCase("pt-BR"))) ?? [];
  return (
    <div className="max-w-4xl space-y-6">
      <h2 className="text-xl">Atribuir trilhas</h2>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-2"><Label htmlFor="buscar-colaborador">Buscar colaborador</Label><Input id="buscar-colaborador" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome ou e-mail" /></div>
        <div className="space-y-2"><Label>Colaborador</Label><Select value={userId} disabled={atribuir.isPending} onValueChange={(id) => { setUserId(id); setSelecionadas([]); }}><SelectTrigger><SelectValue placeholder="Selecione um colaborador" /></SelectTrigger><SelectContent>{pessoas.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}</SelectContent></Select></div>
      </div>
      {userId && (carregandoTrilha ? <p className="text-muted-foreground">Carregando trilhas do colaborador…</p> : erroTrilha ? <p className="ac-warn">{erroAcademia(erroTrilha)}</p> : <>
        <section className="space-y-3">
          <h3 className="text-lg">Trilhas disponíveis</h3>
          {data?.templates.map((t) => {
            const estado = situacao(t);
            const disabled = estado !== "disponivel" || atribuir.isPending;
            return <label key={t.id} className="flex items-start gap-3 border-b py-3 cursor-pointer">
              <Checkbox className="mt-1" checked={selecionadas.includes(t.id)} disabled={disabled} onCheckedChange={(checked) => setSelecionadas((ids) => checked === true ? [...ids, t.id] : ids.filter((id) => id !== t.id))} />
              <span className="min-w-0 flex-1"><span className="font-semibold block">{t.nome}</span>{t.descricao && <span className="text-sm text-muted-foreground block">{t.descricao}</span>}{estado !== "disponivel" && <span className="text-xs text-muted-foreground flex items-center gap-1 mt-1"><CheckCircle2 className="h-3.5 w-3.5" />{SITUACAO[estado]}</span>}</span>
            </label>;
          })}
          <Button disabled={!selecionadas.length || atribuir.isPending} onClick={() => atribuir.mutate()}><ListPlus className="h-4 w-4 mr-2" />{atribuir.isPending ? "Atribuindo…" : `Atribuir trilhas${selecionadas.length ? ` (${selecionadas.length})` : ""}`}</Button>
        </section>
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-lg">Trilhas já atribuídas</h3><Button variant="link" asChild><Link to={`/academia/equipe/${userId}`}>Ver evolução do colaborador</Link></Button></div>
          {!trilha?.tracks.length && <p className="text-sm text-muted-foreground">Nenhuma trilha montada ainda.</p>}
          {trilha?.tracks.map((track) => { const ts = trilha.tarefas.filter((t) => t.user_track_id === track.id); const pct = progresso(ts); return <div key={track.id} className="border-b py-3"><div className="flex justify-between gap-3 text-sm"><span>{data?.templates.find((t) => t.id === track.track_template_id)?.nome ?? "Trilha"} · {track.tipo === "principal" ? "Principal" : "Adicional"}</span><span>{pct}%</span></div><Progress value={pct} className="h-1.5 mt-2" /></div>; })}
        </section>
      </>)}
    </div>
  );
}