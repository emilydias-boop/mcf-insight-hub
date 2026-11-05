import { useId, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowDown, ArrowUp, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

export type EmailBloco =
  | { tipo: "texto"; texto: string }
  | { tipo: "imagem"; url: string; alt: string; link?: string; largura?: 100 | 75 | 50 }
  | { tipo: "botao"; texto: string; cor?: string }
  | { tipo: "destaque"; texto: string; cor_fundo?: string }
  | { tipo: "divisor" }
  | { tipo: "assinatura"; nome: string; cargo?: string; foto_url?: string };
export type EmailTema = { cor_principal: string; cor_fundo: string; logo_url: string | null };
type Modelo = { id: string; nome: string; descricao: string | null; blocos: EmailBloco[]; tema: EmailTema };
export const temaPadrao = (): EmailTema => ({ cor_principal: "#111111", cor_fundo: "#ffffff", logo_url: null });
export const blocosPadrao = (corpo = "", botao = "") : EmailBloco[] => [{ tipo: "texto", texto: corpo }, { tipo: "botao", texto: botao || "Quero fazer a conta com o time" }];
export const imagensNoEmail = (blocos: EmailBloco[], tema: EmailTema) => Number(!!tema.logo_url) + blocos.reduce((n, b) => n + Number(b.tipo === "imagem" && !!b.url || b.tipo === "assinatura" && !!b.foto_url), 0);
const corValida = (cor: string) => /^#[0-9a-f]{6}$/i.test(cor);
const httpsValido = (url: string) => { try { return new URL(url).protocol === "https:" && url.startsWith("https://"); } catch { return false; } };
function imagemDoBucket(url: string) {
  const base = supabase.storage.from("email-imagens").getPublicUrl("").data.publicUrl;
  return httpsValido(url) && url.startsWith(base.endsWith("/") ? base : `${base}/`);
}
export function validarEmailBlocos(blocos: EmailBloco[], tema: EmailTema) {
  if (blocos.length > 30) throw new Error("O e-mail pode ter no máximo 30 blocos.");
  if (!blocos.some(b => b.tipo === "texto" && b.texto.trim())) throw new Error("Inclua pelo menos um bloco de texto com conteúdo.");
  if (!blocos.some(b => b.tipo === "botao")) throw new Error("Inclua pelo menos um botão.");
  if (imagensNoEmail(blocos, tema) > 3) throw new Error("Use no máximo 3 imagens, contando logo e fotos de assinatura.");
  if (!corValida(tema.cor_principal) || !corValida(tema.cor_fundo)) throw new Error("Informe as cores no formato #RRGGBB.");
  if (tema.logo_url && !imagemDoBucket(tema.logo_url)) throw new Error("Envie o logo pelo botão de upload.");
  for (const b of blocos) {
    if (b.tipo === "imagem") {
      if (!b.alt.trim()) throw new Error("Toda imagem precisa de texto alternativo.");
      if (!imagemDoBucket(b.url)) throw new Error("Envie a imagem pelo botão de upload.");
      if (b.link && !httpsValido(b.link)) throw new Error("Links devem começar com https://.");
      if (b.largura !== undefined && ![100, 75, 50].includes(b.largura)) throw new Error("A largura da imagem deve ser 100%, 75% ou 50%.");
    }
    if (b.tipo === "botao" && (!b.texto.trim() || b.cor !== undefined && !corValida(b.cor))) throw new Error("Preencha o texto do botão e use uma cor no formato #RRGGBB.");
    if (b.tipo === "destaque" && b.cor_fundo !== undefined && !corValida(b.cor_fundo)) throw new Error("Informe a cor do destaque no formato #RRGGBB.");
    if (b.tipo === "assinatura" && b.foto_url && !imagemDoBucket(b.foto_url)) throw new Error("Envie a foto da assinatura pelo botão de upload.");
    if (b.tipo === "texto" || b.tipo === "destaque") {
      for (const match of b.texto.matchAll(/\[[^\]]*\]\(([^)]*)\)/g)) if (!httpsValido(match[1])) throw new Error("Links devem começar com https://.");
    }
  }
}
const nomes: Record<EmailBloco["tipo"], string> = { texto: "Texto", imagem: "Imagem", botao: "Botão", destaque: "Destaque", divisor: "Divisor", assinatura: "Assinatura" };
function novoBloco(tipo: EmailBloco["tipo"]): EmailBloco {
  switch (tipo) {
    case "texto": return { tipo, texto: "" };
    case "imagem": return { tipo, url: "", alt: "", largura: 100 };
    case "botao": return { tipo, texto: "Quero fazer a conta com o time" };
    case "destaque": return { tipo, texto: "", cor_fundo: "#f3f4f6" };
    case "divisor": return { tipo };
    case "assinatura": return { tipo, nome: "", cargo: "" };
  }
}
function ArquivoImagem({ url, label, disabled, onUpload, onRemove }: { url?: string | null; label: string; disabled: boolean; onUpload: (file: File) => void; onRemove: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  return <div className="space-y-[8px]">
    {url && <img src={url} alt={label} className="max-h-[120px] max-w-full object-contain" />}
    <input ref={input} type="file" className="hidden" aria-label={label} accept="image/png,image/jpeg,image/gif" disabled={disabled} onChange={e => { const file = e.target.files?.[0]; e.target.value = ""; if (file) onUpload(file); }} />
    <div className="flex flex-wrap gap-[8px]"><Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => input.current?.click()}><Upload className="mr-[6px] h-[14px] w-[14px]" />{label}</Button>{url && <Button type="button" variant="ghost" size="icon" aria-label={`Remover ${label.toLowerCase()}`} title="Remover imagem" disabled={disabled} onClick={onRemove}><Trash2 className="h-[14px] w-[14px]" /></Button>}</div>
  </div>;
}

export function EmailBlocosEditor({ blocos, tema, disabled, editavel, onChange, onBusyChange }: {
  blocos: EmailBloco[]; tema: EmailTema; disabled: boolean; editavel: boolean;
  onChange: (blocos: EmailBloco[], tema: EmailTema) => void; onBusyChange: (busy: boolean) => void;
}) {
  const id = useId();
  const qc = useQueryClient();
  const [ocupado, setOcupado] = useState(false);
  const trava = useRef(false);
  const [modelo, setModelo] = useState<Modelo | null>(null);
  const [salvarModelo, setSalvarModelo] = useState(false);
  const [nome, setNome] = useState("");
  const bloqueado = disabled || ocupado;
  const quantidade = imagensNoEmail(blocos, tema);
  const modelos = useQuery({ queryKey: ["email-modelos"], enabled: editavel, staleTime: 60_000, queryFn: async () => {
    const rows: Modelo[] = [];
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await (supabase as any).from("email_modelos").select("id,nome,descricao,blocos,tema").order("nome").range(offset, offset + 999);
      if (error) throw error;
      rows.push(...(data ?? []));
      if ((data ?? []).length < 1000) return rows;
    }
  } });
  function atualizar(index: number, bloco: EmailBloco) { onChange(blocos.map((b, i) => i === index ? bloco : b), tema); }
  function mover(index: number, delta: number) {
    const proximo = [...blocos];
    const outro = proximo[index + delta];
    const atual = proximo[index];
    if (!outro || !atual) return;
    proximo[index] = outro; proximo[index + delta] = atual; onChange(proximo, tema);
  }
  async function tarefa(fn: () => Promise<void>) {
    if (trava.current || disabled) return;
    trava.current = true; setOcupado(true); onBusyChange(true);
    try { await fn(); } catch (e) { toast.error(String((e as { message?: string })?.message ?? "Não foi possível concluir a ação.")); }
    finally { trava.current = false; setOcupado(false); onBusyChange(false); }
  }
  function upload(file: File, urlAtual: string | null | undefined, concluir: (url: string) => void) {
    if (file.size > 1024 * 1024) { toast.error("A imagem deve ter no máximo 1 MB."); return; }
    const extensoes: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif" };
    const ext = extensoes[file.type];
    if (!ext) { toast.error("Envie uma imagem PNG, JPEG ou GIF."); return; }
    if (!urlAtual && quantidade >= 3) { toast.error("Use no máximo 3 imagens, contando logo e fotos de assinatura."); return; }
    void tarefa(async () => {
      const caminho = `${crypto.randomUUID()}.${ext}`;
      const bucket = supabase.storage.from("email-imagens");
      const { error } = await bucket.upload(caminho, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      concluir(bucket.getPublicUrl(caminho).data.publicUrl);
      toast.success("Imagem enviada.");
    });
  }
  const color = (label: string, value: string, change: (v: string) => void, key: string) => <div className="space-y-[6px]"><Label htmlFor={`${id}-${key}`}>{label}</Label><Input id={`${id}-${key}`} type="color" value={value} disabled={bloqueado} onChange={e => change(e.target.value)} className="h-[36px] w-[60px] cursor-pointer p-[4px]" /></div>;
  return <div className="space-y-[12px]">
    {editavel && <div className="space-y-[8px]">
      <Label htmlFor={`${id}-modelo`}>Começar de um modelo</Label>
      <Select value="" disabled={bloqueado || modelos.isLoading} onValueChange={v => { const m = modelos.data?.find(m => m.id === v); if (m) setModelo(m); }}><SelectTrigger id={`${id}-modelo`}><SelectValue placeholder="Começar de um modelo" /></SelectTrigger><SelectContent>{(modelos.data ?? []).map(m => <SelectItem key={m.id} value={m.id}><span>{m.nome}{m.descricao ? ` — ${m.descricao}` : ""}</span></SelectItem>)}</SelectContent></Select>
      {modelos.error && <Alert variant="destructive"><AlertDescription>{String((modelos.error as Error).message)}</AlertDescription></Alert>}
      <Button type="button" variant="outline" size="sm" disabled={bloqueado} onClick={() => { setNome(""); setSalvarModelo(true); }}>Salvar como modelo</Button>
    </div>}
    <Card><CardContent className="space-y-[12px] p-[12px]">
      <h4 className="text-[13px] font-semibold">Tema</h4>
      <Label>Logo</Label><ArquivoImagem label="Enviar logo" url={tema.logo_url} disabled={bloqueado} onUpload={file => upload(file, tema.logo_url, url => onChange(blocos, { ...tema, logo_url: url }))} onRemove={() => onChange(blocos, { ...tema, logo_url: null })} />
      <div className="flex flex-wrap gap-[20px]">{color("Cor principal", tema.cor_principal, v => onChange(blocos, { ...tema, cor_principal: v }), "principal")}{color("Cor de fundo", tema.cor_fundo, v => onChange(blocos, { ...tema, cor_fundo: v }), "fundo")}</div>
    </CardContent></Card>
    <p className="text-[12px]">Imagens: {quantidade} de 3</p>
    {quantidade > 2 && <Alert className="border-warning bg-warning/10 text-warning"><AlertDescription>E-mails com muitas imagens tendem a cair em Promoções ou spam.</AlertDescription></Alert>}
    {ocupado && <p role="status" className="flex items-center gap-[6px] text-[12px]"><Loader2 className="h-[14px] w-[14px] animate-spin" />Aguarde…</p>}
    {blocos.map((b, i) => <Card key={i}><CardContent className="space-y-[10px] p-[12px]">
      <div className="flex items-center justify-between gap-[8px]"><h4 className="text-[13px] font-semibold">{nomes[b.tipo]}</h4><div className="flex gap-[4px]">
        <Button type="button" variant="ghost" size="icon" aria-label={`Mover bloco ${i + 1} para cima`} title="Mover para cima" disabled={bloqueado || i === 0} onClick={() => mover(i, -1)}><ArrowUp className="h-[14px] w-[14px]" /></Button>
        <Button type="button" variant="ghost" size="icon" aria-label={`Mover bloco ${i + 1} para baixo`} title="Mover para baixo" disabled={bloqueado || i === blocos.length - 1} onClick={() => mover(i, 1)}><ArrowDown className="h-[14px] w-[14px]" /></Button>
        <Button type="button" variant="ghost" size="icon" aria-label={`Remover bloco ${i + 1}`} title="Remover bloco" disabled={bloqueado} onClick={() => onChange(blocos.filter((_, n) => n !== i), tema)}><Trash2 className="h-[14px] w-[14px]" /></Button>
      </div></div>
      {(b.tipo === "texto" || b.tipo === "destaque") && <div className="space-y-[6px]"><Label htmlFor={`${id}-texto-${i}`}>{b.tipo === "texto" ? "Texto do bloco" : "Texto do destaque"}</Label><Textarea id={`${id}-texto-${i}`} rows={b.tipo === "texto" ? 8 : 3} disabled={bloqueado} value={b.texto} onChange={e => atualizar(i, { ...b, texto: e.target.value })} />{b.tipo === "texto" && <p className="text-[11px] text-muted-foreground">**negrito**, [texto](https://link), linha em branco = novo parágrafo</p>}{b.tipo === "destaque" && color("Cor de fundo do destaque", b.cor_fundo ?? "#f3f4f6", v => atualizar(i, { ...b, cor_fundo: v }), `destaque-${i}`)}</div>}
      {b.tipo === "imagem" && <>
        <ArquivoImagem label="Enviar imagem" url={b.url} disabled={bloqueado} onUpload={file => upload(file, b.url, url => atualizar(i, { ...b, url }))} onRemove={() => atualizar(i, { ...b, url: "" })} />
        <div className="space-y-[6px]"><Label htmlFor={`${id}-alt-${i}`}>Texto alternativo (obrigatório)</Label><Input id={`${id}-alt-${i}`} disabled={bloqueado} value={b.alt} onChange={e => atualizar(i, { ...b, alt: e.target.value })} /></div>
        <div className="space-y-[6px]"><Label htmlFor={`${id}-link-${i}`}>Link ao clicar (opcional, https://)</Label><Input id={`${id}-link-${i}`} disabled={bloqueado} value={b.link ?? ""} onChange={e => atualizar(i, { ...b, link: e.target.value })} /></div>
        <Label htmlFor={`${id}-largura-${i}`}>Largura</Label><Select value={String(b.largura ?? 100)} disabled={bloqueado} onValueChange={v => atualizar(i, { ...b, largura: Number(v) as 100 | 75 | 50 })}><SelectTrigger id={`${id}-largura-${i}`}><SelectValue /></SelectTrigger><SelectContent>{[100, 75, 50].map(v => <SelectItem key={v} value={String(v)}>{v}%</SelectItem>)}</SelectContent></Select>
      </>}
      {b.tipo === "botao" && <><Label htmlFor={`${id}-botao-${i}`}>Texto do botão</Label><Input id={`${id}-botao-${i}`} disabled={bloqueado} value={b.texto} onChange={e => atualizar(i, { ...b, texto: e.target.value })} />{color("Cor do botão", b.cor ?? tema.cor_principal, v => atualizar(i, { ...b, cor: v }), `botao-cor-${i}`)}<p className="text-[11px] text-muted-foreground">Abre o WhatsApp do SDR de cada lead.</p></>}
      {b.tipo === "assinatura" && <><Label htmlFor={`${id}-nome-${i}`}>Nome</Label><Input id={`${id}-nome-${i}`} disabled={bloqueado} value={b.nome} onChange={e => atualizar(i, { ...b, nome: e.target.value })} /><Label htmlFor={`${id}-cargo-${i}`}>Cargo</Label><Input id={`${id}-cargo-${i}`} disabled={bloqueado} value={b.cargo ?? ""} onChange={e => atualizar(i, { ...b, cargo: e.target.value })} /><ArquivoImagem label="Enviar foto da assinatura" url={b.foto_url} disabled={bloqueado} onUpload={file => upload(file, b.foto_url, url => atualizar(i, { ...b, foto_url: url }))} onRemove={() => atualizar(i, { ...b, foto_url: undefined })} /></>}
      {b.tipo === "divisor" && <hr className="border-border" />}
    </CardContent></Card>)}
    <div className="flex flex-wrap gap-[6px]">{(Object.keys(nomes) as EmailBloco["tipo"][]).map(tipo => <Button key={tipo} type="button" variant="outline" size="sm" disabled={bloqueado || blocos.length >= 30} onClick={() => onChange([...blocos, novoBloco(tipo)], tema)}>+ {nomes[tipo]}</Button>)}</div>
    <Dialog open={modelo !== null} onOpenChange={v => { if (!ocupado && !v) setModelo(null); }}><DialogContent><DialogHeader><DialogTitle>Substituir os blocos atuais?</DialogTitle><DialogDescription>Os blocos e o tema serão substituídos pelo modelo {modelo?.nome}.</DialogDescription></DialogHeader><DialogFooter><Button type="button" variant="outline" disabled={bloqueado} onClick={() => setModelo(null)}>Voltar</Button><Button type="button" disabled={bloqueado} onClick={() => { if (!modelo) return; onChange(structuredClone(modelo.blocos), structuredClone(modelo.tema)); setModelo(null); }}>Substituir</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={salvarModelo} onOpenChange={v => { if (!ocupado) setSalvarModelo(v); }}><DialogContent><DialogHeader><DialogTitle>Salvar como modelo</DialogTitle><DialogDescription>Guarde os blocos e o tema para reutilizar em outros disparos.</DialogDescription></DialogHeader><Label htmlFor={`${id}-modelo-nome`}>Nome do modelo</Label><Input id={`${id}-modelo-nome`} value={nome} disabled={bloqueado} onChange={e => setNome(e.target.value)} /><DialogFooter><Button type="button" variant="outline" disabled={bloqueado} onClick={() => setSalvarModelo(false)}>Voltar</Button><Button type="button" disabled={bloqueado || !nome.trim()} onClick={() => void tarefa(async () => {
      validarEmailBlocos(blocos, tema);
      const { error } = await (supabase as any).from("email_modelos").insert({ nome: nome.trim(), blocos, tema });
      if (error) { if (error.code === "23505") throw new Error("Já existe um modelo com esse nome."); throw error; }
      await qc.invalidateQueries({ queryKey: ["email-modelos"] }); setSalvarModelo(false); toast.success("Modelo salvo.");
    })}>Salvar modelo</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}