import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { DatePickerCustom } from '@/components/ui/DatePickerCustom';
import { CalendarCheck, Target, Trophy, AlertTriangle, ChevronRight } from 'lucide-react';
import { format, subDays, isWeekend } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BusinessUnit } from '@/hooks/useMyBU';
import { cn } from '@/lib/utils';
import {
  useDailyViewIncorporador,
  type DailyViewSdr,
  type DailyViewCloser,
} from '@/hooks/useDailyViewIncorporador';
import { SdrDailyDrilldownDialog } from './daily-view/SdrDailyDrilldownDialog';
import { CloserDailyDrilldownDialog } from './daily-view/CloserDailyDrilldownDialog';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface Props { bu: BusinessUnit; }

function defaultYesterdayBusinessDay(): Date {
  let d = subDays(new Date(), 1);
  while (isWeekend(d)) d = subDays(d, 1);
  return d;
}

function progressColor(realized: number, target: number) {
  if (target <= 0) return 'bg-muted';
  const pct = realized / target;
  if (pct >= 1) return 'bg-primary';
  if (pct >= 0.8) return 'bg-amber-500';
  return 'bg-destructive';
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 150) : 0;
  return (
    <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
      <div
        className={cn('h-full transition-all', progressColor(value, max))}
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
    </div>
  );
}

function PersonAvatar({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
  return (
    <div className="w-10 h-10 rounded-full bg-primary/15 text-primary flex items-center justify-center font-semibold ring-1 ring-primary/30">
      {initials || '?'}
    </div>
  );
}

function SdrCard({ sdr, onClick }: { sdr: DailyViewSdr; onClick: () => void }) {
  const hit = sdr.meta_diaria > 0 && sdr.agendamentos >= sdr.meta_diaria;
  const diff = sdr.agendamentos - sdr.meta_diaria;
  return (
    <button
      onClick={onClick}
      className={cn(
        'text-left rounded-2xl border-2 bg-card/60 backdrop-blur p-5 transition-all hover:-translate-y-0.5 group',
        hit
          ? 'border-primary/80 shadow-[0_0_28px_-10px_hsl(var(--primary)/0.55)] hover:shadow-[0_0_36px_-8px_hsl(var(--primary)/0.65)] hover:border-primary'
          : 'border-destructive/80 shadow-[0_0_28px_-10px_hsl(var(--destructive)/0.45)] hover:shadow-[0_0_36px_-8px_hsl(var(--destructive)/0.55)] hover:border-destructive'
      )}
    >
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <PersonAvatar name={sdr.name} />
          <div className="min-w-0">
            <p className="font-semibold font-display truncate">{sdr.name}</p>
            <p className="text-xs text-muted-foreground truncate">{sdr.email}</p>
          </div>
        </div>
        {sdr.meta_diaria > 0 ? (
          hit ? (
            <Badge className="bg-primary/15 text-primary ring-1 ring-primary/40 hover:bg-primary/20 shrink-0">
              <Trophy className="h-3 w-3 mr-1" /> Bateu
            </Badge>
          ) : (
            <Badge variant="destructive" className="ring-1 ring-destructive/40 shrink-0">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Faltou {Math.max(-diff, 0)}
            </Badge>
          )
        ) : (
          <Badge variant="outline" className="shrink-0">Sem meta</Badge>
        )}
      </div>
      <div className="flex items-end justify-between mb-2">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Agendamentos</p>
          <p className="text-3xl font-bold font-display leading-none">
            {sdr.agendamentos}
            <span className="text-base text-muted-foreground font-normal"> / {sdr.meta_diaria || '—'}</span>
          </p>
        </div>
        <span className="text-xs text-muted-foreground group-hover:text-primary inline-flex items-center">
          Detalhes <ChevronRight className="h-3 w-3 ml-0.5" />
        </span>
      </div>
      <ProgressBar value={sdr.agendamentos} max={sdr.meta_diaria} />
    </button>
  );
}

function CloserCard({ closer, onClick }: { closer: DailyViewCloser; onClick: () => void }) {
  const hitR = closer.reunioes_realizadas >= closer.meta_reunioes;
  const hitC = closer.contratos_pagos >= closer.meta_contratos;
  const allHit = hitR && hitC;
  return (
    <button
      onClick={onClick}
      className={cn(
        'text-left rounded-2xl border-2 bg-card/60 backdrop-blur p-5 transition-all hover:-translate-y-0.5 group',
        allHit
          ? 'border-primary/80 shadow-[0_0_28px_-10px_hsl(var(--primary)/0.55)] hover:shadow-[0_0_36px_-8px_hsl(var(--primary)/0.65)] hover:border-primary'
          : 'border-destructive/80 shadow-[0_0_28px_-10px_hsl(var(--destructive)/0.45)] hover:shadow-[0_0_36px_-8px_hsl(var(--destructive)/0.55)] hover:border-destructive'
      )}
    >
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <PersonAvatar name={closer.name} />
          <div className="min-w-0">
            <p className="font-semibold font-display truncate">{closer.name}</p>
            <p className="text-xs text-muted-foreground truncate">{closer.email}</p>
          </div>
        </div>
        {allHit ? (
          <Badge className="bg-primary/15 text-primary ring-1 ring-primary/40 hover:bg-primary/20 shrink-0">
            <Trophy className="h-3 w-3 mr-1" /> 2/2
          </Badge>
        ) : (
          <Badge variant="outline" className="shrink-0">
            {(hitR ? 1 : 0) + (hitC ? 1 : 0)}/2 metas
          </Badge>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Reuniões</p>
          <p className="text-2xl font-bold font-display leading-none">
            {closer.reunioes_realizadas}
            <span className="text-sm text-muted-foreground font-normal"> / {closer.meta_reunioes}</span>
          </p>
          <div className="mt-2"><ProgressBar value={closer.reunioes_realizadas} max={closer.meta_reunioes} /></div>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Contratos pagos</p>
          <p className="text-2xl font-bold font-display leading-none">
            {closer.contratos_pagos}
            <span className="text-sm text-muted-foreground font-normal"> / {closer.meta_contratos}</span>
          </p>
          <div className="mt-2"><ProgressBar value={closer.contratos_pagos} max={closer.meta_contratos} /></div>
        </div>
      </div>
    </button>
  );
}

function SummaryCard({ label, value, target, icon: Icon }: { label: string; value: number; target: number; icon: any }) {
  const pct = target > 0 ? Math.round((value / target) * 100) : 0;
  return (
    <Card className="bg-card/60 backdrop-blur border-border">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <p className="text-3xl font-bold font-display">
          {value}
          <span className="text-base text-muted-foreground font-normal"> / {target}</span>
        </p>
        <p className={cn('text-xs mt-1', pct >= 100 ? 'text-primary' : pct >= 80 ? 'text-amber-500' : 'text-destructive')}>
          {pct}% da meta
        </p>
      </CardContent>
    </Card>
  );
}

export function DailyViewPanel(_props: Props) {
  const [date, setDate] = useState<Date>(defaultYesterdayBusinessDay());
  const [metaReunioes, setMetaReunioes] = useState(2);
  const [metaContratos, setMetaContratos] = useState(1);

  const { data, isLoading } = useDailyViewIncorporador(date, metaReunioes, metaContratos);

  const allEmails = useMemo(() => {
    const e = new Set<string>();
    (data?.sdrs || []).forEach((s) => s.email && e.add(s.email.toLowerCase()));
    (data?.closers || []).forEach((c) => c.email && e.add(c.email.toLowerCase()));
    return Array.from(e);
  }, [data]);

  const { data: inactiveEmails } = useQuery({
    queryKey: ['daily-view-inactive-emails', allEmails],
    queryFn: async (): Promise<Set<string>> => {
      if (allEmails.length === 0) return new Set();
      const { data: profs } = await supabase
        .from('profiles')
        .select('email, access_status')
        .in('email', allEmails);
      return new Set(
        (profs || [])
          .filter((p) => p.access_status && p.access_status !== 'ativo')
          .map((p) => (p.email || '').toLowerCase())
      );
    },
    enabled: allEmails.length > 0,
    staleTime: 60_000,
  });

  const filteredSdrs = useMemo(
    () => (data?.sdrs || []).filter((s) => !inactiveEmails?.has((s.email || '').toLowerCase())),
    [data, inactiveEmails]
  );
  const filteredClosers = useMemo(
    () => (data?.closers || []).filter((c) => !inactiveEmails?.has((c.email || '').toLowerCase())),
    [data, inactiveEmails]
  );

  const [openSdr, setOpenSdr] = useState<DailyViewSdr | null>(null);
  const [openCloser, setOpenCloser] = useState<DailyViewCloser | null>(null);

  const totals = useMemo(() => {
    const sdrs = filteredSdrs;
    const closers = filteredClosers;
    return {
      metaAg: sdrs.reduce((a, s) => a + s.meta_diaria, 0),
      realAg: sdrs.reduce((a, s) => a + s.agendamentos, 0),
      hitAg: sdrs.filter((s) => s.meta_diaria > 0 && s.agendamentos >= s.meta_diaria).length,
      sdrsTotal: sdrs.length,
      metaR: closers.reduce((a, c) => a + c.meta_reunioes, 0),
      realR: closers.reduce((a, c) => a + c.reunioes_realizadas, 0),
      metaC: closers.reduce((a, c) => a + c.meta_contratos, 0),
      realC: closers.reduce((a, c) => a + c.contratos_pagos, 0),
    };
  }, [filteredSdrs, filteredClosers]);

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-to-br from-card/80 to-card/40 border-primary/20">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center ring-1 ring-primary/30">
                <CalendarCheck className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="font-display text-xl">Daily View</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Avaliando <span className="text-foreground font-medium capitalize">
                    {format(date, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                  </span>
                  {' '}• {filteredSdrs.length} SDRs · {filteredClosers.length} Closers
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <DatePickerCustom
                mode="single"
                selected={date}
                onSelect={(d) => d && d instanceof Date && setDate(d)}
              />
              <Button variant="outline" size="sm" onClick={() => setDate(defaultYesterdayBusinessDay())}>
                Ontem
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <SummaryCard label="Agendamentos SDR" value={totals.realAg} target={totals.metaAg} icon={Target} />
            <Card className="bg-card/60 backdrop-blur border-border">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">SDRs que bateram</p>
                  <Trophy className="h-4 w-4 text-primary" />
                </div>
                <p className="text-3xl font-bold font-display">
                  {totals.hitAg}
                  <span className="text-base text-muted-foreground font-normal"> / {totals.sdrsTotal}</span>
                </p>
              </CardContent>
            </Card>
            <SummaryCard label="Reuniões realizadas (Closer)" value={totals.realR} target={totals.metaR} icon={CalendarCheck} />
            <SummaryCard label="Contratos pagos" value={totals.realC} target={totals.metaC} icon={Trophy} />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="sdrs">
        <TabsList>
            <TabsTrigger value="sdrs">SDRs ({filteredSdrs.length})</TabsTrigger>
            <TabsTrigger value="closers">Closers ({filteredClosers.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="sdrs" className="mt-4">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-40" />)}
            </div>
          ) : filteredSdrs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Sem SDRs no squad Incorporador para essa data.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSdrs.map((s) => (
                <SdrCard key={s.sdr_id} sdr={s} onClick={() => setOpenSdr(s)} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="closers" className="mt-4">
          <div className="flex items-center gap-3 mb-4 text-xs text-muted-foreground flex-wrap">
            <span>Metas diárias do closer:</span>
            <label className="flex items-center gap-1">
              Reuniões
              <input
                type="number"
                min={0}
                value={metaReunioes}
                onChange={(e) => setMetaReunioes(Math.max(0, parseInt(e.target.value || '0', 10)))}
                className="w-14 h-7 rounded-md border border-border bg-background px-2 text-foreground"
              />
            </label>
            <label className="flex items-center gap-1">
              Contratos
              <input
                type="number"
                min={0}
                value={metaContratos}
                onChange={(e) => setMetaContratos(Math.max(0, parseInt(e.target.value || '0', 10)))}
                className="w-14 h-7 rounded-md border border-border bg-background px-2 text-foreground"
              />
            </label>
          </div>
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-44" />)}
            </div>
          ) : filteredClosers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Sem closers na BU Incorporador.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredClosers.map((c) => (
                <CloserCard key={c.closer_id} closer={c} onClick={() => setOpenCloser(c)} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <SdrDailyDrilldownDialog
        sdr={openSdr}
        date={date}
        open={!!openSdr}
        onClose={() => setOpenSdr(null)}
      />
      <CloserDailyDrilldownDialog
        closer={openCloser}
        date={date}
        open={!!openCloser}
        onClose={() => setOpenCloser(null)}
      />
    </div>
  );
}