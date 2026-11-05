import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { EmailBlocosEditor, blocosPadrao, temaPadrao, validarEmailBlocos, type EmailBloco, type EmailTema } from "./EmailBlocosEditor";

type Status = "rascunho" | "preparando" | "pronto" | "agendando" | "agendado" | "enviado" | "cancelado" | "erro";
type Publico = { dias: number; dias_min: number; estagios: string[] | null };
type Formulario = {
  titulo: string; assunto: string; preheader: string; corpo: string; botao_texto: string;
  texto_whatsapp: string; remetente_nome: string; publico: Publico;
  blocos: EmailBloco[]; tema: EmailTema;
};
type Disparo = Formulario & {
  id: string; status: Status; enviados_previstos: number | null; brevo_campanha_id: number | null;
  agendado_para: string | null; erro: string | null; criado_em: string; atualizado_em: string; preparado_em: string | null;
};
type ResumoPublico = {
  total: number; elegiveis: number; fora: number;
  por_estagio: { estagio: string; n: number }[];
  por_sdr: { sdr: string; n: number }[];
  fora_por_sdr: { sdr: string; n: number }[];
};
type Resposta = { ok?: boolean; error?: string; html_previa?: string; status?: Status; enviados_previstos?: number;
  enviado_para?: string[]; botao_abre_whatsapp_de?: string; quando_brt?: string; em_envio?: boolean; enviados?: number };
class ErroDisparo extends Error {
  constructor(message: string, public resposta: Resposta = {}, public codigo?: number) { super(message); }
}
const LISTA = ["email-disparos"];
const COLUNAS = "id,titulo,assunto,preheader,corpo,botao_texto,texto_whatsapp,remetente_nome,publico,status,enviados_previstos,brevo_campanha_id,agendado_para,erro,criado_em,atualizado_em,preparado_em,blocos,tema";
const REMETENTE = "marketing@minhacasafinanciada.com";
const novoFormulario = (): Formulario => ({ titulo: "", assunto: "", preheader: "", corpo: "", botao_texto: "", texto_whatsapp: "", remetente_nome: "MCF Capital", publico: { dias: 90, dias_min: 0, estagios: null }, blocos: blocosPadrao(), tema: temaPadrao() });
const numero = (n: number | null | undefined) => n == null ? "—" : Number(n).toLocaleString("pt-BR");
const dataSP = (d: string | null) => d ? new Date(d).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";
const mensagemErro = (e: unknown) => e instanceof Error ? e.message : String((e as { message?: string })?.message ?? "Não foi possível concluir a ação.");
function padraoAgenda() {
  const partes = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
  const p = Object.fromEntries(partes.map(v => [v.type, v.value]));
  const data = `${p.year}-${p.month}-${p.day}`;
  const meioDia = new Date(`${data}T12:00:00-03:00`);
  if (Number(p.hour) >= 12) meioDia.setUTCDate(meioDia.getUTCDate() + 1);
  return { data: meioDia.toISOString().slice(0, 10), hora: "12:00" };
}
function useDebounce<T>(valor: T, ms: number) {
  const [resultado, setResultado] = useState(valor);
  useEffect(() => { const t = setTimeout(() => setResultado(valor), ms); return () => clearTimeout(t); }, [valor, ms]);
  return resultado;
}
async function rpc<T>(nome: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await (supabase as any).rpc(nome, args);
  if (error) throw error;
  return data as T;
}
async function chamar(body: Record<string, unknown>): Promise<Resposta> {
  const { data, error } = await supabase.functions.invoke("brevo-sync-lista", { body });
  if (error) {
    let resposta: Resposta = {};
    try { resposta = await error.context.json(); } catch { /* A resposta pode não ser JSON. */ }
    throw new ErroDisparo(resposta?.error || "Não foi possível falar com o Brevo. Tente novamente.", resposta ?? {}, error.context?.status);
  }
  if (data?.ok === false) throw new ErroDisparo(data.error || "Não foi possível concluir a ação.", data);
  return data ?? {};
}
function StatusBadge({ r }: { r: Disparo }) {
  const trabalhando = r.status === "preparando" || r.status === "agendando";
  const nomes: Record<Status, string> = { rascunho: "Rascunho", preparando: "Preparando", pronto: "Pronto", agendando: "Agendando", agendado: "Agendado", enviado: "Enviado", cancelado: "Cancelado", erro: "Erro" };
  return <Badge variant={r.status === "erro" ? "destructive" : trabalhando ? "secondary" : r.status === "rascunho" || r.status === "cancelado" ? "outline" : "default"} className={`gap-[4px] whitespace-nowrap ${r.status === "enviado" ? "bg-success text-success-foreground" : ""}`}>
    {trabalhando && <Loader2 className="h-[12px] w-[12px] animate-spin" />}{nomes[r.status]}{r.status === "agendado" && ` · ${dataSP(r.agendado_para)}`}
  </Badge>;
}

export function EmailDisparos() {
  const acesso = useQuery({ queryKey: ["mkt-email-can-send"], queryFn: () => rpc<boolean>("mkt_email_can_send"), staleTime: 60_000, retry: false });
  if (acesso.data !== true || acesso.isError) return null;
  return <DisparosConteudo />;
}

function DisparosConteudo() {
  const qc = useQueryClient();
  const [aberto, setAberto] = useState(false);
  const [selecionado, setSelecionado] = useState<Disparo | null>(null);
  const [form, setForm] = useState<Formulario>(novoFormulario);
  const [busy, setBusy] = useState<string | null>(null);
  const [editorBusy, setEditorBusy] = useState(false);
  const trava = useRef(false);
  const [agenda, setAgenda] = useState(padraoAgenda);
  const [agendarAberto, setAgendarAberto] = useState(false);
  const [agora, setAgora] = useState(false);
  const [confirmacao, setConfirmacao] = useState<"excluir" | "cancelar" | "forcar" | null>(null);
  const [jaEnviados, setJaEnviados] = useState<number | null>(null);
  const lista = useQuery({
    queryKey: LISTA,
    queryFn: async () => {
      const rows: Disparo[] = [];
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await (supabase as any).from("email_disparos").select(COLUNAS).order("criado_em", { ascending: false }).order("id").range(offset, offset + 999);
        if (error) throw error;
        rows.push(...(data ?? []));
        if ((data ?? []).length < 1000) return rows;
      }
    },
    refetchInterval: q => q.state.data?.some(r => r.status === "preparando" || r.status === "agendando") ? 5000 : false,
  });
  const atual = lista.data?.find(r => r.id === selecionado?.id) ?? selecionado;
  const status = atual?.status ?? "rascunho";
  const editavel = status === "rascunho" || (status === "erro" && atual?.brevo_campanha_id == null);
  const estagios = useQuery({ queryKey: ["mkt-email-estagios"], queryFn: () => rpc<{ ordem: number; estagio: string }[]>("mkt_email_estagios"), enabled: aberto, staleTime: 60_000 });
  const publico = useDebounce(form.publico, 600);
  const resumo = useQuery({ queryKey: ["mkt-email-publico-resumo", publico], queryFn: () => rpc<ResumoPublico>("mkt_email_publico_resumo", { p_dias: publico.dias, p_dias_min: publico.dias_min, p_estagios: publico.estagios }), enabled: aberto && publico.dias_min >= 0, staleTime: 60_000, retry: false });
  const textos = JSON.stringify({ assunto: form.assunto, preheader: form.preheader, texto_whatsapp: form.texto_whatsapp, blocos: form.blocos, tema: form.tema });
  const textoPrevia = useDebounce(textos, 1000);
  const previa = useQuery({ queryKey: ["email-disparos-previa", textoPrevia], queryFn: () => chamar({ modo: "render", ...JSON.parse(textoPrevia) }), enabled: aberto && !busy && !editorBusy, retry: false, staleTime: 60_000 });
  const bloqueado = !!busy || editorBusy || previa.isFetching;
  useEffect(() => { if (previa.error) toast.error(mensagemErro(previa.error)); }, [previa.error]);

  function abrir(r: Disparo | null) {
    setSelecionado(r);
    setForm(r ? { titulo: r.titulo ?? "", assunto: r.assunto ?? "", preheader: r.preheader ?? "", corpo: r.corpo ?? "", botao_texto: r.botao_texto ?? "", texto_whatsapp: r.texto_whatsapp ?? "", remetente_nome: r.remetente_nome ?? "MCF Capital", publico: r.publico ?? novoFormulario().publico, blocos: r.blocos ?? blocosPadrao(r.corpo ?? "", r.botao_texto ?? ""), tema: r.tema ?? temaPadrao() } : novoFormulario());
    setAberto(true);
  }
  function campo<K extends keyof Formulario>(key: K, value: Formulario[K]) { setForm(f => ({ ...f, [key]: value })); }
  function validar() {
    if (!form.assunto.trim() || !form.texto_whatsapp.trim()) throw new Error("Preencha assunto e mensagem do WhatsApp.");
    validarEmailBlocos(form.blocos, form.tema);
    if ([form.assunto, form.preheader, form.remetente_nome].some(t => /[{}]/.test(t))) throw new Error("Assunto, pré-cabeçalho e nome do remetente não podem conter { ou }.");
    if (!Number.isInteger(form.publico.dias_min) || form.publico.dias_min < 0) throw new Error("Informe um número inteiro de dias, maior ou igual a zero.");
  }
  async function salvar(): Promise<Disparo> {
    if (!editavel) throw new Error("Para editar, clique em Reabrir para editar.");
    validar();
    const tabela = (supabase as any).from("email_disparos");
    const payload = { ...form, corpo: form.blocos.filter((b): b is Extract<EmailBloco, { tipo: "texto" }> => b.tipo === "texto").map(b => b.texto).join("\n\n"), botao_texto: form.blocos.find((b): b is Extract<EmailBloco, { tipo: "botao" }> => b.tipo === "botao")?.texto ?? "" };
    let query = atual ? tabela.update(payload).eq("id", atual.id).eq("status", status) : tabela.insert({ ...payload, status: "rascunho" });
    if (atual && status === "erro") query = query.is("brevo_campanha_id", null);
    const { data, error } = await query.select(COLUNAS).single();
    if (error) throw error;
    setSelecionado(data as Disparo);
    return data as Disparo;
  }
  async function acao(nome: string, tarefa: () => Promise<void>) {
    if (trava.current || editorBusy || previa.isFetching) return;
    trava.current = true;
    setBusy(nome);
    try { await tarefa(); } catch (e) { toast.error(mensagemErro(e)); }
    finally { await qc.invalidateQueries({ queryKey: LISTA }); trava.current = false; setBusy(null); }
  }
  async function executar(modo: string, extra: Record<string, unknown> = {}) {
    const r = editavel ? await salvar() : atual;
    if (!r) throw new Error("Salve o disparo antes de continuar.");
    const resposta = await chamar({ modo, disparo_id: r.id, ...extra });
    // Mantém a resposta da edge até a próxima leitura da lista.
    if (resposta.status) {
      const atualizado = { ...r, status: resposta.status, enviados_previstos: resposta.enviados_previstos ?? r.enviados_previstos };
      setSelecionado(atualizado);
      qc.setQueryData<Disparo[]>(LISTA, old => old?.map(item => item.id === r.id ? atualizado : item));
    }
    return resposta;
  }
  async function cancelar(forcar = false) {
    try {
      await executar("cancelar", forcar ? { forcar: true } : {});
      setConfirmacao(null); toast.success("Cancelamento solicitado.");
    } catch (e) {
      if (e instanceof ErroDisparo && e.codigo === 409 && e.resposta.em_envio) {
        setJaEnviados(e.resposta.enviados ?? null); setConfirmacao("forcar");
      } else throw e;
    }
  }
  const quando = agora ? "agora" : `${agenda.data}T${agenda.hora}:00-03:00`;
  const labelQuando = agora ? "agora (Brasília)" : `${agenda.data.slice(8, 10)}/${agenda.data.slice(5, 7)} às ${agenda.hora} (Brasília)`;
  const cell = "px-[12px] py-[12px] whitespace-nowrap";
  return <>
    <Card className="min-w-0">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-[12px] p-[20px]">
        <CardTitle className="text-[18px] tracking-normal">Disparos</CardTitle>
        <Button size="sm" disabled={bloqueado} onClick={() => abrir(null)}><Plus className="mr-[6px] h-[14px] w-[14px]" />Novo disparo</Button>
      </CardHeader>
      <CardContent className="p-[20px] pt-0">
        {lista.isLoading ? <Skeleton className="h-[80px] w-full" /> : lista.error ? <Alert variant="destructive"><AlertDescription>{mensagemErro(lista.error)}</AlertDescription><Button variant="outline" disabled={bloqueado} onClick={() => void lista.refetch()}>Tentar novamente</Button></Alert> : !lista.data?.length ? <p className="py-[24px] text-center text-[13px] text-muted-foreground">Nenhum disparo cadastrado.</p> :
          <Table className="text-[12px]"><TableHeader><TableRow>{["Título", "Status", "Público previsto", "Agendado para", "Criado em"].map(t => <TableHead key={t} className={cell}>{t}</TableHead>)}</TableRow></TableHeader>
            <TableBody>{lista.data.map(r => <TableRow key={r.id} role="button" aria-disabled={bloqueado} tabIndex={bloqueado ? -1 : 0} className="cursor-pointer" onClick={() => { if (!bloqueado) abrir(r); }} onKeyDown={e => { if (!bloqueado && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); abrir(r); } }}>
              <TableCell className="min-w-[180px] px-[12px] py-[12px]">{r.titulo || "Sem título"}</TableCell><TableCell className={cell}><StatusBadge r={r} /></TableCell><TableCell className={cell}>{numero(r.enviados_previstos)}</TableCell><TableCell className={cell}>{dataSP(r.agendado_para)}</TableCell><TableCell className={cell}>{dataSP(r.criado_em)}</TableCell>
            </TableRow>)}</TableBody></Table>}
      </CardContent>
    </Card>
    <Sheet open={aberto} onOpenChange={v => { if (!busy && !editorBusy) setAberto(v); }}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-[1100px]">
        <SheetHeader><SheetTitle>{atual?.titulo || "Novo disparo"}</SheetTitle><SheetDescription>{REMETENTE}</SheetDescription></SheetHeader>
        <div className="mt-[20px] grid min-w-0 grid-cols-1 gap-[24px] lg:grid-cols-2">
          <div className="min-w-0 space-y-[16px]">
            {!editavel && <Alert><AlertDescription>Para editar, clique em Reabrir para editar.</AlertDescription></Alert>}
            {status === "erro" && <Alert variant="destructive"><AlertDescription>{atual?.erro || "O disparo apresentou um erro."}</AlertDescription></Alert>}
            <fieldset disabled={!editavel || bloqueado} className="space-y-[12px]">
              {([ ["titulo", "Título"], ["assunto", "Assunto"], ["preheader", "Pré-cabeçalho"] ] as const).map(([key, label]) => <div key={key} className="space-y-[6px]"><Label htmlFor={`disparo-${key}`}>{label}</Label><Input id={`disparo-${key}`} value={form[key]} onChange={e => campo(key, e.target.value)} /></div>)}
              <EmailBlocosEditor blocos={form.blocos} tema={form.tema} disabled={!editavel || bloqueado} editavel={editavel} onBusyChange={setEditorBusy} onChange={(blocos, tema) => setForm(f => ({ ...f, blocos, tema }))} />
              <div className="space-y-[6px]"><Label htmlFor="disparo-whatsapp">Mensagem que já vem escrita no WhatsApp do SDR</Label><Textarea id="disparo-whatsapp" rows={3} value={form.texto_whatsapp} onChange={e => campo("texto_whatsapp", e.target.value)} /></div>
              <div className="space-y-[6px]"><Label htmlFor="disparo-remetente">Nome do remetente</Label><Input id="disparo-remetente" value={form.remetente_nome} onChange={e => campo("remetente_nome", e.target.value)} /><p className="break-all text-[11px] text-muted-foreground">{REMETENTE}</p></div>
              <h3 className="pt-[8px] text-[14px] font-semibold">Público</h3>
              <div className="space-y-[6px]"><Label htmlFor="disparo-dias">Leads com movimento nos últimos dias</Label><Select value={String(form.publico.dias)} disabled={!editavel || bloqueado} onValueChange={v => campo("publico", { ...form.publico, dias: Number(v) })}><SelectTrigger id="disparo-dias"><SelectValue /></SelectTrigger><SelectContent>{[30, 60, 90, 180, 365].map(n => <SelectItem key={n} value={String(n)}>{n} dias</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-[6px]"><Label htmlFor="disparo-dias-min">Ignorar os mais recentes que (dias)</Label><Input id="disparo-dias-min" type="number" min={0} step={1} value={form.publico.dias_min} onChange={e => campo("publico", { ...form.publico, dias_min: e.target.value === "" ? 0 : Number(e.target.value) })} /></div>
              <p className="text-[12px] font-medium">Estágios <span className="font-normal text-muted-foreground">(nenhum marcado = todos)</span></p>
              {estagios.isLoading ? <Skeleton className="h-[40px]" /> : estagios.error ? <Alert variant="destructive"><AlertDescription>{mensagemErro(estagios.error)}</AlertDescription></Alert> : <div className="grid grid-cols-1 gap-[8px] sm:grid-cols-2">{[...(estagios.data ?? [])].sort((a, b) => a.ordem - b.ordem).map((s, i) => <Label key={s.estagio} htmlFor={`disparo-estagio-${i}`} className="flex items-center gap-[8px] text-[12px] font-normal"><Checkbox id={`disparo-estagio-${i}`} disabled={!editavel || bloqueado} checked={form.publico.estagios?.includes(s.estagio) ?? false} onCheckedChange={checked => {
                const atuais = form.publico.estagios ?? [];
                const novos = checked === true ? [...atuais, s.estagio] : atuais.filter(v => v !== s.estagio);
                campo("publico", { ...form.publico, estagios: novos.length ? novos : null });
              }} />{s.estagio}</Label>)}</div>}
            </fieldset>
            {resumo.isFetching ? <Skeleton className="h-[40px] w-full" /> : resumo.error ? <Alert variant="destructive"><AlertDescription>{mensagemErro(resumo.error)}</AlertDescription></Alert> : resumo.data && <div className="space-y-[10px] text-[12px]">
              <p><strong>{numero(resumo.data.elegiveis)} recebem</strong> · {numero(resumo.data.fora)} ficam de fora (SDR sem telefone ou desligado)</p>
              <details><summary className="cursor-pointer text-muted-foreground">Por estágio</summary><dl className="mt-[8px] space-y-[4px]">{(resumo.data.por_estagio ?? []).map(s => <div key={s.estagio} className="flex justify-between gap-[12px]"><dt>{s.estagio}</dt><dd>{numero(s.n)}</dd></div>)}</dl></details>
              <details><summary className="cursor-pointer text-muted-foreground">Por SDR e fora por SDR</summary><p className="mt-[8px] font-medium">Recebem</p><dl>{(resumo.data.por_sdr ?? []).map(s => <div key={s.sdr} className="flex justify-between gap-[12px]"><dt>{s.sdr}</dt><dd>{numero(s.n)}</dd></div>)}</dl><p className="mt-[8px] font-medium">Ficam de fora</p><dl>{(resumo.data.fora_por_sdr ?? []).map(s => <div key={s.sdr} className="flex justify-between gap-[12px]"><dt>{s.sdr}</dt><dd>{numero(s.n)}</dd></div>)}</dl></details>
            </div>}
          </div>
          <div className="min-w-0 space-y-[12px]">
            <div className="flex flex-wrap items-center justify-between gap-[8px]"><h3 className="text-[14px] font-semibold">Prévia</h3><Button variant="outline" size="sm" disabled={bloqueado} onClick={() => void previa.refetch()}><RefreshCw className="mr-[6px] h-[14px] w-[14px]" />Atualizar prévia</Button></div>
            {previa.isFetching && <p role="status" className="text-[12px] text-muted-foreground">Atualizando prévia…</p>}
            {previa.error && <Alert variant="destructive"><AlertDescription>{mensagemErro(previa.error)}</AlertDescription></Alert>}
            <iframe sandbox="" srcDoc={previa.data?.html_previa ?? ""} title="Prévia do e-mail" className="h-[640px] w-full border bg-[white]" />
            <p className="text-[11px] text-muted-foreground">Na prévia o nome é 'João' e o botão não abre o WhatsApp de verdade.</p>
          </div>
        </div>
        <div className="mt-[24px] space-y-[12px] border-t pt-[16px] text-[13px]">
          {busy && <p role="status" className="flex items-center gap-[8px]"><Loader2 className="h-[16px] w-[16px] animate-spin" />{busy === "preparar" ? "Preparando lista e campanha… pode levar até 1 minuto" : "Aguarde…"}</p>}
          {(status === "preparando" || status === "agendando") && <p role="status">{status === "preparando" ? "Preparando lista e campanha… pode levar até 1 minuto" : "Agendando envio…"}</p>}
          {status === "pronto" && <p>Pronto para <strong>{numero(atual?.enviados_previstos)}</strong> pessoas (público montado em {dataSP(atual?.preparado_em ?? null)})</p>}
          {status === "agendado" && <p>Agendado para {dataSP(atual?.agendado_para ?? null)} (Brasília)</p>}
          {status === "enviado" && <p>Ver números na tabela Por envio, abaixo</p>}
          <div className="flex flex-wrap gap-[8px]">
            {editavel && <>
              <Button disabled={bloqueado} variant="outline" onClick={() => void acao("salvar", async () => { await salvar(); toast.success("Rascunho salvo."); })}>Salvar rascunho</Button>
              <Button disabled={bloqueado} onClick={() => void acao("preparar", async () => { await executar("preparar"); toast.success("Lista e campanha preparadas no Brevo."); })}>Preparar no Brevo</Button>
              {atual && atual.brevo_campanha_id == null && <Button disabled={bloqueado} variant="destructive" onClick={() => setConfirmacao("excluir")}>Excluir</Button>}
            </>}
            {status === "pronto" && <>
              <Button variant="outline" disabled={bloqueado} onClick={() => void acao("teste", async () => { const r = await executar("teste"); toast.success(`Teste enviado para ${(r.enviado_para ?? []).join(", ")}. O botão do teste abre o WhatsApp de ${r.botao_abre_whatsapp_de ?? "—"}.`); })}>Enviar teste para mim</Button>
              <Button disabled={bloqueado} onClick={() => { setAgenda(padraoAgenda()); setAgora(false); setAgendarAberto(true); }}>Agendar envio</Button>
            </>}
            {(status === "pronto" || status === "cancelado" || status === "erro" && atual?.brevo_campanha_id != null) && <Button variant="outline" disabled={bloqueado} onClick={() => void acao("reabrir", async () => { await executar("reabrir"); toast.success("Disparo reaberto para editar."); })}>Reabrir para editar</Button>}
            {status === "agendado" && <><Button variant="destructive" disabled={bloqueado} onClick={() => setConfirmacao("cancelar")}>Cancelar agendamento</Button><Button variant="outline" disabled={bloqueado} onClick={() => void acao("status", async () => { const r = await executar("status"); toast.success(`Status atualizado: ${r.status ?? status}. Enviados: ${numero(r.enviados)}.`); })}>Atualizar status</Button></>}
          </div>
        </div>
      </SheetContent>
    </Sheet>
    <Dialog open={agendarAberto} onOpenChange={v => { if (!busy) setAgendarAberto(v); }}>
      <DialogContent><DialogHeader><DialogTitle>Agendar envio</DialogTitle><DialogDescription>Horário de Brasília</DialogDescription></DialogHeader>
        <div className="grid grid-cols-2 gap-[12px]"><div className="space-y-[6px]"><Label htmlFor="disparo-data">Data</Label><Input id="disparo-data" type="date" value={agenda.data} disabled={bloqueado || agora} onChange={e => setAgenda(a => ({ ...a, data: e.target.value }))} /></div><div className="space-y-[6px]"><Label htmlFor="disparo-hora">Hora</Label><Input id="disparo-hora" type="time" value={agenda.hora} disabled={bloqueado || agora} onChange={e => setAgenda(a => ({ ...a, hora: e.target.value }))} /></div></div>
        <Label htmlFor="disparo-agora" className="flex items-center gap-[8px]"><Checkbox id="disparo-agora" checked={agora} disabled={bloqueado} onCheckedChange={v => setAgora(v === true)} />Enviar agora</Label>
        <p className="text-[13px]">Vai para <strong>{numero(atual?.enviados_previstos)}</strong> pessoas em <strong>{labelQuando}</strong>, pelo {REMETENTE}. Depois que começar a sair, não dá para desfazer.</p>
        <DialogFooter><Button variant="outline" disabled={bloqueado} onClick={() => setAgendarAberto(false)}>Voltar</Button><Button variant="destructive" disabled={bloqueado} onClick={() => void acao("agendar", async () => {
          if (!agora && (!/^\d{4}-\d{2}-\d{2}$/.test(agenda.data) || !/^\d{2}:\d{2}$/.test(agenda.hora) || !Number.isFinite(new Date(quando).getTime()) || new Date(quando).getTime() <= Date.now())) throw new Error("Escolha uma data e hora futuras (Brasília).");
          const r = await executar("agendar", { quando }); setAgendarAberto(false); toast.success(r.quando_brt || "Envio confirmado.");
        })}>Confirmar envio</Button></DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog open={confirmacao !== null} onOpenChange={v => { if (!busy && !v) setConfirmacao(null); }}><DialogContent>
      <DialogHeader><DialogTitle>{confirmacao === "excluir" ? "Excluir disparo?" : confirmacao === "forcar" ? "Interromper envio?" : "Cancelar agendamento?"}</DialogTitle><DialogDescription>{confirmacao === "forcar" ? `Já saíram ${numero(jaEnviados)} e-mails. Interromper o resto?` : confirmacao === "excluir" ? "O rascunho será excluído. Esta ação não pode ser desfeita." : "Confirma o cancelamento deste envio?"}</DialogDescription></DialogHeader>
      <DialogFooter><Button variant="outline" disabled={bloqueado} onClick={() => setConfirmacao(null)}>Voltar</Button><Button variant="destructive" disabled={bloqueado} onClick={() => void acao(confirmacao ?? "cancelar", async () => {
        if (confirmacao === "excluir") {
          const r = await salvar();
          if (r.brevo_campanha_id != null) throw new Error("Este disparo já possui campanha no Brevo.");
          const { data, error } = await (supabase as any).from("email_disparos").delete().eq("id", r.id).in("status", ["rascunho", "erro"]).is("brevo_campanha_id", null).select("id").single();
          if (error) throw error;
          if (!data) throw new Error("Não foi possível excluir o disparo.");
          setConfirmacao(null); setAberto(false); setSelecionado(null); toast.success("Disparo excluído.");
        } else await cancelar(confirmacao === "forcar");
      })}>{confirmacao === "excluir" ? "Excluir" : confirmacao === "forcar" ? "Interromper o resto" : "Confirmar cancelamento"}</Button></DialogFooter>
    </DialogContent></Dialog>
  </>;
}