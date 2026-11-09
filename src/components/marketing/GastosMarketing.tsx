import { useRef, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";

const CATEGORIAS = [
  { value: "disparo", label: "Disparo (WhatsApp)" },
  { value: "meta_ads", label: "Meta Ads" },
  { value: "equipamento", label: "Equipamentos" },
  { value: "ferramenta", label: "Ferramentas online" },
  { value: "sistema", label: "Sistemas e assinaturas" },
  { value: "outro", label: "Outros" },
] as const;
const FORMAS = [
  { value: "pix", label: "Pix" },
  { value: "cartao_credito", label: "Cartão de crédito" },
  { value: "cartao_debito", label: "Cartão de débito" },
  { value: "boleto", label: "Boleto" },
  { value: "transferencia", label: "Transferência" },
  { value: "outro", label: "Outra" },
] as const;
const EXTENSOES: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX_BYTES = 10 * 1024 * 1024;
const DATA_MINIMA = "2025-12-01"; // mesmo início da barra de período da página
const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
type Gasto = Database["public"]["Tables"]["mkt_gastos"]["Row"];
type Formulario = { data: string; valor: string; categoria: string; fornecedor: string; descricao: string; forma: string };
function hojeBrasilia() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const part = (type: string) => parts.find(p => p.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}
function dataFormatada(data: string) { return `${data.slice(8, 10)}/${data.slice(5, 7)}/${data.slice(0, 4)}`; }
function valorBrasileiro(texto: string): number | null {
  const valor = texto.trim();
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(valor)) return null;
  const numero = Number(valor.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(numero) && numero > 0 ? numero : null;
}
function erroArquivo(file: File | null) {
  if (!file) return "Selecione um comprovante.";
  if (!Object.prototype.hasOwnProperty.call(EXTENSOES, file.type)) return "Use um arquivo PDF, JPG, PNG ou WebP.";
  if (file.size > MAX_BYTES) return "O comprovante deve ter até 10 MB.";
  return "";
}
function novoFormulario(): Formulario { return { data: hojeBrasilia(), valor: "", categoria: "", fornecedor: "", descricao: "", forma: "" }; }
function mensagemErro(error: unknown) { return error && typeof error === "object" && "message" in error ? String(error.message) : String(error); }
const classeControle = "h-[36px] px-[10px] text-[12px]";

export function GastosMarketing({ from, to }: { from: string; to: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const hoje = hojeBrasilia();
  const [categoria, setCategoria] = useState("todas");
  const [mostrarExcluidos, setMostrarExcluidos] = useState(false);
  const [formAberto, setFormAberto] = useState(false);
  const [editando, setEditando] = useState<Gasto | null>(null);
  const [form, setForm] = useState<Formulario>(novoFormulario);
  const [file, setFile] = useState<File | null>(null);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const salvando = useRef(false);
  const [excluindo, setExcluindo] = useState<Gasto | null>(null);
  const [motivo, setMotivo] = useState("");
  const [exclusaoPendente, setExclusaoPendente] = useState(false);
  const exclusaoEmCurso = useRef(false);
  const [comprovante, setComprovante] = useState<{ gasto: Gasto; url: string } | null>(null);
  const [arquivoPendente, setArquivoPendente] = useState<string | null>(null);

  const pode = useQuery({ queryKey: ["mkt-gastos", "pode", user?.id], enabled: !!user?.id, staleTime: Infinity, queryFn: async () => {
    if (!user) return false;
    const { data, error } = await supabase.rpc("mkt_gastos_pode", { p_user: user.id });
    if (error) throw error;
    return data === true;
  } });
  const acesso = pode.data === true && !!user;
  const lider = useQuery({ queryKey: ["mkt-gastos", "lider", user?.id], enabled: acesso, staleTime: Infinity, queryFn: async () => {
    if (!user) return false;
    const { data, error } = await supabase.rpc("mkt_gastos_lider", { p_user: user.id });
    if (error) throw error;
    return data === true;
  } });
  const gastos = useQuery({ queryKey: ["mkt-gastos", "periodo", user?.id, from, to, mostrarExcluidos], enabled: acesso, queryFn: async () => {
    const rows: Gasto[] = [];
    for (let offset = 0; ; offset += 1000) {
      let query = supabase.from("mkt_gastos").select("*").gte("data_pagamento", from).lte("data_pagamento", to).order("data_pagamento", { ascending: false }).order("lancado_em", { ascending: false });
      if (!mostrarExcluidos) query = query.is("excluido_em", null);
      const { data, error } = await query.range(offset, offset + 999);
      if (error) throw error;
      rows.push(...(data ?? []));
      if (!data || data.length < 1000) return rows;
    }
  } });
  const meta = useQuery({ queryKey: ["mkt-gastos", "meta", user?.id, from, to], enabled: acesso, queryFn: async () => {
    const { data, error } = await supabase.rpc("mkt_gastos_meta_periodo", { p_from: from, p_to: to });
    if (error) throw error;
    return (data ?? []).map(row => ({ ...row, gasto: Number(row.gasto), gasto_com_imposto: Number(row.gasto_com_imposto) }));
  } });
  const fornecedores = useQuery({ queryKey: ["mkt-gastos", "fornecedores", user?.id], enabled: acesso, queryFn: async () => {
    const { data, error } = await supabase.from("mkt_gastos").select("fornecedor").is("excluido_em", null).order("lancado_em", { ascending: false }).limit(300);
    if (error) throw error;
    return [...new Set((data ?? []).map(row => row.fornecedor))];
  } });
  const rows = gastos.data ?? [];
  const ativos = rows.filter(row => !row.excluido_em);
  const metaPronta = !meta.isLoading && !meta.error;
  const metaRows = meta.data ?? [];
  const metaApi = metaRows.reduce((sum, row) => sum + row.gasto_com_imposto, 0);
  const metaBruto = metaRows.reduce((sum, row) => sum + row.gasto, 0);
  const metaParte = (bu: string, tipo?: string) => metaRows.filter(row => row.bu === bu && (!tipo || row.tipo === tipo)).reduce((sum, row) => sum + row.gasto_com_imposto, 0);
  const metaIncorporador = metaParte("incorporador", "conversao");
  const metaDivulgacao = metaParte("incorporador", "awareness");
  const metaConsorcio = metaParte("consorcio");
  const metaOutras = metaApi - metaIncorporador - metaDivulgacao - metaConsorcio;
  const metaAte = metaRows.reduce<string | null>((max, row) => !row.ultimo_dia ? max : !max || row.ultimo_dia > max ? row.ultimo_dia : max, null);
  const comprovantesMeta = ativos.filter(row => row.categoria === "meta_ads");
  const somaComprovantesMeta = comprovantesMeta.reduce((sum, row) => sum + Number(row.valor), 0);
  const outrosAtivos = ativos.filter(row => row.categoria !== "meta_ads");
  const somaOutros = outrosAtivos.reduce((sum, row) => sum + Number(row.valor), 0);
  // A Meta entra pela API. O comprovante de Meta não soma, para a fatura não contar duas vezes.
  const total = somaOutros + metaApi;
  const percentual = (valor: number) => metaPronta && total ? `${(valor / total * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : "—";
  const visiveis = rows.filter(row => categoria === "todas" || row.categoria === categoria);
  const totalFiltrado = visiveis.reduce((sum, row) => sum + (row.excluido_em ? 0 : Number(row.valor)), 0);
  const periodoTexto = from === to ? dataFormatada(from) : `${dataFormatada(from)} a ${dataFormatada(to)}`;

  function abrirFormulario(gasto?: Gasto) {
    setEditando(gasto ?? null);
    setForm(gasto ? { data: gasto.data_pagamento, valor: Number(gasto.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }), categoria: gasto.categoria, fornecedor: gasto.fornecedor, descricao: gasto.descricao ?? "", forma: gasto.forma_pagamento } : novoFormulario());
    setFile(null); setErros({}); setFormAberto(true);
  }
  function campo(key: keyof Formulario, value: string) { setForm(current => ({ ...current, [key]: value })); setErros(current => ({ ...current, [key]: "" })); }
  async function salvar(event: FormEvent) {
    event.preventDefault();
    if (!user || !acesso || salvando.current) return;
    const valor = valorBrasileiro(form.valor);
    const falhas: Record<string, string> = {};
    if (!form.data || form.data < DATA_MINIMA || form.data > hoje) falhas.data = "Escolha uma data entre 01/12/2025 e hoje.";
    if (valor === null) falhas.valor = "Informe um valor positivo, no formato 1.234,56, com até 2 casas decimais.";
    if (!CATEGORIAS.some(c => c.value === form.categoria)) falhas.categoria = "Selecione uma categoria.";
    if (!form.fornecedor.trim() || form.fornecedor.trim().length > 120) falhas.fornecedor = "Informe o fornecedor (até 120 caracteres).";
    if (form.descricao.length > 1000) falhas.descricao = "A descrição deve ter até 1.000 caracteres.";
    if (!FORMAS.some(f => f.value === form.forma)) falhas.forma = "Selecione a forma de pagamento.";
    if (!editando) { const erro = erroArquivo(file); if (erro) falhas.file = erro; }
    setErros(falhas);
    if (Object.keys(falhas).length || valor === null) return;
    salvando.current = true; setEnviando(true);
    try {
      const args = { p_data: form.data, p_valor: valor, p_categoria: form.categoria, p_fornecedor: form.fornecedor.trim(), p_descricao: form.descricao || null, p_forma_pagamento: form.forma };
      if (editando) {
        const { error } = await supabase.rpc("mkt_gasto_editar", { ...args, p_id: editando.id });
        if (error) throw error;
      } else {
        if (!file) return;
        const ext = EXTENSOES[file.type];
        const path = `${user.id}/${form.data.slice(0, 7)}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from("mkt-comprovantes").upload(path, file, { contentType: file.type, upsert: false });
        if (uploadError) throw uploadError;
        try {
          const { error } = await supabase.rpc("mkt_gasto_lancar", { ...args, p_comprovante_path: path, p_comprovante_nome: file.name });
          if (error) throw error;
        } catch (error) {
          try { await supabase.storage.from("mkt-comprovantes").remove([path]); } catch { /* Limpeza não deve ocultar o erro original. */ }
          throw error;
        }
      }
      toast.success(editando ? "Gasto atualizado" : "Gasto lançado");
      if (form.data < from || form.data > to) toast.info(`Pagamento de ${dataFormatada(form.data)} fica fora do período selecionado. Mude o período no topo da página para ver.`);
      setFormAberto(false); setEditando(null); setForm(novoFormulario()); setFile(null); setErros({});
      void qc.invalidateQueries({ queryKey: ["mkt-gastos"] });
    } catch (error) { toast.error(mensagemErro(error)); }
    finally { salvando.current = false; setEnviando(false); }
  }
  async function excluir() {
    if (!excluindo || !motivo.trim() || exclusaoEmCurso.current) return;
    exclusaoEmCurso.current = true; setExclusaoPendente(true);
    try {
      const { error } = await supabase.rpc("mkt_gasto_excluir", { p_id: excluindo.id, p_motivo: motivo.trim() });
      if (error) throw error;
      toast.success("Gasto excluído"); setExcluindo(null); setMotivo("");
      void qc.invalidateQueries({ queryKey: ["mkt-gastos"] });
    } catch (error) { toast.error(mensagemErro(error)); }
    finally { exclusaoEmCurso.current = false; setExclusaoPendente(false); }
  }
  async function abrirArquivo(gasto: Gasto, baixar = false) {
    setArquivoPendente(gasto.id);
    try {
      const { data, error } = baixar
        ? await supabase.storage.from("mkt-comprovantes").createSignedUrl(gasto.comprovante_path, 300, { download: gasto.comprovante_nome })
        : await supabase.storage.from("mkt-comprovantes").createSignedUrl(gasto.comprovante_path, 300);
      if (error) throw error;
      if (!data?.signedUrl) throw new Error("Não foi possível abrir o comprovante.");
      if (baixar) window.location.assign(data.signedUrl);
      else setComprovante({ gasto, url: data.signedUrl });
    } catch (error) { toast.error(mensagemErro(error)); }
    finally { setArquivoPendente(null); }
  }
  const erroCampo = (key: string) => erros[key] ? <p role="alert" className="text-[12px] text-destructive">{erros[key]}</p> : null;

  if (pode.data === false || !user) return <p className="text-[13px] text-muted-foreground">Sem acesso aos gastos de marketing</p>;
  if (pode.error) return <div className="space-y-[8px] text-[13px]"><p className="text-destructive">{mensagemErro(pode.error)}</p><Button variant="outline" onClick={() => pode.refetch()}>Tentar de novo</Button></div>;
  if (!acesso) return <Skeleton aria-label="Conferindo acesso" className="h-[100px] w-full" />;

  return <TooltipProvider delayDuration={150}><div className="min-w-0 space-y-[20px]">
    <header className="space-y-[12px]">
      <div className="flex flex-wrap items-start justify-between gap-[12px]">
        <div className="min-w-0 space-y-[6px]"><h2 className="text-[20px] font-semibold tracking-normal">Gastos de marketing</h2><p className="text-[13px] text-muted-foreground">Comprovantes do que foi pago em disparo, Meta Ads, equipamentos, ferramentas e sistemas</p></div>
        <Button onClick={() => abrirFormulario()} className="h-[36px] gap-[6px] px-[12px] text-[12px]"><Plus className="h-[14px] w-[14px]" />Lançar gasto</Button>
      </div>
      <p className="text-[11px] text-muted-foreground">Período: {periodoTexto}, escolhido no topo da página. Meta Ads mostra o gasto da API da Meta com imposto estimado: é o mesmo investimento do Funil, mais as outras contas (consórcio). A Meta conta pela data em que o anúncio rodou; os comprovantes, pela data do pagamento. Por isso o total não bate dia a dia com o extrato nem com a fatura da Meta. O comprovante de Meta fica guardado, mas não entra no total, para a fatura não contar duas vezes.</p>
    </header>
    <div className="flex flex-wrap items-end gap-[16px]">
      <div className="space-y-[6px]"><Label htmlFor="gastos-categoria" className="text-[12px]">Categoria</Label><Select value={categoria} onValueChange={setCategoria}><SelectTrigger id="gastos-categoria" className={`${classeControle} w-[210px]`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todas" className="text-[12px]">Todas</SelectItem>{CATEGORIAS.map(c => <SelectItem key={c.value} value={c.value} className="text-[12px]">{c.label}</SelectItem>)}</SelectContent></Select></div>
      <div className="flex h-[36px] items-center gap-[8px]"><Switch id="gastos-excluidos" checked={mostrarExcluidos} onCheckedChange={setMostrarExcluidos} /><Label htmlFor="gastos-excluidos" className="text-[12px]">Mostrar excluídos</Label></div>
    </div>
    {gastos.error ? <div className="space-y-[8px] text-[13px]"><p className="text-destructive">{mensagemErro(gastos.error)}</p><Button variant="outline" onClick={() => gastos.refetch()}>Tentar de novo</Button></div> : gastos.isLoading ? <Skeleton aria-label="Carregando gastos" className="h-[200px] w-full" /> : <>
      <div className="grid grid-cols-2 gap-[12px] lg:grid-cols-4">
        <Card className="min-w-0"><CardContent className="space-y-[6px] p-[14px]"><p className="text-[12px] text-muted-foreground">Total do período</p>{meta.isLoading ? <Skeleton className="h-[24px] w-[120px]" /> : <p className="break-words text-[20px] font-semibold tabular-nums">{moeda.format(meta.error ? somaOutros : total)}</p>}{meta.error ? <p className="text-[11px] text-muted-foreground">Sem a Meta: erro ao carregar</p> : <><p className="text-[11px] text-muted-foreground">{`Meta (API) + ${outrosAtivos.length} comprovantes`}</p><p className="text-[11px] text-muted-foreground">Meta por veiculação · comprovantes por pagamento</p></>}</CardContent></Card>
        {CATEGORIAS.map(c => {
          const itens = ativos.filter(row => row.categoria === c.value);
          const soma = itens.reduce((sum, row) => sum + Number(row.valor), 0);
          return <Card key={c.value} className={`min-w-0 ${categoria === c.value ? "border-primary" : ""}`}><CardContent className="p-0"><Button variant="ghost" aria-pressed={categoria === c.value} onClick={() => setCategoria(current => current === c.value ? "todas" : c.value)} className="h-full min-h-[110px] w-full flex-col items-start justify-start gap-[6px] whitespace-normal rounded-[6px] p-[14px] text-left">{c.value === "meta_ads" ? <>
            <span className="text-[12px] text-muted-foreground">Meta Ads (API, imposto estimado)</span>
            {meta.isLoading ? <Skeleton className="h-[24px] w-[120px]" /> : <span className="break-words text-[20px] font-semibold tabular-nums">{meta.error ? "—" : moeda.format(metaApi)}</span>}
            {meta.error ? <span className="text-[11px] text-destructive">{mensagemErro(meta.error)}</span> : !meta.isLoading && <>
              <span className="text-[11px] text-muted-foreground">{[metaIncorporador ? `Incorporador ${moeda.format(metaIncorporador)}` : null, metaDivulgacao ? `Divulgação ${moeda.format(metaDivulgacao)}` : null, metaConsorcio ? `Consórcio ${moeda.format(metaConsorcio)}` : null, Math.abs(metaOutras) >= 0.01 ? `Outras contas ${moeda.format(metaOutras)}` : null].filter(Boolean).join(" · ") || "Sem gasto na Meta no período"}</span>
              <span className="text-[11px] text-muted-foreground">{`${percentual(metaApi)} do total`}{metaBruto > 0 ? ` · imposto estimado +${((metaApi / metaBruto - 1) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : ""}{metaAte ? ` · dados até ${dataFormatada(metaAte)}` : ""}</span>
              {comprovantesMeta.length > 0 && <span className="text-[11px] text-muted-foreground">{`${comprovantesMeta.length} comprovantes: ${moeda.format(somaComprovantesMeta)} (fora do total)`}</span>}
            </>}
          </> : <><span className="text-[12px] text-muted-foreground">{c.label}</span><span className="break-words text-[20px] font-semibold tabular-nums">{moeda.format(soma)}</span><span className="text-[11px] text-muted-foreground">{itens.length} lançamentos · {percentual(soma)}</span></>}</Button></CardContent></Card>;
        })}
      </div>
      <div className="overflow-x-auto rounded-[6px] border border-border">
        <Table className="min-w-[1150px] text-[12px]"><TableHeader><TableRow>{["Data", "Categoria", "Fornecedor", "Descrição", "Forma de pagamento", "Valor", "Lançado por", "Comprovante", "Ações"].map(label => <TableHead key={label} className={`whitespace-nowrap text-[12px] ${label === "Valor" ? "text-right" : ""}`}>{label}</TableHead>)}</TableRow></TableHeader>
          <TableBody>{!visiveis.length ? <TableRow><TableCell colSpan={9} className="py-[32px] text-center text-[13px] text-muted-foreground">Nenhum comprovante lançado no período ({periodoTexto}). Clique em Lançar gasto.</TableCell></TableRow> : visiveis.map(row => <TableRow key={row.id} className={row.excluido_em ? "opacity-60 [&>td:not(:nth-last-child(-n+2))]:line-through" : ""}>
            <TableCell className="whitespace-nowrap">{dataFormatada(row.data_pagamento)}</TableCell>
            <TableCell><div className="flex flex-wrap gap-[4px]"><Badge variant="secondary" className="whitespace-nowrap text-[11px]">{CATEGORIAS.find(c => c.value === row.categoria)?.label ?? row.categoria}</Badge>{row.excluido_em && <Tooltip><TooltipTrigger asChild><span tabIndex={0}><Badge variant="outline" className="text-[11px]">Excluído</Badge></span></TooltipTrigger><TooltipContent className="max-w-[300px] text-[12px]">Motivo: {row.motivo_exclusao}</TooltipContent></Tooltip>}</div></TableCell>
            <TableCell className="max-w-[200px] break-words">{row.fornecedor}</TableCell><TableCell><div className="max-w-[220px] truncate" title={row.descricao ?? ""}>{row.descricao || "—"}</div></TableCell>
            <TableCell>{FORMAS.find(f => f.value === row.forma_pagamento)?.label ?? row.forma_pagamento}</TableCell><TableCell className="whitespace-nowrap text-right tabular-nums">{moeda.format(Number(row.valor))}</TableCell><TableCell>{row.lancado_por_nome || "—"}</TableCell>
            <TableCell><div className="flex gap-[4px]"><Button variant="outline" className="h-[30px] px-[8px] text-[12px]" disabled={arquivoPendente === row.id} onClick={() => abrirArquivo(row)}>Ver</Button><Button variant="ghost" className="h-[30px] px-[8px] text-[12px]" disabled={arquivoPendente === row.id} onClick={() => abrirArquivo(row, true)}>Baixar</Button></div></TableCell>
            <TableCell>{!row.excluido_em && (row.lancado_por === user.id || lider.data === true) && <div className="flex gap-[4px]"><Button variant="ghost" className="h-[30px] px-[8px] text-[12px]" onClick={() => abrirFormulario(row)}>Editar</Button><Button variant="ghost" className="h-[30px] px-[8px] text-[12px] text-destructive" onClick={() => { setExcluindo(row); setMotivo(""); }}>Excluir</Button></div>}</TableCell>
          </TableRow>)}</TableBody>
          <TableFooter><TableRow><TableCell colSpan={5}>Total dos comprovantes filtrados</TableCell><TableCell className="whitespace-nowrap text-right tabular-nums">{moeda.format(totalFiltrado)}</TableCell><TableCell colSpan={3} /></TableRow></TableFooter>
        </Table>
      </div>
    </>}
    <Dialog open={formAberto} onOpenChange={open => { if (!salvando.current) setFormAberto(open); }}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]" onEscapeKeyDown={e => { if (enviando) e.preventDefault(); }} onPointerDownOutside={e => { if (enviando) e.preventDefault(); }}><DialogHeader><DialogTitle className="text-[18px]">{editando ? "Editar gasto" : "Lançar gasto"}</DialogTitle></DialogHeader>
      <form onSubmit={salvar} noValidate className="space-y-[14px]"><fieldset disabled={enviando} className="grid grid-cols-1 gap-[14px] sm:grid-cols-2">
        <div className="space-y-[6px]"><Label htmlFor="gasto-data" className="text-[12px]">Data do pagamento</Label><Input id="gasto-data" type="date" required min={DATA_MINIMA} max={hoje} value={form.data} onChange={e => campo("data", e.target.value)} className={classeControle} />{erroCampo("data")}</div>
        <div className="space-y-[6px]"><Label htmlFor="gasto-valor" className="text-[12px]">Valor (R$)</Label><Input id="gasto-valor" inputMode="decimal" required placeholder="1.234,56" value={form.valor} onChange={e => campo("valor", e.target.value)} className={classeControle} />{erroCampo("valor")}</div>
        <div className="space-y-[6px]"><Label htmlFor="gasto-categoria" className="text-[12px]">Categoria</Label><Select disabled={enviando} value={form.categoria} onValueChange={v => campo("categoria", v)}><SelectTrigger id="gasto-categoria" className={classeControle}><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{CATEGORIAS.map(c => <SelectItem key={c.value} value={c.value} className="text-[12px]">{c.label}</SelectItem>)}</SelectContent></Select>{erroCampo("categoria")}</div>
        <div className="space-y-[6px]"><Label htmlFor="gasto-forma" className="text-[12px]">Forma de pagamento</Label><Select disabled={enviando} value={form.forma} onValueChange={v => campo("forma", v)}><SelectTrigger id="gasto-forma" className={classeControle}><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{FORMAS.map(f => <SelectItem key={f.value} value={f.value} className="text-[12px]">{f.label}</SelectItem>)}</SelectContent></Select>{erroCampo("forma")}</div>
        <div className="space-y-[6px] sm:col-span-2"><Label htmlFor="gasto-fornecedor" className="text-[12px]">Fornecedor</Label><Input id="gasto-fornecedor" required maxLength={120} list="gasto-fornecedores" value={form.fornecedor} onChange={e => campo("fornecedor", e.target.value)} className={classeControle} /><datalist id="gasto-fornecedores">{fornecedores.data?.map(nome => <option key={nome} value={nome} />)}</datalist>{erroCampo("fornecedor")}</div>
        <div className="space-y-[6px] sm:col-span-2"><Label htmlFor="gasto-descricao" className="text-[12px]">Descrição (opcional)</Label><Textarea id="gasto-descricao" maxLength={1000} value={form.descricao} onChange={e => campo("descricao", e.target.value)} className="text-[12px]" />{erroCampo("descricao")}</div>
        {!editando && <div className="space-y-[6px] sm:col-span-2"><Label htmlFor="gasto-file" className="text-[12px]">Comprovante</Label><Input id="gasto-file" type="file" required accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" className="text-[12px]" onChange={e => { const escolhido = e.target.files?.[0] ?? null; setFile(escolhido); setErros(current => ({ ...current, file: erroArquivo(escolhido) })); }} /><p className="text-[11px] text-muted-foreground">PDF, JPG, PNG ou WebP · até 10 MB</p>{erroCampo("file")}</div>}
      </fieldset>
        {editando && <p className="text-[12px] text-muted-foreground">Para trocar o comprovante, exclua este gasto e lance de novo.</p>}
        <div className="flex justify-end gap-[8px]"><Button type="button" variant="outline" disabled={enviando} onClick={() => setFormAberto(false)} className={classeControle}>Cancelar</Button><Button type="submit" disabled={enviando} className={classeControle}>{enviando ? "Enviando…" : "Salvar"}</Button></div>
      </form>
    </DialogContent></Dialog>
    <Dialog open={!!comprovante} onOpenChange={open => { if (!open) setComprovante(null); }}><DialogContent className="max-h-[95vh] max-w-[calc(100vw-24px)] sm:max-w-[1100px]"><DialogHeader><DialogTitle className="break-all pr-[20px] text-[16px]">{comprovante?.gasto.comprovante_nome}</DialogTitle></DialogHeader>{comprovante && <><a href={comprovante.url} target="_blank" rel="noopener noreferrer" className="text-[12px] text-primary underline">Abrir em nova aba</a>{comprovante.gasto.comprovante_mime === "application/pdf" ? <iframe src={comprovante.url} title={comprovante.gasto.comprovante_nome} className="h-[75vh] w-full" /> : <img src={comprovante.url} alt={comprovante.gasto.comprovante_nome} className="h-[75vh] w-full object-contain" />}</>}</DialogContent></Dialog>
    <AlertDialog open={!!excluindo} onOpenChange={open => { if (!exclusaoEmCurso.current && !open) setExcluindo(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle className="text-[18px]">Excluir este gasto?</AlertDialogTitle><AlertDialogDescription className="space-y-[8px] text-[13px]">{excluindo && <span className="block">{dataFormatada(excluindo.data_pagamento)} · {excluindo.fornecedor} · {moeda.format(Number(excluindo.valor))}</span>}<span className="block">O comprovante continua guardado e aparece em Mostrar excluídos.</span></AlertDialogDescription></AlertDialogHeader><div className="space-y-[6px]"><Label htmlFor="gasto-motivo" className="text-[12px]">Motivo</Label><Textarea id="gasto-motivo" required disabled={exclusaoPendente} value={motivo} onChange={e => setMotivo(e.target.value)} className="text-[12px]" /></div><AlertDialogFooter><AlertDialogCancel disabled={exclusaoPendente} className={classeControle}>Cancelar</AlertDialogCancel><Button variant="destructive" disabled={!motivo.trim() || exclusaoPendente} onClick={excluir} className={classeControle}>{exclusaoPendente ? "Excluindo…" : "Excluir"}</Button></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div></TooltipProvider>;
}