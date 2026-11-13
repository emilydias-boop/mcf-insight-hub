import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { rpc, mensagemErro, cellWA, type EstadoWA, type TemplateWA } from "./WhatsAppDisparos";

const CATEGORIA: Record<string, string> = { UTILITY: "Utilidade", MARKETING: "Marketing", AUTHENTICATION: "Autenticação" };
const STATUS: Record<string, { t: string; c: string }> = {
  APPROVED: { t: "Aprovado", c: "bg-success/15 text-success border-success/30" },
  PENDING: { t: "Em análise", c: "bg-warning/15 text-warning border-warning/30" },
  REJECTED: { t: "Recusado", c: "bg-destructive/15 text-destructive border-destructive/30" },
  PAUSED: { t: "Pausado", c: "" },
  DISABLED: { t: "Desativado", c: "" },
};

type Grupo = "nenhum" | "rapidas" | "acao";
type BotaoForm = { tipo: "QUICK_REPLY" | "URL" | "PHONE_NUMBER"; texto: string; url: string; exemplo: string; telefone: string };
type Erros = Record<string, string>;
const novoBotao = (tipo: BotaoForm["tipo"]): BotaoForm => ({ tipo, texto: "", url: "", exemplo: "", telefone: "" });

export function variaveisDoCorpo(corpo: string) {
  return Array.from(new Set(Array.from(corpo.matchAll(/\{\{\s*(\d+)\s*\}\}/g)).map(m => Number(m[1])))).sort((a, b) => a - b);
}

function validar(f: { nome: string; cabecalho: string; corpo: string; exemplos: Record<string, string>; rodape: string; grupo: Grupo; botoes: BotaoForm[] }): Erros {
  const e: Erros = {};
  if (!/^[a-z0-9_]{1,512}$/.test(f.nome)) e.nome = "Use só letras minúsculas, números e _.";
  if (f.cabecalho.length > 60) e.cabecalho = "Até 60 caracteres.";
  else if (f.cabecalho.includes("{{")) e.cabecalho = "O cabeçalho não pode ter variável.";
  if (f.rodape.length > 60) e.rodape = "Até 60 caracteres.";
  else if (f.rodape.includes("{{")) e.rodape = "O rodapé não pode ter variável.";
  const corpo = f.corpo.trim();
  if (!corpo) e.corpo = "Escreva o corpo da mensagem.";
  else if (f.corpo.length > 1024) e.corpo = "Até 1024 caracteres.";
  else if (/^\{\{\s*\d+\s*\}\}/.test(corpo) || /\{\{\s*\d+\s*\}\}$/.test(corpo)) e.corpo = "O corpo não pode começar nem terminar com uma variável.";
  else {
    const vars = variaveisDoCorpo(corpo);
    if (vars.some((v, i) => v !== i + 1)) e.corpo = "As variáveis precisam estar em sequência, começando em {{1}}, sem pular.";
    vars.forEach(v => { if (!(f.exemplos[v] ?? "").trim()) e[`exemplo_${v}`] = "Exemplo obrigatório."; });
  }
  if (f.grupo !== "nenhum") {
    if (f.botoes.length === 0) e.botoes = "Adicione ao menos um botão ou escolha Nenhum.";
    if (f.botoes.length > 3) e.botoes = "No máximo 3 botões.";
    if (f.botoes.filter(b => b.tipo === "PHONE_NUMBER").length > 1) e.botoes = "No máximo 1 botão de telefone.";
    if (f.botoes.filter(b => b.tipo === "URL").length > 2) e.botoes = "No máximo 2 botões de link.";
    f.botoes.forEach((b, i) => {
      if (!b.texto.trim()) e[`botao_${i}_texto`] = "Texto obrigatório.";
      else if (b.texto.length > 25) e[`botao_${i}_texto`] = "Até 25 caracteres.";
      if (b.tipo === "URL") {
        if (!/^https:\/\/\S+$/.test(b.url)) e[`botao_${i}_url`] = "A URL precisa começar com https://";
        else if (b.url.endsWith("{{1}}") && !/^https:\/\/\S+$/.test(b.exemplo)) e[`botao_${i}_exemplo`] = "Informe o exemplo da URL completa.";
      }
      if (b.tipo === "PHONE_NUMBER" && !/^\+55\d{10,11}$/.test(b.telefone.replace(/[\s()-]/g, ""))) e[`botao_${i}_telefone`] = "Use o formato +55 com DDD.";
    });
  }
  return e;
}

function Erro({ m }: { m?: string }) { return m ? <p className="text-[12px] text-destructive">{m}</p> : null; }

async function lerErroEdge(error: unknown) {
  const ctx = (error as { context?: Response })?.context;
  let corpo: { error?: string; campo?: string } = {};
  let status: number | undefined;
  if (ctx && typeof ctx.json === "function") { status = ctx.status; try { corpo = await ctx.json(); } catch { /* sem corpo */ } }
  return { status, mensagem: corpo.error ?? mensagemErro(error), campo: corpo.campo };
}

export function WhatsAppTemplates() {
  const qc = useQueryClient();
  const estado = useQuery({ queryKey: ["mkt-wa-estado"], queryFn: () => rpc<EstadoWA>("mkt_wa_estado"), staleTime: 60_000 });
  const e = estado.data;
  const pode = !!e?.pode_mexer;
  const [aberto, setAberto] = useState(false);
  const [excluir, setExcluir] = useState<TemplateWA | null>(null);
  const [busy, setBusy] = useState(false);
  const trava = useRef(false);

  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState<"UTILITY" | "MARKETING">("UTILITY");
  const [cabecalho, setCabecalho] = useState("");
  const [corpo, setCorpo] = useState("");
  const [exemplos, setExemplos] = useState<Record<string, string>>({});
  const [rodape, setRodape] = useState("");
  const [grupo, setGrupo] = useState<Grupo>("nenhum");
  const [botoes, setBotoes] = useState<BotaoForm[]>([]);
  const [erros, setErros] = useState<Erros>({});
  const corpoRef = useRef<HTMLTextAreaElement>(null);
  const vars = useMemo(() => variaveisDoCorpo(corpo), [corpo]);

  function limpar() { setNome(""); setCategoria("UTILITY"); setCabecalho(""); setCorpo(""); setExemplos({}); setRodape(""); setGrupo("nenhum"); setBotoes([]); setErros({}); }
  function inserirVariavel() {
    const n = (vars.length ? Math.max(...vars) : 0) + 1;
    const tag = `{{${n}}}`;
    const el = corpoRef.current;
    const ini = el?.selectionStart ?? corpo.length, fim = el?.selectionEnd ?? corpo.length;
    setCorpo((corpo.slice(0, ini) + tag + corpo.slice(fim)).slice(0, 1024));
  }
  function trocarGrupo(g: Grupo) { setGrupo(g); setBotoes(g === "rapidas" ? [novoBotao("QUICK_REPLY")] : g === "acao" ? [novoBotao("URL")] : []); }
  const setBotao = (i: number, p: Partial<BotaoForm>) => setBotoes(bs => bs.map((b, j) => j === i ? { ...b, ...p } : b));

  async function enviar() {
    const err = validar({ nome, cabecalho, corpo, exemplos, rodape, grupo, botoes });
    setErros(err);
    if (Object.keys(err).length) { toast.error("Corrija os campos marcados."); return; }
    if (trava.current) return;
    trava.current = true; setBusy(true);
    try {
      const body = {
        acao: "criar", nome, categoria, idioma: "pt_BR",
        cabecalho: cabecalho.trim() || null,
        corpo: corpo.trim(),
        exemplos: vars.map(v => exemplos[v].trim()),
        rodape: rodape.trim() || null,
        botoes: botoes.map(b => b.tipo === "QUICK_REPLY" ? { tipo: b.tipo, texto: b.texto.trim() }
          : b.tipo === "URL" ? { tipo: b.tipo, texto: b.texto.trim(), url: b.url.trim(), ...(b.url.endsWith("{{1}}") ? { exemplo: b.exemplo.trim() } : {}) }
          : { tipo: b.tipo, texto: b.texto.trim(), telefone: b.telefone.replace(/[\s()-]/g, "") }),
      };
      const { data, error } = await supabase.functions.invoke("meta-wa-templates", { body });
      if (error) {
        const { status, mensagem, campo } = await lerErroEdge(error);
        if (campo) setErros(x => ({ ...x, [campo]: mensagem }));
        toast.error(status === 409 ? "Já existe um template com esse nome" : status === 504 ? "A Meta não respondeu. Clique em Atualizar saúde antes de tentar de novo" : mensagem);
        return;
      }
      toast.success("Template enviado para análise da Meta. A aprovação costuma levar de minutos a algumas horas.");
      if ((data as { aviso?: string })?.aviso) toast.warning((data as { aviso: string }).aviso);
      setAberto(false); limpar();
      await qc.invalidateQueries({ queryKey: ["mkt-wa-estado"] });
    } finally { trava.current = false; setBusy(false); }
  }

  async function confirmarExcluir() {
    if (!excluir || trava.current) return;
    trava.current = true; setBusy(true);
    try {
      const { error } = await supabase.functions.invoke("meta-wa-templates", { body: { acao: "excluir", nome: excluir.nome, idioma: excluir.idioma } });
      if (error) { const { status, mensagem } = await lerErroEdge(error); toast.error(status === 504 ? "A Meta não respondeu. Clique em Atualizar saúde antes de tentar de novo" : mensagem); return; }
      toast.success("Template excluído.");
      setExcluir(null);
      await qc.invalidateQueries({ queryKey: ["mkt-wa-estado"] });
    } finally { trava.current = false; setBusy(false); }
  }

  const previa = corpo.replace(/\{\{\s*(\d+)\s*\}\}/g, (m, n) => exemplos[n]?.trim() || m);
  const templates = e?.templates ?? [];

  return <Card className="min-w-0">
    <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-[12px] p-[20px]">
      <CardTitle className="text-[18px] tracking-normal">Templates do WhatsApp oficial</CardTitle>
      {pode && <Button size="sm" onClick={() => { limpar(); setAberto(true); }}><Plus className="mr-[6px] h-[14px] w-[14px]" />Novo template</Button>}
    </CardHeader>
    <CardContent className="p-[20px] pt-0">
      {estado.isLoading ? <Skeleton className="h-[80px] w-full" /> : estado.error ? <Alert variant="destructive"><AlertDescription>{mensagemErro(estado.error)}</AlertDescription></Alert> : templates.length === 0 ? <p className="text-[13px] text-muted-foreground">Nenhum template encontrado.</p> :
        <Table className="text-[12px]"><TableHeader><TableRow>{["Nome", "Idioma", "Categoria", "Status", "Qualidade", "Motivo da recusa", "Corpo", ...(pode ? [""] : [])].map((t, i) => <TableHead key={i} className={cellWA}>{t}</TableHead>)}</TableRow></TableHeader>
          <TableBody>{templates.map(t => { const s = STATUS[t.status]; return <TableRow key={`${t.nome}-${t.idioma}`}>
            <TableCell className={`${cellWA} font-medium`}>{t.nome}</TableCell>
            <TableCell className={cellWA}>{t.idioma}</TableCell>
            <TableCell className={cellWA}>{CATEGORIA[t.categoria] ?? t.categoria}</TableCell>
            <TableCell className={cellWA}><Badge variant="outline" className={s?.c}>{s?.t ?? t.status}</Badge></TableCell>
            <TableCell className={cellWA}>{t.qualidade ?? "—"}</TableCell>
            <TableCell className="px-[12px] py-[12px]">{t.motivo_rejeicao || "—"}</TableCell>
            <TableCell className="max-w-[320px] px-[12px] py-[12px]" title={t.corpo}>{t.corpo?.length > 80 ? `${t.corpo.slice(0, 80)}…` : t.corpo}</TableCell>
            {pode && <TableCell className={cellWA}><Button size="sm" variant="ghost" disabled={busy} onClick={() => setExcluir(t)}><Trash2 className="mr-[6px] h-[14px] w-[14px]" />Excluir</Button></TableCell>}
          </TableRow>; })}</TableBody></Table>}
    </CardContent>

    <Dialog open={!!excluir} onOpenChange={v => { if (!busy && !v) setExcluir(null); }}><DialogContent><DialogHeader><DialogTitle>Excluir template</DialogTitle><DialogDescription>Excluir o template {excluir?.nome}? A Meta não deixa reaproveitar o nome por algum tempo.</DialogDescription></DialogHeader>
      <DialogFooter><Button variant="outline" disabled={busy} onClick={() => setExcluir(null)}>Voltar</Button><Button variant="destructive" disabled={busy} onClick={confirmarExcluir}>{busy && <Loader2 className="mr-[6px] h-[14px] w-[14px] animate-spin" />}Excluir</Button></DialogFooter></DialogContent></Dialog>

    <Sheet open={aberto} onOpenChange={v => { if (!busy) setAberto(v); }}><SheetContent className="w-full overflow-y-auto sm:max-w-[640px]">
      <SheetHeader><SheetTitle>Novo template</SheetTitle><SheetDescription>O template vai para análise da Meta antes de poder ser usado.</SheetDescription></SheetHeader>
      <div className="mt-[20px] space-y-[16px]">
        <div className="space-y-[6px]"><Label htmlFor="tpl-nome">Nome</Label><Input id="tpl-nome" value={nome} onChange={ev => setNome(ev.target.value.toLowerCase().replace(/ /g, "_"))} placeholder="lembrete_reuniao" /><Erro m={erros.nome} /></div>
        <div className="space-y-[6px]"><Label>Categoria</Label><Select value={categoria} onValueChange={v => setCategoria(v as "UTILITY" | "MARKETING")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="UTILITY">Utilidade</SelectItem><SelectItem value="MARKETING">Marketing</SelectItem></SelectContent></Select>
          <p className="text-[12px] text-muted-foreground">Utilidade = lembrete, confirmação, aviso sobre algo que a pessoa já pediu. Marketing = oferta, convite, novidade. Marketing custa mais e pesa na qualidade do número.</p><Erro m={erros.categoria} /></div>
        <div className="space-y-[6px]"><Label htmlFor="tpl-cab">Cabeçalho (opcional)</Label><Input id="tpl-cab" maxLength={60} value={cabecalho} onChange={ev => setCabecalho(ev.target.value)} /><Erro m={erros.cabecalho} /></div>
        <div className="space-y-[6px]"><div className="flex items-center justify-between"><Label htmlFor="tpl-corpo">Corpo</Label><Button type="button" size="sm" variant="outline" onClick={inserirVariavel}>Inserir variável</Button></div>
          <Textarea id="tpl-corpo" ref={corpoRef} rows={6} maxLength={1024} value={corpo} onChange={ev => setCorpo(ev.target.value)} />
          <div className="flex justify-between text-[12px] text-muted-foreground"><span>Use {"{{1}}"}, {"{{2}}"}… em sequência. O corpo não pode começar nem terminar com uma variável.</span><span>{corpo.length}/1024</span></div><Erro m={erros.corpo} /></div>
        {vars.length > 0 && <div className="space-y-[8px]"><h3 className="text-[13px] font-semibold">Exemplos</h3>{vars.map(v => <div key={v} className="space-y-[4px]"><Label htmlFor={`tpl-ex-${v}`}>Exemplo para {`{{${v}}}`}</Label><Input id={`tpl-ex-${v}`} value={exemplos[v] ?? ""} placeholder={v === 1 ? "Maria" : ""} onChange={ev => setExemplos(x => ({ ...x, [v]: ev.target.value }))} /><Erro m={erros[`exemplo_${v}`]} /></div>)}<Erro m={erros.exemplos} /></div>}
        <div className="space-y-[6px]"><Label htmlFor="tpl-rod">Rodapé (opcional)</Label><Input id="tpl-rod" maxLength={60} value={rodape} onChange={ev => setRodape(ev.target.value)} /><Erro m={erros.rodape} /></div>
        <div className="space-y-[8px]"><Label>Botões (opcional, até 3)</Label><Select value={grupo} onValueChange={v => trocarGrupo(v as Grupo)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="nenhum">Nenhum</SelectItem><SelectItem value="rapidas">Respostas rápidas</SelectItem><SelectItem value="acao">Link / telefone</SelectItem></SelectContent></Select>
          {botoes.map((b, i) => <div key={i} className="space-y-[6px] rounded-md border p-[12px]">
            <div className="flex items-center gap-[8px]">
              {grupo === "acao" && <Select value={b.tipo} onValueChange={v => setBotao(i, { tipo: v as BotaoForm["tipo"] })}><SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="URL">Link</SelectItem><SelectItem value="PHONE_NUMBER">Telefone</SelectItem></SelectContent></Select>}
              <Input aria-label="Texto do botão" placeholder="Texto do botão" maxLength={25} value={b.texto} onChange={ev => setBotao(i, { texto: ev.target.value })} />
              <Button type="button" size="sm" variant="ghost" onClick={() => setBotoes(bs => bs.filter((_, j) => j !== i))}>Remover</Button>
            </div><Erro m={erros[`botao_${i}_texto`]} />
            {b.tipo === "URL" && <><Input aria-label="URL do botão" placeholder="https://..." value={b.url} onChange={ev => setBotao(i, { url: ev.target.value })} /><Erro m={erros[`botao_${i}_url`]} />
              {b.url.endsWith("{{1}}") && <><Input aria-label="Exemplo da URL completa" placeholder="Exemplo da URL completa" value={b.exemplo} onChange={ev => setBotao(i, { exemplo: ev.target.value })} /><Erro m={erros[`botao_${i}_exemplo`]} /></>}</>}
            {b.tipo === "PHONE_NUMBER" && <><Input aria-label="Telefone do botão" placeholder="+5511999999999" value={b.telefone} onChange={ev => setBotao(i, { telefone: ev.target.value })} /><Erro m={erros[`botao_${i}_telefone`]} /></>}
          </div>)}
          {grupo !== "nenhum" && botoes.length < 3 && <Button type="button" size="sm" variant="outline" onClick={() => setBotoes(bs => [...bs, novoBotao(grupo === "rapidas" ? "QUICK_REPLY" : "URL")])}><Plus className="mr-[6px] h-[14px] w-[14px]" />Adicionar botão</Button>}
          <Erro m={erros.botoes} /></div>
        <div className="space-y-[6px]"><h3 className="text-[13px] font-semibold">Prévia</h3>
          <div className="max-w-[360px] rounded-lg bg-success/10 p-[12px] text-[13px] shadow-sm">
            {cabecalho.trim() && <p className="mb-[4px] font-semibold">{cabecalho}</p>}
            <p className="whitespace-pre-wrap">{previa || "Corpo da mensagem"}</p>
            {rodape.trim() && <p className="mt-[6px] text-[11px] text-muted-foreground">{rodape}</p>}
          </div>
          {botoes.length > 0 && <div className="max-w-[360px] space-y-[4px]">{botoes.map((b, i) => <div key={i} className="rounded-lg bg-card py-[6px] text-center text-[13px] text-primary shadow-sm">{b.texto || "Botão"}</div>)}</div>}
        </div>
        <div className="flex justify-end gap-[8px]"><Button variant="outline" disabled={busy} onClick={() => setAberto(false)}>Cancelar</Button><Button disabled={busy} onClick={enviar}>{busy && <Loader2 className="mr-[6px] h-[14px] w-[14px] animate-spin" />}Enviar para análise</Button></div>
      </div>
    </SheetContent></Sheet>
  </Card>;
}
