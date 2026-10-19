import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { addDays, format } from 'date-fns';
import { AlertTriangle, CalendarCheck, CalendarPlus, CheckCircle, Users, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { POS_VENDA_ORIGIN_ID } from '@/lib/posVenda';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TeamKPICards, type TeamKpiCardDefinition } from '@/components/sdr/TeamKPICards';
import type { TeamKPIs } from '@/hooks/useTeamMeetingsData';

// Painel Comercial do Pós Venda — só leitura. Fontes: crm_deals (pipeline Pós Venda) e pos_venda_reunioes.
// Não usa meeting_slots/closers. Datas sempre na data civil de Brasília (UTC-3).
const db = supabase as any;

const EMPTY_TEAM_KPIS = {
  sdrCount: 0, totalAgendamentos: 0, totalRealizadas: 0, totalNoShows: 0, totalContratos: 0,
  totalOutside: 0, totalReembolsos: 0, totalR1Agendada: 0, totalSemStatus: 0, taxaConversao: 0, taxaNoShow: 0,
} as unknown as TeamKPIs;

const STATUS_LABEL: Record<string, string> = { agendada: 'Agendada', realizada: 'Realizada', no_show: 'No-show', cancelada: 'Cancelada' };

type Reuniao = {
  id: string; deal_id: string; gerente_id: string; tipo: string; inicio: string; created_at: string; status: string;
  crm_deals?: { name: string | null } | null; profiles?: { full_name: string | null; email: string | null } | null;
};
type Lead = { id: string; name: string | null; created_at: string; custom_fields?: Record<string, unknown> | null; crm_stages?: { stage_name: string | null } | null; fonte?: string };

type Linha = { cliente: string; data: string; gerente: string; status: string };
type Detalhe = { titulo: string; linhas: Linha[]; colunaGerente?: string };

const FONTE_LABEL: Record<string, string> = { hubla: 'Hubla', mcfpay: 'MCF Pay', kiwify: 'Kiwify' };
/** Lead conta só se entrou por venda (pos_venda_fonte) ou outro meio; base importada do Harvey (harvey_crm_id) fica fora. */
const fonteDoLead = (cf: Record<string, unknown> | null | undefined): string | null => {
  const f = cf?.pos_venda_fonte;
  if (typeof f === 'string' && f.trim()) return FONTE_LABEL[f.trim().toLowerCase()] ?? f.trim();
  if (cf && 'harvey_crm_id' in cf) return null;
  return 'Outro';
};

const ymd = (d: Date) => format(d, 'yyyy-MM-dd');
const ymdLocal = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
/** Início do dia em Brasília (UTC-3, sem horário de verão). */
const isoBrt = (s: string) => `${s}T00:00:00-03:00`;
const fmtBrt = (iso: string) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso));
const fmtInt = (n: number) => new Intl.NumberFormat('pt-BR').format(n);
const pct = (a: number, b: number) => (b > 0 ? `${((a / b) * 100).toFixed(1)}%` : '—');

async function buscarTudo<T>(build: (from: number, to: number) => any): Promise<T[]> {
  const out: T[] = [];
  for (let p = 0; ; p++) {
    const { data, error } = await build(p * 1000, p * 1000 + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

/** Painel comercial do Pós Venda (cards + tabela por gerente). O período vem de quem usa (from/to 'yyyy-MM-dd', data civil de Brasília). */
export function PainelComercialPosVendaSection({ from, to }: { from: string; to: string }) {
  const [detalhe, setDetalhe] = useState<Detalhe | null>(null);
  const ate = ymd(addDays(ymdLocal(to), 1)); // exclusivo

  const { data, isLoading, isError } = useQuery({
    queryKey: ['painel-comercial-pos-venda', from, to],
    staleTime: 60_000,
    queryFn: async () => {
      const [leads, criadas, doPeriodo] = await Promise.all([
        buscarTudo<Lead>((a, b) => db.from('crm_deals').select('id, name, created_at, custom_fields, crm_stages(stage_name)')
          .eq('origin_id', POS_VENDA_ORIGIN_ID).gte('created_at', isoBrt(from)).lt('created_at', isoBrt(ate))
          .order('created_at').range(a, b)),
        buscarTudo<Reuniao>((a, b) => db.from('pos_venda_reunioes')
          .select('id, deal_id, gerente_id, tipo, inicio, created_at, status, crm_deals(name), profiles:gerente_id(full_name, email)')
          .eq('tipo', 'viabilidade_1').gte('created_at', isoBrt(from)).lt('created_at', isoBrt(ate)).order('created_at').range(a, b)),
        buscarTudo<Reuniao>((a, b) => db.from('pos_venda_reunioes')
          .select('id, deal_id, gerente_id, tipo, inicio, created_at, status, crm_deals(name), profiles:gerente_id(full_name, email)')
          .eq('tipo', 'viabilidade_1').gte('inicio', isoBrt(from)).lt('inicio', isoBrt(ate)).order('inicio').range(a, b)),
      ]);
      const unicos = [...new Map(leads.map((l) => [l.id, l])).values()]
        .map((l) => ({ ...l, fonte: fonteDoLead(l.custom_fields) ?? undefined, custom_fields: undefined }))
        .filter((l) => !!l.fonte);
      return { leads: unicos, criadas, doPeriodo };
    },
  });

  const agora = Date.now();
  const m = useMemo(() => {
    const criadas = data?.criadas ?? [];
    const per = data?.doPeriodo ?? [];
    const agendada = per.filter((r) => r.status !== 'cancelada');
    return {
      leads: data?.leads ?? [],
      agendamentos: criadas,
      r1Agendada: agendada,
      realizada: per.filter((r) => r.status === 'realizada'),
      noShow: per.filter((r) => r.status === 'no_show'),
      semDesfecho: per.filter((r) => r.status === 'agendada' && +new Date(r.inicio) < agora),
    };
  }, [data, agora]);

  const linhasReuniao = (lista: Reuniao[], campo: 'inicio' | 'created_at'): Linha[] => lista.map((r) => ({
    cliente: r.crm_deals?.name ?? 'Cliente', data: fmtBrt(r[campo]),
    gerente: r.profiles?.full_name ?? r.profiles?.email ?? '—', status: STATUS_LABEL[r.status] ?? r.status,
  }));
  const abrir = (titulo: string, lista: Reuniao[], campo: 'inicio' | 'created_at' = 'inicio') => setDetalhe({ titulo, linhas: linhasReuniao(lista, campo) });

  const quebraFonte = useMemo(() => {
    const c = new Map<string, number>();
    m.leads.forEach((l) => c.set(l.fonte ?? 'Outro', (c.get(l.fonte ?? 'Outro') ?? 0) + 1));
    return [...c.entries()].sort((a, b) => (a[0] === 'Outro' ? 1 : b[0] === 'Outro' ? -1 : b[1] - a[1])).map(([f, n]) => `${f} ${fmtInt(n)}`).join(' · ');
  }, [m.leads]);

  const cards: TeamKpiCardDefinition[] = [
    {
      title: 'Leads que entraram', value: fmtInt(m.leads.length), icon: Users, color: 'text-sky-500', bgColor: 'bg-sky-500/10',
      tooltip: 'Negócios da pipeline Relacionamento - Pós venda criados no período (horário de Brasília) que entraram por venda (Hubla, MCF Pay, Kiwify...) ou outro meio. A base importada do Harvey não conta.',
      subline: quebraFonte || undefined,
      customOnClick: () => setDetalhe({ titulo: 'Leads que entraram', colunaGerente: 'Fonte', linhas: m.leads.map((l) => ({ cliente: l.name ?? 'Cliente', data: fmtBrt(l.created_at), gerente: l.fonte ?? 'Outro', status: l.crm_stages?.stage_name ?? '—' })) }),
    },
    {
      title: 'Agendamentos', value: fmtInt(m.agendamentos.length), icon: CalendarPlus, color: 'text-indigo-500', bgColor: 'bg-indigo-500/10',
      tooltip: 'Reuniões de Viabilidade 1 marcadas no período (data em que foram criadas), qualquer status.',
      subline: `${pct(m.agendamentos.length, m.leads.length)} dos leads`,
      customOnClick: () => abrir('Agendamentos (pela data de marcação)', m.agendamentos, 'created_at'),
    },
    {
      title: 'R1 Agendada', value: fmtInt(m.r1Agendada.length), icon: CalendarCheck, color: 'text-cyan-500', bgColor: 'bg-cyan-500/10',
      tooltip: 'Reuniões de Viabilidade 1 com data da reunião no período, sem as canceladas.',
      subline: m.semDesfecho.length > 0 ? `⚠ ${m.semDesfecho.length} já passaram sem status` : undefined,
      customOnClick: () => abrir('R1 Agendada', m.r1Agendada),
    },
    {
      title: 'R1 Realizada', value: fmtInt(m.realizada.length), icon: CheckCircle, color: 'text-green-500', bgColor: 'bg-green-500/10',
      tooltip: 'Viabilidade 1 com data no período e status Realizada.',
      subline: `${pct(m.realizada.length, m.r1Agendada.length)} comparecimento`,
      customOnClick: () => abrir('R1 Realizada', m.realizada),
    },
    {
      title: 'No-show R1', value: fmtInt(m.noShow.length), icon: XCircle, color: 'text-red-500', bgColor: 'bg-red-500/10',
      tooltip: 'Viabilidade 1 com data no período e status No-show.',
      subline: `${pct(m.noShow.length, m.r1Agendada.length)} das R1 agendadas`,
      customOnClick: () => abrir('No-show R1', m.noShow),
    },
  ];

  const porGerente = useMemo(() => {
    const map = new Map<string, { id: string; nome: string; ag: Reuniao[]; r1: Reuniao[]; real: Reuniao[]; ns: Reuniao[] }>();
    const get = (r: Reuniao) => {
      if (!map.has(r.gerente_id)) map.set(r.gerente_id, { id: r.gerente_id, nome: r.profiles?.full_name ?? r.profiles?.email ?? 'Sem nome', ag: [], r1: [], real: [], ns: [] });
      return map.get(r.gerente_id)!;
    };
    m.agendamentos.forEach((r) => get(r).ag.push(r));
    m.r1Agendada.forEach((r) => get(r).r1.push(r));
    m.realizada.forEach((r) => get(r).real.push(r));
    m.noShow.forEach((r) => get(r).ns.push(r));
    return [...map.values()].sort((a, b) => b.r1.length - a.r1.length || a.nome.localeCompare(b.nome));
  }, [m]);

  const Num = ({ n, onClick }: { n: number; onClick: () => void }) => (
    <button type="button" onClick={onClick} disabled={n === 0} className="tabular-nums hover:underline disabled:no-underline disabled:cursor-default">{fmtInt(n)}</button>
  );


  return (
    <div className="space-y-4">
      {isLoading && <div className="grid grid-cols-2 gap-3 md:grid-cols-5">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>}
      {isError && !isLoading && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">Não foi possível carregar os dados do painel.</div>
      )}

      {data && !isLoading && (
        <>
          <TeamKPICards kpis={EMPTY_TEAM_KPIS} customCards={cards} isLoading={false} />

          {m.semDesfecho.length > 0 && (
            <button type="button" onClick={() => abrir('R1 que já passaram sem status marcado', m.semDesfecho)}
              className="flex items-center gap-2 rounded-md border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-700 dark:text-yellow-400 hover:bg-yellow-500/20">
              <AlertTriangle className="h-4 w-4" />
              {m.semDesfecho.length} R1 do período já passaram e continuam como "Agendada" (sem status marcado). Clique para ver.
            </button>
          )}

          <Card className="bg-card border-border overflow-hidden">
            <CardHeader className="pb-2 px-3 sm:px-6"><CardTitle className="text-base">Por gerente de relacionamento</CardTitle></CardHeader>
            <CardContent className="pt-0 px-0 sm:px-6 pb-3 sm:pb-6 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Gerente</TableHead>
                    <TableHead className="text-right">Agendamentos</TableHead>
                    <TableHead className="text-right">R1 Agendada</TableHead>
                    <TableHead className="text-right">R1 Realizada</TableHead>
                    <TableHead className="text-right">No-show</TableHead>
                    <TableHead className="text-right">% comparecimento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {porGerente.length === 0 && <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Sem reuniões no período</TableCell></TableRow>}
                  {porGerente.map((g) => (
                    <TableRow key={g.id}>
                      <TableCell className="font-medium">{g.nome}</TableCell>
                      <TableCell className="text-right"><Num n={g.ag.length} onClick={() => abrir(`Agendamentos — ${g.nome}`, g.ag, 'created_at')} /></TableCell>
                      <TableCell className="text-right"><Num n={g.r1.length} onClick={() => abrir(`R1 Agendada — ${g.nome}`, g.r1)} /></TableCell>
                      <TableCell className="text-right"><Num n={g.real.length} onClick={() => abrir(`R1 Realizada — ${g.nome}`, g.real)} /></TableCell>
                      <TableCell className="text-right"><Num n={g.ns.length} onClick={() => abrir(`No-show — ${g.nome}`, g.ns)} /></TableCell>
                      <TableCell className="text-right tabular-nums">{pct(g.real.length, g.r1.length)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell className="font-semibold">Total <span className="text-xs font-normal text-muted-foreground">· {fmtInt(m.leads.length)} leads</span></TableCell>
                    <TableCell className="text-right font-semibold"><Num n={m.agendamentos.length} onClick={() => abrir('Agendamentos', m.agendamentos, 'created_at')} /></TableCell>
                    <TableCell className="text-right font-semibold"><Num n={m.r1Agendada.length} onClick={() => abrir('R1 Agendada', m.r1Agendada)} /></TableCell>
                    <TableCell className="text-right font-semibold"><Num n={m.realizada.length} onClick={() => abrir('R1 Realizada', m.realizada)} /></TableCell>
                    <TableCell className="text-right font-semibold"><Num n={m.noShow.length} onClick={() => abrir('No-show R1', m.noShow)} /></TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{pct(m.realizada.length, m.r1Agendada.length)}</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={!!detalhe} onOpenChange={(o) => !o && setDetalhe(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>{detalhe?.titulo} ({detalhe?.linhas.length ?? 0})</DialogTitle></DialogHeader>
          <div className="max-h-[60vh] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow><TableHead>Cliente</TableHead><TableHead>Data</TableHead><TableHead>{detalhe?.colunaGerente ?? 'Gerente'}</TableHead><TableHead>Status</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {detalhe?.linhas.map((l, i) => (
                  <TableRow key={i}><TableCell>{l.cliente}</TableCell><TableCell className="tabular-nums">{l.data}</TableCell><TableCell>{l.gerente}</TableCell><TableCell>{l.status}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
