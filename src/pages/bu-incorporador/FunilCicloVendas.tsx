import { useMemo, useState } from 'react';
import { subDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CalendarIcon, ChevronDown, ChevronRight, Filter, TrendingDown, Search, ArrowDown, CheckCircle2, XCircle, Clock, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFunilCicloVendas, ClientRow, ClientTransaction, MeetingInfo } from '@/hooks/useFunilCicloVendas';

const AVAILABLE_ENTRY_PRODUCTS = ['A010', 'A017'];

function formatBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function TxList({ items, empty }: { items: ClientTransaction[]; empty: string }) {
  if (items.length === 0) return <span className="text-xs text-muted-foreground">{empty}</span>;
  return (
    <div className="space-y-1">
      {items.map((t) => (
        <div key={t.id} className="text-xs">
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className="text-[10px] py-0 px-1.5">{t.productCode}</Badge>
            <span className="text-muted-foreground">{format(new Date(t.saleDate), 'dd/MM/yy')}</span>
            <span className="font-medium">{formatBRL(t.netValue)}</span>
          </div>
          <div className="text-[10px] text-muted-foreground pl-1">{t.source}</div>
        </div>
      ))}
    </div>
  );
}

const meetingStatusLabel: Record<string, { label: string; className: string; icon: any }> = {
  scheduled: { label: 'Agendada', className: 'bg-blue-500/10 text-blue-600', icon: Clock },
  confirmed: { label: 'Confirmada', className: 'bg-emerald-500/10 text-emerald-600', icon: CheckCircle2 },
  completed: { label: 'Realizada', className: 'bg-green-500/10 text-green-600', icon: CheckCircle2 },
  done: { label: 'Realizada', className: 'bg-green-500/10 text-green-600', icon: CheckCircle2 },
  no_show: { label: 'No-show', className: 'bg-red-500/10 text-red-600', icon: XCircle },
  cancelled: { label: 'Cancelada', className: 'bg-muted text-muted-foreground', icon: XCircle },
  rescheduled: { label: 'Reagendada', className: 'bg-yellow-500/10 text-yellow-600', icon: Clock },
};

function MeetingBadge({ m, type }: { m: MeetingInfo | null; type: 'R1' | 'R2' }) {
  if (!m) return <Badge variant="outline" className="text-[10px] text-muted-foreground">{type}: —</Badge>;
  const cfg = meetingStatusLabel[m.status] || { label: m.status, className: 'bg-muted', icon: Clock };
  const Icon = cfg.icon;
  return (
    <div className="space-y-0.5">
      <Badge variant="secondary" className={cn('text-[10px] gap-1', cfg.className)}>
        <Icon className="h-2.5 w-2.5" />
        {type}: {cfg.label}
      </Badge>
      <div className="text-[10px] text-muted-foreground">
        {format(new Date(m.scheduledAt), 'dd/MM HH:mm')} · {m.closerName || '—'}
      </div>
    </div>
  );
}

function StageNode({ label, value, pct, active, tooltip }: { label: string; value: number; pct?: number; active?: boolean; tooltip?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={cn(
          'flex-1 rounded-lg border p-3 text-center transition-colors cursor-help',
          active ? 'border-primary bg-primary/5' : 'border-border'
        )}>
          <div className="flex items-center justify-center gap-1">
            <div className="text-[11px] uppercase text-muted-foreground tracking-wide">{label}</div>
            {tooltip && <Info className="h-3 w-3 text-muted-foreground" />}
          </div>
          <div className="text-2xl font-bold mt-1">{value}</div>
          {pct !== undefined && (
            <div className="text-xs text-muted-foreground mt-0.5">{pct.toFixed(0)}%</div>
          )}
        </div>
      </TooltipTrigger>
      {tooltip && (
        <TooltipContent side="top" className="max-w-xs">
          <p className="text-xs">{tooltip}</p>
        </TooltipContent>
      )}
    </Tooltip>
  );
}

function FunnelViz({ rows }: { rows: ClientRow[] }) {
  const entry = rows.filter((r) => r.entryPurchases.length > 0).length;
  const withDeal = rows.filter((r) => r.entryPurchases.length > 0 && r.dealId).length;
  const withR1 = rows.filter((r) => r.entryPurchases.length > 0 && r.hasR1).length;
  const withR2 = rows.filter((r) => r.entryPurchases.length > 0 && r.hasR2).length;
  const final = rows.filter((r) => r.entryPurchases.length > 0 && r.hasFinal).length;

  const pct = (n: number) => (entry > 0 ? (n / entry) * 100 : 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <TrendingDown className="h-4 w-4 text-primary" />
          Funil do Ciclo de Vendas
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-stretch gap-2">
          <StageNode label="Entrada (A010)" value={entry} active />
          <ArrowDown className="h-5 w-5 text-muted-foreground self-center rotate-[-90deg]" />
          <StageNode label="No CRM" value={withDeal} pct={pct(withDeal)} />
          <ArrowDown className="h-5 w-5 text-muted-foreground self-center rotate-[-90deg]" />
          <StageNode label="R1" value={withR1} pct={pct(withR1)} />
          <ArrowDown className="h-5 w-5 text-muted-foreground self-center rotate-[-90deg]" />
          <StageNode label="R2" value={withR2} pct={pct(withR2)} />
          <ArrowDown className="h-5 w-5 text-muted-foreground self-center rotate-[-90deg]" />
          <StageNode label="Final (A001/03/09)" value={final} pct={pct(final)} />
        </div>
      </CardContent>
    </Card>
  );
}

function TimelineRow({ row }: { row: ClientRow }) {
  const events: { label: string; date: string | null; sub?: string; done: boolean }[] = [
    {
      label: 'Entrada',
      date: row.firstEntryDate,
      sub: row.entryPurchases.map((p) => p.productCode).join(', ') || undefined,
      done: row.entryPurchases.length > 0,
    },
    {
      label: 'R1',
      date: row.r1?.scheduledAt || null,
      sub: row.r1 ? `${row.r1.status}${row.r1.closerName ? ' · ' + row.r1.closerName : ''}` : 'Sem R1',
      done: !!row.r1,
    },
    {
      label: 'R2',
      date: row.r2?.scheduledAt || null,
      sub: row.r2 ? `${row.r2.status}${row.r2.closerName ? ' · ' + row.r2.closerName : ''}` : 'Sem R2',
      done: !!row.r2,
    },
    {
      label: 'Venda Final',
      date: row.finalPurchases[0]?.saleDate || null,
      sub: row.finalPurchases.map((p) => `${p.productCode} · ${formatBRL(p.netValue)}`).join(', ') || 'Sem venda final',
      done: row.hasFinal,
    },
  ];
  return (
    <div className="bg-muted/30 rounded-md p-4">
      <div className="text-xs font-medium text-muted-foreground mb-3">TIMELINE DO CLIENTE</div>
      <div className="flex items-start gap-2 overflow-x-auto">
        {events.map((ev, i) => (
          <div key={i} className="flex items-start gap-2 min-w-fit">
            <div className="flex flex-col items-center">
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold',
                ev.done ? 'bg-emerald-500 text-white' : 'bg-muted border border-border text-muted-foreground'
              )}>
                {ev.done ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
              </div>
              <div className="mt-1 text-xs font-medium">{ev.label}</div>
              <div className="text-[10px] text-muted-foreground max-w-[130px] text-center">
                {ev.date ? format(new Date(ev.date), "dd/MM/yy HH:mm", { locale: ptBR }) : '—'}
              </div>
              {ev.sub && <div className="text-[10px] text-muted-foreground max-w-[130px] text-center">{ev.sub}</div>}
            </div>
            {i < events.length - 1 && (
              <div className={cn('h-0.5 w-10 mt-4', ev.done && events[i + 1].done ? 'bg-emerald-500' : 'bg-border')} />
            )}
          </div>
        ))}
      </div>
      {row.dealStageName && (
        <div className="mt-3 text-xs">
          <span className="text-muted-foreground">Estágio atual no CRM: </span>
          <Badge variant="outline">{row.dealStageName}</Badge>
        </div>
      )}
    </div>
  );
}

function ClientTableRow({ row }: { row: ClientRow }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <TableRow className="cursor-pointer" onClick={() => setOpen(!open)}>
        <TableCell className="w-8">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </TableCell>
        <TableCell>
          <div className="font-medium text-sm">{row.customerName}</div>
          <div className="text-xs text-muted-foreground">{row.customerEmail || row.customerPhone}</div>
        </TableCell>
        <TableCell><TxList items={row.entryPurchases} empty="—" /></TableCell>
        <TableCell><TxList items={row.contractPurchases} empty="—" /></TableCell>
        <TableCell><TxList items={row.finalPurchases} empty="—" /></TableCell>
        <TableCell><MeetingBadge m={row.r1} type="R1" /></TableCell>
        <TableCell><MeetingBadge m={row.r2} type="R2" /></TableCell>
        <TableCell>
          {row.dealStageName ? (
            <Badge variant="outline" className="text-[10px]">{row.dealStageName}</Badge>
          ) : (
            <span className="text-xs text-muted-foreground">Sem deal</span>
          )}
        </TableCell>
      </TableRow>
      {open && (
        <TableRow>
          <TableCell colSpan={8} className="p-3">
            <TimelineRow row={row} />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function DateBtn({ label, date, onChange }: { label: string; date: Date; onChange: (d: Date) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="justify-start font-normal">
            <CalendarIcon className="h-3.5 w-3.5 mr-2" />
            {format(date, 'dd/MM/yyyy', { locale: ptBR })}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={date} onSelect={(d) => d && onChange(d)} initialFocus />
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default function FunilCicloVendas() {
  const [startDate, setStartDate] = useState<Date>(subDays(new Date(), 30));
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [entryProducts, setEntryProducts] = useState<string[]>(['A010']);
  const [onlyWithEntry, setOnlyWithEntry] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilters, setStatusFilters] = useState<{ semR1: boolean; semR2: boolean; semFinal: boolean }>({
    semR1: false,
    semR2: false,
    semFinal: false,
  });

  const { data: rows = [], isLoading } = useFunilCicloVendas({
    startDate,
    endDate,
    entryProducts,
    onlyWithEntry,
  });

  const filtered = useMemo(() => {
    let out = rows;
    if (statusFilters.semR1) out = out.filter((r) => !r.hasR1);
    if (statusFilters.semR2) out = out.filter((r) => !r.hasR2);
    if (statusFilters.semFinal) out = out.filter((r) => !r.hasFinal);
    if (search) {
      const q = search.toLowerCase();
      out = out.filter((r) =>
        (r.customerName || '').toLowerCase().includes(q) ||
        (r.customerEmail || '').toLowerCase().includes(q) ||
        (r.customerPhone || '').includes(q)
      );
    }
    return out;
  }, [rows, search, statusFilters]);

  const toggleProduct = (p: string) => {
    setEntryProducts((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  };

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Funil e Ciclo de Vendas</h1>
        <p className="text-sm text-muted-foreground">
          Compras de entrada (A010), contrato (A000) e produto final (A001/A003/A009) lado a lado, com a jornada de atendimento (R1 → R2 → Contrato).
        </p>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <DateBtn label="De" date={startDate} onChange={setStartDate} />
            <DateBtn label="Até" date={endDate} onChange={setEndDate} />

            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Produtos de entrada</span>
              <div className="flex gap-3 h-9 items-center">
                {AVAILABLE_ENTRY_PRODUCTS.map((p) => (
                  <label key={p} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <Checkbox checked={entryProducts.includes(p)} onCheckedChange={() => toggleProduct(p)} />
                    {p}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">&nbsp;</span>
              <label className="flex items-center gap-1.5 text-sm cursor-pointer h-9">
                <Checkbox checked={onlyWithEntry} onCheckedChange={(v) => setOnlyWithEntry(!!v)} />
                Só clientes com compra de entrada
              </label>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Status</span>
              <div className="flex gap-3 h-9 items-center">
                <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <Checkbox
                    checked={statusFilters.semR1}
                    onCheckedChange={(v) => setStatusFilters((s) => ({ ...s, semR1: !!v }))}
                  />
                  Sem R1
                </label>
                <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <Checkbox
                    checked={statusFilters.semR2}
                    onCheckedChange={(v) => setStatusFilters((s) => ({ ...s, semR2: !!v }))}
                  />
                  Sem R2
                </label>
                <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <Checkbox
                    checked={statusFilters.semFinal}
                    onCheckedChange={(v) => setStatusFilters((s) => ({ ...s, semFinal: !!v }))}
                  />
                  Sem Venda Final
                </label>
              </div>
            </div>

            <div className="flex-1 min-w-[200px]">
              <span className="text-xs text-muted-foreground block mb-1">Buscar</span>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Nome, e-mail ou telefone"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-9"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : (
        <FunnelViz rows={filtered} />
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Clientes ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Nenhum cliente encontrado no período.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
                    <TableHead>Cliente</TableHead>
                    <TableHead>Entrada</TableHead>
                    <TableHead>Contrato (A000)</TableHead>
                    <TableHead>Final (A001/03/09)</TableHead>
                    <TableHead>R1</TableHead>
                    <TableHead>R2</TableHead>
                    <TableHead>Estágio CRM</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((row) => (
                    <ClientTableRow key={row.key} row={row} />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
