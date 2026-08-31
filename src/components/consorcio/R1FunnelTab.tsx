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
import { useProposals, useSemSucesso } from '@/hooks/useConsorcioPostMeeting';
import { useUpdateAttendeeAndSlotStatus } from '@/hooks/useAgendaData';
import { useAuth } from '@/contexts/AuthContext';
import { getReasonLabel, NO_REASON_LABEL } from '@/lib/meetingOutcomeReasons';
import { cn } from '@/lib/utils';
import { CONSORCIO_LABELS } from '@/lib/consorcioLabels';
import { FilaDuasListas } from '@/components/consorcio/FilaDuasListas';
import { SeloDiasParados } from '@/components/consorcio/SeloDiasParados';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
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
  const { data: semSucesso = [] } = useSemSucesso();

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
  // Paginação agora é por seção (pendentes / tratadas), dentro de FilaDuasListas.

  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [proposalTarget, setProposalTarget] = useState<R1FunnelParticipant | null>(null);
  const [semSucessoTarget, setSemSucessoTarget] = useState<R1FunnelParticipant | null>(null);
  const [evidenceTarget, setEvidenceTarget] = useState<
    { p: R1FunnelParticipant; reason: string; note?: string } | null
  >(null);

  // SDRs mantêm o fluxo de evidência + IA; closers/liderança marcam direto.
  const requiresEvidence = role === 'sdr';

  /**
   * Propostas que ainda "ocupam" o deal. Decisão do dono: proposta com
   * desistência da carta (`carta_excluida`) deixa de ocupar — o lead volta a
   * Pendentes e pode receber uma nova venda. O rastro antigo continua visível
   * em "Tratados" (aba de Termos), nada é escondido nem alterado.
   */
  const dealsWithProposal = useMemo(
    () =>
      new Set(
        (proposals || [])
          .filter((p: any) => p?.carta_excluida !== true)
          .map((p: any) => p.deal_id)
          .filter(Boolean),
      ),
    [proposals],
  );

  /** Deals que já tiveram uma venda lançada e desistiram da carta — só informativo. */
  const dealsComDesistencia = useMemo(
    () =>
      new Set(
        (proposals || [])
          .filter((p: any) => p?.carta_excluida === true)
          .map((p: any) => p.deal_id)
          .filter(Boolean),
      ),
    [proposals],
  );


  /** Negócios já marcados como "sem sucesso" — desfecho comercial da etapa 2. */
  const dealsSemSucesso = useMemo(
    () => new Set((semSucesso || []).map((d) => d.deal_id).filter(Boolean)),
    [semSucesso],
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

  /**
   * Duas listas: pendentes (o trabalho) antes de tratadas.
   *  - Etapa 1: pendente = reunião passou e continua sem desfecho.
   *  - Etapa 2: pendente = realizada e sem desfecho comercial (nem venda
   *    lançada, nem "sem sucesso").
   * Pendentes sempre do mais parado para o mais recente, ignorando a ordenação
   * de coluna — a fila tem que se auto-priorizar.
   */
  const ehPendente = (p: R1FunnelParticipant) =>
    mode === 'realizadas'
      ? !(p.deal_id && (dealsWithProposal.has(p.deal_id) || dealsSemSucesso.has(p.deal_id)))
      : p.sem_desfecho;

  const pendentes = useMemo(
    () =>
      rows
        .filter(ehPendente)
        .slice()
        .sort((a, b) => (a.scheduled_at || '').localeCompare(b.scheduled_at || '')),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, mode, dealsWithProposal, dealsSemSucesso],
  );
  const tratadas = useMemo(
    () => rows.filter((p) => !ehPendente(p)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, mode, dealsWithProposal, dealsSemSucesso],
  );


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

  const showActions = mode === 'agendadas';

  /** Uma única tabela, reaproveitada nas duas seções da fila. */
  const renderTabela = (linhas: R1FunnelParticipant[]) => (
    <Table>
      <TableHeader>
        <TableRow>
          <SortableTableHead field="lead_name" active={field} dir={dir} onSort={toggle}>Lead</SortableTableHead>
          <SortableTableHead field="lead_phone" active={field} dir={dir} onSort={toggle}>Telefone</SortableTableHead>
          <SortableTableHead field="scheduled_at" active={field} dir={dir} onSort={toggle}>Data / Hora</SortableTableHead>
          <SortableTableHead field="closer_name" active={field} dir={dir} onSort={toggle}>Closer</SortableTableHead>
          <SortableTableHead field="status" active={field} dir={dir} onSort={toggle}>Status</SortableTableHead>
          <SortableTableHead field="outcome_reason" active={field} dir={dir} onSort={toggle}>Motivo</SortableTableHead>
          <SortableTableHead field="closer_notes" active={field} dir={dir} onSort={toggle}>Nota do Closer</SortableTableHead>
          {(mode === 'realizadas' || showActions) && (
            <TableHead className="text-right">Ações</TableHead>
          )}
        </TableRow>
      </TableHeader>
      <TableBody>
        {linhas.map(p => {
          const short = r1StatusShortLabel(p.status);
          const jaTemCarta = p.deal_id ? dealsWithProposal.has(p.deal_id) : false;
          const houveDesistencia =
            !jaTemCarta && p.deal_id ? dealsComDesistencia.has(p.deal_id) : false;
          const reasonLabel = getReasonLabel(p.outcome_reason);
          return (
            <TableRow
              key={p.id}
              className={cn(p.deal_id && 'cursor-pointer', p.sem_desfecho && 'bg-amber-500/5')}
              onClick={() => p.deal_id && setSelectedDealId(p.deal_id)}
            >
              <TableCell className="font-medium">
                <div className="flex flex-col items-start gap-1">
                  <span>{p.lead_name}</span>
                  {ehPendente(p) && (
                    <SeloDiasParados
                      desde={p.scheduled_at}
                      motivo={
                        mode === 'realizadas'
                          ? 'Dias desde a reunião realizada sem desfecho comercial (nem venda lançada, nem "sem sucesso"). Âmbar de 2 a 5 dias, vermelho a partir de 6.'
                          : 'Dias desde o horário da reunião sem nenhum desfecho registrado. Âmbar de 2 a 5 dias, vermelho a partir de 6.'
                      }
                    />
                  )}
                  {houveDesistencia && (
                    <span className="text-[10px] text-muted-foreground">
                      venda anterior com desistência
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground" onClick={e => e.stopPropagation()}>
                <div className="flex items-center gap-1">
                  <span>{p.lead_phone || '—'}</span>
                  <LeadCallButton phone={p.lead_phone} dealId={p.deal_id || undefined} />
                </div>
              </TableCell>
              <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                {p.scheduled_at
                  ? format(new Date(p.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                  : '—'}
              </TableCell>
              <TableCell className="text-sm">{p.closer_name}</TableCell>
              <TableCell>
                <div className="flex flex-col items-start gap-1">
                  <Badge variant="outline" className={cn('text-xs', STATUS_STYLE[short])}>
                    {short}
                  </Badge>
                  {p.sem_desfecho && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge
                          variant="outline"
                          className="cursor-help border-amber-500/50 bg-amber-500/10 text-[10px] text-amber-600 dark:text-amber-400"
                        >
                          sem desfecho
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-[240px]">
                        <p className="text-xs">
                          Reunião já passou e continua sem status — não entra em realizadas
                          nem em no-show.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-xs">
                {reasonLabel ? (
                  p.outcome_reason_note ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help underline decoration-dotted">
                          {reasonLabel}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-[260px]">
                        <p className="text-xs">{p.outcome_reason_note}</p>
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <span>{reasonLabel}</span>
                  )
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="max-w-[280px] text-xs text-muted-foreground">
                {p.closer_notes || p.notes || '—'}
              </TableCell>
              {mode === 'realizadas' && (
                <TableCell className="space-x-2 text-right" onClick={e => e.stopPropagation()}>
                  {p.deal_id ? (
                    <>
                      <Button size="sm" disabled={jaTemCarta} onClick={() => setProposalTarget(p)}>
                        <Send className="mr-1 h-3 w-3" /> {CONSORCIO_LABELS.lancarVenda}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={jaTemCarta}
                        onClick={() => setSemSucessoTarget(p)}
                      >
                        <XCircle className="mr-1 h-3 w-3" /> Sem Sucesso
                      </Button>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">sem negócio vinculado</span>
                  )}
                </TableCell>
              )}
              {showActions && (
                <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 border-primary/40 text-primary hover:bg-primary/10"
                          disabled={updateStatus.isPending || p.status === 'completed'}
                          onClick={() => applyStatus(p, 'completed')}
                        >
                          <CheckCircle className="mr-1 h-3 w-3" /> Realizada
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-[280px]">
                        <p className="text-xs">
                          Marcar como Realizada muda o estágio do negócio no CRM
                          <strong> e transfere a titularidade do negócio para o closer</strong>.
                        </p>
                      </TooltipContent>
                    </Tooltip>

                    <NoShowReasonPicker
                      loading={updateStatus.isPending}
                      onConfirm={payload => handleNoShow(p, payload)}
                    >
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 border-amber-500/40 text-amber-600 hover:bg-amber-500/10 dark:text-amber-400"
                        disabled={updateStatus.isPending || p.status === 'no_show'}
                      >
                        <AlertTriangle className="mr-1 h-3 w-3" />
                        {p.status === 'no_show' ? 'No-Show ✓' : 'No-Show'}
                      </Button>
                    </NoShowReasonPicker>

                    {p.status !== 'scheduled' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-muted-foreground"
                        disabled={updateStatus.isPending}
                        onClick={() => applyStatus(p, 'scheduled')}
                      >
                        <CalendarCheck className="mr-1 h-3 w-3" /> Voltar p/ Agendada
                      </Button>
                    )}
                  </div>
                </TableCell>
              )}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );


  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }



  return (
    <TooltipProvider delayDuration={150}>
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-base">
            {mode === 'realizadas' ? CONSORCIO_LABELS.reunioesRealizadas : CONSORCIO_LABELS.reunioesAgendadas} ({rows.length})
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
