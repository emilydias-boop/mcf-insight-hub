import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Loader2, Search, Send, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { LeadCallButton } from '@/components/crm/LeadCallButton';
import { DealDetailsDrawer } from '@/components/crm/DealDetailsDrawer';
import { ProposalModal } from '@/components/consorcio/ProposalModal';
import { SemSucessoModal } from '@/components/consorcio/SemSucessoModal';
import {
  useConsorcioR1Funnel,
  r1StatusShortLabel,
  type R1FunnelParticipant,
} from '@/hooks/useConsorcioR1Funnel';
import { useProposals } from '@/hooks/useConsorcioPostMeeting';
import { cn } from '@/lib/utils';

interface R1FunnelTabProps {
  mode: 'agendadas' | 'realizadas';
  range: { startDate?: Date; endDate?: Date };
}

const STATUS_STYLE: Record<string, string> = {
  OK: 'bg-primary/15 text-primary border-primary/40',
  NS: 'bg-destructive/15 text-destructive border-destructive/40',
  RE: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/40',
  Ag: 'bg-muted text-muted-foreground border-border',
};

export function R1FunnelTab({ mode, range }: R1FunnelTabProps) {
  const { data, isLoading } = useConsorcioR1Funnel(range);
  const { data: proposals = [] } = useProposals();
  const [search, setSearch] = useState('');
  const [closerFilter, setCloserFilter] = useState('all');
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [proposalTarget, setProposalTarget] = useState<R1FunnelParticipant | null>(null);
  const [semSucessoTarget, setSemSucessoTarget] = useState<R1FunnelParticipant | null>(null);

  const dealsWithProposal = useMemo(
    () => new Set((proposals || []).map((p: any) => p.deal_id).filter(Boolean)),
    [proposals],
  );

  const base = useMemo(() => {
    const all = data?.participants || [];
    return mode === 'realizadas' ? all.filter(p => p.status === 'completed') : all;
  }, [data, mode]);

  const closerOptions = useMemo(
    () => [...new Set(base.map(p => p.closer_name).filter(Boolean))].sort(),
    [base],
  );

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return base.filter(p => {
      if (closerFilter !== 'all' && p.closer_name !== closerFilter) return false;
      if (term) {
        const hay = `${p.lead_name} ${p.lead_phone}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [base, search, closerFilter]);

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
            {mode === 'realizadas' ? 'R1 Realizadas' : 'R1 Agendadas'} ({rows.length})
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-60">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar nome ou telefone..."
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
          {rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhuma reunião no período selecionado.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lead</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Data / Hora</TableHead>
                    <TableHead>Closer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Nota do Closer</TableHead>
                    {mode === 'realizadas' && <TableHead className="text-right">Ações</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(p => {
                    const short = r1StatusShortLabel(p.status);
                    const jaTemCarta = p.deal_id ? dealsWithProposal.has(p.deal_id) : false;
                    return (
                      <TableRow
                        key={p.id}
                        className={cn(p.deal_id && 'cursor-pointer', p.sem_desfecho && 'bg-amber-500/5')}
                        onClick={() => p.deal_id && setSelectedDealId(p.deal_id)}
                      >
                        <TableCell className="font-medium">{p.lead_name}</TableCell>
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
                        <TableCell className="max-w-[280px] text-xs text-muted-foreground">
                          {p.closer_notes || p.notes || '—'}
                        </TableCell>
                        {mode === 'realizadas' && (
                          <TableCell className="space-x-2 text-right" onClick={e => e.stopPropagation()}>
                            {p.deal_id ? (
                              <>
                                <Button size="sm" disabled={jaTemCarta} onClick={() => setProposalTarget(p)}>
                                  <Send className="mr-1 h-3 w-3" /> Lançar Carta
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
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
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
