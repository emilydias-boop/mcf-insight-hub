import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Check, FileUp, UserCheck, HeartHandshake, HelpCircle, MousePointerClick, Wrench, Paperclip, Lock, Clock } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { adb, TIPO_LABEL, erroAcademia, type AUserTask, type TipoValidacao } from "@/lib/academia";
import { useAcademiaRpc } from "@/hooks/useAcademia";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ICONES: Record<TipoValidacao, typeof Check> = {
  auto: MousePointerClick, gestor: UserCheck, padrinho: HeartHandshake, quiz: HelpCircle, evidencia: FileUp, pratica: Wrench,
};

export async function abrirEvidencia(path: string) {
  const { data, error } = await adb.storage.from("academia-evidencias").createSignedUrl(path, 300);
  if (error) return toast.error("Não foi possível abrir a evidência.");
  window.open(data.signedUrl, "_blank");
}

export function Checkbox({ marcado, onClick, disabled }: { marcado: boolean; onClick?: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-pressed={marcado}
      className={cn("h-6 w-6 shrink-0 rounded-md border-2 grid place-items-center transition-colors",
        marcado ? "bg-primary border-primary text-primary-foreground" : "border-border hover:border-primary",
        disabled && "opacity-50 cursor-not-allowed")}>
      {marcado && <Check className="h-4 w-4" strokeWidth={3} />}
    </button>
  );
}

export function TarefaItem({ ut, travada, atuacao, somenteLeitura }: { ut: AUserTask; travada: boolean; atuacao?: string | null; somenteLeitura?: boolean }) {
  const { user } = useAuth();
  const t = ut.task;
  const Icone = ICONES[t.tipo_validacao];
  const enviar = useAcademiaRpc("academia_enviar_tarefa");
  const desmarcar = useAcademiaRpc("academia_desmarcar_tarefa");
  const fileRef = useRef<HTMLInputElement>(null);
  const [subindo, setSubindo] = useState(false);
  const aprovada = ut.status === "aprovada";
  const enviada = ut.status === "enviada";
  const bloqueado = travada || somenteLeitura;
  const precisaArquivo = t.tipo_validacao === "evidencia" || t.tipo_validacao === "pratica";

  const upload = async (f: File) => {
    setSubindo(true);
    try {
      const path = `${user!.id}/${ut.id}/${Date.now()}-${f.name.replace(/[^\w.-]/g, "_")}`;
      const { error } = await adb.storage.from("academia-evidencias").upload(path, f);
      if (error) throw error;
      await enviar.mutateAsync({ _user_task_id: ut.id, _evidencia_url: path });
      toast.success(t.tipo_validacao === "pratica" ? "Evidência enviada ao gestor." : "Evidência registrada.");
    } catch (e) { toast.error(erroAcademia(e)); } finally { setSubindo(false); }
  };

  const variante = t.variantes ? (atuacao && t.variantes[atuacao] ? [t.variantes[atuacao]] : Object.values(t.variantes)) : [];

  return (
    <div className={cn("flex gap-3 p-4 rounded-2xl border bg-card/40", aprovada && "border-primary/30")}>
      {t.tipo_validacao === "auto" && !bloqueado ? (
        <Checkbox marcado={aprovada} disabled={aprovada || enviar.isPending}
          onClick={() => enviar.mutate({ _user_task_id: ut.id, _evidencia_url: null })} />
      ) : (
        <div className={cn("h-6 w-6 shrink-0 rounded-md border-2 grid place-items-center",
          aprovada ? "bg-primary border-primary text-primary-foreground" : enviada ? "ac-warn-bg ac-warn" : "border-border")}>
          {aprovada ? <Check className="h-4 w-4" strokeWidth={3} /> : enviada ? <Clock className="h-3.5 w-3.5" /> : bloqueado ? <Lock className="h-3 w-3 text-muted-foreground" /> : null}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className={cn("font-semibold leading-snug", aprovada && "text-muted-foreground")}>{t.titulo}</div>
        {t.detalhe && <div className="text-sm text-muted-foreground mt-1">{t.detalhe}</div>}
        {variante.map((v) => <div key={v} className="text-sm mt-1 border-l-2 border-primary pl-2">{v}</div>)}
        <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><Icone className="h-3.5 w-3.5" />{TIPO_LABEL[t.tipo_validacao]}</span>
          <span className="font-bold text-primary">+{t.xp} XP</span>
          {!t.obrigatoria && <span>Opcional</span>}
          {enviada && <span className="ac-warn font-semibold">Aguardando validação</span>}
          {ut.evidencia_url && <button className="inline-flex items-center gap-1 underline" onClick={() => abrirEvidencia(ut.evidencia_url!)}><Paperclip className="h-3 w-3" />Evidência</button>}
        </div>
        {ut.comentario_validador && ut.status === "pendente" && (
          <div className="mt-2 text-sm rounded-xl border p-2 ac-warn-bg"><b className="ac-warn">Devolvida:</b> {ut.comentario_validador}</div>
        )}
      </div>
      {!bloqueado && !aprovada && (
        <div className="flex flex-col gap-2 items-end">
          {t.tipo_validacao === "quiz" && t.quiz_id && <Button asChild size="sm"><Link to={`/academia/quiz/${t.quiz_id}`}>Fazer quiz</Link></Button>}
          {precisaArquivo && !enviada && (
            <>
              <input ref={fileRef} type="file" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
              <Button size="sm" disabled={subindo} onClick={() => fileRef.current?.click()}><FileUp className="h-4 w-4 mr-1" />{subindo ? "Enviando…" : "Enviar evidência"}</Button>
            </>
          )}
          {(t.tipo_validacao === "gestor" || t.tipo_validacao === "padrinho") && !enviada && (
            <Button size="sm" disabled={enviar.isPending} onClick={() => enviar.mutate({ _user_task_id: ut.id, _evidencia_url: null })}>Pedir validação</Button>
          )}
          {enviada && <Button size="sm" variant="ghost" onClick={() => desmarcar.mutate({ _user_task_id: ut.id })}>Cancelar envio</Button>}
        </div>
      )}
    </div>
  );
}
