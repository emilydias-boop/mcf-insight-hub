import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Archive, ExternalLink, FileUp, Loader2, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { MATERIAL_STATUS, MATERIAL_TIPOS, PROCESSO_POS_VENDA, statusInfo } from "@/lib/processoMateriais";

const db = supabase as any;
const BUCKET = "processo-materiais";

type Etapa = { id: string; chave: string; titulo: string; ordem: number };
type Material = {
  id: string; processo_id: string; etapa_id: string; titulo: string; tipo: string; status: string;
  responsavel_id: string | null; assunto: string | null; conteudo: string | null; link_url: string | null;
  arquivo_path: string | null; arquivo_nome: string | null; observacao: string | null; ordem: number;
  ativo: boolean; updated_at: string | null; created_at: string | null;
};
type Pessoa = { id: string; full_name: string | null; email: string | null };

const fmt = (d?: string | null) => (d ? format(new Date(d), "dd/MM/yyyy HH:mm") : "-");

export default function MateriaisProcesso() {
  const { hasAnyRole } = useAuth();
  const podeEditar = hasAnyRole("admin", "gerente_relacionamento");
  const qc = useQueryClient();

  const [fStatus, setFStatus] = useState("todos");
  const [fTipo, setFTipo] = useState("todos");
  const [busca, setBusca] = useState("");
  const [arquivados, setArquivados] = useState(false);
  const [aberto, setAberto] = useState<Material | "novo" | null>(null);

  const base = useQuery({
    queryKey: ["processo-materiais", PROCESSO_POS_VENDA],
    queryFn: async () => {
      const { data: proc, error: e1 } = await db.from("processos").select("id").eq("chave", PROCESSO_POS_VENDA).single();
      if (e1) throw e1;
      const [et, mt] = await Promise.all([
        db.from("processo_etapas").select("id,chave,titulo,ordem").eq("processo_id", proc.id).order("ordem"),
        db.from("processo_materiais").select("*").eq("processo_id", proc.id).order("ordem"),
      ]);
      if (et.error) throw et.error;
      if (mt.error) throw mt.error;
      return { processoId: proc.id as string, etapas: et.data as Etapa[], materiais: mt.data as Material[] };
    },
  });

  const pessoas = useQuery({
    queryKey: ["processo-materiais-pessoas"],
    queryFn: async () => {
      const { data, error } = await db.from("profiles").select("id,full_name,email").eq("access_status", "ativo").order("full_name");
      if (error) throw error;
      return data as Pessoa[];
    },
  });
  const nomePessoa = (id: string | null) => {
    if (!id) return "-";
    const p = pessoas.data?.find((x) => x.id === id);
    return p?.full_name || p?.email || "—";
  };

  const materiais = base.data?.materiais ?? [];
  const visiveis = materiais.filter((m) => (arquivados ? true : m.ativo));
  const contagem = useMemo(() => {
    const c: Record<string, number> = {};
    materiais.filter((m) => m.ativo).forEach((m) => (c[m.status] = (c[m.status] ?? 0) + 1));
    return c;
  }, [materiais]);
  const totalAtivos = materiais.filter((m) => m.ativo).length;

  const filtrados = visiveis.filter((m) => {
    if (fStatus !== "todos" && m.status !== fStatus) return false;
    if (fTipo !== "todos" && m.tipo !== fTipo) return false;
    if (busca) {
      const t = busca.toLowerCase();
      if (![m.titulo, m.assunto, m.conteudo, m.observacao].some((x) => x?.toLowerCase().includes(t))) return false;
    }
    return true;
  });

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Materiais do processo</h1>
          <p className="text-sm text-muted-foreground">Pós-venda · Gerentes de Relacionamento</p>
        </div>
        {podeEditar && (
          <Button onClick={() => setAberto("novo")}><Plus className="h-4 w-4 mr-1" /> Novo material</Button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        {MATERIAL_STATUS.map((s) => (
          <Card key={s.value} className="cursor-pointer" onClick={() => setFStatus(fStatus === s.value ? "todos" : s.value)}>
            <CardContent className={cn("p-3", fStatus === s.value && "ring-2 ring-primary rounded-lg")}>
              <Badge variant="outline" className={s.cls}>{s.label}</Badge>
              <div className="text-2xl font-semibold mt-1">{contagem[s.value] ?? 0}</div>
            </CardContent>
          </Card>
        ))}
        <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Total</div><div className="text-2xl font-semibold mt-1">{totalAtivos}</div></CardContent></Card>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8 w-64" placeholder="Buscar" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <Select value={fStatus} onValueChange={setFStatus}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {MATERIAL_STATUS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={fTipo} onValueChange={setFTipo}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            {Object.entries(MATERIAL_TIPOS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={arquivados} onCheckedChange={setArquivados} /> Mostrar arquivados
        </label>
      </div>

      {base.isLoading && <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>}
      {base.error && <div className="text-destructive text-sm">Não foi possível carregar: {(base.error as any).message}</div>}

      {base.data?.etapas.map((et) => {
        const itens = filtrados.filter((m) => m.etapa_id === et.id);
        if (!itens.length) return null;
        return (
          <Card key={et.id}>
            <CardContent className="p-0">
              <div className="px-4 py-2 border-b font-medium">{et.titulo}</div>
              {itens.map((m) => {
                const s = statusInfo(m.status);
                return (
                  <button key={m.id} onClick={() => setAberto(m)}
                    className={cn("w-full grid grid-cols-12 gap-2 px-4 py-2 text-left text-sm border-b last:border-0 hover:bg-muted/50", !m.ativo && "opacity-50")}>
                    <span className="col-span-2"><Badge variant="outline" className={s.cls}>{s.label}</Badge></span>
                    <span className="col-span-5">{m.titulo}{!m.ativo && " (arquivado)"}</span>
                    <span className="col-span-1 text-muted-foreground">{MATERIAL_TIPOS[m.tipo] ?? m.tipo}</span>
                    <span className="col-span-2 text-muted-foreground truncate">{nomePessoa(m.responsavel_id)}</span>
                    <span className="col-span-2 text-muted-foreground text-right">{fmt(m.updated_at ?? m.created_at)}</span>
                  </button>
                );
              })}
            </CardContent>
          </Card>
        );
      })}

      <Sheet open={!!aberto} onOpenChange={(o) => !o && setAberto(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {aberto && base.data && (
            <Editor
              key={aberto === "novo" ? "novo" : aberto.id}
              material={aberto === "novo" ? null : aberto}
              processoId={base.data.processoId}
              etapas={base.data.etapas}
              pessoas={pessoas.data ?? []}
              podeEditar={podeEditar}
              nomePessoa={nomePessoa}
              onSalvo={() => { qc.invalidateQueries({ queryKey: ["processo-materiais"] }); qc.invalidateQueries({ queryKey: ["fluxo-pos-venda-materiais"] }); setAberto(null); }}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Editor({ material, processoId, etapas, pessoas, podeEditar, nomePessoa, onSalvo }: {
  material: Material | null; processoId: string; etapas: Etapa[]; pessoas: Pessoa[]; podeEditar: boolean;
  nomePessoa: (id: string | null) => string; onSalvo: () => void;
}) {
  const [f, setF] = useState({
    titulo: material?.titulo ?? "", etapa_id: material?.etapa_id ?? etapas[0]?.id ?? "", tipo: material?.tipo ?? "outro",
    status: material?.status ?? "falta_fazer", responsavel_id: material?.responsavel_id ?? "", assunto: material?.assunto ?? "",
    conteudo: material?.conteudo ?? "", link_url: material?.link_url ?? "", observacao: material?.observacao ?? "",
    arquivo_path: material?.arquivo_path ?? "", arquivo_nome: material?.arquivo_nome ?? "",
  });
  const [enviando, setEnviando] = useState(false);
  const ro = !podeEditar;
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  const etapaTitulo = (id: string) => etapas.find((e) => e.id === id)?.titulo ?? id;

  const hist = useQuery({
    queryKey: ["processo-materiais-hist", material?.id],
    enabled: !!material,
    queryFn: async () => {
      const { data, error } = await db.from("processo_materiais_historico").select("*").eq("material_id", material!.id).order("alterado_em", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const payload = () => ({
    titulo: f.titulo.trim(), etapa_id: f.etapa_id, tipo: f.tipo, status: f.status,
    responsavel_id: f.responsavel_id || null, assunto: f.tipo === "email" ? f.assunto || null : material?.assunto ?? null,
    conteudo: f.conteudo || null, link_url: f.link_url || null, observacao: f.observacao || null,
    arquivo_path: f.arquivo_path || null, arquivo_nome: f.arquivo_nome || null,
  });

  const salvar = useMutation({
    mutationFn: async () => {
      if (!f.titulo.trim()) throw new Error("Informe o título");
      if (material) {
        const { error } = await db.from("processo_materiais").update(payload()).eq("id", material.id);
        if (error) throw error;
      } else {
        const { error } = await db.from("processo_materiais").insert({ ...payload(), processo_id: processoId, ordem: 999 });
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Material salvo"); onSalvo(); },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });

  const arquivar = useMutation({
    mutationFn: async (ativo: boolean) => {
      const { error } = await db.from("processo_materiais").update({ ativo }).eq("id", material!.id);
      if (error) throw error;
    },
    onSuccess: (_d, ativo) => { toast.success(ativo ? "Material reativado" : "Material arquivado"); onSalvo(); },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const upload = async (file: File) => {
    setEnviando(true);
    try {
      const safe = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${processoId}/${material?.id ?? "novo"}/${Date.now()}_${safe}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file);
      if (error) throw error;
      setF((p) => ({ ...p, arquivo_path: path, arquivo_nome: file.name }));
      toast.success("Arquivo enviado — clique em Salvar");
    } catch (e: any) {
      toast.error(e.message ?? "Falha no envio");
    } finally {
      setEnviando(false);
    }
  };

  const abrirArquivo = async () => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(f.arquivo_path, 600);
    if (error || !data) return toast.error("Não foi possível abrir o arquivo");
    window.open(data.signedUrl, "_blank", "noopener");
  };

  const valorHist = (campo: string, v: string | null) => {
    if (v == null || v === "") return "vazio";
    if (campo === "status") return statusInfo(v).label;
    if (campo === "tipo") return MATERIAL_TIPOS[v] ?? v;
    if (campo === "responsavel_id") return nomePessoa(v);
    if (campo === "etapa_id") return etapaTitulo(v);
    if (campo === "ativo") return v === "true" ? "ativo" : "arquivado";
    return v.length > 80 ? v.slice(0, 80) + "…" : v;
  };

  return (
    <div className="space-y-4">
      <SheetHeader><SheetTitle>{material ? (ro ? "Material" : "Editar material") : "Novo material"}</SheetTitle></SheetHeader>
      {ro && <p className="text-xs text-muted-foreground">Somente leitura.</p>}

      <div className="space-y-1"><Label>Título</Label><Input disabled={ro} value={f.titulo} onChange={(e) => set("titulo", e.target.value)} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1 col-span-2"><Label>Etapa</Label>
          <Select disabled={ro} value={f.etapa_id} onValueChange={(v) => set("etapa_id", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{etapas.map((e) => <SelectItem key={e.id} value={e.id}>{e.titulo}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1"><Label>Tipo</Label>
          <Select disabled={ro} value={f.tipo} onValueChange={(v) => set("tipo", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(MATERIAL_TIPOS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1"><Label>Status</Label>
          <Select disabled={ro} value={f.status} onValueChange={(v) => set("status", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{MATERIAL_STATUS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1 col-span-2"><Label>Responsável</Label>
          <Select disabled={ro} value={f.responsavel_id || "_none"} onValueChange={(v) => set("responsavel_id", v === "_none" ? "" : v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">Sem responsável</SelectItem>
              {pessoas.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name || p.email}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      {f.tipo === "email" && (
        <div className="space-y-1"><Label>Assunto</Label><Input disabled={ro} value={f.assunto} onChange={(e) => set("assunto", e.target.value)} /></div>
      )}
      <div className="space-y-1"><Label>Conteúdo</Label><Textarea disabled={ro} rows={10} value={f.conteudo} onChange={(e) => set("conteudo", e.target.value)} placeholder="Texto do e-mail, WhatsApp, SMS ou roteiro" /></div>
      <div className="space-y-1"><Label>Link (Canva, vídeo, Drive)</Label>
        <div className="flex gap-2">
          <Input disabled={ro} value={f.link_url} onChange={(e) => set("link_url", e.target.value)} placeholder="https://" />
          {f.link_url && <Button variant="outline" size="icon" asChild><a href={f.link_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a></Button>}
        </div>
      </div>
      <div className="space-y-1"><Label>Arquivo</Label>
        <div className="flex flex-wrap items-center gap-2">
          {f.arquivo_path ? <Button variant="link" className="px-0" onClick={abrirArquivo}>{f.arquivo_nome || "Abrir arquivo"}</Button> : <span className="text-sm text-muted-foreground">Nenhum</span>}
          {!ro && (
            <label className="inline-flex items-center gap-1 text-sm cursor-pointer border rounded-md px-2 py-1 hover:bg-muted">
              {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />} {f.arquivo_path ? "Trocar" : "Enviar"}
              <input type="file" className="hidden" disabled={enviando} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            </label>
          )}
        </div>
      </div>
      <div className="space-y-1"><Label>Observação</Label><Textarea disabled={ro} rows={3} value={f.observacao} onChange={(e) => set("observacao", e.target.value)} /></div>

      {!ro && (
        <div className="flex justify-between gap-2">
          {material ? (
            <Button variant="outline" onClick={() => arquivar.mutate(!material.ativo)} disabled={arquivar.isPending}>
              <Archive className="h-4 w-4 mr-1" /> {material.ativo ? "Arquivar" : "Reativar"}
            </Button>
          ) : <span />}
          <Button onClick={() => salvar.mutate()} disabled={salvar.isPending || enviando}>
            {salvar.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Salvar
          </Button>
        </div>
      )}

      {material && (
        <div className="border-t pt-3">
          <div className="font-medium text-sm mb-2">Histórico de alterações</div>
          {hist.isLoading && <div className="text-xs text-muted-foreground">Carregando…</div>}
          <ul className="space-y-1 text-xs">
            {hist.data?.map((h) => (
              <li key={h.id} className="text-muted-foreground">
                <span className="text-foreground">{fmt(h.alterado_em)}</span> · {h.alterado_por ? nomePessoa(h.alterado_por) : "sistema"} ·{" "}
                {h.campo === "criado" ? "criado" : <><b>{h.campo}</b>: {valorHist(h.campo, h.valor_antigo)} → {valorHist(h.campo, h.valor_novo)}</>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
