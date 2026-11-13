import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

export async function rpc<T>(nome: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await (supabase as any).rpc(nome, args);
  if (error) throw error;
  return data as T;
}
export function isPermError(e: unknown) {
  const err = e as { code?: string; message?: string } | null;
  return err?.code === "42501" || /permission denied|42501/i.test(err?.message ?? "");
}
export const fmtInt = (v: unknown) => (Number(v ?? 0) || 0).toLocaleString("pt-BR");
export const dinheiro = (v: number | null | undefined) => v == null ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const dataSP = (d: string | null) => d ? new Date(d).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";
export const mensagemErro = (e: unknown) => e instanceof Error ? e.message : String((e as { message?: string })?.message ?? "Não foi possível concluir a ação.");
export function hojeSP() {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date()).map(v => [v.type, v.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
export function useDebounce<T>(valor: T, ms: number) {
  const [resultado, setResultado] = useState(valor);
  useEffect(() => { const t = setTimeout(() => setResultado(valor), ms); return () => clearTimeout(t); }, [valor, ms]);
  return resultado;
}
export type TemplateWA = { nome: string; idioma: string; categoria: string; status: string; qualidade: string | null; motivo_rejeicao: string | null; corpo: string; variaveis: number; botoes: { type: string; url?: string; text?: string; texto?: string }[] };
export type EstadoWA = {
  config: { envio_ativo: boolean; numero: string; teto_diario: number; ritmo_por_minuto: number; cooldown_dias: number; pausar_se_falha_pct: number; so_allowlist: boolean; allowlist: string[]; freio_em: string | null; freio_motivo: string | null; atualizado_em: string };
  saude: { lido_em: string; pode_enviar: string; status_numero: string; qualidade: string; tier: string; erros: { entity_type: string; id: string; code: number | string; description: string; possible_solution: string }[]; origem: string } | null;
  pessoas_24h: number; na_fila: number; precos: Record<string, number | null>; templates: TemplateWA[]; pode_mexer: boolean;
};
type Valor = "primeiro_nome" | "nome" | { fixo: string };
type Formulario = { titulo: string; template_nome: string; idioma: string; variaveis: Record<string, Valor>; botoes: Record<string, { fixo: string }>; publico: { dias: number; dias_min: number; estagios: string[] | null }; limite_alvos: number | null; utm_campaign: string };
export type DisparoWA = Formulario & { id: string; status: string; total_alvos: number; enviados: number; na_fila: number; entregues: number; lidos: number; responderam: number; falhas: number; ignorados: number; custo_brl: number | null; criado_em: string; agendado_para: string | null; erro: string | null };
type PublicoResumo = { total: number; elegiveis: number; opt_out: number; cooldown: number; por_estagio: { estagio: string; n: number }[]; modo_teste: boolean; allowlist: number; saldo_24h: number };
const novo = (): Formulario => ({ titulo: "", template_nome: "", idioma: "pt_BR", variaveis: {}, botoes: {}, publico: { dias: 90, dias_min: 0, estagios: null }, limite_alvos: null, utm_campaign: "" });
export const cellWA = "whitespace-nowrap px-[12px] py-[12px]";
export function StatusDisparoWA({ r }: { r: DisparoWA }) {
  const nomes: Record<string, string> = { rascunho: "Rascunho", agendado: "Agendado", enviando: "Enviando", pausado: "Pausado", concluido: "Concluído", cancelado: "Cancelado", erro: "Erro" };
  return <Badge variant={r.status === "erro" ? "destructive" : "outline"} className={`gap-[4px] whitespace-nowrap ${r.status === "concluido" ? "bg-success text-success-foreground" : ""}`}>
    {r.status === "enviando" && <Loader2 className="h-[12px] w-[12px] animate-spin" />}{nomes[r.status] ?? r.status}{r.status === "agendado" && ` · ${dataSP(r.agendado_para)}`}
  </Badge>;
}
export function TabelaDisparosWA({ rows, onAbrir, onSelecionar, bloqueado = false }: { rows: DisparoWA[]; onAbrir?: (d: DisparoWA) => void; onSelecionar?: (d: { id: string; titulo: string }) => void; bloqueado?: boolean }) {
  return !rows.length ? <p className="py-[24px] text-center text-[13px] text-muted-foreground">Nenhum disparo no período.</p> : <Table className="text-[12px]"><TableHeader><TableRow>{["Título", "Status", "Template", "Alvos", "Enviados", "Entregues", "Lidos", "Responderam", "Falhas", "Custo", "Criado em", ...(onSelecionar ? ["Destinatários"] : [])].map(t => <TableHead key={t} className={cellWA}>{t}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.map(r => <TableRow key={r.id} role={onAbrir ? "button" : undefined} tabIndex={onAbrir && !bloqueado ? 0 : undefined} className={onAbrir ? "cursor-pointer" : undefined} onClick={() => { if (!bloqueado) onAbrir?.(r); }} onKeyDown={e => { if (!bloqueado && onAbrir && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onAbrir(r); } }}>
    <TableCell className={cellWA}>{r.titulo}</TableCell><TableCell className={cellWA}><StatusDisparoWA r={r} /></TableCell><TableCell className={cellWA}>{r.template_nome}</TableCell>{[r.total_alvos, r.enviados, r.entregues, r.lidos, r.responderam, r.falhas].map((n, i) => <TableCell key={i} className={`${cellWA} text-right tabular-nums`}>{fmtInt(n)}</TableCell>)}<TableCell className={cellWA}>{dinheiro(r.custo_brl)}</TableCell><TableCell className={cellWA}>{dataSP(r.criado_em)}</TableCell>{onSelecionar && <TableCell className={cellWA}><Button variant="link" size="sm" disabled={bloqueado} onClick={e => { e.stopPropagation(); onSelecionar(r); }}>Ver destinatários</Button></TableCell>}
  </TableRow>)}</TableBody></Table>;
}

export function WhatsAppDisparos({ from, to, onSelecionar }: { from: string; to: string; onSelecionar?: (d: { id: string; titulo: string }) => void }) {
  const qc = useQueryClient();
  const [aberto, setAberto] = useState(false);
  const [selecionado, setSelecionado] = useState<DisparoWA | null>(null);
  const [form, setForm] = useState<Formulario>(novo);
  const [busy, setBusy] = useState(false);
  const trava = useRef(false);
  const [dialog, setDialog] = useState<"acionar" | "cancelar" | "excluir" | null>(null);
  const [quando, setQuando] = useState("agora");
  const [data, setData] = useState(hojeSP);
  const [hora, setHora] = useState("12:00");
  const lista = useQuery({ queryKey: ["mkt-wa-disparos", from, to], queryFn: () => rpc<DisparoWA[]>("mkt_wa_disparos", { p_from: from, p_to: to }), staleTime: 60_000, refetchInterval: q => q.state.data?.some(r => ["enviando", "agendado"].includes(r.status)) ? 10_000 : false });
  const estado = useQuery({ queryKey: ["mkt-wa-estado"], queryFn: () => rpc<EstadoWA>("mkt_wa_estado"), staleTime: 60_000, refetchInterval: q => (q.state.data?.na_fila ?? 0) > 0 ? 30_000 : false });
  const estagios = useQuery({ queryKey: ["mkt-email-estagios"], queryFn: () => rpc<{ ordem: number; estagio: string }[]>("mkt_email_estagios"), enabled: aberto, staleTime: 60_000 });
  const publico = useDebounce(form.publico, 600);
  const resumo = useQuery({ queryKey: ["mkt-wa-publico", publico], queryFn: () => rpc<PublicoResumo>("mkt_wa_publico_resumo", { p_dias: publico.dias, p_dias_min: publico.dias_min, p_estagios: publico.estagios }), enabled: aberto && Number.isInteger(publico.dias_min) && publico.dias_min >= 0, staleTime: 60_000 });
  const atual = lista.data?.find(r => r.id === selecionado?.id) ?? selecionado;
  const status = atual?.status ?? "rascunho";
  const editavel = status === "rascunho";
  const permitido = estado.data?.pode_mexer === true;
  const bloqueado = busy || !permitido;
  const templates = estado.data?.templates ?? [];
  const template = templates.find(t => t.nome === form.template_nome && t.idioma === form.idioma);
  function campo<K extends keyof Formulario>(key: K, value: Formulario[K]) { setForm(f => ({ ...f, [key]: value })); }
  function abrir(r: DisparoWA | null) {
    setSelecionado(r); setDialog(null);
    setForm(r ? { titulo: r.titulo ?? "", template_nome: r.template_nome ?? "", idioma: r.idioma ?? "pt_BR", variaveis: r.variaveis ?? {}, botoes: r.botoes ?? {}, publico: r.publico ?? novo().publico, limite_alvos: r.limite_alvos ?? null, utm_campaign: r.utm_campaign ?? "" } : novo());
    setAberto(true);
  }
  async function invalidar() { await Promise.all(["disparos", "estado", "resumo", "envios", "publico"].map(k => qc.invalidateQueries({ queryKey: [`mkt-wa-${k}`] }))); }
  async function acao(tarefa: () => Promise<void>) {
    if (trava.current || !permitido) return;
    trava.current = true; setBusy(true);
    try { await tarefa(); } catch (e) { toast.error(mensagemErro(e)); }
    finally { try { await invalidar(); } finally { trava.current = false; setBusy(false); } }
  }
  async function salvar(): Promise<DisparoWA> {
    if (!editavel) throw new Error("Só rascunhos podem ser editados.");
    if (!form.titulo.trim() || !template || template.status !== "APPROVED") throw new Error("Preencha o título e escolha um template aprovado.");
    if (!Number.isInteger(form.publico.dias_min) || form.publico.dias_min < 0) throw new Error("Informe dias inteiros maiores ou iguais a zero.");
    if (form.limite_alvos !== null && (!Number.isInteger(form.limite_alvos) || form.limite_alvos < 1)) throw new Error("O limite de pessoas deve ser um inteiro maior que zero.");
    const variaveis: Formulario["variaveis"] = {};
    for (let i = 1; i <= Number(template.variaveis); i++) {
      const v = form.variaveis[String(i)];
      if (!v || (typeof v === "object" && !v.fixo.trim())) throw new Error(`Preencha a variável {{${i}}}.`);
      variaveis[String(i)] = v;
    }
    const botoes: Formulario["botoes"] = {};
    (template.botoes ?? []).forEach((b, i) => { if (b.type === "URL" && b.url?.includes("{{1}}")) { const v = form.botoes[String(i)]; if (!v?.fixo.trim()) throw new Error("Preencha o final do link do botão."); botoes[String(i)] = v; } });
    const payload = { titulo: form.titulo.trim(), template_nome: form.template_nome, idioma: form.idioma, variaveis, botoes, publico: form.publico, limite_alvos: form.limite_alvos, utm_campaign: form.utm_campaign.trim() || null };
    const tabela = (supabase as any).from("meta_wa_disparos");
    const q = atual ? tabela.update(payload).eq("id", atual.id).eq("status", "rascunho") : tabela.insert(payload);
    const { data: r, error } = await q.select("*").single();
    if (error) throw error;
    setSelecionado(r); return r as DisparoWA;
  }
  async function executar(nome: string, agendar: string | null = null) {
    if (!atual) throw new Error("Salve o disparo antes de continuar.");
    const r = await rpc<DisparoWA>("mkt_wa_disparo_acao", { p_id: atual.id, p_acao: nome, p_agendar_para: agendar });
    setSelecionado(r);
    qc.setQueryData<DisparoWA[]>(["mkt-wa-disparos", from, to], old => old?.map(d => d.id === r.id ? r : d));
    setDialog(null); toast.success("Disparo atualizado.");
  }
  const previa = (template?.corpo ?? "").replace(/\{\{(\d+)\}\}/g, (_, k: string) => { const v = form.variaveis[k]; return v === "primeiro_nome" ? "João" : v === "nome" ? "João Silva" : typeof v === "object" ? v.fixo : `{{${k}}}`; });
  const quantidade = resumo.data?.modo_teste ? resumo.data.allowlist : Math.min(resumo.data?.elegiveis ?? 0, form.limite_alvos ?? Infinity);
  if ([lista.error, estado.error, estagios.error, resumo.error].some(isPermError)) return <Alert><AlertDescription>Sem permissão para ver os dados do WhatsApp</AlertDescription></Alert>;
  return <>
    <Card className="min-w-0"><CardHeader className="flex flex-row flex-wrap items-center justify-between gap-[12px] p-[20px]"><CardTitle className="text-[18px] tracking-normal">Disparos</CardTitle><Button size="sm" disabled={bloqueado} onClick={() => abrir(null)}><Plus className="mr-[6px] h-[14px] w-[14px]" />Novo disparo</Button></CardHeader><CardContent className="p-[20px] pt-0">{lista.isLoading ? <Skeleton className="h-[80px] w-full" /> : lista.error ? <Alert variant="destructive"><AlertDescription>{mensagemErro(lista.error)}</AlertDescription></Alert> : <TabelaDisparosWA rows={lista.data ?? []} onAbrir={abrir} onSelecionar={onSelecionar} bloqueado={bloqueado} />}</CardContent></Card>
    <Sheet open={aberto} onOpenChange={v => { if (!busy) setAberto(v); }}><SheetContent className="w-full overflow-y-auto sm:max-w-[1100px]"><SheetHeader><SheetTitle>{atual?.titulo || "Novo disparo"}</SheetTitle><SheetDescription>WhatsApp oficial · {editavel ? "Rascunho" : "Somente leitura"}</SheetDescription></SheetHeader>
      <div className="mt-[20px] grid min-w-0 grid-cols-1 gap-[24px] lg:grid-cols-2"><fieldset disabled={!editavel || bloqueado} className="min-w-0 space-y-[12px]">
        <Label htmlFor="wa-titulo">Título</Label><Input id="wa-titulo" value={form.titulo} onChange={e => campo("titulo", e.target.value)} />
        <Label htmlFor="wa-template">Template</Label><Select value={form.template_nome ? `${form.template_nome}|${form.idioma}` : ""} disabled={!editavel || bloqueado} onValueChange={v => { const t = templates.find(t => `${t.nome}|${t.idioma}` === v); if (t) setForm(f => ({ ...f, template_nome: t.nome, idioma: t.idioma, variaveis: {}, botoes: {} })); }}><SelectTrigger id="wa-template"><SelectValue placeholder="Escolha um template" /></SelectTrigger><SelectContent>{templates.filter(t => t.status === "APPROVED").map(t => <SelectItem key={`${t.nome}|${t.idioma}`} value={`${t.nome}|${t.idioma}`}>{t.nome} · {({ MARKETING: "Marketing", UTILITY: "Utilidade", AUTHENTICATION: "Autenticação", SERVICE: "Serviço" } as Record<string, string>)[t.categoria] ?? t.categoria}</SelectItem>)}</SelectContent></Select>
        {!templates.some(t => t.status === "APPROVED") && <Alert><AlertDescription>Nenhum template aprovado. Crie e aprove os templates no WhatsApp Manager e clique em Atualizar saúde na aba</AlertDescription></Alert>}
        {template && <p className="text-[12px] text-muted-foreground">Categoria: {({ MARKETING: "Marketing", UTILITY: "Utilidade", AUTHENTICATION: "Autenticação", SERVICE: "Serviço" } as Record<string, string>)[template.categoria] ?? template.categoria}</p>}
        {template?.categoria === "MARKETING" && <Alert className="border-warning bg-warning/10"><AlertDescription>Template de marketing: custa mais e pesa na qualidade do número. Comece com público pequeno.</AlertDescription></Alert>}
        {Array.from({ length: Number(template?.variaveis ?? 0) }, (_, i) => { const k = String(i + 1), v = form.variaveis[k]; return <div key={k} className="space-y-[6px]"><Label htmlFor={`wa-var-${k}`}>Variável {`{{${k}}}`}</Label><Select value={typeof v === "object" ? "fixo" : v ?? ""} disabled={!editavel || bloqueado} onValueChange={v => campo("variaveis", { ...form.variaveis, [k]: v === "fixo" ? { fixo: "" } : v as "nome" | "primeiro_nome" })}><SelectTrigger id={`wa-var-${k}`}><SelectValue placeholder="Escolha o conteúdo" /></SelectTrigger><SelectContent><SelectItem value="primeiro_nome">Primeiro nome</SelectItem><SelectItem value="nome">Nome completo</SelectItem><SelectItem value="fixo">Texto fixo</SelectItem></SelectContent></Select>{typeof v === "object" && <Input aria-label={`Texto fixo da variável ${k}`} value={v.fixo} onChange={e => campo("variaveis", { ...form.variaveis, [k]: { fixo: e.target.value } })} />}</div>; })}
        {(template?.botoes ?? []).map((b, i) => b.type === "URL" && b.url?.includes("{{1}}") ? <div key={i} className="space-y-[6px]"><Label htmlFor={`wa-botao-${i}`}>Final do link do botão {b.text ?? b.texto}</Label><Input id={`wa-botao-${i}`} value={form.botoes[String(i)]?.fixo ?? ""} placeholder={`?utm_source=whatsapp&utm_medium=api&utm_campaign=${form.utm_campaign}`} onChange={e => campo("botoes", { ...form.botoes, [String(i)]: { fixo: e.target.value } })} /><Button type="button" variant="link" size="sm" disabled={!editavel || bloqueado} onClick={() => campo("botoes", { ...form.botoes, [String(i)]: { fixo: `?utm_source=whatsapp&utm_medium=api&utm_campaign=${encodeURIComponent(form.utm_campaign)}` } })}>Usar UTM sugerida</Button></div> : null)}
        <h3 className="pt-[8px] text-[14px] font-semibold">Público</h3><Label htmlFor="wa-dias">Leads com movimento nos últimos dias</Label><Select value={String(form.publico.dias)} disabled={!editavel || bloqueado} onValueChange={v => campo("publico", { ...form.publico, dias: Number(v) })}><SelectTrigger id="wa-dias"><SelectValue /></SelectTrigger><SelectContent>{[30, 60, 90, 180, 365].map(n => <SelectItem key={n} value={String(n)}>{n} dias</SelectItem>)}</SelectContent></Select>
        <Label htmlFor="wa-dias-min">Ignorar os mais recentes que (dias)</Label><Input id="wa-dias-min" type="number" min={0} step={1} value={form.publico.dias_min} onChange={e => campo("publico", { ...form.publico, dias_min: Number(e.target.value) })} />
        <p className="text-[12px]">Estágios (nenhum marcado = todos)</p>{estagios.isLoading ? <Skeleton className="h-[40px]" /> : estagios.error ? <Alert variant="destructive"><AlertDescription>{mensagemErro(estagios.error)}</AlertDescription></Alert> : <div className="grid gap-[8px] sm:grid-cols-2">{[...(estagios.data ?? [])].sort((a, b) => a.ordem - b.ordem).map((s, i) => <Label key={s.estagio} htmlFor={`wa-estagio-${i}`} className="flex items-center gap-[8px] text-[12px] font-normal"><Checkbox id={`wa-estagio-${i}`} disabled={!editavel || bloqueado} checked={form.publico.estagios?.includes(s.estagio) ?? false} onCheckedChange={v => { const arr = form.publico.estagios ?? []; const next = v === true ? [...arr, s.estagio] : arr.filter(a => a !== s.estagio); campo("publico", { ...form.publico, estagios: next.length ? next : null }); }} />{s.estagio}</Label>)}</div>}
        <Label htmlFor="wa-limite">Limite de pessoas</Label><Input id="wa-limite" type="number" min={1} step={1} placeholder="Sem limite" value={form.limite_alvos ?? ""} onChange={e => campo("limite_alvos", e.target.value === "" ? null : Number(e.target.value))} /><Label htmlFor="wa-utm">UTM campaign</Label><Input id="wa-utm" value={form.utm_campaign} onChange={e => campo("utm_campaign", e.target.value)} />
      </fieldset><div className="min-w-0 space-y-[16px]"><h3 className="text-[14px] font-semibold">Prévia</h3><div className="whitespace-pre-wrap break-words rounded-[8px] bg-success/10 p-[16px] text-[13px]">{previa || "Escolha um template"}</div><h3 className="text-[14px] font-semibold">Prévia do público</h3>{resumo.isFetching || JSON.stringify(publico) !== JSON.stringify(form.publico) ? <Skeleton className="h-[80px] w-full" /> : resumo.error ? <Alert variant="destructive"><AlertDescription>{mensagemErro(resumo.error)}</AlertDescription></Alert> : resumo.data && <div className="space-y-[12px] text-[13px]"><p><strong>{fmtInt(resumo.data.elegiveis)} recebem</strong> · {fmtInt(resumo.data.opt_out)} pediram para sair · {fmtInt(resumo.data.cooldown)} receberam disparo nos últimos dias</p><p>Saldo das próximas 24 h: {fmtInt(resumo.data.saldo_24h)} pessoas</p><details><summary className="cursor-pointer">Por estágio</summary>{resumo.data.por_estagio.map(s => <p key={s.estagio} className="mt-[6px] flex justify-between gap-[12px]"><span>{s.estagio}</span><span>{fmtInt(s.n)}</span></p>)}</details>{resumo.data.modo_teste && <Alert className="border-primary bg-primary/10"><AlertDescription>Modo teste ligado: este disparo vai só para os {fmtInt(resumo.data.allowlist)} telefones de teste, não para o público acima.</AlertDescription></Alert>}</div>}</div></div>
      <div className="mt-[24px] space-y-[12px] border-t pt-[16px]">{status === "erro" && <Alert variant="destructive"><AlertDescription>{atual?.erro ?? "O disparo apresentou um erro."}</AlertDescription></Alert>}{busy && <Loader2 aria-label="Aguarde" className="h-[16px] w-[16px] animate-spin" />}<div className="flex flex-wrap gap-[8px]">
        {editavel && <><Button variant="outline" disabled={bloqueado} onClick={() => void acao(async () => { await salvar(); toast.success("Rascunho salvo."); })}>Salvar rascunho</Button>{atual && <Button variant="destructive" disabled={bloqueado} onClick={() => setDialog("excluir")}>Excluir</Button>}<Button disabled={bloqueado || resumo.isFetching || !resumo.data || !!resumo.error || JSON.stringify(publico) !== JSON.stringify(form.publico)} onClick={() => void acao(async () => { await salvar(); setQuando("agora"); setDialog("acionar"); })}>Acionar</Button></>}
        {["enviando", "agendado"].includes(status) && <Button variant="outline" disabled={bloqueado} onClick={() => void acao(() => executar("pausar"))}>Pausar</Button>}{status === "pausado" && <Button disabled={bloqueado} onClick={() => void acao(() => executar("retomar"))}>Retomar</Button>}{status === "erro" && <Button disabled={bloqueado || !resumo.data || resumo.isFetching} onClick={() => { setQuando("agora"); setDialog("acionar"); }}>Acionar de novo</Button>}{["enviando", "agendado", "pausado", "erro"].includes(status) && <Button variant="destructive" disabled={bloqueado} onClick={() => setDialog("cancelar")}>Cancelar</Button>}
      </div></div>
    </SheetContent></Sheet>
    <Dialog open={dialog !== null} onOpenChange={v => { if (!busy && !v) setDialog(null); }}><DialogContent><DialogHeader><DialogTitle>{dialog === "acionar" ? "Acionar disparo" : dialog === "excluir" ? "Excluir rascunho?" : "Cancelar disparo?"}</DialogTitle><DialogDescription>{dialog === "acionar" ? `Vai para ${fmtInt(quantidade)} pessoas pelo número oficial. O envio sai aos poucos (${fmtInt(estado.data?.config.ritmo_por_minuto)} por minuto, até ${fmtInt(estado.data?.config.teto_diario)} pessoas em 24 h).` : dialog === "cancelar" ? "Os que ainda estão na fila não recebem. Os já enviados não voltam." : "O rascunho será excluído. Esta ação não pode ser desfeita."}</DialogDescription></DialogHeader>
      {dialog === "acionar" && <><Select value={quando} onValueChange={setQuando} disabled={bloqueado}><SelectTrigger aria-label="Quando enviar"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="agora">Agora</SelectItem><SelectItem value="agendar">Agendar</SelectItem></SelectContent></Select>{quando === "agendar" && <div className="grid grid-cols-2 gap-[12px]"><div><Label htmlFor="wa-agenda-data">Data (Brasília)</Label><Input id="wa-agenda-data" type="date" value={data} min={hojeSP()} disabled={bloqueado} onChange={e => setData(e.target.value)} /></div><div><Label htmlFor="wa-agenda-hora">Hora (Brasília)</Label><Input id="wa-agenda-hora" type="time" value={hora} disabled={bloqueado} onChange={e => setHora(e.target.value)} /></div></div>}{!estado.data?.config.envio_ativo && <Alert><AlertDescription>O envio está desligado: o disparo fica na fila até alguém ligar.</AlertDescription></Alert>}</>}
      <DialogFooter><Button variant="outline" disabled={bloqueado} onClick={() => setDialog(null)}>Voltar</Button><Button disabled={bloqueado} onClick={() => void acao(async () => {
        if (!atual) throw new Error("Disparo não encontrado.");
        if (dialog === "excluir") { const { error } = await (supabase as any).from("meta_wa_disparos").delete().eq("id", atual.id).eq("status", "rascunho").select("id").single(); if (error) throw error; setDialog(null); setAberto(false); setSelecionado(null); toast.success("Rascunho excluído."); }
        else if (dialog === "cancelar") await executar("cancelar");
        else { const iso = quando === "agora" ? null : `${data}T${hora}:00-03:00`; if (iso && (!/^\d{4}-\d{2}-\d{2}$/.test(data) || !/^\d{2}:\d{2}$/.test(hora) || !Number.isFinite(new Date(iso).getTime()) || new Date(iso).getTime() <= Date.now())) throw new Error("Escolha uma data e hora futuras (Brasília)."); await executar("acionar", iso); }
      })}>Confirmar</Button></DialogFooter>
    </DialogContent></Dialog>
  </>;
}
