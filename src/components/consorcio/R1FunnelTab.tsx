import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertTriangle, CalendarCheck, CheckCircle, Loader2, Search, Send, X, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { LeadCallButton } from '@/components/crm/LeadCallButton';
import { DealDetailsDrawer } from '@/components/crm/DealDetailsDrawer';
import { NoShowReasonPicker } from '@/components/crm/NoShowReasonPicker';
import { NoShowEvidenceDialog } from '@/components/crm/NoShowEvidenceDialog';
import { ProposalModal } from '@/components/consorcio/ProposalModal';
import { SemSucessoModal } from '@/components/consorcio/SemSucessoModal';
import {
  useConsorcioR1Funnel,
  r1StatusShortLabel,
  type R1FunnelParticipant,
} from '@/hooks/useConsorcioR1Funnel';
import { useProposals } from '@/hooks/useConsorcioPostMeeting';
import { useUpdateAttendeeAndSlotStatus } from '@/hooks/useAgendaData';
import { useAuth } from '@/contexts/AuthContext';
import { getReasonLabel, NO_REASON_LABEL } from '@/lib/meetingOutcomeReasons';
import { cn } from '@/lib/utils';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { TablePagination } from '@/components/ui/table-pagination';
import { useTableSortUrl } from '@/hooks/useTableSortUrl';
import { useDebounce } from '@/hooks/useDebounce';
import { ordenarPor } from '@/lib/ordenacaoTabela';

interface R1FunnelTabProps {
  mode: 'agendadas' | 'realizadas';
  range: { startDate?: Date; endDate?: Date };
  quickFilter?: 'sem-desfecho' | 'no-show' | null;
  onClearQuickFilter?: () => void;
}

const STATUS_STYLE: Record<string, string> = {
  OK: 'bg-primary/15 text-primary border-primary/40',
  NS: 'bg-destructive/15 text-destructive border-destructive/40',
  RE: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/40',
  Ag: 'bg-muted text-muted-foreground border-border',
};

const QUICK_FILTER_LABEL: Record<string, string> = {
  'sem-desfecho': 'Somente sem desfecho',
  'no-show': 'Somente no-show',
};

/** Ordem de processo: o que exige ação primeiro em `asc`. */
const RANK_STATUS: Record<string, number> = {
  scheduled: 1,
  no_show: 2,
  completed: 3,
  contract_paid: 4,
};

const R1_SORT_FIELDS = [
  'lead_name', 'lead_phone', 'scheduled_at', 'closer_name', 'status', 'outcome_reason', 'closer_notes',
] as const;
type R1SortField = (typeof R1_SORT_FIELDS)[number];

const R1_EXTRATORES: Record<R1SortField, (p: R1FunnelParticipant) => unknown> = {
  lead_name: (p) => p.lead_name,
  lead_phone: (p) => p.lead_phone,
  scheduled_at: (p) => (p.scheduled_at ? new Date(p.scheduled_at) : null),
  closer_name: (p) => p.closer_name,
  // "sem desfecho" no topo em asc — são as linhas que pedem ação.
  status: (p) => (p.sem_desfecho ? 0 : RANK_STATUS[p.status] ?? 9),
  outcome_reason: (p) => getReasonLabel(p.outcome_reason) || '',
  closer_notes: (p) => p.closer_notes || p.notes || '',
};

export function R1FunnelTab({ mode, range, quickFilter = null, onClearQuickFilter }: R1FunnelTabProps) {
  const { data, isLoading } = useConsorcioR1Funnel(range);
  const { data: proposals = [] } = useProposals();
  const { role } = useAuth();
  const updateStatus = useUpdateAttendeeAndSlotStatus();
  const [closerFilter, setCloserFilter] = useState('all');
  const { field, dir, toggle, q, setQ } = useTableSortUrl<R1SortField>({
    campos: R1_SORT_FIELDS,
    inicial: { field: 'scheduled_at', dir: 'desc' },
    // Abas distintas (Agendadas/Realizadas) não podem compartilhar ?ord/?dir/?q.
    sufixo: mode === 'realizadas' ? 'Re' : 'Ag',
  });
  const [search, setSearch] = useState(q);
  const buscaAplicada = useDebounce(search, 300);
  useEffect(() => { setQ(buscaAplicada); /* eslint-disable-next-line */ }, [buscaAplicada]);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [proposalTarget, setProposalTarget] = useState<R1FunnelParticipant | null>(null);
  const [semSucessoTarget, setSemSucessoTarget] = useState<R1FunnelParticipant | null>(null);
  const [evidenceTarget, setEvidenceTarget] = useState<
    { p: R1FunnelParticipant; reason: string; note?: string } | null
  >(null);

  // SDRs mantêm o fluxo de evidência + IA; closers/liderança marcam direto.
  const requiresEvidence = role === 'sdr';

  const dealsWithProposal = useMemo(
    () => new Set((proposals || []).map((p: any) => p.deal_id).filter(Boolean)),
    [proposals],
  );

  const base = useMemo(() => {
    const all = data?.participants || [];
    if (mode === 'realizadas') return all.filter(p => p.status === 'completed');
    if (quickFilter === 'sem-desfecho') return all.filter(p => p.sem_desfecho);
    if (quickFilter === 'no-show') return all.filter(p => p.status === 'no_show');
    return all;
  }, [data, mode, quickFilter]);

  const closerOptions = useMemo(
    () => [...new Set(base.map(p => p.closer_name).filter(Boolean))].sort(),
    [base],
  );

  const filtradas = useMemo(() => {
    const term = buscaAplicada.trim().toLowerCase();
    return base.filter(p => {
      if (closerFilter !== 'all' && p.closer_name !== closerFilter) return false;
      if (term) {
        const hay = `${p.lead_name} ${p.lead_phone} ${p.closer_name || ''}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [base, buscaAplicada, closerFilter]);

  // Ordem: filtrar → buscar → ordenar → paginar.
  const rows = useMemo(
    () => ordenarPor(filtradas, R1_EXTRATORES[field], dir),
    [filtradas, field, dir],
  );

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = useMemo(
    () => rows.slice(safePage * pageSize, (safePage + 1) * pageSize),
    [rows, safePage, pageSize],
  );
  useEffect(() => { setPage(0); }, [field, dir, buscaAplicada, closerFilter, pageSize, mode, quickFilter]);

  // Quebra por motivo dos no-shows do período (só quando o filtro está ativo)
  const reasonBreakdown = useMemo(() => {
    if (quickFilter !== 'no-show') return [];
    const counts = new Map<string, number>();
    for (const p of rows) {
      const key = p.outcome_reason || '__none__';
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return [...counts.entries()]
      .map(([code, n]) => ({
        label: code === '__none__' ? NO_REASON_LABEL : getReasonLabel(code) || code,
        n,
        none: code === '__none__',
      }))
      .sort((a, b) => b.n - a.n);
  }, [rows, quickFilter]);

  const shouldSyncSlot = (p: R1FunnelParticipant, status: string) =>
    ['completed', 'contract_paid'].includes(status) && !p.is_partner && !p.parent_attendee_id;

  const applyStatus = (
    p: R1FunnelParticipant,
    status: string,
    outcome?: { reason: string; note?: string },
  ) => {
    updateStatus.mutate({
      attendeeId: p.id,
      status,
      meetingId: p.meeting_slot_id,
      syncSlot: shouldSyncSlot(p, status),
      meetingType: 'r1',
      outcomeReason: outcome?.reason,
      outcomeReasonNote: outcome?.note,
    });
  };

  const handleNoShow = (p: R1FunnelParticipant, payload: { reason: string; note?: string }) => {
    if (requiresEvidence) {
      setEvidenceTarget({ p, reason: payload.reason, note: payload.note });
      return;
    }
    applyStatus(p, 'no_show', payload);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const showActions = mode === 'agendadas';

  return (
    <TooltipProvider delayDuration={150}>
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-base">
            {mode === 'realizadas' ? 'R1 Realizadas' : 'R1 Agendadas'} ({rows.length})
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-60">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar nome, telefone ou closer..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <Select value={closerFilter} onValueChange={setCloserFilter}>
              <SelectTrigger className="h-9 w-48"><SelectValue placeholder="Closer" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Closers</SelectItem>
                {closerOptions.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {mode === 'agendadas' && quickFilter && (
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className={cn(
                  'gap-1 py-1',
                  quickFilter === 'sem-desfecho'
                    ? 'border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                    : 'border-destructive/40 bg-destructive/10 text-destructive',
                )}
              >
                {QUICK_FILTER_LABEL[quickFilter]}
                <button
                  type="button"
                  onClick={() => onClearQuickFilter?.()}
                  aria-label="Remover filtro"
                  className="ml-1 rounded-full p-0.5 hover:bg-background/60"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            </div>
          )}

          {quickFilter === 'no-show' && reasonBreakdown.length > 0 && (
            <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              {reasonBreakdown.map((r, i) => (
                <span key={r.label} className="flex items-center gap-2">
                  {i > 0 && <span className="text-muted-foreground/50">·</span>}
                  <span className={cn(r.none && 'italic text-amber-600 dark:text-amber-400')}>
                    {r.label} <strong className="tabular-nums text-foreground">{r.n}</strong>
                  </span>
                </span>
              ))}
            </div>
          )}

          {rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhuma reunião no período selecionado.
            </p>
          ) : (
            <FilaDuasListas
              pendentes={pendentes}
              tratadas={tratadas}
              tituloPendentes={
                mode === 'realizadas'
                  ? `Pendentes — sem desfecho comercial (${pendentes.length})`
                  : `Pendentes — reunião passou sem desfecho (${pendentes.length})`
              }
              tituloTratadas={
                mode === 'realizadas'
                  ? `Tratadas — venda lançada ou sem sucesso (${tratadas.length})`
                  : `Tratadas — realizada, no-show ou remarcada (${tratadas.length})`
              }
              descricaoPendentes="do mais parado para o mais recente"
              vazioPendentes={
                mode === 'realizadas'
                  ? 'Toda reunião realizada do período já teve desfecho comercial.'
                  : 'Nenhuma reunião do período ficou sem desfecho.'
              }
              renderTabela={renderTabela}
            />
          )}


          {proposalTarget?.deal_id && (
            <ProposalModal
              open={!!proposalTarget}
              onOpenChange={o => !o && setProposalTarget(null)}
              dealId={proposalTarget.deal_id}
              dealName={proposalTarget.lead_name}
              contactName={proposalTarget.lead_name}
              originId={''}
            />
          )}
          {semSucessoTarget?.deal_id && (
            <SemSucessoModal
              open={!!semSucessoTarget}
              onOpenChange={o => !o && setSemSucessoTarget(null)}
              dealId={semSucessoTarget.deal_id}
              dealName={semSucessoTarget.lead_name}
              contactName={semSucessoTarget.lead_name}
              originId={''}
            />
          )}

          {evidenceTarget && (
            <NoShowEvidenceDialog
              open={!!evidenceTarget}
              onOpenChange={o => !o && setEvidenceTarget(null)}
              leadPhone={evidenceTarget.p.lead_phone}
              leadName={evidenceTarget.p.lead_name}
              dealId={evidenceTarget.p.deal_id}
              meetingSlotId={evidenceTarget.p.meeting_slot_id}
              attendeeId={evidenceTarget.p.id}
              meetingScheduledAt={evidenceTarget.p.scheduled_at}
              performedByRole={role}
              meetingType="R1"
              confirmLoading={updateStatus.isPending}
              onConfirm={() => {
                applyStatus(evidenceTarget.p, 'no_show', {
                  reason: evidenceTarget.reason,
                  note: evidenceTarget.note,
                });
                setEvidenceTarget(null);
              }}
            />
          )}

          <DealDetailsDrawer
            dealId={selectedDealId}
            open={!!selectedDealId}
            onOpenChange={o => !o && setSelectedDealId(null)}
          />
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
