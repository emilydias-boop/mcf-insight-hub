import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as unknown as { from: (t: string) => any; rpc: (f: string, a?: object) => any };
const NONE = "__none";

type Opt = { id: string; nome: string };

function useBase() {
  const deps = useQuery({
    queryKey: ["gov", "departamentos"],
    queryFn: async () => {
      const { data, error } = await db.from("departamentos").select("id,nome,ativo,responsavel_employee_id,parent_id").order("ordem");
      if (error) throw error;
      return data as { id: string; nome: string; ativo: boolean; responsavel_employee_id: string | null; parent_id: string | null }[];
    },
  });
  const cargos = useQuery({
    queryKey: ["gov", "cargos"],
    queryFn: async () => {
      const { data, error } = await db.from("cargos_catalogo")
        .select("id,nome_exibicao,area,ativo,fixo_valor,departamento_id,reporta_a_cargo_id,faixa_salarial_min,faixa_salarial_max")
        .eq("ativo", true).order("nome_exibicao");
      if (error) throw error;
      return data as { id: string; nome_exibicao: string; area: string; fixo_valor: number | null; departamento_id: string | null; reporta_a_cargo_id: string | null; faixa_salarial_min: number | null; faixa_salarial_max: number | null }[];
    },
  });
  const pessoas = useQuery({
    queryKey: ["gov", "pessoas"],
    queryFn: async () => {
      const { data, error } = await db.from("employees").select("id,nome_completo").eq("status", "ativo").order("nome_completo");
      if (error) throw error;
      return (data as { id: string; nome_completo: string }[]).map((p) => ({ id: p.id, nome: p.nome_completo }));
    },
  });
  return { deps, cargos, pessoas };
}

function Pick({ value, options, onChange, placeholder = "—" }: { value: string | null; options: Opt[]; onChange: (v: string | null) => void; placeholder?: string }) {
  return (
    <Select value={value ?? NONE} onValueChange={(v) => onChange(v === NONE ? null : v)}>
      <SelectTrigger className="h-8 min-w-[180px]"><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>{placeholder}</SelectItem>
        {options.map((o) => <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

async function salvar(tabela: string, id: string, patch: object, qc: ReturnType<typeof useQueryClient>, key: string) {
  const { error } = await db.from(tabela).update(patch).eq("id", id);
  if (error) { toast.error(error.message); return; }
  toast.success("Salvo");
  qc.invalidateQueries({ queryKey: ["gov", key] });
}

function SetoresSecao() {
  const qc = useQueryClient();
  const { deps, pessoas } = useBase();
  const lista = (deps.data ?? []).filter((d) => d.ativo);
  return (
    <Table>
      <TableHeader><TableRow><TableHead>Setor</TableHead><TableHead>Responsável</TableHead><TableHead>Setor pai</TableHead></TableRow></TableHeader>
      <TableBody>
        {lista.map((d) => (
          <TableRow key={d.id}>
            <TableCell className="font-medium">{d.nome}</TableCell>
            <TableCell><Pick value={d.responsavel_employee_id} options={pessoas.data ?? []} onChange={(v) => salvar("departamentos", d.id, { responsavel_employee_id: v }, qc, "departamentos")} /></TableCell>
            <TableCell><Pick value={d.parent_id} options={lista.filter((x) => x.id !== d.id)} onChange={(v) => salvar("departamentos", d.id, { parent_id: v }, qc, "departamentos")} /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function NumCell({ value, onSave }: { value: number | null; onSave: (v: number | null) => void }) {
  const [v, setV] = useState(value?.toString() ?? "");
  return (
    <Input className="h-8 w-28" type="number" value={v} onChange={(e) => setV(e.target.value)}
      onBlur={() => { const n = v === "" ? null : Number(v); if (n !== value) onSave(n); }} />
  );
}

function CargosSecao() {
  const qc = useQueryClient();
  const { deps, cargos } = useBase();
  const setores = (deps.data ?? []).filter((d) => d.ativo);
  const lista = cargos.data ?? [];
  const opts = lista.map((c) => ({ id: c.id, nome: c.nome_exibicao }));
  return (
    <Table>
      <TableHeader><TableRow><TableHead>Cargo</TableHead><TableHead>Setor</TableHead><TableHead>Reporta a</TableHead><TableHead>Faixa mín.</TableHead><TableHead>Faixa máx.</TableHead><TableHead>Fixo atual</TableHead></TableRow></TableHeader>
      <TableBody>
        {lista.map((c) => (
          <TableRow key={c.id}>
            <TableCell className="font-medium">{c.nome_exibicao}<div className="text-xs text-muted-foreground">{c.area}</div></TableCell>
            <TableCell><Pick value={c.departamento_id} options={setores} onChange={(v) => salvar("cargos_catalogo", c.id, { departamento_id: v }, qc, "cargos")} /></TableCell>
            <TableCell><Pick value={c.reporta_a_cargo_id} options={opts.filter((o) => o.id !== c.id)} onChange={(v) => salvar("cargos_catalogo", c.id, { reporta_a_cargo_id: v }, qc, "cargos")} /></TableCell>
            <TableCell><NumCell value={c.faixa_salarial_min} onSave={(v) => salvar("cargos_catalogo", c.id, { faixa_salarial_min: v }, qc, "cargos")} /></TableCell>
            <TableCell><NumCell value={c.faixa_salarial_max} onSave={(v) => salvar("cargos_catalogo", c.id, { faixa_salarial_max: v }, qc, "cargos")} /></TableCell>
            <TableCell className="text-muted-foreground">{c.fixo_valor != null ? c.fixo_valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

type Alcada = {
  id?: string; nome: string; descricao: string | null; aplica_em: string;
  cond_aumento_quadro: boolean | null; cond_salario_acima: number | null; cond_tipos_desligamento: string[] | null;
  aprovador_tipo: string; aprovador_cargo_id: string | null; aprovador_departamento_id: string | null;
  aprovador_role: string | null; aprovador_employee_id: string | null; rotulo_papel: string; ordem: number; sla_dias: number; ativo: boolean;
};
const VAZIA: Alcada = { nome: "", descricao: null, aplica_em: "contratacao", cond_aumento_quadro: null, cond_salario_acima: null, cond_tipos_desligamento: null, aprovador_tipo: "cargo", aprovador_cargo_id: null, aprovador_departamento_id: null, aprovador_role: null, aprovador_employee_id: null, rotulo_papel: "Diretoria", ordem: 100, sla_dias: 2, ativo: true };
const TIPOS_DESL = [
  ["sem_justa_causa", "Sem justa causa"], ["justa_causa", "Justa causa"], ["acordo", "Acordo"],
  ["termino_experiencia", "Término de experiência"], ["encerramento_pj", "Encerramento PJ"], ["pedido_demissao", "Pedido de demissão"],
];
const ROLES = ["admin", "rh", "manager", "coordenador", "financeiro"];

function AlcadasSecao() {
  const qc = useQueryClient();
  const { deps, cargos, pessoas } = useBase();
  const [edit, setEdit] = useState<Alcada | null>(null);
  const q = useQuery({
    queryKey: ["gov", "alcadas"],
    queryFn: async () => {
      const { data, error } = await db.from("gov_alcadas").select("*").order("ordem");
      if (error) throw error;
      return data as Alcada[];
    },
  });
  const nomeCargo = (id: string | null) => cargos.data?.find((c) => c.id === id)?.nome_exibicao ?? "—";
  const nomeSetor = (id: string | null) => deps.data?.find((c) => c.id === id)?.nome ?? "—";
  const nomePessoa = (id: string | null) => pessoas.data?.find((c) => c.id === id)?.nome ?? "—";
  const aprovador = (a: Alcada) => a.aprovador_tipo === "cargo" ? `Cargo: ${nomeCargo(a.aprovador_cargo_id)}`
    : a.aprovador_tipo === "setor" ? `Responsável de ${nomeSetor(a.aprovador_departamento_id)}`
    : a.aprovador_tipo === "papel" ? `Papel: ${a.aprovador_role ?? "—"}` : nomePessoa(a.aprovador_employee_id);
  const condicoes = (a: Alcada) => [
    a.cond_aumento_quadro ? "Aumento de quadro" : null,
    a.cond_salario_acima != null ? `Salário > ${a.cond_salario_acima.toLocaleString("pt-BR")}` : null,
    a.cond_tipos_desligamento?.length ? a.cond_tipos_desligamento.map((t) => TIPOS_DESL.find((x) => x[0] === t)?.[1] ?? t).join(", ") : null,
  ].filter(Boolean).join(" · ") || "Sempre";

  async function gravar() {
    if (!edit) return;
    if (!edit.nome.trim()) { toast.error("Informe o nome da regra"); return; }
    const alvoOk = { cargo: edit.aprovador_cargo_id, setor: edit.aprovador_departamento_id, papel: edit.aprovador_role, colaborador: edit.aprovador_employee_id }[edit.aprovador_tipo as "cargo"];
    if (!alvoOk) { toast.error("Escolha quem aprova"); return; }
    const { id, ...rest } = edit;
    const r = id ? await db.from("gov_alcadas").update(rest).eq("id", id) : await db.from("gov_alcadas").insert(rest);
    if (r.error) { toast.error(r.error.message); return; }
    toast.success("Regra salva"); setEdit(null); qc.invalidateQueries({ queryKey: ["gov", "alcadas"] });
  }
  async function excluir(id: string) {
    if (!confirm("Excluir esta regra de alçada?")) return;
    const { error } = await db.from("gov_alcadas").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["gov", "alcadas"] });
  }

  const set = (p: Partial<Alcada>) => setEdit((e) => (e ? { ...e, ...p } : e));
  return (
    <div className="space-y-3">
      <div className="flex justify-end"><Button size="sm" onClick={() => setEdit({ ...VAZIA })}><Plus className="h-4 w-4 mr-1" />Nova regra</Button></div>
      <Table>
        <TableHeader><TableRow><TableHead>Regra</TableHead><TableHead>Aplica em</TableHead><TableHead>Quando</TableHead><TableHead>Quem aprova</TableHead><TableHead>Ordem</TableHead><TableHead>Prazo</TableHead><TableHead /></TableRow></TableHeader>
        <TableBody>
          {(q.data ?? []).length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Nenhuma regra cadastrada.</TableCell></TableRow>}
          {(q.data ?? []).map((a) => (
            <TableRow key={a.id}>
              <TableCell className="font-medium">{a.nome} {!a.ativo && <Badge variant="outline">inativa</Badge>}</TableCell>
              <TableCell>{a.aplica_em === "ambos" ? "Ambos" : a.aplica_em === "contratacao" ? "Contratação" : "Desligamento"}</TableCell>
              <TableCell className="text-sm">{condicoes(a)}</TableCell>
              <TableCell className="text-sm">{a.rotulo_papel} — {aprovador(a)}</TableCell>
              <TableCell>{a.ordem}</TableCell>
              <TableCell>{a.sla_dias} d</TableCell>
              <TableCell className="text-right whitespace-nowrap">
                <Button variant="ghost" size="icon" aria-label="Editar" onClick={() => setEdit(a)}><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" aria-label="Excluir" onClick={() => excluir(a.id!)}><Trash2 className="h-4 w-4" /></Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{edit?.id ? "Editar regra" : "Nova regra de alçada"}</DialogTitle></DialogHeader>
          {edit && (
            <div className="grid gap-3">
              <div><Label>Nome</Label><Input value={edit.nome} onChange={(e) => set({ nome: e.target.value })} placeholder="Ex.: Aumento de quadro exige Diretoria" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Aplica em</Label>
                  <Select value={edit.aplica_em} onValueChange={(v) => set({ aplica_em: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="contratacao">Contratação</SelectItem><SelectItem value="desligamento">Desligamento</SelectItem><SelectItem value="ambos">Ambos</SelectItem></SelectContent>
                  </Select></div>
                <div><Label>Nome do papel no fluxo</Label><Input value={edit.rotulo_papel} onChange={(e) => set({ rotulo_papel: e.target.value })} /></div>
              </div>
              <div className="rounded-md border p-3 space-y-2">
                <div className="text-sm font-medium">Quando se aplica (sem condição = sempre)</div>
                {edit.aplica_em !== "desligamento" && (
                  <>
                    <div className="flex items-center gap-2"><Switch checked={!!edit.cond_aumento_quadro} onCheckedChange={(c) => set({ cond_aumento_quadro: c || null })} /><Label>Somente aumento de quadro</Label></div>
                    <div className="flex items-center gap-2"><Label className="whitespace-nowrap">Salário acima de</Label><Input type="number" className="w-40" value={edit.cond_salario_acima ?? ""} onChange={(e) => set({ cond_salario_acima: e.target.value === "" ? null : Number(e.target.value) })} /></div>
                  </>
                )}
                {edit.aplica_em !== "contratacao" && (
                  <div className="grid grid-cols-2 gap-1">
                    {TIPOS_DESL.map(([k, l]) => {
                      const on = edit.cond_tipos_desligamento?.includes(k) ?? false;
                      return (
                        <label key={k} className="flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={on} onChange={() => {
                            const cur = edit.cond_tipos_desligamento ?? [];
                            const nx = on ? cur.filter((x) => x !== k) : [...cur, k];
                            set({ cond_tipos_desligamento: nx.length ? nx : null });
                          }} />{l}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Quem aprova</Label>
                  <Select value={edit.aprovador_tipo} onValueChange={(v) => set({ aprovador_tipo: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="cargo">Ocupante de um cargo</SelectItem><SelectItem value="setor">Responsável de um setor</SelectItem><SelectItem value="papel">Papel no sistema</SelectItem><SelectItem value="colaborador">Pessoa específica</SelectItem></SelectContent>
                  </Select></div>
                <div><Label>&nbsp;</Label>
                  {edit.aprovador_tipo === "cargo" && <Pick value={edit.aprovador_cargo_id} options={(cargos.data ?? []).map((c) => ({ id: c.id, nome: c.nome_exibicao }))} onChange={(v) => set({ aprovador_cargo_id: v })} />}
                  {edit.aprovador_tipo === "setor" && <Pick value={edit.aprovador_departamento_id} options={deps.data ?? []} onChange={(v) => set({ aprovador_departamento_id: v })} />}
                  {edit.aprovador_tipo === "papel" && <Pick value={edit.aprovador_role} options={ROLES.map((r) => ({ id: r, nome: r }))} onChange={(v) => set({ aprovador_role: v })} />}
                  {edit.aprovador_tipo === "colaborador" && <Pick value={edit.aprovador_employee_id} options={pessoas.data ?? []} onChange={(v) => set({ aprovador_employee_id: v })} />}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Ordem no fluxo</Label><Input type="number" value={edit.ordem} onChange={(e) => set({ ordem: Number(e.target.value) })} /></div>
                <div><Label>Prazo (dias)</Label><Input type="number" min={1} value={edit.sla_dias} onChange={(e) => set({ sla_dias: Number(e.target.value) })} /></div>
                <div className="flex items-end gap-2 pb-2"><Switch checked={edit.ativo} onCheckedChange={(c) => set({ ativo: c })} /><Label>Ativa</Label></div>
              </div>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setEdit(null)}>Cancelar</Button><Button onClick={gravar}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function HierarquiaSecao() {
  const { pessoas } = useBase();
  const [id, setId] = useState<string | null>(null);
  const cadeia = useQuery({
    queryKey: ["gov", "cadeia", id],
    enabled: !!id,
    queryFn: async () => {
      const [c, s] = await Promise.all([
        db.rpc("gov_cadeia_hierarquica", { _employee_id: id }),
        db.rpc("gov_setor_do_colaborador", { _employee_id: id }),
      ]);
      if (c.error) throw c.error;
      let resp: string | null = null;
      if (s.data) { const r = await db.rpc("gov_responsavel_setor", { _departamento_id: s.data }); resp = r.data ?? null; }
      return { cadeia: c.data as { nivel: number; employee_id: string; nome: string }[], setor: s.data as string | null, resp };
    },
  });
  const { deps } = useBase();
  return (
    <div className="space-y-3">
      <Pick value={id} options={pessoas.data ?? []} onChange={setId} placeholder="Escolha um colaborador" />
      {cadeia.data && (
        <div className="text-sm space-y-1">
          <div>Setor: <b>{deps.data?.find((d) => d.id === cadeia.data.setor)?.nome ?? "não identificado"}</b></div>
          <div>Responsável do setor: <b>{pessoas.data?.find((p) => p.id === cadeia.data.resp)?.nome ?? "não definido"}</b></div>
          <div>Cadeia acima:</div>
          {cadeia.data.cadeia.length === 0 ? <div className="text-muted-foreground">Nenhum superior encontrado. Defina "Reporta a" no cargo ou o gestor no cadastro.</div>
            : <ol className="list-decimal pl-6">{cadeia.data.cadeia.map((c) => <li key={c.employee_id}>{c.nome}</li>)}</ol>}
        </div>
      )}
    </div>
  );
}

export default function GovernancaTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Governança de contratação e desligamento</CardTitle>
        <CardDescription>Hierarquia de setores e cargos, faixas salariais e regras de alçada. Somente RH e administradores alteram.</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="setores">
          <TabsList>
            <TabsTrigger value="setores">Setores</TabsTrigger>
            <TabsTrigger value="cargos">Cargos e faixas</TabsTrigger>
            <TabsTrigger value="alcadas">Alçadas</TabsTrigger>
            <TabsTrigger value="hierarquia">Consultar hierarquia</TabsTrigger>
          </TabsList>
          <TabsContent value="setores"><SetoresSecao /></TabsContent>
          <TabsContent value="cargos"><CargosSecao /></TabsContent>
          <TabsContent value="alcadas"><AlcadasSecao /></TabsContent>
          <TabsContent value="hierarquia"><HierarquiaSecao /></TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
