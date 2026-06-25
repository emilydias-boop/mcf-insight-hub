import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { DatePickerCustom } from '@/components/ui/DatePickerCustom';
import { CalendarCheck, Target, Trophy, AlertTriangle, ChevronRight, X, Plus } from 'lucide-react';
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
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

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

function SdrCard({ sdr, onClick, onRemove }: { sdr: DailyViewSdr; onClick: () => void; onRemove?: () => void }) {
  const hit = sdr.meta_diaria > 0 && sdr.agendamentos >= sdr.meta_diaria;
  const diff = sdr.agendamentos - sdr.meta_diaria;
  return (
    <div className="relative">
      {onRemove && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          title="Remover card"
          className="absolute -top-2 -right-2 z-10 w-7 h-7 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-md hover:scale-110 transition"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
      <button
        onClick={onClick}
        className={cn(
        'text-left rounded-2xl border-2 bg-card/60 backdrop-blur p-5 transition-all hover:-translate-y-0.5 group',
        'w-full',
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
    </div>
  );
}

function CloserCard({ closer, onClick, onRemove }: { closer: DailyViewCloser; onClick: () => void; onRemove?: () => void }) {
  const hitR = closer.reunioes_realizadas >= closer.meta_reunioes;
  const hitC = closer.contratos_pagos >= closer.meta_contratos;
  const allHit = hitR && hitC;
  return (
    <div className="relative">
      {onRemove && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          title="Remover card"
          className="absolute -top-2 -right-2 z-10 w-7 h-7 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-md hover:scale-110 transition"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
      <button
        onClick={onClick}
        className={cn(
        'text-left rounded-2xl border-2 bg-card/60 backdrop-blur p-5 transition-all hover:-translate-y-0.5 group',
        'w-full',
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
    </div>
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
  const { role } = useAuth();
  const isAdmin = role === 'admin';
  const queryClient = useQueryClient();
  const [pickerKind, setPickerKind] = useState<null | 'sdr' | 'closer'>(null);

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

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['daily-view-incorporador'] });

  const hideMutation = useMutation({
    mutationFn: async (args: { kind: 'sdr_hidden' | 'closer_hidden'; person_id: string }) => {
      const { error } = await supabase
        .from('daily_view_overrides' as any)
        .insert({ bu: 'incorporador', kind: args.kind, person_id: args.person_id });
      if (error && !String(error.message).includes('duplicate')) throw error;
    },
    onSuccess: () => { invalidate(); toast.success('Card removido'); },
    onError: (e: any) => toast.error('Falha ao remover: ' + e.message),
  });

  const addMutation = useMutation({
    mutationFn: async (args: { kind: 'sdr_extra' | 'closer_extra'; person_id: string }) => {
      // If person was previously hidden, unhide first
      const hiddenKind = args.kind === 'sdr_extra' ? 'sdr_hidden' : 'closer_hidden';
      await supabase
        .from('daily_view_overrides' as any)
        .delete()
        .eq('bu', 'incorporador')
        .eq('kind', hiddenKind)
        .eq('person_id', args.person_id);
      const { error } = await supabase
        .from('daily_view_overrides' as any)
        .insert({ bu: 'incorporador', kind: args.kind, person_id: args.person_id });
      if (error && !String(error.message).includes('duplicate')) throw error;
    },
    onSuccess: () => { invalidate(); setPickerKind(null); toast.success('Card adicionado'); },
    onError: (e: any) => toast.error('Falha ao adicionar: ' + e.message),
  });

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
          {isAdmin && (
            <div className="flex justify-end mb-3">
              <Button size="sm" variant="outline" onClick={() => setPickerKind('sdr')}>
                <Plus className="h-4 w-4 mr-1" /> Adicionar SDR
              </Button>
            </div>
          )}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-40" />)}
            </div>
          ) : filteredSdrs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Sem SDRs no squad Incorporador para essa data.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSdrs.map((s) => (
                <SdrCard
                  key={s.sdr_id}
                  sdr={s}
                  onClick={() => setOpenSdr(s)}
                  onRemove={isAdmin ? () => hideMutation.mutate({ kind: 'sdr_hidden', person_id: s.sdr_id }) : undefined}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="closers" className="mt-4">
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
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
            {isAdmin && (
              <Button size="sm" variant="outline" onClick={() => setPickerKind('closer')}>
                <Plus className="h-4 w-4 mr-1" /> Adicionar Closer
              </Button>
            )}
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
                <CloserCard
                  key={c.closer_id}
                  closer={c}
                  onClick={() => setOpenCloser(c)}
                  onRemove={isAdmin ? () => hideMutation.mutate({ kind: 'closer_hidden', person_id: c.closer_id }) : undefined}
                />
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

      <PersonPickerDialog
        kind={pickerKind}
        onClose={() => setPickerKind(null)}
        existingIds={new Set([
          ...(pickerKind === 'sdr' ? filteredSdrs.map((s) => s.sdr_id) : filteredClosers.map((c) => c.closer_id)),
        ])}
        onPick={(id) =>
          addMutation.mutate({
            kind: pickerKind === 'sdr' ? 'sdr_extra' : 'closer_extra',
            person_id: id,
          })
        }
      />
    </div>
  );
}

function PersonPickerDialog({
  kind,
  onClose,
  onPick,
  existingIds,
}: {
  kind: null | 'sdr' | 'closer';
  onClose: () => void;
  onPick: (id: string) => void;
  existingIds: Set<string>;
}) {
  const { data: options = [], isLoading } = useQuery({
    queryKey: ['daily-view-picker-options', kind],
    enabled: !!kind,
    queryFn: async (): Promise<{ id: string; name: string; email: string | null }[]> => {
      if (kind === 'sdr') {
        const { data, error } = await supabase
          .from('sdr')
          .select('id, name, email')
          .eq('active', true)
          .order('name');
        if (error) throw error;
        return (data || []) as any;
      }
      const { data, error } = await supabase
        .from('closers')
        .select('id, name, email')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return (data || []) as any;
    },
  });

  const available = options.filter((o) => !existingIds.has(o.id));

  return (
    <Dialog open={!!kind} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            Adicionar {kind === 'sdr' ? 'SDR' : 'Closer'} ao Daily View
          </DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Carregando…</p>
        ) : available.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Nenhum {kind === 'sdr' ? 'SDR' : 'Closer'} disponível para adicionar.
          </p>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto divide-y divide-border rounded-md border border-border">
            {available.map((o) => (
              <button
                key={o.id}
                onClick={() => onPick(o.id)}
                className="w-full text-left px-3 py-2 hover:bg-muted/50 transition flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{o.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{o.email}</p>
                </div>
                <Plus className="h-4 w-4 text-primary shrink-0" />
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}