import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface EnvioSelecionado { chave: string; nome: string | null; origem: string; envios: number }

interface DestRow {
  mk: string; email: string; lead_nome: string | null; deal_id: string | null; contact_id: string | null;
  enviado_em: string | null; ultimo_evento: string | null;
  entregue: boolean; aberto: boolean; clicado: boolean; soft_bounce: boolean; hard_bounce: boolean;
  spam: boolean; descadastro: boolean; bloqueado: boolean; tem_conteudo: boolean; total: number;
}
interface Conteudo { assunto: string | null; remetente: string | null; destinatario: string | null; enviado_em: string | null; html: string | null }

const PAGE = 100;
const ORIGEM: Record<string, string> = { total: "Total", transacional: "Transacional", campanha: "Campanha" };
const fmtDateTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
const head = "px-[12px] py-[12px] text-[12px]";

function isPermError(e: unknown) {
  const err = e as { code?: string; message?: string } | null;
  return err?.code === "42501" || /permission denied|42501/i.test(err?.message ?? "");
}
async function call<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await (supabase as any).rpc(fn, args);
  if (error) throw error;
  return data as T;
}
function ErrorBox({ error }: { error: unknown }) {
  const msg = isPermError(error) ? "Sem permissão para ver os dados de e-mail" : String((error as any)?.message ?? error);
  return <Alert variant="destructive" className="p-[16px]"><AlertDescription className="text-[13px]">{msg}</AlertDescription></Alert>;
}

function StatusBadges({ d }: { d: DestRow }) {
  const items: { l: string; v: "destructive" | "secondary" | "outline" | "default" }[] = [];
  if (d.hard_bounce) items.push({ l: "Hard bounce", v: "destructive" });
  if (d.spam) items.push({ l: "Spam", v: "destructive" });
  if (d.descadastro) items.push({ l: "Descadastrou", v: "secondary" });
  if (d.soft_bounce) items.push({ l: "Soft bounce", v: "outline" });
  if (d.bloqueado) items.push({ l: "Bloqueado", v: "outline" });
  if (d.clicado) items.push({ l: "Clicou", v: "default" });
  if (d.aberto) items.push({ l: "Abriu", v: "default" });
  if (d.entregue) items.push({ l: "Entregue", v: "outline" });
  if (!items.length) items.push({ l: "Enviado", v: "outline" });
  return <div className="flex flex-wrap gap-[4px]">{items.map(i => <Badge key={i.l} variant={i.v} className="px-[6px] py-0 text-[10px]">{i.l}</Badge>)}</div>;
}

function MensagemDialog({ mk, onClose }: { mk: string | null; onClose: () => void }) {
  const q = useQuery({
    queryKey: ["mkt-email", "conteudo", mk],
    queryFn: () => call<Conteudo[]>("mkt_email_conteudo", { p_mk: mk }),
    enabled: !!mk, staleTime: 60_000,
  });
  const c = q.data?.[0];
  return <Dialog open={!!mk} onOpenChange={o => !o && onClose()}>
    <DialogContent className="max-w-[860px]">
      <DialogHeader><DialogTitle>Mensagem enviada</DialogTitle></DialogHeader>
      {q.isLoading ? <Skeleton className="h-[520px] w-full" /> : q.error ? <ErrorBox error={q.error} /> : !c ?
        <p className="py-[24px] text-center text-[13px] text-muted-foreground">Conteúdo não disponível para este envio.</p> :
        <div className="space-y-[12px] text-[13px]">
          <dl className="grid grid-cols-[90px_1fr] gap-x-[8px] gap-y-[4px]">
            <dt className="text-muted-foreground">Assunto</dt><dd className="break-words font-medium">{c.assunto ?? "—"}</dd>
            <dt className="text-muted-foreground">De</dt><dd className="break-words">{c.remetente ?? "—"}</dd>
            <dt className="text-muted-foreground">Para</dt><dd className="break-words">{c.destinatario ?? "—"}</dd>
            <dt className="text-muted-foreground">Enviado em</dt><dd>{fmtDateTime(c.enviado_em)}</dd>
          </dl>
          <iframe sandbox="" srcDoc={c.html ?? ""} title="Mensagem enviada" className="h-[520px] w-full rounded-md border bg-background" style={{ background: "#fff" }} />
          <p className="text-[11px] text-muted-foreground">Mensagem como saiu do sistema, antes do Brevo. Campanhas enviadas pelo Brevo não guardam o conteúdo aqui.</p>
        </div>}
    </DialogContent>
  </Dialog>;
}

export function EmailDestinatarios({ from, to, envio, onClose }: { from: string; to: string; envio: EnvioSelecionado | null; onClose: () => void }) {
  const [busca, setBusca] = useState("");
  const [buscaDeb, setBuscaDeb] = useState("");
  const [pagina, setPagina] = useState(0);
  const [mk, setMk] = useState<string | null>(null);
  const chave = envio?.chave ?? null;

  useEffect(() => { setBusca(""); setBuscaDeb(""); setPagina(0); }, [chave]);
  useEffect(() => { const t = setTimeout(() => { setBuscaDeb(busca.trim()); setPagina(0); }, 400); return () => clearTimeout(t); }, [busca]);

  const q = useQuery({
    queryKey: ["mkt-email", "destinatarios", from, to, chave, buscaDeb, pagina],
    queryFn: () => call<DestRow[]>("mkt_email_destinatarios", { p_from: from, p_to: to, p_chave: chave, p_busca: buscaDeb || null, p_limit: PAGE, p_offset: pagina * PAGE }),
    enabled: !!chave, staleTime: 60_000,
  });
  const rows = q.data ?? [];
  const total = Number(rows[0]?.total ?? 0);
  const ini = pagina * PAGE;

  return <>
    <Sheet open={!!envio} onOpenChange={o => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-[900px]">
        <SheetHeader>
          <SheetTitle>{envio?.nome ?? "—"}</SheetTitle>
          <SheetDescription>{envio ? `${ORIGEM[envio.origem] ?? envio.origem} · ${Number(envio.envios ?? 0).toLocaleString("pt-BR")} envios` : ""}</SheetDescription>
        </SheetHeader>
        <div className="mt-[16px] space-y-[12px]">
          <Input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por nome ou e-mail" className="h-[36px] text-[13px]" />
          {q.isLoading ? <div className="space-y-[8px]">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-[36px] w-full" />)}</div>
            : q.error ? <ErrorBox error={q.error} />
            : !rows.length ? <p className="py-[32px] text-center text-[14px] text-muted-foreground">Nenhum destinatário</p>
            : <>
              <div className="overflow-x-auto">
                <Table className="min-w-[760px] text-[12px]">
                  <TableHeader><TableRow>
                    {["Lead", "E-mail", "Enviado em", "Status", "Ações"].map(l => <TableHead key={l} scope="col" className={head}>{l}</TableHead>)}
                  </TableRow></TableHeader>
                  <TableBody>{rows.map(d => <TableRow key={d.mk}>
                    <TableCell className="px-[12px] py-[10px]">{d.lead_nome || "—"}</TableCell>
                    <TableCell className="break-all px-[12px] py-[10px]">{d.email}</TableCell>
                    <TableCell className="whitespace-nowrap px-[12px] py-[10px]">{fmtDateTime(d.enviado_em)}</TableCell>
                    <TableCell className="px-[12px] py-[10px]"><StatusBadges d={d} /></TableCell>
                    <TableCell className="whitespace-nowrap px-[12px] py-[10px]">
                      <div className="flex items-center gap-[8px]">
                        {d.deal_id && <a href={`/crm/negocios?deal=${d.deal_id}`} target="_blank" rel="noopener noreferrer" className="text-primary underline-offset-2 hover:underline">Abrir negócio</a>}
                        {d.tem_conteudo && <Button variant="outline" size="sm" className="h-[28px] text-[12px]" onClick={() => setMk(d.mk)}>Ver mensagem</Button>}
                      </div>
                    </TableCell>
                  </TableRow>)}</TableBody>
                </Table>
              </div>
              <div className="flex items-center justify-between text-[12px] text-muted-foreground">
                <span>{(ini + 1).toLocaleString("pt-BR")}–{(ini + rows.length).toLocaleString("pt-BR")} de {total.toLocaleString("pt-BR")}</span>
                <div className="flex gap-[8px]">
                  <Button variant="outline" size="sm" className="h-[30px] text-[12px]" disabled={pagina === 0} onClick={() => setPagina(p => p - 1)}>Anterior</Button>
                  <Button variant="outline" size="sm" className="h-[30px] text-[12px]" disabled={ini + rows.length >= total} onClick={() => setPagina(p => p + 1)}>Próxima</Button>
                </div>
              </div>
            </>}
        </div>
      </SheetContent>
    </Sheet>
    <MensagemDialog mk={mk} onClose={() => setMk(null)} />
  </>;
}
