import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useState } from "react";
import { EmailDestinatarios } from "./EmailDestinatarios";

type Grao = "day" | "week" | "month";

interface Resumo {
  ultimo_evento: string | null;
  ultimo_recebido: string | null;
  eventos_24h: number | null;
  suprimidos_total: number | null;
  suprimidos_hard_bounce: number | null;
  suprimidos_spam: number | null;
  suprimidos_descadastro: number | null;
  suprimidos_invalido: number | null;
}

interface SaudeRow {
  periodo: string;
  origem: "total" | "transacional" | "campanha" | string;
  envios: number; entregues: number; hard_bounce: number; soft_bounce: number; spam: number;
  descadastros: number; aberturas: number; cliques: number;
  pct_entrega: number | null; pct_hard_bounce: number | null; pct_spam: number | null;
  pct_descadastro: number | null; pct_abertura: number | null; pct_clique: number | null;
  alerta_bounce: boolean | null; alerta_spam: boolean | null;
}

interface EnvioRow {
  chave: string;
  origem: string; nome: string | null; primeiro_evento: string | null; ultimo_evento: string | null;
  envios: number; entregues: number; hard_bounce: number; spam: number; descadastros: number;
  aberturas: number; cliques: number;
  pct_hard_bounce: number | null; pct_spam: number | null; pct_abertura: number | null; pct_clique: number | null;
}

const n = (v: unknown) => Number(v ?? 0) || 0;
const fmtInt = (v: unknown) => n(v).toLocaleString("pt-BR");
const fmtPct = (v: number | string | null | undefined) =>
  v === null || v === undefined || v === "" ? "—" : `${Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
const ratio = (a: number, b: number) => (b > 0 ? (a / b) * 100 : null);
const fmtDateTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
const fmtDate = (d: string) => { const [y, m, dd] = d.slice(0, 10).split("-"); return `${dd}/${m}/${y}`; };
const ORIGEM: Record<string, string> = { total: "Total", transacional: "Transacional", campanha: "Campanha" };
const numericCell = "whitespace-nowrap px-[12px] py-[12px] text-right tabular-nums";
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
function Loading() {
  return <div role="status" aria-label="Carregando" className="space-y-[12px]">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[40px] w-full" />)}</div>;
}
const Empty = () => <p className="py-[32px] text-center text-[14px] text-muted-foreground">Sem e-mails no período</p>;

export function EmailMarketing({ from, to, grao }: { from: string; to: string; grao: Grao }) {
  const [envioSel, setEnvioSel] = useState<EnvioRow | null>(null);
  const resumo = useQuery({
    queryKey: ["mkt-email-resumo"],
    queryFn: async () => { const d = await call<Resumo[] | Resumo>("mkt_email_resumo"); return (Array.isArray(d) ? d[0] : d) ?? null; },
    staleTime: 60_000,
  });
  const saude = useQuery({
    queryKey: ["mkt-email-saude", from, to, grao],
    queryFn: () => call<SaudeRow[]>("mkt_email_saude", { p_from: from, p_to: to, p_grao: grao }),
    staleTime: 60_000,
  });
  const envios = useQuery({
    queryKey: ["mkt-email-por-envio", from, to],
    queryFn: () => call<EnvioRow[]>("mkt_email_por_envio", { p_from: from, p_to: to }),
    staleTime: 60_000,
  });

  if ([resumo.error, saude.error, envios.error].some(isPermError)) {
    return <Alert className="p-[16px]"><AlertDescription className="text-[13px]">Sem permissão para ver os dados de e-mail</AlertDescription></Alert>;
  }

  const r = resumo.data;
  const recebido = r?.ultimo_recebido ?? null;
  const atrasado = recebido ? Date.now() - new Date(recebido).getTime() > 24 * 60 * 60 * 1000 : false;

  const linhas = saude.data ?? [];
  const tot = linhas.filter(l => l.origem === "total").reduce((a, l) => ({
    envios: a.envios + n(l.envios), entregues: a.entregues + n(l.entregues), hard: a.hard + n(l.hard_bounce),
    spam: a.spam + n(l.spam), desc: a.desc + n(l.descadastros),
  }), { envios: 0, entregues: 0, hard: 0, spam: 0, desc: 0 });
  const pHard = ratio(tot.hard, tot.envios);
  const pSpam = ratio(tot.spam, tot.entregues);
  const amostra = tot.envios >= 50;
  const cards = [
    { label: "Entrega", pct: ratio(tot.entregues, tot.envios), a: tot.entregues, b: tot.envios, bad: false },
    { label: "Hard bounce (limite 2%)", pct: pHard, a: tot.hard, b: tot.envios, bad: amostra && (pHard ?? 0) > 2 },
    { label: "Spam (limite 0,1%)", pct: pSpam, a: tot.spam, b: tot.entregues, bad: amostra && (pSpam ?? 0) > 0.1 },
    { label: "Descadastro", pct: ratio(tot.desc, tot.entregues), a: tot.desc, b: tot.entregues, bad: false },
  ];

  return <div className="space-y-[16px]">
    {/* a. Status do webhook */}
    <Card className="min-w-0">
      <CardContent className="space-y-[12px] p-[20px]">
        {resumo.isLoading ? <Skeleton className="h-[40px] w-full" /> : resumo.error ? <ErrorBox error={resumo.error} /> : <>
          <div className="flex flex-wrap gap-x-[24px] gap-y-[8px] text-[13px]">
            <span>Último evento recebido do Brevo: <strong>{fmtDateTime(recebido)}</strong></span>
            <span>Eventos nas últimas 24h: <strong>{fmtInt(r?.eventos_24h)}</strong></span>
          </div>
          {!recebido ? <Alert className="p-[16px]"><AlertDescription className="text-[13px]">O Brevo ainda não está enviando eventos para o sistema. Falta cadastrar o webhook no Brevo.</AlertDescription></Alert>
            : atrasado ? <Alert variant="destructive" className="p-[16px]"><AlertDescription className="text-[13px]">Nenhum evento do Brevo há mais de 24 horas — confira o webhook</AlertDescription></Alert> : null}
        </>}
      </CardContent>
    </Card>

    {/* b. Cartões de saúde */}
    {saude.isLoading ? <Loading /> : saude.error ? <ErrorBox error={saude.error} /> : <div className="space-y-[8px]">
      <div className="grid grid-cols-1 gap-[12px] sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(c => <Card key={c.label} className={c.bad ? "border-destructive" : undefined}>
          <CardContent className="space-y-[4px] p-[16px]">
            <p className="text-[12px] text-muted-foreground">{c.label}</p>
            <p className={`text-[24px] font-semibold tabular-nums ${c.bad ? "text-destructive" : ""}`}>{fmtPct(c.pct)}</p>
            <p className={`text-[11px] ${c.bad ? "text-destructive" : "text-muted-foreground"}`}>{fmtInt(c.a)} de {fmtInt(c.b)}</p>
          </CardContent>
        </Card>)}
      </div>
      <p className="text-[11px] text-muted-foreground">Bounce e spam acima do limite derrubam a reputação do domínio minhacasafinanciada.com — que também envia os e-mails do time e a confirmação de R1.</p>
    </div>}

    {/* c. Tabela por período */}
    <Card className="min-w-0">
      <CardHeader className="space-y-[8px] p-[20px]"><CardTitle className="text-[18px] tracking-normal">Saúde por período</CardTitle></CardHeader>
      <CardContent className="p-[20px] pt-0">
        {saude.isLoading ? <Loading /> : saude.error ? <ErrorBox error={saude.error} /> : !linhas.length ? <Empty /> : <div className="overflow-x-auto">
          <Table className="min-w-[1200px] text-[12px]">
            <TableHeader><TableRow>
              <TableHead scope="col" className={head}>Período</TableHead>
              <TableHead scope="col" className={head}>Origem</TableHead>
              {["Envios", "Entregues", "% entrega", "Hard bounce", "% hard bounce", "Spam", "% spam", "Descadastros", "% abertura", "% clique"].map(l => <TableHead key={l} scope="col" className={`${numericCell} text-[12px]`}>{l}</TableHead>)}
            </TableRow></TableHeader>
            <TableBody>{linhas.map((l, i) => {
              const total = l.origem === "total";
              return <TableRow key={`${l.periodo}-${l.origem}-${i}`} className={total ? "font-semibold" : undefined}>
                <TableCell className="whitespace-nowrap px-[12px] py-[12px]">{fmtDate(l.periodo)}</TableCell>
                <TableCell className="whitespace-nowrap px-[12px] py-[12px]">{ORIGEM[l.origem] ?? l.origem}</TableCell>
                <TableCell className={numericCell}>{fmtInt(l.envios)}</TableCell>
                <TableCell className={numericCell}>{fmtInt(l.entregues)}</TableCell>
                <TableCell className={numericCell}>{fmtPct(l.pct_entrega)}</TableCell>
                <TableCell className={numericCell}>{fmtInt(l.hard_bounce)}</TableCell>
                <TableCell className={`${numericCell} ${l.alerta_bounce ? "text-destructive" : ""}`}>{fmtPct(l.pct_hard_bounce)}</TableCell>
                <TableCell className={numericCell}>{fmtInt(l.spam)}</TableCell>
                <TableCell className={`${numericCell} ${l.alerta_spam ? "text-destructive" : ""}`}>{fmtPct(l.pct_spam)}</TableCell>
                <TableCell className={numericCell}>{fmtInt(l.descadastros)}</TableCell>
                <TableCell className={numericCell}>{fmtPct(l.pct_abertura)}</TableCell>
                <TableCell className={numericCell}>{fmtPct(l.pct_clique)}</TableCell>
              </TableRow>;
            })}</TableBody>
          </Table>
        </div>}
        <p className="mt-[12px] text-[11px] text-muted-foreground">Período = data do primeiro evento de cada e-mail. Abertura é indicativa (o iPhone abre e-mails automaticamente; essas aberturas não contam).</p>
      </CardContent>
    </Card>

    {/* d. Tabela por envio */}
    <Card className="min-w-0">
      <CardHeader className="space-y-[8px] p-[20px]"><CardTitle className="text-[18px] tracking-normal">Por envio</CardTitle></CardHeader>
      <CardContent className="p-[20px] pt-0">
        {envios.isLoading ? <Loading /> : envios.error ? <ErrorBox error={envios.error} /> : !(envios.data ?? []).length ? <Empty /> : <div className="overflow-x-auto">
          <Table className="min-w-[1200px] text-[12px]">
            <TableHeader><TableRow>
              <TableHead scope="col" className={head}>Origem</TableHead>
              <TableHead scope="col" className={head}>Envio</TableHead>
              <TableHead scope="col" className={head}>Primeiro evento</TableHead>
              {["Envios", "Entregues", "Hard bounce", "% hard bounce", "Spam", "% spam", "Descadastros", "% abertura", "% clique"].map(l => <TableHead key={l} scope="col" className={`${numericCell} text-[12px]`}>{l}</TableHead>)}
            </TableRow></TableHeader>
            <TableBody>{(envios.data ?? []).map((e, i) => <TableRow key={`${e.origem}-${e.nome}-${i}`} role="button" tabIndex={0} className="cursor-pointer hover:bg-muted/50"
              onClick={() => setEnvioSel(e)} onKeyDown={ev => { if (ev.key === "Enter") setEnvioSel(e); }}>
              <TableCell className="whitespace-nowrap px-[12px] py-[12px]">{ORIGEM[e.origem] ?? e.origem}</TableCell>
              <TableCell className="min-w-[220px] px-[12px] py-[12px]">{e.nome ?? "—"}</TableCell>
              <TableCell className="whitespace-nowrap px-[12px] py-[12px]">{fmtDateTime(e.primeiro_evento)}</TableCell>
              <TableCell className={numericCell}>{fmtInt(e.envios)}</TableCell>
              <TableCell className={numericCell}>{fmtInt(e.entregues)}</TableCell>
              <TableCell className={numericCell}>{fmtInt(e.hard_bounce)}</TableCell>
              <TableCell className={numericCell}>{fmtPct(e.pct_hard_bounce)}</TableCell>
              <TableCell className={numericCell}>{fmtInt(e.spam)}</TableCell>
              <TableCell className={numericCell}>{fmtPct(e.pct_spam)}</TableCell>
              <TableCell className={numericCell}>{fmtInt(e.descadastros)}</TableCell>
              <TableCell className={numericCell}>{fmtPct(e.pct_abertura)}</TableCell>
              <TableCell className={numericCell}>{fmtPct(e.pct_clique)}</TableCell>
            </TableRow>)}</TableBody>
          </Table>
        </div>}
      </CardContent>
    </Card>

    <EmailDestinatarios from={from} to={to} envio={envioSel} onClose={() => setEnvioSel(null)} />

    {/* e. Supressões */}
    {r && !resumo.error && <p className="text-[12px] text-muted-foreground">
      E-mails suprimidos (não recebem marketing): {fmtInt(r.suprimidos_total)} — hard bounce {fmtInt(r.suprimidos_hard_bounce)} · spam {fmtInt(r.suprimidos_spam)} · descadastro {fmtInt(r.suprimidos_descadastro)} · inválido {fmtInt(r.suprimidos_invalido)}
    </p>}
  </div>;
}
