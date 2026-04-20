import { useState, useMemo } from "react";
import { format, addWeeks, subWeeks, addDays, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, ChevronDown, Download, Search, Loader2, PackagePlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useContractLifecycleReport, ContractLifecycleRow, ContractSituacao, PendingReason } from "@/hooks/useContractLifecycleReport";
import { DealDetailsDrawer } from "./DealDetailsDrawer";
import { getCartWeekStart, getCartWeekEnd } from "@/lib/carrinhoWeekBoundaries";
import { useEncaixarNoCarrinho } from "@/hooks/useEncaixarNoCarrinho";

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—';
  try {
    return format(new Date(dateStr), 'dd/MM/yy', { locale: ptBR });
  } catch { return '—'; }
}

function R2StatusBadge({ name, color }: { name: string | null; color: string | null }) {
  if (!name) return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <Badge
      variant="outline"
      className="text-xs whitespace-nowrap"
      style={{
        backgroundColor: color ? `${color}20` : undefined,
        color: color || undefined,
        borderColor: color ? `${color}50` : undefined,
      }}
    >
      {name}
    </Badge>
  );
}

const SITUACAO_STYLES: Record<ContractSituacao, { bg: string; text: string; border: string }> = {
  reembolso:      { bg: 'bg-red-500/15',    text: 'text-red-400',    border: 'border-red-500/30' },
  no_show:        { bg: 'bg-red-900/20',     text: 'text-red-300',    border: 'border-red-800/30' },
  desistente:     { bg: 'bg-zinc-500/15',    text: 'text-zinc-400',   border: 'border-zinc-500/30' },
  realizada:      { bg: 'bg-emerald-500/15', text: 'text-emerald-400',border: 'border-emerald-500/30' },
  proxima_semana: { bg: 'bg-green-500/15',   text: 'text-green-400',  border: 'border-green-500/30' },
  agendado:       { bg: 'bg-blue-500/15',    text: 'text-blue-400',   border: 'border-blue-500/30' },
  pre_agendado:   { bg: 'bg-purple-500/15',  text: 'text-purple-400', border: 'border-purple-500/30' },
  pendente:       { bg: 'bg-amber-500/15',   text: 'text-amber-400',  border: 'border-amber-500/30' },
};

function SituacaoBadge({ situacao, label }: { situacao: ContractSituacao; label: string }) {
  const style = SITUACAO_STYLES[situacao];
  return (
    <Badge variant="outline" className={cn("text-xs whitespace-nowrap", style.bg, style.text, style.border)}>
      {label}
    </Badge>
  );
}

const PENDING_REASON_LABELS: Record<Exclude<PendingReason, null>, { label: string; bg: string; text: string; border: string }> = {
  r2_proxima_semana:  { label: '📅 R2 próx. semana', bg: 'bg-blue-500/15',    text: 'text-blue-300',    border: 'border-blue-500/30' },
  aguardando_r2:      { label: '⏳ Aguardando R2',   bg: 'bg-amber-500/15',   text: 'text-amber-300',   border: 'border-amber-500/30' },
  r2_outro_deal:      { label: '🔀 R2 em outro deal', bg: 'bg-emerald-500/15', text: 'text-emerald-300', border: 'border-emerald-500/30' },
  reembolso_recente:  { label: '💸 Reembolso recente', bg: 'bg-red-500/15',   text: 'text-red-300',     border: 'border-red-500/30' },
  outside_legitimo:   { label: '🚪 Outside (s/ R1)', bg: 'bg-zinc-500/15',    text: 'text-zinc-300',    border: 'border-zinc-500/30' },
};

function PendingReasonBadge({ reason, futureDate }: { reason: PendingReason; futureDate?: string | null }) {
  if (!reason) return <span className="text-muted-foreground text-xs">—</span>;
  const style = PENDING_REASON_LABELS[reason];
  const dateSuffix = reason === 'r2_proxima_semana' && futureDate
    ? ` ${format(new Date(futureDate), 'dd/MM', { locale: ptBR })}`
    : '';
  return (
    <Badge variant="outline" className={cn("text-xs whitespace-nowrap", style.bg, style.text, style.border)}>
      {style.label}{dateSuffix}
    </Badge>
  );
}

function formatPhone(phone: string | null) {
  if (!phone) return '—';
  const clean = phone.replace(/\D/g, '');
  if (clean.length === 13) return `+${clean.slice(0,2)} (${clean.slice(2,4)}) ${clean.slice(4,9)}-${clean.slice(9)}`;
  if (clean.length === 11) return `(${clean.slice(0,2)}) ${clean.slice(2,7)}-${clean.slice(7)}`;
  return phone;
}

// Parent KPI filter map
const PARENT_SITUACOES: Record<string, ContractSituacao[]> = {
  realizadas: ['realizada'],
  agendados: ['agendado', 'proxima_semana'],
  pre_agendado: ['pre_agendado'],
  pendentes: ['pendente'],
  noShow: ['no_show'],
  reembolso: ['reembolso'],
};

// Parents that have children
const EXPANDABLE_PARENTS = ['realizadas', 'agendados', 'pendentes'];

export function R2ContractLifecyclePanel() {
  const [weekDate, setWeekDate] = useState<Date>(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [expandedKpi, setExpandedKpi] = useState<string | null>(null);
  const [activeSubFilter, setActiveSubFilter] = useState<string | null>(null);
  const [encaixandoId, setEncaixandoId] = useState<string | null>(null);
  const encaixarMutation = useEncaixarNoCarrinho();

  const safraStart = useMemo(() => getCartWeekStart(weekDate), [weekDate]);
  const safraEnd = useMemo(() => getCartWeekEnd(weekDate), [weekDate]);
  const carrinhoFriday = useMemo(() => addDays(safraStart, 8), [safraStart]);

  const filters = useMemo(() => ({
    startDate: safraStart,
    endDate: safraEnd,
    weekStart: safraStart,
  }), [safraStart, safraEnd]);

  const { data: rows, isLoading } = useContractLifecycleReport(filters);

  // KPI counts
  const kpis = useMemo(() => {
    if (!rows) return { total: 0, realizadas: 0, agendados: 0, preAgendado: 0, pendentes: 0, noShow: 0, reembolso: 0 };
    return {
      total: rows.filter(r => r.isPaidContract).length,
      realizadas: rows.filter(r => r.situacao === 'realizada').length,
      agendados: rows.filter(r => ['agendado', 'proxima_semana'].includes(r.situacao)).length,
      preAgendado: rows.filter(r => r.situacao === 'pre_agendado').length,
      pendentes: rows.filter(r => r.situacao === 'pendente').length,
      noShow: rows.filter(r => r.situacao === 'no_show').length,
      reembolso: rows.filter(r => r.situacao === 'reembolso').length,
    };
  }, [rows]);

  // Realizadas children: dynamic by r2StatusName (only completed/contract_paid)
  // Leads whose R2 belongs to a different week are bucketed as "Outra semana"
  const currentWeekStartStr = useMemo(() => format(safraStart, 'yyyy-MM-dd'), [safraStart]);

  const realizadasChildren = useMemo(() => {
    if (!rows) return [];
    const map = new Map<string, { count: number; color: string | null; key: string }>();
    rows.filter(r => r.situacao === 'realizada')
      .forEach(r => {
        const cws = r.carrinhoWeekStart;
        const isOtherWeek = cws && cws !== currentWeekStartStr;
        const statusName = r.r2StatusName || 'Sem status';
        const isAprovado = statusName.toLowerCase().includes('aprovado') || statusName.toLowerCase().includes('approved');

        let displayName: string;
        let key: string;
        let color: string | null;

        if (isOtherWeek) {
          displayName = 'Outra semana';
          key = '__other_week__';
          color = null;
        } else if (isAprovado && !r.dentroCorte) {
          displayName = 'Aprovado — Próxima Safra';
          key = '__aprovado_fora__';
          color = r.r2StatusColor || null;
        } else {
          displayName = statusName;
          key = `status:${statusName}`;
          color = r.r2StatusColor || null;
        }

        const existing = map.get(key) || { count: 0, color, key: displayName };
        map.set(key, { count: existing.count + 1, color: existing.color, key: displayName });
      });
    return Array.from(map.entries())
      .map(([k, v]) => [v.key, { count: v.count, color: v.color, filterKey: k }] as const)
      .sort((a, b) => b[1].count - a[1].count);
  }, [rows, currentWeekStartStr]);

  // Agendados children: dynamic by r2StatusName (invited/scheduled)
  const agendadosChildren = useMemo(() => {
    if (!rows) return [];
    const map = new Map<string, { count: number; color: string | null }>();
    rows.filter(r => ['agendado', 'proxima_semana'].includes(r.situacao))
      .forEach(r => {
        const key = r.r2StatusName || 'Sem status';
        const existing = map.get(key) || { count: 0, color: r.r2StatusColor || null };
        map.set(key, { count: existing.count + 1, color: existing.color });
      });
    return Array.from(map.entries()).sort((a, b) => b[1].count - a[1].count);
  }, [rows]);

  // Pendentes children: recentes vs antigos
  const pendentesChildren = useMemo(() => {
    if (!rows) return { recentes: 0, antigos: 0, proximaSafra: 0 };
    const pendentes = rows.filter(r => r.situacao === 'pendente');
    return {
      recentes: pendentes.filter(r => (r.diasParado ?? 0) <= 3).length,
      antigos: pendentes.filter(r => (r.diasParado ?? 0) > 3).length,
      proximaSafra: pendentes.filter(r => r.pendingReason === 'r2_proxima_semana').length,
    };
  }, [rows]);

  // Handle parent KPI click
  const handleParentClick = (key: string) => {
    if (EXPANDABLE_PARENTS.includes(key)) {
      if (expandedKpi === key) {
        setExpandedKpi(null);
        setActiveSubFilter(null);
      } else {
        setExpandedKpi(key);
        setActiveSubFilter(null);
      }
    } else {
      // No children — toggle direct filter
      setExpandedKpi(prev => prev === key ? null : key);
      setActiveSubFilter(null);
    }
  };

  const handleSubClick = (subKey: string) => {
    setActiveSubFilter(prev => prev === subKey ? null : subKey);
  };

  // Filtering logic
  const filteredRows = useMemo(() => {
    if (!rows) return [];
    let result = rows;

    // Apply parent filter
    if (expandedKpi && PARENT_SITUACOES[expandedKpi]) {
      result = result.filter(r => PARENT_SITUACOES[expandedKpi].includes(r.situacao));

      // Apply sub-filter
      if (activeSubFilter) {
        if (expandedKpi === 'realizadas') {
          if (activeSubFilter === '__other_week__') {
            result = result.filter(r => r.carrinhoWeekStart && r.carrinhoWeekStart !== currentWeekStartStr);
          } else if (activeSubFilter === '__aprovado_fora__') {
            result = result.filter(r => {
              const sn = (r.r2StatusName || '').toLowerCase();
              const isAprovado = sn.includes('aprovado') || sn.includes('approved');
              const sameWeek = !r.carrinhoWeekStart || r.carrinhoWeekStart === currentWeekStartStr;
              return isAprovado && sameWeek && !r.dentroCorte;
            });
          } else if (activeSubFilter.startsWith('status:')) {
            const statusName = activeSubFilter.slice('status:'.length);
            const isAprovadoFilter = statusName.toLowerCase().includes('aprovado') || statusName.toLowerCase().includes('approved');
            result = result.filter(r => {
              const sameWeek = !r.carrinhoWeekStart || r.carrinhoWeekStart === currentWeekStartStr;
              if (!sameWeek) return false;
              if ((r.r2StatusName || 'Sem status') !== statusName) return false;
              // For "Aprovado" status card, only include leads dentro_corte
              if (isAprovadoFilter && !r.dentroCorte) return false;
              return true;
            });
          }
        } else if (expandedKpi === 'agendados') {
          result = result.filter(r => (r.r2StatusName || 'Sem status') === activeSubFilter);
        } else if (expandedKpi === 'pendentes') {
          if (activeSubFilter === 'recentes') {
            result = result.filter(r => (r.diasParado ?? 0) <= 3);
          } else if (activeSubFilter === 'antigos') {
            result = result.filter(r => (r.diasParado ?? 0) > 3);
          } else if (activeSubFilter === 'proxima_safra') {
            result = result.filter(r => r.pendingReason === 'r2_proxima_semana');
          }
        }
      }
    }

    // Apply search
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(r =>
        (r.leadName || '').toLowerCase().includes(term) ||
        (r.phone || '').includes(term) ||
        (r.r1CloserName || '').toLowerCase().includes(term) ||
        (r.r2CloserName || '').toLowerCase().includes(term)
      );
    }
    return result;
  }, [rows, searchTerm, expandedKpi, activeSubFilter]);

  const handleRowClick = (row: ContractLifecycleRow) => {
    if (row.dealId) {
      setSelectedDealId(row.dealId);
      setDrawerOpen(true);
    }
  };

  const handleExportCSV = () => {
    if (!filteredRows.length) return;
    const headers = ['Lead', 'Telefone', 'Contrato Pago', 'Closer R1', 'R1 Data', 'R1 Status', 'Status', 'Motivo', 'R2 Data', 'Closer R2', 'R2 Status'];
    const csvRows = filteredRows.map(r => [
      r.leadName || '',
      r.phone || '',
      formatDate(r.contractPaidAt),
      r.r1CloserName || '',
      formatDate(r.r1Date),
      r.r1Status || '',
      r.situacaoLabel.replace(/^[^\w]*\s*/, ''),
      r.pendingReason ? PENDING_REASON_LABELS[r.pendingReason].label.replace(/^[^\w]*\s*/, '') : '',
      formatDate(r.r2Date || r.futureR2Date),
      r.r2CloserName || r.futureR2CloserName || '',
      r.r2StatusName || '',
    ]);
    const csv = [headers, ...csvRows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contratos-lifecycle-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const navigateWeek = (dir: number) => {
    setWeekDate(prev => dir > 0 ? addWeeks(prev, 1) : subWeeks(prev, 1));
  };

  const handleEncaixar = (row: ContractLifecycleRow, e: React.MouseEvent) => {
    e.stopPropagation();
    const attendeeId = row.futureR2AttendeeId || row.id;
    if (!attendeeId || attendeeId.startsWith('hubla-orphan-')) return;
    setEncaixandoId(row.id);
    encaixarMutation.mutate(
      { attendeeId, weekStart: safraStart },
      { onSettled: () => setEncaixandoId(null) },
    );
  };

  const isParentActive = (key: string) => expandedKpi === key;

  return (
    <div className="space-y-4">
      {/* Week Navigation */}
      <Card className="bg-card border-border">
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigateWeek(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="px-3 py-1.5 text-sm font-medium whitespace-nowrap">
                <span className="text-muted-foreground">Carrinho </span>
                <span className="text-foreground">Sex {format(carrinhoFriday, "dd/MM", { locale: ptBR })}</span>
                <span className="text-muted-foreground mx-1.5">—</span>
                <span className="text-muted-foreground">Safra: </span>
                <span className="text-foreground">
                  Qui {format(safraStart, "dd/MM", { locale: ptBR })} → Qua {format(safraEnd, "dd/MM", { locale: ptBR })}
                </span>
              </div>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigateWeek(1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" className="text-xs ml-1" onClick={() => setWeekDate(new Date())}>
                Hoje
              </Button>
            </div>

            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar lead, telefone, closer..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={!filteredRows.length}>
              <Download className="h-4 w-4 mr-1" />
              CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* KPIs - Parent Row */}
      <div className="space-y-2">
        <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
          {/* Total Pagos */}
          <Card
            className={cn(
              "bg-card border-border cursor-pointer transition-all hover:shadow-md",
              expandedKpi === null && "ring-2 ring-primary/50"
            )}
            onClick={() => { setExpandedKpi(null); setActiveSubFilter(null); }}
          >
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-xs text-muted-foreground">Total Pagos</p>
              <p className="text-2xl font-bold text-foreground">{kpis.total}</p>
            </CardContent>
          </Card>

          {/* Realizadas (expandable) */}
          <Card
            className={cn(
              "bg-card border-border cursor-pointer transition-all hover:shadow-md",
              isParentActive('realizadas') && "ring-2 ring-emerald-500/50"
            )}
            onClick={() => handleParentClick('realizadas')}
          >
            <CardContent className="pt-4 pb-3 text-center">
              <div className="flex items-center justify-center gap-1">
                <p className="text-xs text-muted-foreground">Realizadas</p>
                <ChevronDown className={cn(
                  "h-3 w-3 text-muted-foreground transition-transform",
                  isParentActive('realizadas') && "rotate-180"
                )} />
              </div>
              <p className="text-2xl font-bold text-emerald-400">{kpis.realizadas}</p>
            </CardContent>
          </Card>

          {/* Agendados (expandable) */}
          <Card
            className={cn(
              "bg-card border-border cursor-pointer transition-all hover:shadow-md",
              isParentActive('agendados') && "ring-2 ring-blue-500/50"
            )}
            onClick={() => handleParentClick('agendados')}
          >
            <CardContent className="pt-4 pb-3 text-center">
              <div className="flex items-center justify-center gap-1">
                <p className="text-xs text-muted-foreground">Agendados</p>
                <ChevronDown className={cn(
                  "h-3 w-3 text-muted-foreground transition-transform",
                  isParentActive('agendados') && "rotate-180"
                )} />
              </div>
              <p className="text-2xl font-bold text-blue-400">{kpis.agendados}</p>
            </CardContent>
          </Card>

          {/* Pré-agendado (no children) */}
          <Card
            className={cn(
              "bg-card border-border cursor-pointer transition-all hover:shadow-md",
              isParentActive('pre_agendado') && "ring-2 ring-purple-500/50"
            )}
            onClick={() => handleParentClick('pre_agendado')}
          >
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-xs text-muted-foreground">Pré-agendado</p>
              <p className="text-2xl font-bold text-purple-400">{kpis.preAgendado}</p>
            </CardContent>
          </Card>

          {/* Pendentes (expandable) */}
          <Card
            className={cn(
              "bg-card border-border cursor-pointer transition-all hover:shadow-md",
              isParentActive('pendentes') && "ring-2 ring-amber-500/50"
            )}
            onClick={() => handleParentClick('pendentes')}
          >
            <CardContent className="pt-4 pb-3 text-center">
              <div className="flex items-center justify-center gap-1">
                <p className="text-xs text-muted-foreground">Pendentes</p>
                <ChevronDown className={cn(
                  "h-3 w-3 text-muted-foreground transition-transform",
                  isParentActive('pendentes') && "rotate-180"
                )} />
              </div>
              <p className="text-2xl font-bold text-amber-400">{kpis.pendentes}</p>
            </CardContent>
          </Card>

          {/* No-show (no children) */}
          <Card
            className={cn(
              "bg-card border-border cursor-pointer transition-all hover:shadow-md",
              isParentActive('noShow') && "ring-2 ring-red-500/50"
            )}
            onClick={() => handleParentClick('noShow')}
          >
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-xs text-muted-foreground">No-show</p>
              <p className="text-2xl font-bold text-red-400">{kpis.noShow}</p>
            </CardContent>
          </Card>

          {/* Reembolso (no children) */}
          <Card
            className={cn(
              "bg-card border-border cursor-pointer transition-all hover:shadow-md",
              isParentActive('reembolso') && "ring-2 ring-red-400/50"
            )}
            onClick={() => handleParentClick('reembolso')}
          >
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-xs text-muted-foreground">Reembolso</p>
              <p className="text-2xl font-bold text-red-300">{kpis.reembolso}</p>
            </CardContent>
          </Card>
        </div>

        {/* Children Row - Realizadas */}
        <div className={cn(
          "overflow-hidden transition-all duration-300 ease-in-out",
          expandedKpi === 'realizadas' ? "max-h-[200px] opacity-100" : "max-h-0 opacity-0"
        )}>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 pt-1">
            {realizadasChildren.map(([statusName, { count, color, filterKey }]) => (
              <Card
                key={filterKey}
                className={cn(
                  "bg-muted/30 border-border cursor-pointer transition-all hover:shadow-sm",
                  activeSubFilter === filterKey && "ring-2 ring-emerald-500/50 bg-emerald-500/5"
                )}
                onClick={() => handleSubClick(filterKey)}
              >
                <CardContent className="py-2 px-3 text-center">
                  <p className="text-[10px] text-muted-foreground truncate">{statusName}</p>
                  <p
                    className="text-lg font-bold"
                    style={{ color: color || undefined }}
                  >
                    {count}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Children Row - Agendados */}
        <div className={cn(
          "overflow-hidden transition-all duration-300 ease-in-out",
          expandedKpi === 'agendados' ? "max-h-[200px] opacity-100" : "max-h-0 opacity-0"
        )}>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 pt-1">
            {agendadosChildren.map(([statusName, { count, color }]) => (
              <Card
                key={statusName}
                className={cn(
                  "bg-muted/30 border-border cursor-pointer transition-all hover:shadow-sm",
                  activeSubFilter === statusName && "ring-2 ring-blue-500/50 bg-blue-500/5"
                )}
                onClick={() => handleSubClick(statusName)}
              >
                <CardContent className="py-2 px-3 text-center">
                  <p className="text-[10px] text-muted-foreground truncate">{statusName}</p>
                  <p
                    className="text-lg font-bold"
                    style={{ color: color || undefined }}
                  >
                    {count}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Children Row - Pendentes */}
        <div className={cn(
          "overflow-hidden transition-all duration-300 ease-in-out",
          expandedKpi === 'pendentes' ? "max-h-[200px] opacity-100" : "max-h-0 opacity-0"
        )}>
          <div className="grid grid-cols-2 gap-2 max-w-xs pt-1">
            <Card
              className={cn(
                "bg-muted/30 border-border cursor-pointer transition-all hover:shadow-sm",
                activeSubFilter === 'recentes' && "ring-2 ring-amber-500/50 bg-amber-500/5"
              )}
              onClick={() => handleSubClick('recentes')}
            >
              <CardContent className="py-2 px-3 text-center">
                <p className="text-[10px] text-muted-foreground">Recentes (≤3d)</p>
                <p className="text-lg font-bold text-amber-300">{pendentesChildren.recentes}</p>
              </CardContent>
            </Card>
            <Card
              className={cn(
                "bg-muted/30 border-border cursor-pointer transition-all hover:shadow-sm",
                activeSubFilter === 'antigos' && "ring-2 ring-amber-500/50 bg-amber-500/5"
              )}
              onClick={() => handleSubClick('antigos')}
            >
              <CardContent className="py-2 px-3 text-center">
                <p className="text-[10px] text-muted-foreground">{"Antigos (>3d)"}</p>
                <p className="text-lg font-bold text-amber-600">{pendentesChildren.antigos}</p>
              </CardContent>
            </Card>
            <Card
              className={cn(
                "bg-muted/30 border-border cursor-pointer transition-all hover:shadow-sm",
                activeSubFilter === 'proxima_safra' && "ring-2 ring-amber-500/50 bg-amber-500/5"
              )}
              onClick={() => handleSubClick('proxima_safra')}
            >
              <CardContent className="py-2 px-3 text-center">
                <p className="text-[10px] text-muted-foreground">📦 Próxima Safra</p>
                <p className="text-lg font-bold text-amber-400">{pendentesChildren.proximaSafra}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Table */}
      <Card className="bg-card border-border">
        <CardContent className="pt-4 p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Nenhum contrato pago encontrado no período
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Lead</TableHead>
                    <TableHead className="whitespace-nowrap">Telefone</TableHead>
                    <TableHead className="whitespace-nowrap">Contrato Pago</TableHead>
                    <TableHead className="whitespace-nowrap">Closer R1</TableHead>
                    <TableHead className="whitespace-nowrap">R1 Data</TableHead>
                    <TableHead className="whitespace-nowrap">Status</TableHead>
                    <TableHead className="whitespace-nowrap">Motivo</TableHead>
                    <TableHead className="whitespace-nowrap">R2 Data</TableHead>
                    <TableHead className="whitespace-nowrap">Closer R2</TableHead>
                    <TableHead className="whitespace-nowrap">R2 Status</TableHead>
                    {expandedKpi === 'pendentes' && activeSubFilter === 'proxima_safra' && (
                      <TableHead className="whitespace-nowrap text-right">Ação</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.map(row => (
                    <TableRow
                      key={row.id}
                      onClick={() => handleRowClick(row)}
                      className={cn(row.dealId ? "cursor-pointer hover:bg-muted/70" : "")}
                    >
                      <TableCell className="font-medium whitespace-nowrap max-w-[180px] truncate">
                        {row.leadName || '—'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatPhone(row.phone)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">{formatDate(row.contractPaidAt)}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs">{row.r1CloserName || '—'}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs">{formatDate(row.r1Date)}</TableCell>
                      <TableCell>
                        <SituacaoBadge situacao={row.situacao} label={row.situacaoLabel} />
                      </TableCell>
                      <TableCell>
                        {row.situacao === 'pendente'
                          ? <PendingReasonBadge reason={row.pendingReason} futureDate={row.futureR2Date} />
                          : <span className="text-muted-foreground text-xs">—</span>
                        }
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        {row.hasR2 ? formatDate(row.r2Date) : (row.futureR2Date ? formatDate(row.futureR2Date) : <span className="text-muted-foreground">—</span>)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">{row.r2CloserName || row.futureR2CloserName || '—'}</TableCell>
                      <TableCell><R2StatusBadge name={row.r2StatusName} color={row.r2StatusColor} /></TableCell>
                      {expandedKpi === 'pendentes' && activeSubFilter === 'proxima_safra' && (
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 border-amber-500/40 text-amber-600 hover:bg-amber-500/10"
                            disabled={encaixandoId === row.id || !row.futureR2AttendeeId}
                            onClick={(e) => handleEncaixar(row, e)}
                          >
                            {encaixandoId === row.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <PackagePlus className="h-4 w-4 mr-1" />
                                <span className="text-xs">Encaixar</span>
                              </>
                            )}
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Deal Details Drawer */}
      <DealDetailsDrawer
        dealId={selectedDealId}
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open);
          if (!open) setSelectedDealId(null);
        }}
      />
    </div>
  );
}
