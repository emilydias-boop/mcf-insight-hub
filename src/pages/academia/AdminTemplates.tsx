import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { toast } from "sonner";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { adb, erroAcademia, TIPO_LABEL, type APhase, type AModule, type ATask, type TipoValidacao } from "@/lib/academia";
import { useCatalogo } from "@/hooks/useAcademia";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

export default function AdminTemplates() {
  const qc = useQueryClient();
  const { data: cat } = useCatalogo();
  const { data: templates = [] } = useQuery({ queryKey: ["academia", "tpls"], queryFn: async () => (await adb.from("academia_track_templates").select("*").order("created_at")).data ?? [] });
  const [sel, setSel] = useState("");
  const tplId = sel || templates[0]?.id;
  const { data, refetch } = useQuery({
    queryKey: ["academia", "tpl-arvore", tplId], enabled: !!tplId,
    queryFn: async () => {
      const ph = ((await adb.from("academia_phases").select("*").eq("track_template_id", tplId).order("ordem")).data ?? []) as APhase[];
      const ids = ph.map((p) => p.id);
      const md = ids.length ? ((await adb.from("academia_modules").select("*").in("phase_id", ids).order("ordem")).data ?? []) as AModule[] : [];
      const mids = md.map((m) => m.id);
      const tk = mids.length ? ((await adb.from("academia_tasks").select("*").in("module_id", mids).order("ordem")).data ?? []) as ATask[] : [];
      return { ph, md, tk };
    },
  });
  const done = (e: unknown) => { if (e) toast.error(erroAcademia(e)); refetch(); qc.invalidateQueries({ queryKey: ["academia", "catalogo"] }); };

  const reordenar = async (tabela: string, ids: string[]) => {
    const r = await Promise.all(ids.map((id, i) => adb.from(tabela).update({ ordem: i + 1 }).eq("id", id)));
    done(r.find((x) => x.error)?.error);
  };
  const onDragEnd = (r: DropResult) => {
    if (!r.destination || !data) return;
    const [tipo, pai] = r.type.split(":");
    const lista = tipo === "fase" ? data.ph.map((p) => p.id)
      : tipo === "modulo" ? data.md.filter((m) => m.phase_id === pai).map((m) => m.id)
      : data.tk.filter((t) => t.module_id === pai).map((t) => t.id);
    const [mv] = lista.splice(r.source.index, 1); lista.splice(r.destination.index, 0, mv);
    reordenar(tipo === "fase" ? "academia_phases" : tipo === "modulo" ? "academia_modules" : "academia_tasks", lista);
  };
  const upd = async (tabela: string, id: string, patch: Record<string, unknown>) => done((await adb.from(tabela).update(patch).eq("id", id)).error);
  const del = async (tabela: string, id: string) => { if (confirm("Excluir? Tarefas já atribuídas a pessoas também serão removidas.")) done((await adb.from(tabela).delete().eq("id", id)).error); };
  const addModulo = async (phase: string) => done((await adb.from("academia_modules").insert({ phase_id: phase, titulo: "Novo módulo", ordem: 99 })).error);
  const addTarefa = async (mod: string) => done((await adb.from("academia_tasks").insert({ module_id: mod, titulo: "Nova tarefa", ordem: 99 })).error);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <Select value={tplId ?? ""} onValueChange={setSel}>
          <SelectTrigger className="w-80"><SelectValue placeholder="Template" /></SelectTrigger>
          <SelectContent>{templates.map((t: { id: string; nome: string; frente_id: string | null }) => (
            <SelectItem key={t.id} value={t.id}>{t.nome}{t.frente_id ? "" : " (global)"}</SelectItem>))}</SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">Arraste para reordenar. Mudanças valem para quem receber a trilha depois; trilhas já montadas mantêm as tarefas atuais.</p>
      </div>
      {data && (
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="fases" type="fase">
            {(p) => (
              <div ref={p.innerRef} {...p.droppableProps} className="space-y-4">
                {data.ph.map((ph, i) => (
                  <Draggable key={ph.id} draggableId={ph.id} index={i}>
                    {(d) => (
                      <div ref={d.innerRef} {...d.draggableProps} className="ac-card p-4">
                        <div className="flex items-center gap-2">
                          <span {...d.dragHandleProps}><GripVertical className="h-4 w-4 text-muted-foreground" /></span>
                          <span className="ac-eyebrow">{ph.codigo}</span>
                          <Input className="font-bold" defaultValue={ph.titulo} onBlur={(e) => e.target.value !== ph.titulo && upd("academia_phases", ph.id, { titulo: e.target.value })} />
                          <Input className="w-32" defaultValue={ph.periodo_label ?? ""} onBlur={(e) => upd("academia_phases", ph.id, { periodo_label: e.target.value })} />
                        </div>
                        <Droppable droppableId={`m-${ph.id}`} type={`modulo:${ph.id}`}>
                          {(pm) => (
                            <div ref={pm.innerRef} {...pm.droppableProps} className="mt-3 space-y-3 pl-4">
                              {data.md.filter((m) => m.phase_id === ph.id).map((m, j) => (
                                <Draggable key={m.id} draggableId={m.id} index={j}>
                                  {(dm) => (
                                    <div ref={dm.innerRef} {...dm.draggableProps} className="rounded-xl border p-3">
                                      <div className="flex items-center gap-2">
                                        <span {...dm.dragHandleProps}><GripVertical className="h-4 w-4 text-muted-foreground" /></span>
                                        <Input defaultValue={m.titulo} onBlur={(e) => e.target.value !== m.titulo && upd("academia_modules", m.id, { titulo: e.target.value })} />
                                        <button onClick={() => del("academia_modules", m.id)} aria-label="Excluir módulo"><Trash2 className="h-4 w-4" /></button>
                                      </div>
                                      <Droppable droppableId={`t-${m.id}`} type={`tarefa:${m.id}`}>
                                        {(pt) => (
                                          <div ref={pt.innerRef} {...pt.droppableProps} className="mt-2 space-y-1 pl-4">
                                            {data.tk.filter((t) => t.module_id === m.id).map((t, k) => (
                                              <Draggable key={t.id} draggableId={t.id} index={k}>
                                                {(dt) => (
                                                  <div ref={dt.innerRef} {...dt.draggableProps} className="flex flex-wrap items-center gap-2 text-sm bg-background/50 rounded-lg p-1">
                                                    <span {...dt.dragHandleProps}><GripVertical className="h-4 w-4 text-muted-foreground" /></span>
                                                    <Input className="flex-1 min-w-60 h-8" defaultValue={t.titulo} onBlur={(e) => e.target.value !== t.titulo && upd("academia_tasks", t.id, { titulo: e.target.value })} />
                                                    <Select value={t.tipo_validacao} onValueChange={(v) => upd("academia_tasks", t.id, { tipo_validacao: v as TipoValidacao })}>
                                                      <SelectTrigger className="w-44 h-8"><SelectValue /></SelectTrigger>
                                                      <SelectContent>{Object.entries(TIPO_LABEL).map(([k2, l]) => <SelectItem key={k2} value={k2}>{l}</SelectItem>)}</SelectContent>
                                                    </Select>
                                                    <Input className="w-20 h-8" type="number" defaultValue={t.xp} onBlur={(e) => upd("academia_tasks", t.id, { xp: Number(e.target.value) })} aria-label="XP" />
                                                    <Select value={t.produto_id ?? "nenhum"} onValueChange={(v) => upd("academia_tasks", t.id, { produto_id: v === "nenhum" ? null : v })}>
                                                      <SelectTrigger className="w-40 h-8"><SelectValue /></SelectTrigger>
                                                      <SelectContent><SelectItem value="nenhum">Sem produto</SelectItem>{cat?.produtos.map((pr) => <SelectItem key={pr.id} value={pr.id}>{pr.nome}</SelectItem>)}</SelectContent>
                                                    </Select>
                                                    <label className="flex items-center gap-1 text-xs"><Switch checked={t.obrigatoria} onCheckedChange={(v) => upd("academia_tasks", t.id, { obrigatoria: v })} />Obrigatória</label>
                                                    <button onClick={() => del("academia_tasks", t.id)} aria-label="Excluir tarefa"><Trash2 className="h-4 w-4" /></button>
                                                  </div>)}
                                              </Draggable>))}
                                            {pt.placeholder}
                                            <Button size="sm" variant="ghost" onClick={() => addTarefa(m.id)}><Plus className="h-4 w-4 mr-1" />Tarefa</Button>
                                          </div>)}
                                      </Droppable>
                                    </div>)}
                                </Draggable>))}
                              {pm.placeholder}
                              <Button size="sm" variant="outline" onClick={() => addModulo(ph.id)}><Plus className="h-4 w-4 mr-1" />Módulo</Button>
                            </div>)}
                        </Droppable>
                      </div>)}
                  </Draggable>))}
                {p.placeholder}
              </div>)}
          </Droppable>
        </DragDropContext>
      )}
    </div>
  );
}
