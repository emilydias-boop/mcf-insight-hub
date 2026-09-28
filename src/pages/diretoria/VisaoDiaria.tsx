import { useState } from 'react';
import { differenceInCalendarDays, format, startOfMonth, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';
import { ArrowRight, CalendarDays, ChevronDown, Info, RefreshCw, AlertTriangle } from 'lucide-react';
import { useVisaoDiariaBus, hojeSaoPaulo, type VDBu, type VDTotais } from '@/hooks/useVisaoDiariaBus';
import { formatDateForDB, parseYmdLocal } from '@/lib/dateHelpers';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const integer = (n: number) => n.toLocaleString('pt-BR');
const pctFormat = (v: number) => `${(v * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
const currency = (n: number) => new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL', maximumFractionDigits: 0, minimumFractionDigits: 0,
}).format(n);

function Taxa({ value, label, compact = false }: { value: number | null; label: string; compact?: boolean }) {
  return (
    <div className={cn('flex items-center gap-1.5', compact ? 'flex-wrap' : 'min-w-[115px] flex-col justify-center text-center')}>
      {!compact && <ArrowRight className="h-4 w-4 text-muted-foreground max-lg:rotate-90" aria-hidden />}
      <span className="flex items-center gap-1 font-semibold tabular-nums text-foreground">
        {value === null ? '—' : `${(value * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`}
        {value !== null && value > 1 && (
          <Tooltip>
            <TooltipTrigger asChild><Info className="h-3.5 w-3.5 text-muted-foreground" aria-label="Explicação da taxa acima de 100%" /></TooltipTrigger>
            <TooltipContent className="max-w-64">Acima de 100%: o time está trabalhando leads que entraram antes do período (base antiga)</TooltipContent>
          </Tooltip>
        )}
      </span>
      <span className="text-[11px] leading-tight text-muted-foreground">{label}</span>
    </div>
  );
}

function Etapa({ title, value, children, highlight = false }: { title: string; value: number; children?: React.ReactNode; highlight?: boolean }) {
  return (
    <div className={cn('min-w-0 flex-1 border-l-2 pl-4 py-2', highlight ? 'border-primary' : 'border-border')}>
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums text-foreground">{integer(value)}</p>
      <div className="mt-2 min-h-8 text-xs leading-relaxed text-muted-foreground">{children}</div>
    </div>
  );
}

function EtapaDupla({ title, pares }: { title: string; pares: { label: string; value: number }[] }) {
  return (
    <div className="min-w-0 flex-1 border-l-2 border-border pl-4 py-2">
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      <div className="mt-1 flex gap-6">
        {pares.map((par) => (
          <div key={par.label}>
            <p className="text-3xl font-semibold tabular-nums text-foreground">{integer(par.value)}</p>
            <p className="text-xs text-muted-foreground">{par.label}</p>
          </div>
        ))}
      </div>
      <div className="mt-2 min-h-8" />
    </div>
  );
}

function DiaADia({ bu }: { bu: VDBu }) {
  type Col = { label: string; key: keyof VDTotais } | { label: string; especial: 'taxa_no_show' };
  const columns: Col[] = [
    ...(bu.bu === 'incorporador'
      ? [{ label: 'A010', key: 'entrada_a010' as const }, { label: 'Anamnese', key: 'entrada_anamnese' as const }]
      : [{ label: 'Entrada', key: 'entrada' as const }]),
    { label: 'Agend.', key: 'agendamentos' },
    ...(bu.bu === 'incorporador' ? [{ label: 'Lead A', key: 'agendamentos_a' as const }, { label: 'Lead B', key: 'agendamentos_b' as const }] : []),
    { label: 'R1 marc.', key: 'r1_marcadas' },
    { label: 'R1 real.', key: 'r1_realizadas' },
    { label: 'No-show', key: 'r1_no_show' },
    { label: '% No-show', especial: 'taxa_no_show' as const },
    { label: 'Fechamento', key: 'fechamentos' },
    ...(bu.bu === 'consorcio' ? [{ label: 'Cartas', key: 'cartas' as const }, { label: 'Valor', key: 'valor' as const }] : []),
    ...(bu.bu === 'incorporador' ? [{ label: 'Sem R1', key: 'fechamentos_sem_r1' as const }] : []),
  ];
  const pct = (v: number | null | undefined) => (v === null || v === undefined ? '—' : pctFormat(v));
  const cell = (key: keyof VDTotais, value: number | undefined) => key === 'valor' ? currency(value ?? 0) : integer(value ?? 0);

  return (
    <Collapsible className="mt-5 border-t border-border pt-3">
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="group gap-2 px-2">
          Ver dia a dia <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-3">
        <Table>
          <TableHeader><TableRow>
            <TableHead className="whitespace-nowrap">Data</TableHead>
            {columns.map((c) => <TableHead key={c.label} className="text-right whitespace-nowrap">{c.label}</TableHead>)}
          </TableRow></TableHeader>
          <TableBody>
            {bu.dias.map((dia) => {
              const date = parseYmdLocal(dia.data);
              return <TableRow key={dia.data}>
                <TableCell className="whitespace-nowrap font-medium">{date ? format(date, 'dd/MM, EEE', { locale: ptBR }) : dia.data}</TableCell>
                {columns.map((c) => <TableCell key={c.label} className="text-right tabular-nums whitespace-nowrap">{'especial' in c ? pct(dia.taxa_no_show) : cell(c.key, dia[c.key])}</TableCell>)}
              </TableRow>;
            })}
          </TableBody>
          <TableFooter><TableRow>
            <TableCell>Total</TableCell>
            {columns.map((c) => <TableCell key={c.label} className="text-right tabular-nums whitespace-nowrap">{'especial' in c ? pct(bu.taxas.no_show) : cell(c.key, bu.totais[c.key])}</TableCell>)}
          </TableRow></TableFooter>
        </Table>
      </CollapsibleContent>
    </Collapsible>
  );
}

function BuSection({ bu, singleDay }: { bu: VDBu; singleDay: boolean }) {
  const t = bu.totais;
  const pendentesAnteriores = bu.dias.reduce((soma, d) => (d.data < hojeSaoPaulo() ? soma + (d.r1_pendentes ?? 0) : soma), 0);
  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="pb-3"><CardTitle className="text-lg">{bu.label}</CardTitle></CardHeader>
      <CardContent>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-3">
          <Etapa title="Entrada de lead" value={t.entrada}>
            {bu.bu === 'incorporador' ? `A010: ${integer(t.entrada_a010)} · Anamnese: ${integer(t.entrada_anamnese)}` :
              t.entrada_importados > 0 ? `inclui ${integer(t.entrada_importados)} importados (base clint)` : null}
          </Etapa>
          <Taxa value={bu.taxas.entrada_agendamento} label="agendamentos ÷ entradas" />
          <Etapa title="Agendamento" value={t.agendamentos}>
            {t.reagendamentos > 0 && `+ ${integer(t.reagendamentos)} reagendamentos`}
          </Etapa>
          <Taxa value={bu.taxas.comparecimento} label="realizadas ÷ R1 marcadas" />
          <Etapa title="R1 Realizada" value={t.r1_realizadas}>
            de {integer(t.r1_marcadas)} marcadas · {integer(t.r1_no_show)} no-show · {integer(t.r1_pendentes)} pendentes
          </Etapa>
          <Taxa value={bu.taxas.realizada_fechamento} label="fechamentos ÷ realizadas" />
          <Etapa title={bu.fechamento_label} value={t.fechamentos} highlight>
            {bu.bu === 'incorporador' && t.fechamentos_sem_r1 > 0 && `+ ${integer(t.fechamentos_sem_r1)} sem R1 (outside) · total ${integer(t.fechamentos_total ?? 0)}`}
            {bu.bu === 'consorcio' && <>{integer(t.cartas)} cartas · <strong className="font-semibold text-foreground">{currency(t.valor)}</strong></>}
            {bu.bu === 'solar' && t.valor > 0 && <strong className="font-semibold text-foreground">{currency(t.valor)}</strong>}
          </Etapa>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Badge variant="secondary" className="gap-1.5 py-1"><Taxa value={bu.taxas.entrada_fechamento} label="Entrada → Fechamento" compact /></Badge>
        </div>
        {pendentesAnteriores > 0 && (
          <p className="mt-4 flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-foreground">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {integer(pendentesAnteriores)} R1 de dias anteriores sem status marcado na agenda — a taxa de comparecimento fica subestimada até o closer marcar
          </p>
        )}
        {!singleDay && <DiaADia bu={bu} />}
      </CardContent>
    </Card>
  );
}

type Preset = 'hoje' | 'ontem' | 'sete' | 'mes' | 'personalizado';

export default function VisaoDiaria() {
  const today = hojeSaoPaulo();
  const todayDate = parseYmdLocal(today) ?? new Date();
  const [preset, setPreset] = useState<Preset>('hoje');
  const [period, setPeriod] = useState({ from: today, to: today });
  const [draft, setDraft] = useState<DateRange | undefined>();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const { data, isLoading, isFetching, error, refetch } = useVisaoDiariaBus(period.from, period.to);

  const selectPreset = (choice: Preset) => {
    setPreset(choice);
    const start = choice === 'ontem' ? subDays(todayDate, 1) : choice === 'sete' ? subDays(todayDate, 6) : choice === 'mes' ? startOfMonth(todayDate) : todayDate;
    const end = choice === 'ontem' ? start : todayDate;
    setPeriod({ from: formatDateForDB(start), to: formatDateForDB(end) });
    setCalendarOpen(false);
  };

  const days = draft?.from && draft?.to ? differenceInCalendarDays(draft.to, draft.from) + 1 : 0;
  const invalidRange = days > 93;
  const geradoEm = data?.gerado_em ?? '';

  return (
    <main className="mx-auto max-w-[1500px] space-y-6 p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-semibold md:text-3xl">Visão Diária</h1>
          <p className="mt-1 text-sm text-muted-foreground">Entrada → Agendamento → R1 Realizada → Fechamento, por BU</p>
        </div>
        <div className="flex items-center gap-3">
          {geradoEm && <span className="text-xs text-muted-foreground">Atualizado às {geradoEm.slice(11, 16)}</span>}
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} title="Atualizar" aria-label="Atualizar">
            <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2" aria-label="Período">
        {([['hoje', 'Hoje'], ['ontem', 'Ontem'], ['sete', 'Últimos 7 dias'], ['mes', 'Mês atual']] as const).map(([key, label]) =>
          <Button key={key} size="sm" variant={preset === key ? 'default' : 'outline'} onClick={() => selectPreset(key)}>{label}</Button>
        )}
        <Popover open={calendarOpen} onOpenChange={(open) => {
          setCalendarOpen(open);
          if (open) {
            setPreset('personalizado');
            setDraft({ from: parseYmdLocal(period.from) ?? undefined, to: parseYmdLocal(period.to) ?? undefined });
          }
        }}>
          <PopoverTrigger asChild>
            <Button size="sm" variant={preset === 'personalizado' ? 'default' : 'outline'}>
              <CalendarDays className="mr-2 h-4 w-4" /> Personalizado
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto max-w-[calc(100vw-2rem)] p-3">
            <Calendar mode="range" selected={draft} onSelect={setDraft} numberOfMonths={1} locale={ptBR} />
            {invalidRange && <p role="alert" className="mb-2 text-xs text-destructive">Selecione no máximo 93 dias.</p>}
            <Button size="sm" className="w-full" disabled={!draft?.from || !draft?.to || invalidRange} onClick={() => {
              if (!draft?.from || !draft?.to) return;
              setPeriod({ from: formatDateForDB(draft.from), to: formatDateForDB(draft.to) });
              setCalendarOpen(false);
            }}>Aplicar período</Button>
          </PopoverContent>
        </Popover>
        <span className="text-xs text-muted-foreground">{period.from === period.to ? format(todayOrDate(period.from), 'dd/MM/yyyy') : `${format(todayOrDate(period.from), 'dd/MM/yyyy')} – ${format(todayOrDate(period.to), 'dd/MM/yyyy')}`}</span>
      </div>

      {isLoading && <div className="space-y-4" aria-label="Carregando visão diária">{[1, 2, 3].map((n) => <Skeleton key={n} className="h-52 w-full rounded-md" />)}</div>}
      {error && <Card><CardContent className="space-y-3 pt-6"><p className="text-sm text-destructive">{error.message}</p><Button variant="outline" onClick={() => refetch()}>Tentar de novo</Button></CardContent></Card>}
      {!isLoading && !error && data?.bus.map((bu) => <BuSection key={bu.bu} bu={bu} singleDay={data.periodo.de === data.periodo.ate} />)}
      {!isLoading && !error && data?.bus.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma BU encontrada para o período.</p>}

      <footer className="border-t border-border pt-5 text-xs leading-relaxed text-muted-foreground">
        Taxas por volume do período (não coorte): em 'Hoje' oscilam, em 7/30 dias estabilizam. Entrada Incorporador = compradores A010 (pessoas distintas, Hubla+Kiwify) + leads Anamnese sem A010. Entrada Consórcio/Solar = todo negócio criado na pipeline, inclusive importações. Agendamento = R1 marcadas no dia (sem reagendamento). R1 Realizada = pela data da reunião, mesma régua do Painel Comercial. Contrato pago = cauções efetivas sem estorno; 'sem R1' = contrato pago sem reunião vinculada. Carta fechada = propostas aceitas pela data do aceite (mesma perna A da Produção Gerada).
      </footer>
    </main>
  );
}

function todayOrDate(value: string): Date {
  return parseYmdLocal(value) ?? new Date();
}