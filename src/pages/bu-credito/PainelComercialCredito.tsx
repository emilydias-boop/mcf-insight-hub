import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, RefreshCw, Users, CalendarCheck, CalendarX, HandCoins, TrendingUp, Banknote, Receipt, Clock, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { LeadSegmentBadge } from '@/components/crm/LeadSegmentBadge';
import { cn } from '@/lib/utils';

// ============= Tipos do retorno da RPC painel_comercial_credito =============

interface PCPeriodo {
  from: string;
  to: string;
  fuso: string;
}

interface PCTotais {
  leads_criados: number | string;
  agendadas: number | string;
  realizadas: number | string;
  no_show: number | string;
  pendentes: number | string;
  vendas: number | string;
  volume_financiado: number | string;
  ticket_medio: number | string;
}

interface PCSdr {
  sdr_id: string | null;
  name: string | null;
  agendadas: number | string;
  realizadas: number | string;
  no_show: number | string;
  pendentes: number | string;
  agendadas_icp: number | string;
  vendas: number | string;
}

interface PCCloser {
  closer_id: string | null;
  name: string | null;
  email: string | null;
  color: string | null;
  is_active: boolean;
  agendadas: number | string;
  realizadas: number | string;
  no_show: number | string;
  pendentes: number | string;
  vendas: number | string;
  volume_financiado: number | string;
}

interface PCIcp {
  segmento: 'ICP' | 'Parcial' | 'Fora do ICP' | 'Sem qualificação';
  leads_criados: number | string;
  agendadas: number | string;
  realizadas: number | string;
  vendas: number | string;
  volume_financiado: number | string;
}

interface PCOrigem {
  tag: string;
  label: string;
  leads_criados: number | string;
  agendadas: number | string;
  realizadas: number | string;
  vendas: number | string;
  volume_financiado: number | string;
}

interface PCBanco {
  banco: string;
  modalidade: string;
  vendas: number | string;
  volume: number | string;
}

interface PCResult {
  periodo: PCPeriodo;
  totais: PCTotais;
  por_sdr: PCSdr[];
  por_closer: PCCloser[];
  por_icp: PCIcp[];
  por_origem: PCOrigem[];
  por_banco: PCBanco[];
}

// ============= Helpers =============

const num = (v: number | string | null | undefined): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const fmtBRL = (v: number | string | null | undefined): string =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(num(v));

const fmtInt = (v: number | string | null | undefined): string =>
  new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(num(v));

const fmtPct = (parte: number, total: number): string =>
  total > 0 ? `${Math.round((parte / total) * 100)}%` : '—';

const fmtYmd = (d: Date): string => format(d, 'yyyy-MM-dd');

type Preset = 'hoje' | 'semana' | 'mes' | 'personalizado';

// ============= Página =============

export default function PainelComercialCredito() {
  const hoje = new Date();
  const [preset, setPreset] = useState<Preset>('mes');
  const [from, setFrom] = useState<Date>(startOfMonth(hoje));
  const [to, setTo] = useState<Date>(endOfMonth(hoje));

  const aplicarPreset = (p: Preset) => {
    setPreset(p);
    const h = new Date();
    if (p === 'hoje') {
      setFrom(h);
      setTo(h);
    } else if (p === 'semana') {
      // Semana começa na segunda-feira
      setFrom(startOfWeek(h, { weekStartsOn: 1 }));
      setTo(endOfWeek(h, { weekStartsOn: 1 }));
    } else if (p === 'mes') {
      setFrom(startOfMonth(h));
      setTo(endOfMonth(h));
    }
  };

  const fromStr = fmtYmd(from);
  const toStr = fmtYmd(to);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['painel-comercial-credito', fromStr, toStr],
    staleTime: 60_000,
    queryFn: async (): Promise<PCResult> => {
      const { data: res, error } = await (supabase.rpc as any)('painel_comercial_credito', {
        p_from: fromStr,
        p_to: toStr,
      });
      if (error) throw error;
      return res as PCResult;
    },
  });

  const totais = data?.totais;
  const t = useMemo(() => ({
    leads: num(totais?.leads_criados),
    agendadas: num(totais?.agendadas),
    realizadas: num(totais?.realizadas),
    noShow: num(totais?.no_show),
    pendentes: num(totais?.pendentes),
    vendas: num(totais?.vendas),
    volume: num(totais?.volume_financiado),
    ticket: num(totais?.ticket_medio),
  }), [totais]);

  const comparecimento = fmtPct(t.realizadas, t.realizadas + t.noShow);
  const noShowPct = fmtPct(t.noShow, t.realizadas + t.noShow);
  const conversao = fmtPct(t.vendas, t.realizadas);

  const kpis = [
    { label: 'Leads criados', valor: fmtInt(t.leads), icon: Users },
    { label: 'R1 agendadas', valor: fmtInt(t.agendadas), icon: CalendarCheck },
    { label: 'R1 realizadas', valor: fmtInt(t.realizadas), sub: `Comparecimento ${comparecimento}`, icon: CalendarCheck },
    { label: 'No-show', valor: fmtInt(t.noShow), sub: `${noShowPct} das reuniões`, icon: CalendarX },
    { label: 'Vendas de crédito', valor: fmtInt(t.vendas), sub: `Conversão ${conversao} das realizadas`, icon: HandCoins },
    { label: 'Volume financiado', valor: fmtBRL(t.volume), icon: Banknote },
    { label: 'Ticket médio', valor: fmtBRL(t.ticket), icon: Receipt },
    { label: 'Pendentes', valor: fmtInt(t.pendentes), sub: 'Reuniões ainda sem status', icon: Clock },
  ];

  const funil = [
    { label: 'Leads', valor: t.leads },
    { label: 'Agendadas', valor: t.agendadas },
    { label: 'Realizadas', valor: t.realizadas },
    { label: 'Vendas', valor: t.vendas },
  ];

  const EmptyRow = ({ cols }: { cols: number }) => (
    <TableRow>
      <TableCell colSpan={cols} className="text-center text-muted-foreground py-8">
        Sem dados no período
      </TableCell>
    </TableRow>
  );

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Painel Comercial — Crédito Imobiliário</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Reuniões R1 pelo horário da reunião · vendas pela data de assinatura
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(['hoje', 'semana', 'mes'] as Preset[]).map((p) => (
            <Button
              key={p}
              variant={preset === p ? 'default' : 'outline'}
              size="sm"
              onClick={() => aplicarPreset(p)}
            >
              {p === 'hoje' ? 'Hoje' : p === 'semana' ? 'Semana' : 'Mês'}
            </Button>
          ))}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant={preset === 'personalizado' ? 'default' : 'outline'} size="sm">
                <CalendarIcon className="h-4 w-4 mr-2" />
                {format(from, 'dd/MM/yyyy')} — {format(to, 'dd/MM/yyyy')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-3" align="end">
              <div className="flex flex-col sm:flex-row gap-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Início</p>
                  <Calendar
                    mode="single"
                    selected={from}
                    onSelect={(d) => { if (d) { setFrom(d); setPreset('personalizado'); } }}
                    locale={ptBR}
                    className="pointer-events-auto"
                  />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Fim</p>
                  <Calendar
                    mode="single"
                    selected={to}
                    onSelect={(d) => { if (d) { setTo(d); setPreset('personalizado'); } }}
                    locale={ptBR}
                    className="pointer-events-auto"
                  />
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn('h-4 w-4 mr-2', isFetching && 'animate-spin')} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Estados */}
      {isLoading && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full" />
            ))}
          </div>
          <Skeleton className="h-48 w-full" />
        </div>
      )}

      {isError && !isLoading && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Erro ao carregar o painel</AlertTitle>
          <AlertDescription className="flex items-center gap-3">
            Não foi possível buscar os dados do período.
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Tentar de novo
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {data && !isLoading && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {kpis.map((k) => (
              <Card key={k.label}>
                <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{k.label}</CardTitle>
                  <k.icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{k.valor}</div>
                  {k.sub && <p className="text-xs text-muted-foreground mt-1">{k.sub}</p>}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Funil */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Funil
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                {funil.map((etapa, i) => (
                  <div key={etapa.label} className="flex items-center gap-3">
                    {i > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {fmtPct(etapa.valor, funil[i - 1].valor)} →
                      </span>
                    )}
                    <div className="flex flex-col">
                      <span className="text-xs text-muted-foreground">{etapa.label}</span>
                      <span className="text-lg font-bold">{fmtInt(etapa.valor)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Por SDR */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Por SDR (quem agendou)</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SDR</TableHead>
                    <TableHead className="text-right">Agendadas</TableHead>
                    <TableHead className="text-right">das quais ICP</TableHead>
                    <TableHead className="text-right">Realizadas</TableHead>
                    <TableHead className="text-right">No-show</TableHead>
                    <TableHead className="text-right">Comparecimento</TableHead>
                    <TableHead className="text-right">Vendas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.por_sdr.length === 0 && <EmptyRow cols={7} />}
                  {data.por_sdr.map((s, i) => (
                    <TableRow key={s.sdr_id ?? `sem-sdr-${i}`}>
                      <TableCell className="font-medium">{s.name ?? 'Sem SDR'}</TableCell>
                      <TableCell className="text-right">{fmtInt(s.agendadas)}</TableCell>
                      <TableCell className="text-right">{fmtInt(s.agendadas_icp)}</TableCell>
                      <TableCell className="text-right">{fmtInt(s.realizadas)}</TableCell>
                      <TableCell className="text-right">{fmtInt(s.no_show)}</TableCell>
                      <TableCell className="text-right">{fmtPct(num(s.realizadas), num(s.realizadas) + num(s.no_show))}</TableCell>
                      <TableCell className="text-right">{fmtInt(s.vendas)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Por Closer */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Por Closer</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Closer</TableHead>
                    <TableHead className="text-right">Agendadas</TableHead>
                    <TableHead className="text-right">Realizadas</TableHead>
                    <TableHead className="text-right">No-show</TableHead>
                    <TableHead className="text-right">Comparecimento</TableHead>
                    <TableHead className="text-right">Vendas</TableHead>
                    <TableHead className="text-right">Volume</TableHead>
                    <TableHead className="text-right">Conversão</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.por_closer.length === 0 && <EmptyRow cols={8} />}
                  {data.por_closer.map((c, i) => (
                    <TableRow key={c.closer_id ?? `closer-${i}`}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block h-2.5 w-2.5 rounded-full bg-muted-foreground"
                            style={c.color ? { backgroundColor: c.color } : undefined}
                          />
                          <span className="font-medium">{c.name ?? 'Sem closer'}</span>
                          {!c.is_active && <Badge variant="secondary">Inativo</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{fmtInt(c.agendadas)}</TableCell>
                      <TableCell className="text-right">{fmtInt(c.realizadas)}</TableCell>
                      <TableCell className="text-right">{fmtInt(c.no_show)}</TableCell>
                      <TableCell className="text-right">{fmtPct(num(c.realizadas), num(c.realizadas) + num(c.no_show))}</TableCell>
                      <TableCell className="text-right">{fmtInt(c.vendas)}</TableCell>
                      <TableCell className="text-right">{fmtBRL(c.volume_financiado)}</TableCell>
                      <TableCell className="text-right">{fmtPct(num(c.vendas), num(c.realizadas))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Por ICP + Por origem */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Por qualificação (ICP)</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Segmento</TableHead>
                      <TableHead className="text-right">Leads</TableHead>
                      <TableHead className="text-right">Agendadas</TableHead>
                      <TableHead className="text-right">Realizadas</TableHead>
                      <TableHead className="text-right">Vendas</TableHead>
                      <TableHead className="text-right">Volume</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.por_icp.length === 0 && <EmptyRow cols={6} />}
                    {data.por_icp.map((s) => (
                      <TableRow key={s.segmento}>
                        <TableCell>
                          {s.segmento === 'Sem qualificação' ? (
                            <span className="text-muted-foreground">Sem qualificação</span>
                          ) : (
                            <LeadSegmentBadge segment={s.segmento} />
                          )}
                        </TableCell>
                        <TableCell className="text-right">{fmtInt(s.leads_criados)}</TableCell>
                        <TableCell className="text-right">{fmtInt(s.agendadas)}</TableCell>
                        <TableCell className="text-right">{fmtInt(s.realizadas)}</TableCell>
                        <TableCell className="text-right">{fmtInt(s.vendas)}</TableCell>
                        <TableCell className="text-right">{fmtBRL(s.volume_financiado)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Por origem</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Origem</TableHead>
                      <TableHead className="text-right">Leads</TableHead>
                      <TableHead className="text-right">Agendadas</TableHead>
                      <TableHead className="text-right">Realizadas</TableHead>
                      <TableHead className="text-right">Vendas</TableHead>
                      <TableHead className="text-right">Volume</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.por_origem.length === 0 && <EmptyRow cols={6} />}
                    {data.por_origem.map((o) => (
                      <TableRow key={o.tag}>
                        <TableCell className="font-medium">{o.label}</TableCell>
                        <TableCell className="text-right">{fmtInt(o.leads_criados)}</TableCell>
                        <TableCell className="text-right">{fmtInt(o.agendadas)}</TableCell>
                        <TableCell className="text-right">{fmtInt(o.realizadas)}</TableCell>
                        <TableCell className="text-right">{fmtInt(o.vendas)}</TableCell>
                        <TableCell className="text-right">{fmtBRL(o.volume_financiado)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Por banco e modalidade */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Por banco e modalidade</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Banco</TableHead>
                    <TableHead>Modalidade</TableHead>
                    <TableHead className="text-right">Vendas</TableHead>
                    <TableHead className="text-right">Volume</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.por_banco.length === 0 && <EmptyRow cols={4} />}
                  {data.por_banco.map((b, i) => (
                    <TableRow key={`${b.banco}-${b.modalidade}-${i}`}>
                      <TableCell className="font-medium">{b.banco}</TableCell>
                      <TableCell>{b.modalidade}</TableCell>
                      <TableCell className="text-right">{fmtInt(b.vendas)}</TableCell>
                      <TableCell className="text-right">{fmtBRL(b.volume)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
