import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, startOfDay, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Download, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CONSORCIO_WEEK_STARTS_ON } from '@/lib/businessDays';

// Painel Comercial BU MCF SOLAR (2026-10-02). Lê somente a RPC painel_comercial_solar.
// Nenhum cálculo de métrica no front além de razões (taxas) sobre números do banco.

type N = number | string;
interface Linha { agendadas: N; realizadas: N; no_show: N; pendentes: N; vendas: N }
interface Sdr extends Linha { sdr_id: string | null; name: string; email: string | null; na_bu: boolean; agendamentos: N }
interface Closer extends Linha { closer_id: string; name: string; email: string | null; is_active: boolean }
interface Meta { meta_valor: number | null; meta_agendamento_dia: number | null; closer_targets: Record<string, number> | null }
interface Resp {
  totais: {
    agendamentos: N; agendadas: N; realizadas: N; no_show: N;
    pendentes_futuras: N; pendentes_vencidas: N; remarcadas: N;
    vendas: N; contratos_pagos: N; valor_registrado: N;
  };
  meta: Meta | null;
  sdrs: Sdr[];
  closers: Closer[];
  fonte_vendas: string;
}

type Preset = 'today' | 'week' | 'month' | 'custom';
const n = (v: N | null | undefined) => Number(v ?? 0);
const pct = (a: number, b: number) => (b > 0 ? `${((a / b) * 100).toFixed(1)}%` : '—');

function range(preset: Preset, custom: { from?: Date; to?: Date }) {
  const now = new Date();
  if (preset === 'today') return { from: startOfDay(now), to: startOfDay(now) };
  if (preset === 'week') return {
    from: startOfWeek(now, { weekStartsOn: CONSORCIO_WEEK_STARTS_ON }),
    to: endOfWeek(now, { weekStartsOn: CONSORCIO_WEEK_STARTS_ON }),
  };
  if (preset === 'custom' && custom.from) return { from: custom.from, to: custom.to ?? custom.from };
  return { from: startOfMonth(now), to: endOfMonth(now) };
}

function Kpi({ title, value, sub }: { title: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{title}</p>
        <p className="text-2xl font-semibold text-foreground">{value}</p>
        {sub && <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export default function PainelComercialSolar() {
  const { role } = useAuth();
  const canEdit = !!role && ['admin', 'manager', 'coordenador'].includes(role);
  const qc = useQueryClient();
  const [preset, setPreset] = useState<Preset>('month');
  const [custom, setCustom] = useState<{ from?: Date; to?: Date }>({});
  const [sdrFiltro, setSdrFiltro] = useState<string>('all');
  const [metaOpen, setMetaOpen] = useState(false);
  const { from, to } = range(preset, custom);
  const pFrom = format(from, 'yyyy-MM-dd');
  const pTo = format(to, 'yyyy-MM-dd');

  const { data, isLoading, error } = useQuery({
    queryKey: ['painel-comercial-solar', pFrom, pTo],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('painel_comercial_solar', { p_from: pFrom, p_to: pTo });
      if (error) throw error;
      return data as Resp;
    },
    staleTime: 30000,
  });

  const t = data?.totais;
  const meta = data?.meta ?? null;
  const sdrs = useMemo(
    () => (data?.sdrs ?? []).filter((s) => sdrFiltro === 'all' || (s.sdr_id ?? 'null') === sdrFiltro),
    [data, sdrFiltro],
  );
  const closers = data?.closers ?? [];

  const exportar = () => {
    const linhas = [
      ['SDR', 'Fora da BU', 'Meta agend./dia', 'Agendamentos', 'Reuniões agendadas', 'Realizadas', 'No-show', 'Pendentes', 'Vendas'],
      ...sdrs.map((s) => [s.name, s.na_bu ? '' : 'sim', meta?.meta_agendamento_dia ?? 'sem meta', n(s.agendamentos), n(s.agendadas), n(s.realizadas), n(s.no_show), n(s.pendentes), n(s.vendas)]),
      [],
      ['Closer', 'Ativo', 'Agendadas', 'Realizadas', 'No-show', 'Pendentes', 'Vendas'],
      ...closers.map((c) => [c.name, c.is_active ? 'sim' : 'não', n(c.agendadas), n(c.realizadas), n(c.no_show), n(c.pendentes), n(c.vendas)]),
    ];
    const csv = linhas.map((l) => l.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')).join('\n');
    const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = `painel-solar-${pFrom}_${pTo}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const realizadas = n(t?.realizadas);
  const pendTotal = n(t?.pendentes_futuras) + n(t?.pendentes_vencidas) + n(t?.remarcadas);

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Painel Comercial — MCF Solar</h1>
          <p className="text-sm text-muted-foreground">
            {format(from, 'dd/MM/yyyy', { locale: ptBR })} – {format(to, 'dd/MM/yyyy', { locale: ptBR })} · fuso America/Sao_Paulo
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-muted rounded-lg p-1 gap-0.5">
            {(['today', 'week', 'month'] as Preset[]).map((p) => (
              <button key={p} onClick={() => setPreset(p)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md ${preset === p ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'}`}>
                {p === 'today' ? 'Hoje' : p === 'week' ? 'Semana' : 'Mês'}
              </button>
            ))}
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant={preset === 'custom' ? 'default' : 'outline'} size="sm">
                <CalendarIcon className="h-4 w-4 mr-1" /> Custom
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar mode="range" locale={ptBR} numberOfMonths={2}
                selected={{ from: custom.from, to: custom.to }}
                onSelect={(r) => { setCustom({ from: r?.from, to: r?.to }); if (r?.from) setPreset('custom'); }} />
            </PopoverContent>
          </Popover>
          <Select value={sdrFiltro} onValueChange={setSdrFiltro}>
            <SelectTrigger className="w-[200px] h-9"><SelectValue placeholder="SDR" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os SDRs</SelectItem>
              {(data?.sdrs ?? []).map((s) => (
                <SelectItem key={s.sdr_id ?? 'null'} value={s.sdr_id ?? 'null'}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={exportar} disabled={!data}>
            <Download className="h-4 w-4 mr-1" /> Exportar
          </Button>
          {canEdit && (
            <Button variant="ghost" size="sm" onClick={() => setMetaOpen(true)}>
              <Settings2 className="h-4 w-4 mr-1" /> Metas
            </Button>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}

      {isLoading || !t ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">{Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Kpi title="Agendamentos" value={String(n(t.agendamentos))} sub="criados no período" />
          <Kpi title="Reuniões Agendadas" value={String(n(t.agendadas))} sub="R1 com data no período" />
          <Kpi title="Reuniões Realizadas" value={String(realizadas)} />
          <Kpi title="No-shows" value={String(n(t.no_show))} />
          <Kpi title="Pendentes" value={String(pendTotal)}
            sub={`futuras ${n(t.pendentes_futuras)} · vencidas ${n(t.pendentes_vencidas)} · remarcadas ${n(t.remarcadas)}`} />
          <Kpi title="Vendas Realizadas" value={String(n(t.vendas))} sub="entrada na etapa “Venda realizada”" />
          <Kpi title="Contrato Pago" value={String(n(t.contratos_pagos))} sub="entrada na etapa — não somado às vendas" />
          <Kpi title="Taxa de No-show" value={pct(n(t.no_show), n(t.agendadas))} sub="no-show ÷ agendadas" />
          <Kpi title="Conversão" value={pct(n(t.vendas), realizadas)} sub="vendas ÷ realizadas" />
          <Kpi title="Valor / Ticket" value={n(t.valor_registrado) > 0 ? 'ver CRM' : 'sem registro'} sub="Solar não registra valor por negócio" />
        </div>
      )}

      <Tabs defaultValue="sdr">
        <TabsList>
          <TabsTrigger value="sdr">SDRs</TabsTrigger>
          <TabsTrigger value="closer">Closers</TabsTrigger>
        </TabsList>
        <TabsContent value="sdr">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Por SDR (quem agendou)</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SDR</TableHead><TableHead>Meta</TableHead><TableHead className="text-right">Agendamento</TableHead>
                    <TableHead className="text-right">Reuniões Agendadas</TableHead><TableHead className="text-right">Reuniões Realizadas</TableHead>
                    <TableHead className="text-right">No-show</TableHead><TableHead className="text-right">Vendas</TableHead>
                    <TableHead className="text-right">Conv. Vendas/Reunião</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sdrs.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Sem reuniões no período</TableCell></TableRow>}
                  {sdrs.map((s) => (
                    <TableRow key={s.sdr_id ?? 'null'}>
                      <TableCell>
                        {s.name}
                        {!s.na_bu && <Badge variant="outline" className="ml-2 text-[10px]">fora da BU</Badge>}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{meta?.meta_agendamento_dia ? `${meta.meta_agendamento_dia}/dia` : 'sem meta'}</TableCell>
                      <TableCell className="text-right">{n(s.agendamentos)}</TableCell>
                      <TableCell className="text-right">{n(s.agendadas)}</TableCell>
                      <TableCell className="text-right">{n(s.realizadas)}</TableCell>
                      <TableCell className="text-right">{n(s.no_show)} <span className="text-muted-foreground text-xs">({pct(n(s.no_show), n(s.agendadas))})</span></TableCell>
                      <TableCell className="text-right">{n(s.vendas)}</TableCell>
                      <TableCell className="text-right">{pct(n(s.vendas), n(s.realizadas))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="closer">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Por Closer (quem atendeu)</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Closer</TableHead><TableHead>Meta</TableHead><TableHead className="text-right">Agendadas</TableHead>
                    <TableHead className="text-right">Realizadas</TableHead><TableHead className="text-right">No-show</TableHead>
                    <TableHead className="text-right">Pendentes</TableHead><TableHead className="text-right">Vendas</TableHead>
                    <TableHead className="text-right">Conversão</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {closers.map((c) => {
                    const m = meta?.closer_targets?.[c.closer_id];
                    return (
                      <TableRow key={c.closer_id}>
                        <TableCell>{c.name}{!c.is_active && <Badge variant="outline" className="ml-2 text-[10px]">inativo</Badge>}</TableCell>
                        <TableCell className="text-muted-foreground">{m ? m : 'sem meta'}</TableCell>
                        <TableCell className="text-right">{n(c.agendadas)}</TableCell>
                        <TableCell className="text-right">{n(c.realizadas)}</TableCell>
                        <TableCell className="text-right">{n(c.no_show)} <span className="text-muted-foreground text-xs">({pct(n(c.no_show), n(c.agendadas))})</span></TableCell>
                        <TableCell className="text-right">{n(c.pendentes)}</TableCell>
                        <TableCell className="text-right">{n(c.vendas)}</TableCell>
                        <TableCell className="text-right">{pct(n(c.vendas), n(c.realizadas))}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <p className="text-xs text-muted-foreground">
        Reuniões: agenda R1 dos closers da Solar (1 participante = 1 reunião; parceiro e cancelada fora).
        Vendas: data de entrada na etapa pelo histórico de movimentação do CRM. Meta: {meta ? 'lançada para o mês' : 'sem meta lançada para o mês'}.
      </p>

      {canEdit && (
        <MetaDialog open={metaOpen} onOpenChange={setMetaOpen} monthRef={format(startOfMonth(from), 'yyyy-MM-dd')}
          meta={meta} closers={closers}
          onSaved={() => qc.invalidateQueries({ queryKey: ['painel-comercial-solar'] })} />
      )}
    </div>
  );
}

function MetaDialog({ open, onOpenChange, monthRef, meta, closers, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void; monthRef: string; meta: Meta | null; closers: Closer[]; onSaved: () => void;
}) {
  const [valor, setValor] = useState('');
  const [agDia, setAgDia] = useState('');
  const [ct, setCt] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState<string | null>(null);
  if (open && loaded !== monthRef) {
    setLoaded(monthRef);
    setValor(meta?.meta_valor != null ? String(meta.meta_valor) : '');
    setAgDia(meta?.meta_agendamento_dia != null ? String(meta.meta_agendamento_dia) : '');
    setCt(Object.fromEntries(Object.entries(meta?.closer_targets ?? {}).map(([k, v]) => [k, String(v)])));
  }
  const save = useMutation({
    mutationFn: async () => {
      const closer_targets = Object.fromEntries(Object.entries(ct).filter(([, v]) => v !== '').map(([k, v]) => [k, Number(v)]));
      const { error } = await (supabase as any).from('solar_bi_metas').upsert({
        month_ref: monthRef,
        meta_valor: valor === '' ? null : Number(valor),
        meta_agendamento_dia: agDia === '' ? null : Number(agDia),
        closer_targets,
      }, { onConflict: 'month_ref' });
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Metas salvas'); onSaved(); onOpenChange(false); setLoaded(null); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setLoaded(null); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Metas Solar — {format(new Date(monthRef + 'T12:00:00'), 'MMMM/yyyy', { locale: ptBR })}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Meta de valor (R$)</Label><Input type="number" value={valor} onChange={(e) => setValor(e.target.value)} /></div>
          <div><Label>Meta de agendamento por dia</Label><Input type="number" value={agDia} onChange={(e) => setAgDia(e.target.value)} /></div>
          {closers.filter((c) => c.is_active).map((c) => (
            <div key={c.closer_id}><Label>Meta de vendas — {c.name}</Label>
              <Input type="number" value={ct[c.closer_id] ?? ''} onChange={(e) => setCt({ ...ct, [c.closer_id]: e.target.value })} /></div>
          ))}
        </div>
        <DialogFooter><Button onClick={() => save.mutate()} disabled={save.isPending}>Salvar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
