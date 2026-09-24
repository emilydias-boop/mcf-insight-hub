import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Paperclip } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { adb, USER_TASK_SELECT, TIPO_LABEL, type AUserTask, type AMilestone, type APerfil } from "@/lib/academia";
import { useAcademiaRpc, useAcademiaIsAdmin } from "@/hooks/useAcademia";
import { useMeusVinculados } from "./AcademiaLayout";
import { abrirEvidencia } from "@/components/academia/TarefaItem";
import { MarcoCard } from "@/components/academia/MarcoCard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

function ItemValidacao({ ut, pessoa }: { ut: AUserTask; pessoa?: APerfil }) {
  const validar = useAcademiaRpc("academia_validar_tarefa");
  const [reprovando, setReprovando] = useState(false);
  const [coment, setComent] = useState("");
  return (
    <div className="ac-card p-5">
      <div className="text-xs text-muted-foreground">{pessoa?.nome} · {ut.task.module?.phase?.titulo} · {TIPO_LABEL[ut.task.tipo_validacao]}</div>
      <div className="font-semibold mt-1">{ut.task.titulo}</div>
      <div className="text-xs text-muted-foreground mt-1">Enviada em {ut.enviada_em ? new Date(ut.enviada_em).toLocaleString("pt-BR") : "—"}{ut.reprovacoes ? ` · já devolvida ${ut.reprovacoes}x` : ""}</div>
      {ut.evidencia_url && <button className="mt-2 text-sm underline inline-flex items-center gap-1" onClick={() => abrirEvidencia(ut.evidencia_url!)}><Paperclip className="h-4 w-4" />Ver evidência</button>}
      {reprovando && <Textarea className="mt-3" placeholder="Motivo da reprovação (obrigatório)" value={coment} onChange={(e) => setComent(e.target.value)} />}
      <div className="flex gap-2 mt-3">
        {!reprovando ? (
          <>
            <Button size="sm" disabled={validar.isPending} onClick={() => validar.mutate({ _user_task_id: ut.id, _aprovar: true, _comentario: null })}>Aprovar</Button>
            <Button size="sm" variant="outline" onClick={() => setReprovando(true)}>Reprovar</Button>
          </>
        ) : (
          <>
            <Button size="sm" variant="destructive" disabled={!coment.trim() || validar.isPending}
              onClick={() => validar.mutate({ _user_task_id: ut.id, _aprovar: false, _comentario: coment })}>Confirmar reprovação</Button>
            <Button size="sm" variant="ghost" onClick={() => setReprovando(false)}>Cancelar</Button>
          </>
        )}
      </div>
    </div>
  );
}

export default function Validacoes() {
  const { user } = useAuth();
  const isAdmin = useAcademiaIsAdmin();
  const { data: vinculados = [] } = useMeusVinculados();
  const { data } = useQuery({
    queryKey: ["academia", "fila", user?.id, isAdmin],
    queryFn: async () => {
      const [t, m, p] = await Promise.all([
        adb.from("academia_user_tasks").select(USER_TASK_SELECT).eq("status", "enviada").order("enviada_em"),
        adb.from("academia_milestones").select("*").is("fechado_em", null),
        isAdmin ? adb.from("academia_perfis").select("*") : Promise.resolve({ data: null }),
      ]);
      return { tarefas: (t.data ?? []) as AUserTask[], marcos: (m.data ?? []) as AMilestone[], todos: (p.data ?? null) as APerfil[] | null };
    },
  });
  const pessoas: APerfil[] = data?.todos ?? (vinculados as APerfil[]);
  const pp = (id: string) => pessoas.find((p) => p.id === id);
  const meuPapel = (uid: string, tipo?: string): boolean => {
    if (isAdmin) return true;
    const p = pp(uid); if (!p) return false;
    if (tipo === "padrinho") return p.padrinho_id === user?.id;
    return p.gestor_id === user?.id;
  };
  const fila = (data?.tarefas ?? []).filter((t) => meuPapel(t.user_id, t.task.tipo_validacao));
  const papelMarco = (uid: string): "gestor" | "padrinho" | "admin" | null => {
    const p = pp(uid);
    if (p?.gestor_id === user?.id) return "gestor";
    if (p?.padrinho_id === user?.id) return "padrinho";
    return isAdmin ? "admin" : null;
  };

  return (
    <div className="max-w-4xl space-y-8">
      <div><div className="ac-eyebrow">Gestor e padrinho</div><h1 className="text-3xl">Fila de validações</h1></div>
      <section className="space-y-3">
        <h2 className="text-lg">Tarefas aguardando ({fila.length})</h2>
        {fila.length === 0 && <p className="text-muted-foreground text-sm">Nada pendente por aqui.</p>}
        {fila.map((ut) => <ItemValidacao key={ut.id} ut={ut} pessoa={pp(ut.user_id)} />)}
      </section>
      <section className="space-y-3">
        <h2 className="text-lg">Marcos para assinar</h2>
        {(data?.marcos ?? []).filter((m) => papelMarco(m.user_id)).map((m) => (
          <MarcoCard key={m.id} marco={m} papel={papelMarco(m.user_id)!} nome={pp(m.user_id)?.nome} />
        ))}
        {!(data?.marcos ?? []).some((m) => papelMarco(m.user_id)) && <p className="text-muted-foreground text-sm">Nenhum marco aberto.</p>}
      </section>
    </div>
  );
}
