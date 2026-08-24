import React, { useState, useMemo, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { XCircle, CheckCircle, FileText, Loader2, Search, Download, Trash2, Pencil, Plus } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { loadXLSX } from '@/lib/lazyExport';
import { ProposalModal } from '@/components/consorcio/ProposalModal';
import { AddCartaModal } from '@/components/consorcio/AddCartaModal';

import { SemSucessoModal } from '@/components/consorcio/SemSucessoModal';
import { AcceptProposalModal } from '@/components/consorcio/AcceptProposalModal';
import { EditProposalModal } from '@/components/consorcio/EditProposalModal';
import { UploadPendingDocumentsDialog } from '@/components/consorcio/UploadPendingDocumentsDialog';
import { LeadCallButton } from '@/components/crm/LeadCallButton';
import { DossieCadastroDialog } from '@/components/consorcio/DossieCadastroDialog';
import { FunilConsorcioTimeline, isInPeriod, type FunilQuickFilter } from '@/components/consorcio/FunilConsorcioTimeline';
import { R1FunnelTab } from '@/components/consorcio/R1FunnelTab';
import { ConsorcioPeriodFilter, type DateRangeFilter } from '@/components/consorcio/ConsorcioPeriodFilter';
import { DealDetailsDrawer } from '@/components/crm/DealDetailsDrawer';
import {
  useProposals, useExcluirProposta,
  useProposalHasPendingRegistration,
  useProposalIdsWithPendingRegistration,
  isPropostaSemValor,
  labelPropostaSemValor,
  type Proposal,
} from '@/hooks/useConsorcioPostMeeting';
import { StickyNote } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertTriangle, Info } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { useSearchParams } from 'react-router-dom';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { TablePagination } from '@/components/ui/table-pagination';
import { useTableSortUrl } from '@/hooks/useTableSortUrl';
import { useDebounce } from '@/hooks/useDebounce';
import { ordenarPor } from '@/lib/ordenacaoTabela';

import { PendingRegistrationsList } from '@/components/consorcio/PendingRegistrationsList';
import { CotasTab } from '@/components/consorcio/CotasTab';
import { CotasCadastradasTab } from '@/components/consorcio/CotasCadastradasTab';
import { CONSORCIO_LABELS } from '@/lib/consorcioLabels';
import { FilaDuasListas } from '@/components/consorcio/FilaDuasListas';
import { SeloDiasParados, diasDesde } from '@/components/consorcio/SeloDiasParados';
import { TaxaAssinaturaHeader } from '@/components/consorcio/TaxaAssinaturaHeader';
import { GerarTermoModal } from '@/components/consorcio/GerarTermoModal';
import { TermoPanelDialog } from '@/components/consorcio/TermoPanelDialog';
import { FileSignature } from 'lucide-react';
import {
  useTermosByProposal, useRegistrationIdsByProposal, type ConsorcioTermo,
} from '@/hooks/useConsorcioTermos';

const POS_TABS = [
  'r1-agendadas', 'r1-realizadas', 'propostas', 'pendentes', 'cadastradas', 'cotas',
] as const;

const ymd = (d: Date) => format(d, 'yyyy-MM-dd');
const parseYmd = (v: string | null): Date | undefined => {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined;
  const [y, m, d] = v.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return Number.isNaN(dt.getTime()) ? undefined : dt;
};

export default function PosReuniao() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const activeTab = (POS_TABS as readonly string[]).includes(tabParam || '')
    ? (tabParam as string)
    : 'r1-agendadas';

  // Período global das 6 etapas — persistido na URL (?de=&ate=&periodo=).
  // Padrão: Este Mês.
  const hasPeriodParams = searchParams.has('de') || searchParams.has('ate') || searchParams.has('periodo');
  const period: DateRangeFilter = hasPeriodParams
    ? {
        startDate: parseYmd(searchParams.get('de')),
        endDate: parseYmd(searchParams.get('ate')),
        label: searchParams.get('periodo') || 'Período',
      }
    : {
        startDate: startOfMonth(new Date()),
        endDate: endOfMonth(new Date()),
        label: format(new Date(), 'MMMM', { locale: ptBR }),
      };
  const range = { startDate: period.startDate, endDate: period.endDate };

  // Filtro rápido dos selos da timeline (?filtro=...)
  const QUICK_FILTER_TAB: Record<FunilQuickFilter, string> = {
    'sem-desfecho': 'r1-agendadas',
    'no-show': 'r1-agendadas',
    'nao-aceitas': 'propostas',
    'aguardando-abertura': 'pendentes',
    'do-funil': 'cotas',
    reservadas: 'cadastradas',
    externas: 'cotas',
  };
  const filtroParam = searchParams.get('filtro') as FunilQuickFilter | null;
  const quickFilter: FunilQuickFilter | null =
    filtroParam && filtroParam in QUICK_FILTER_TAB ? filtroParam : null;

  const setActiveTab = (tab: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    setSearchParams(next, { replace: true });
  };

  const setQuickFilter = (filter: FunilQuickFilter | null) => {
    const next = new URLSearchParams(searchParams);
    if (filter) {
      next.set('filtro', filter);
      next.set('tab', QUICK_FILTER_TAB[filter]);
    } else {
      next.delete('filtro');
    }
    setSearchParams(next, { replace: true });
  };

  const setPeriod = (value: DateRangeFilter) => {
    const next = new URLSearchParams(searchParams);
    next.set('periodo', value.label || 'Período');
    if (value.startDate) next.set('de', ymd(value.startDate)); else next.delete('de');
    if (value.endDate) next.set('ate', ymd(value.endDate)); else next.delete('ate');
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="space-y-4">
      <FunilConsorcioTimeline
        activeTab={activeTab}
        onTabChange={setActiveTab}
        period={period}
        onPeriodChange={setPeriod}
        onQuickFilter={setQuickFilter}
      />
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        {/* Etapas 1 e 2 montadas de forma preguiçosa (queries novas, página pesada) */}
        <TabsContent value="r1-agendadas">
          {activeTab === 'r1-agendadas' && (
            <R1FunnelTab
              mode="agendadas"
              range={range}
              quickFilter={quickFilter === 'sem-desfecho' || quickFilter === 'no-show' ? quickFilter : null}
              onClearQuickFilter={() => setQuickFilter(null)}
            />
          )}
        </TabsContent>
        <TabsContent value="r1-realizadas">
          {activeTab === 'r1-realizadas' && <R1FunnelTab mode="realizadas" range={range} />}
        </TabsContent>
        <TabsContent value="propostas">
          <PropostasTab
            range={range}
            onlyNaoAceitas={quickFilter === 'nao-aceitas'}
            onClearQuickFilter={() => setQuickFilter(null)}
          />
        </TabsContent>
        <TabsContent value="pendentes">
          <PendingRegistrationsList
            variant="pendentes"
            range={range}
            onlyAguardandoAbertura={quickFilter === 'aguardando-abertura'}
            onClearQuickFilter={() => setQuickFilter(null)}
          />
        </TabsContent>
        <TabsContent value="cadastradas">
          {activeTab === 'cadastradas' && <CotasCadastradasTab range={range} />}
        </TabsContent>
        <TabsContent value="cotas">
          <CotasTab
            range={range}
            onlyDoFunil={quickFilter === 'do-funil'}
            onlyExternas={quickFilter === 'externas'}
            onClearQuickFilter={() => setQuickFilter(null)}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}


// ─── Propostas Tab ───────────────────────────────────────────
/** Ordem de processo: o que exige ação primeiro em `asc`. */
const rankPropostaStatus = (p: Proposal): number => {
  if (isPropostaSemValor(p)) return 1;                     // sem valor / aguardando retorno
  if ((p as any).documentos_pendentes) return 2;           // documento pendente
  if (p.status === 'pendente') return 3;
  if (p.status === 'aceita') return 4;                     // cadastrada
  return 5;
};

const PROPOSTA_SORT_FIELDS = [
  'contato', 'created_at', 'meeting_date', 'valor_credito', 'prazo_meses',
  'tipo_produto', 'status', 'closer_name',
] as const;
/** `meeting_date_desc` é só o default de hoje (Data Reunião desc), não é coluna. */
type PropostaSortField = (typeof PROPOSTA_SORT_FIELDS)[number];

const PROPOSTA_EXTRATORES: Record<PropostaSortField, (p: Proposal) => unknown> = {
  contato: (p) => p.contact_name || p.deal_name || '',
  // A coluna "Data Proposta" exibe created_at — ordenamos pelo que ela exibe.
  created_at: (p) => (p.created_at ? new Date(p.created_at) : null),
  meeting_date: (p) => ((p as any).meeting_date ? new Date((p as any).meeting_date) : null),
  valor_credito: (p) => Number(p.valor_credito) || 0,
  prazo_meses: (p) => Number(p.prazo_meses) || 0,
  tipo_produto: (p) => p.tipo_produto || '',
  status: rankPropostaStatus,
  closer_name: (p) => p.closer_name || '',
};

function PropostasTab({
  range,
  onlyNaoAceitas,
  onClearQuickFilter,
}: {
  range: { startDate?: Date; endDate?: Date };
  onlyNaoAceitas?: boolean;
  onClearQuickFilter?: () => void;
}) {
  const { data: allPropostas = [], isLoading } = useProposals();
  const [statusFilter, setStatusFilter] = useState<'all' | 'pendente' | 'documento-pendente' | 'recusada'>('all');
  const [closerFilter, setCloserFilter] = useState('all');
  const [addCartaOpen, setAddCartaOpen] = useState(false);

  const { field, dir, toggle, q, setQ } = useTableSortUrl<PropostaSortField>({
    campos: PROPOSTA_SORT_FIELDS,
    inicial: { field: 'meeting_date', dir: 'desc' },
    sufixo: 'Ca',
  });
  const [searchTerm, setSearchTerm] = useState(q);
  const termo = useDebounce(searchTerm, 300);
  useEffect(() => { setQ(termo); /* eslint-disable-next-line */ }, [termo]);

  const closerOptions = useMemo(() => {
    const names = [...new Set(allPropostas.map(p => p.closer_name).filter(Boolean))];
    return names.sort();
  }, [allPropostas]);

  const propostas = useMemo(() => {
    // Etapa 3 do funil mede EVENTO: todas as propostas criadas no período,
    // independente do status atual (a coluna Status distingue o desfecho).
    // Eixo de data: proposal_date ?? created_at.
    let list = allPropostas.filter(
      p => !p.carta_excluida && isInPeriod(p.proposal_date || p.created_at, range),
    );
    if (onlyNaoAceitas) list = list.filter(p => p.status !== 'aceita');
    if (statusFilter === 'pendente') list = list.filter(p => p.status === 'pendente');
    else if (statusFilter === 'documento-pendente') list = list.filter(p => p.documentos_pendentes);
    else if (statusFilter === 'recusada') list = list.filter(p => p.status === 'recusada');
    if (closerFilter !== 'all') list = list.filter(p => p.closer_name === closerFilter);
    if (termo.trim()) {
      const term = termo.toLowerCase();
      // Valor: comparamos também sem pontuação, para "50.000" e "50.000,00"
      // acharem o valor cru (50000) — é assim que a pessoa lê o número na tela.
      const semPont = (s: string) => s.replace(/[.,\s]/g, '');
      const termNum = semPont(term);
      list = list.filter(p =>
      {
        const hay = `${p.contact_name || p.deal_name || ''} ${p.closer_name || ''} ${p.tipo_produto || ''} ${p.valor_credito ?? ''} ${p.prazo_meses ?? ''}`.toLowerCase();
        if (hay.includes(term)) return true;
        const valorFmt = p.valor_credito != null
          ? new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(Number(p.valor_credito))
          : '';
        const hayNum = semPont(`${p.valor_credito ?? ''} ${valorFmt} ${p.prazo_meses ?? ''}`);
        return !!termNum && hayNum.includes(termNum);
      });
    }
    // filtrar → buscar → ordenar (paginação abaixo)
    return ordenarPor(list, PROPOSTA_EXTRATORES[field], dir);
  }, [allPropostas, statusFilter, closerFilter, termo, onlyNaoAceitas, range.startDate, range.endDate, field, dir]);

  // Desistências da carta no período (o que o sistema grava como "carta excluída").
  // Elas ficam fora da métrica da etapa, mas aparecem na lista de tratados.
  const desistidas = useMemo(() => {
    let list = allPropostas.filter(
      p => p.carta_excluida && isInPeriod(p.proposal_date || p.created_at, range),
    );
    if (closerFilter !== 'all') list = list.filter(p => p.closer_name === closerFilter);
    if (termo.trim()) {
      const t = termo.toLowerCase();
      list = list.filter(p =>
        `${p.contact_name || p.deal_name || ''} ${p.closer_name || ''}`.toLowerCase().includes(t),
      );
    }
    return list;
  }, [allPropostas, closerFilter, termo, range.startDate, range.endDate]);

  const [semSucessoTarget, setSemSucessoTarget] = useState<Proposal | null>(null);
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [acceptTarget, setAcceptTarget] = useState<Proposal | null>(null);
  const [uploadTarget, setUploadTarget] = useState<Proposal | null>(null);
  const [viewTarget, setViewTarget] = useState<Proposal | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Proposal | null>(null);
  const [editTarget, setEditTarget] = useState<Proposal | null>(null);
  const [termoTarget, setTermoTarget] = useState<Proposal | null>(null);
  const [termoPanelTarget, setTermoPanelTarget] = useState<Proposal | null>(null);

  const linhasVisiveis = useMemo(() => [...propostas, ...desistidas], [propostas, desistidas]);
  const { data: termosByProposal = {} } = useTermosByProposal();
  const { data: registrationByProposal = {} } = useRegistrationIdsByProposal(
    useMemo(() => linhasVisiveis.map(p => p.id), [linhasVisiveis]),
  );

  const termosDe = (p: Proposal): ConsorcioTermo[] => termosByProposal[p.id] || [];
  const termoAssinadoDe = (p: Proposal) => termosDe(p).find(t => t.status === 'assinado');

  /**
   * Âncora do selo de dias parados na etapa 3: a geração do termo. Quando a
   * venda foi lançada e o termo ainda não existe, contamos da data da venda —
   * são âncoras diferentes e o tooltip diz qual está valendo.
   */
  const ancoraDe = (p: Proposal) => {
    const t = termosDe(p)[0];
    return t
      ? { desde: t.created_at, motivo: 'Contando desde a geração do termo de adesão.' }
      : {
          desde: p.proposal_date || p.created_at,
          motivo: 'Termo ainda não gerado — contando desde a data da venda.',
        };
  };

  // Pendentes: venda viva, termo ainda não assinado. Tratados: termo assinado
  // ou desistência da carta.
  const propostasPendentes = useMemo(
    () =>
      propostas
        .filter(p => !termoAssinadoDe(p))
        .sort((a, b) => (diasDesde(ancoraDe(b).desde) ?? 0) - (diasDesde(ancoraDe(a).desde) ?? 0)),
    [propostas, termosByProposal],
  );
  const propostasTratadas = useMemo(
    () => [...propostas.filter(p => !!termoAssinadoDe(p)), ...desistidas],
    [propostas, desistidas, termosByProposal],
  );

  // Quais cartas já têm cadastro em Cotas a Fazer. Sem isso, "Inserir Dados"
  // cria um SEGUNDO cadastro e re-dispara e-mail/WhatsApp + webhook para o cliente.
  const idsAceitasSemCota = useMemo(
    () => linhasVisiveis.filter(p => p.status === 'aceita' && !p.consortium_card_id).map(p => p.id),
    [linhasVisiveis],
  );

  const { data: comCadastro } = useProposalIdsWithPendingRegistration(idsAceitasSemCota);

  /**
   * Selo do termo de adesão na coluna Status. Só visibilidade — não muda etapa
   * nem cálculo: a etapa 3 continua governada pela assinatura.
   */
  const seloTermo = (p: Proposal) => {
    const t = termosDe(p)[0];
    if (!t) return null;
    if (t.status === 'pendente') {
      const dias = diasDesde(t.created_at);
      return (
        <Badge
          variant="outline"
          className="text-xs border-amber-500 text-amber-600"
          title={`Termo gerado em ${new Date(t.created_at).toLocaleString('pt-BR')}${
            dias != null ? ` — aguardando assinatura há ${dias} dia(s)` : ''
          }`}
        >
          Termo aguardando assinatura
        </Badge>
      );
    }
    if (t.status === 'assinado') {
      return (
        <Badge
          variant="outline"
          className="text-xs border-emerald-500 text-emerald-600"
          title={t.assinado_em ? `Assinado em ${new Date(t.assinado_em).toLocaleString('pt-BR')}` : undefined}
        >
          Termo assinado
          {t.assinado_em ? ` · ${format(new Date(t.assinado_em), 'dd/MM/yyyy', { locale: ptBR })}` : ''}
        </Badge>
      );
    }
    return (
      <Badge
        variant="outline"
        className="text-xs text-muted-foreground font-normal"
        title={t.cancelado_motivo || undefined}
      >
        {t.status === 'cancelado' ? 'Termo cancelado' : 'Termo expirado'}
      </Badge>
    );
  };


  if (isLoading) return <LoadingState />;

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const renderTabela = (rows: Proposal[]) => (
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHead field="contato" active={field} dir={dir} onSort={toggle}>Contato</SortableTableHead>
                <SortableTableHead field="created_at" active={field} dir={dir} onSort={toggle}>Data Proposta</SortableTableHead>
                <SortableTableHead field="meeting_date" active={field} dir={dir} onSort={toggle}>Data Reunião</SortableTableHead>
                <SortableTableHead field="valor_credito" active={field} dir={dir} onSort={toggle}>Valor Crédito</SortableTableHead>
                <SortableTableHead field="prazo_meses" active={field} dir={dir} onSort={toggle}>Prazo</SortableTableHead>
                <SortableTableHead field="tipo_produto" active={field} dir={dir} onSort={toggle}>Produto</SortableTableHead>
                <SortableTableHead field="status" active={field} dir={dir} onSort={toggle}>Status</SortableTableHead>
                <SortableTableHead field="closer_name" active={field} dir={dir} onSort={toggle}>Closer</SortableTableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(p => {
                const proposalDate = p.created_at ? new Date(p.created_at) : null;
                const daysOverdue = proposalDate && p.documentos_pendentes
                  ? Math.max(0, Math.floor((Date.now() - proposalDate.getTime()) / (1000 * 60 * 60 * 24)))
                  : 0;
                return (
                <TableRow
                  key={p.id}
                  className={`cursor-pointer ${p.documentos_pendentes ? 'bg-destructive/10 hover:bg-destructive/20 border-l-4 border-l-destructive' : ''}`}
                  onClick={() => setSelectedDealId(p.deal_id)}
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <span>{p.contact_name || p.deal_name}</span>
                      {p.closer_notes && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={e => e.stopPropagation()}
                              className="text-amber-600"
                              aria-label="Nota do closer na R1"
                            >
                              <StickyNote className="h-4 w-4" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-sm whitespace-pre-wrap text-xs">
                            <p className="font-semibold mb-1">Nota do closer na R1</p>
                            {p.closer_notes}
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {proposalDate ? (
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground">
                          {format(proposalDate, "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                        {!p.carta_excluida && !termoAssinadoDe(p) && (
                          <SeloDiasParados
                            desde={ancoraDe(p).desde}
                            motivo={ancoraDe(p).motivo}
                          />
                        )}
                        {p.documentos_pendentes && daysOverdue > 0 && (
                          <span
                            className="animate-frantic-blink font-extrabold text-2xl leading-none text-destructive drop-shadow-sm"
                            title={`Documentação pendente há ${daysOverdue} dia(s)`}
                          >
                            {daysOverdue}d
                          </span>
                        )}
                      </div>
                    ) : '—'}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {(p as any).meeting_date
                      ? format(new Date((p as any).meeting_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                      : '—'}
                  </TableCell>
                  <TableCell>{formatCurrency(p.valor_credito)}</TableCell>
                  <TableCell>{p.prazo_meses} meses</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs capitalize">{p.tipo_produto}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1 items-start">
                      {isPropostaSemValor(p) ? (
                        <Badge
                          variant="outline"
                          className="text-xs border-amber-500 text-amber-600"
                          title="Proposta registrada sem valor de crédito — não conta como carta negociada"
                        >
                          {labelPropostaSemValor(p)}
                        </Badge>
                      ) : (
                        <Badge variant={p.status === 'aceita' ? 'default' : 'outline'} className="text-xs capitalize">
                          {p.status === 'aceita' ? 'Cadastrada' : p.status}
                        </Badge>
                      )}
                      {p.documentos_pendentes && (
                        <Badge
                          variant="destructive"
                          className="text-xs cursor-pointer hover:opacity-80"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (p.consortium_card_id) {
                              setUploadTarget(p);
                            } else {
                              setAcceptTarget(p);
                            }
                          }}
                          title={p.consortium_card_id ? 'Anexar documentos faltantes' : 'Cadastrar cota para anexar documentos'}
                        >
                          Documento pendente
                        </Badge>
                      )}
                      {seloTermo(p)}
                      {(p as any).carta_excluida && (
                        <Badge
                          variant="destructive"
                          className="text-xs cursor-help"
                          title={`Carta excluída${(p as any).carta_excluida_em ? ' em ' + new Date((p as any).carta_excluida_em).toLocaleString('pt-BR') : ''}${(p as any).carta_excluida_por_nome ? ' por ' + (p as any).carta_excluida_por_nome : ''}\nJustificativa: ${(p as any).carta_excluida_motivo || '—'}`}
                        >
                          Desistência da Carta
                        </Badge>
                      )}
                      {(p as any).carta_excluida && (p as any).carta_excluida_motivo && (
                        <span className="text-[11px] text-muted-foreground italic max-w-[220px] block">
                          "{(p as any).carta_excluida_motivo}"
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{p.closer_name || '—'}</TableCell>
                  <TableCell className="text-right space-x-2" onClick={e => e.stopPropagation()}>
                    {p.status === 'pendente' && (
                      <>
                        <Button
                          size="sm"
                          disabled={isPropostaSemValor(p)}
                          title={isPropostaSemValor(p) ? 'Registre valor e prazo antes de cadastrar' : undefined}
                          onClick={() => setAcceptTarget(p)}
                        >
                          <CheckCircle className="h-3 w-3 mr-1" /> Cadastrar
                        </Button>
                        {/* Mesmo padrão da etapa 4: ação destrutiva discreta, não gritante. */}
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => setSemSucessoTarget(p)}
                        >
                          <XCircle className="h-3 w-3 mr-1" /> Recusar
                        </Button>

                      </>
                    )}
                    {p.status === 'aceita' && !p.consortium_card_id && (
                      <>
                        {comCadastro?.has(p.id) ? (
                          /* Selo, não botão: o cadastro é tratado na etapa 4. Continua
                             bloqueando "Inserir Dados" para não criar um segundo
                             cadastro (que redispara e-mail/WhatsApp + webhook). */
                          <Badge
                            variant="outline"
                            className="text-xs text-muted-foreground font-normal"
                            title="Esta carta já tem cadastro em Cotas a Fazer. Trate por lá."
                          >
                            Cadastro já criado
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={p.cadastro_completo}
                            title={p.cadastro_completo ? 'Cadastro já preenchido e documento anexado' : undefined}
                            onClick={() => setAcceptTarget(p)}
                          >
                            <FileText className="h-3 w-3 mr-1" /> Inserir Dados
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => setViewTarget(p)}>
                          <FileText className="h-3 w-3 mr-1" /> Ver Dados
                        </Button>
                      </>
                    )}
                    {p.consortium_card_id && (
                      <>
                        <Badge className="bg-primary/10 text-primary text-xs">Cota Cadastrada</Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled
                          title="Cota já cadastrada"
                        >
                          <FileText className="h-3 w-3 mr-1" /> Inserir Dados
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setViewTarget(p)}>
                          <FileText className="h-3 w-3 mr-1" /> Ver Dados
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setUploadTarget(p)}>
                          <FileText className="h-3 w-3 mr-1" /> Documentos
                        </Button>
                        {p.documentos_pendentes && (
                          <Button size="sm" variant="outline" onClick={() => setUploadTarget(p)}>
                            <FileText className="h-3 w-3 mr-1" /> Anexar Documentos
                          </Button>
                        )}
                      </>
                    )}
                    {!p.carta_excluida && (
                      termosDe(p).length > 0 ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setTermoPanelTarget(p)}
                          title="Ver, copiar o link ou reenviar o termo de adesão"
                        >
                          <FileSignature className="h-3 w-3 mr-1" /> Ver / reenviar termo
                        </Button>
                      ) : registrationByProposal[p.id] ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setTermoTarget(p)}
                          title="Gerar o termo de adesão para o cliente assinar"
                        >
                          <FileSignature className="h-3 w-3 mr-1" /> Gerar Termo de Adesão
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled
                          title="O termo é montado a partir do cadastro da cota. Lance a venda (Inserir Dados) antes de gerar o termo."
                        >
                          <FileSignature className="h-3 w-3 mr-1" /> Gerar Termo de Adesão
                        </Button>
                      )
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditTarget(p)}
                      title="Editar a venda (as alterações ficam registradas)"
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    {!p.carta_excluida && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setDeleteTarget(p)}
                        title="Desistência da Carta (abate do realizado)"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        );


  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          <CardTitle className="text-base">{CONSORCIO_LABELS.termosPendentes} ({propostas.length})</CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar contato, closer, produto, valor..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 h-8"
            />
          </div>
          <Select value={closerFilter} onValueChange={setCloserFilter}>
            <SelectTrigger className="w-[180px] h-8">
              <SelectValue placeholder="Closer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Closers</SelectItem>
              {closerOptions.map(c => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={v => setStatusFilter(v as any)}>
            <SelectTrigger className="w-[180px] h-8">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Status</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="documento-pendente">Documento pendente</SelectItem>
              <SelectItem value="recusada">Recusada</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={propostas.length === 0}
          onClick={async () => {
            const XLSX = await loadXLSX();
            const data = propostas.map(p => ({
              "Contato": p.contact_name || p.deal_name || '',
              "Telefone": p.contact_phone || '',
              "Email": p.contact_email || '',
              "Valor Crédito": p.valor_credito,
              "Prazo (meses)": p.prazo_meses,
              "Produto": p.tipo_produto || '',
              "Status": p.status || '',
              "Closer": p.closer_name || '',
            }));
            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Propostas");
            XLSX.writeFile(wb, `propostas-consorcio-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
          }}
        >
          <Download className="h-4 w-4 mr-1" />
          Exportar Excel
        </Button>
        <Button size="sm" onClick={() => setAddCartaOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Adicionar Carta
        </Button>
      </CardHeader>

      <CardContent>
        {onlyNaoAceitas && (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-primary/50 text-primary">
              Filtrado: ainda não aceitas
            </Badge>
            <Button size="sm" variant="ghost" onClick={onClearQuickFilter}>
              Limpar filtro
            </Button>
          </div>
        )}
        <TotalCreditoSummary
          propostas={propostas.filter(p => !isPropostaSemValor(p))}
          title="Crédito Contratado — Termos de Adesão Pendentes"
          className="mb-4"
        />
        <TaxaAssinaturaHeader range={range} className="mb-4" />
        <FilaDuasListas
          pendentes={propostasPendentes}
          tratadas={propostasTratadas}
          renderTabela={renderTabela}
          tituloPendentes="Pendentes — termo de adesão não assinado"
          tituloTratadas="Tratados — termo assinado ou desistência da carta"
          descricaoPendentes="ordenado do mais parado para o mais recente"
          vazioPendentes="Nenhum termo de adesão pendente no período."
          vazioTratadas="Nenhum termo assinado nem desistência no período."
        />

        <AddCartaModal open={addCartaOpen} onOpenChange={setAddCartaOpen} />




        {semSucessoTarget && (
          <SemSucessoModal
            open={!!semSucessoTarget}
            onOpenChange={o => !o && setSemSucessoTarget(null)}
            dealId={semSucessoTarget.deal_id}
            dealName={semSucessoTarget.deal_name}
            contactName={semSucessoTarget.contact_name}
            originId={semSucessoTarget.origin_id}
            proposalId={semSucessoTarget.id}
          />
        )}

        {acceptTarget && (
          <AcceptProposalModal
            open={!!acceptTarget}
            onOpenChange={o => !o && setAcceptTarget(null)}
            proposalId={acceptTarget.id}
            dealId={acceptTarget.deal_id}
            contactName={acceptTarget.contact_name || acceptTarget.deal_name}
            vendedorName={acceptTarget.closer_name || ""}
          />
        )}

        {uploadTarget && uploadTarget.consortium_card_id && (
          <UploadPendingDocumentsDialog
            open={!!uploadTarget}
            onOpenChange={o => !o && setUploadTarget(null)}
            cardId={uploadTarget.consortium_card_id}
            contactName={uploadTarget.contact_name || uploadTarget.deal_name}
          />
        )}

        {viewTarget && (
          <DossieCadastroDialog
            open={!!viewTarget}
            onOpenChange={o => !o && setViewTarget(null)}
            proposalId={viewTarget.id}
          />
        )}


        <DealDetailsDrawer dealId={selectedDealId} open={!!selectedDealId} onOpenChange={o => !o && setSelectedDealId(null)} />

        <DeletePropostaDialog
          proposal={deleteTarget}
          onClose={() => setDeleteTarget(null)}
        />

        {termoTarget && registrationByProposal[termoTarget.id] && (
          <GerarTermoModal
            open={!!termoTarget}
            onOpenChange={o => !o && setTermoTarget(null)}
            // Termo da VENDA: cobre todas as cartas da proposta.
            proposalId={termoTarget.id}
          />
        )}

        {termoPanelTarget && (
          <TermoPanelDialog
            open={!!termoPanelTarget}
            onOpenChange={o => !o && setTermoPanelTarget(null)}
            termos={termosDe(termoPanelTarget)}
            clienteNome={termoPanelTarget.contact_name || termoPanelTarget.deal_name || 'cliente'}
            onGerarNovo={() => {
              const alvo = termoPanelTarget;
              setTermoPanelTarget(null);
              if (alvo && registrationByProposal[alvo.id]) setTermoTarget(alvo);
            }}
          />
        )}

        {editTarget && (
          <EditProposalModal
            open={!!editTarget}
            onOpenChange={o => !o && setEditTarget(null)}
            proposalId={editTarget.id}
            contactName={editTarget.contact_name || ''}
            dealName={editTarget.deal_name || ''}
            initialCartas={(editTarget as any).cartas || []}
            initialValorCredito={Number(editTarget.valor_credito) || 0}

            initialPrazoMeses={Number(editTarget.prazo_meses) || 0}
            initialTipoProduto={editTarget.tipo_produto || ''}
            initialDetails={editTarget.proposal_details || ''}
            initialOrigemLead={(editTarget as any).origem_lead || ''}
            termos={termosDe(editTarget)}
          />

        )}
      </CardContent>
    </Card>
  );
}




function LoadingState() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

// ─── Delete Proposta Dialog ─────────────────────────────────
function DeletePropostaDialog({
  proposal,
  onClose,
}: {
  proposal: Proposal | null;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');
  const excluir = useExcluirProposta();
  const { data: hasPending, isLoading: checkingPending } =
    useProposalHasPendingRegistration(
      proposal ? { id: proposal.id, deal_id: proposal.deal_id } : null,
    );

  React.useEffect(() => {
    if (!proposal) setReason('');
  }, [proposal]);

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  return (
    <AlertDialog open={!!proposal} onOpenChange={o => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Registrar Desistência da Carta?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              {proposal && (
                <p>
                  Você está registrando a desistência da carta de{' '}
                  <strong>{proposal.contact_name || proposal.deal_name}</strong> no valor de{' '}
                  <strong>{formatCurrency(proposal.valor_credito || 0)}</strong>.
                </p>
              )}
              {checkingPending && (
                <p className="text-xs text-muted-foreground">Verificando cadastro pendente…</p>
              )}
              {hasPending && (
                <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-amber-900 dark:text-amber-200">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <p className="text-sm">
                    A carta já possui cadastro de cota em andamento. Favor informar ao time
                    operacional para validar a exclusão/cancelamento. Ao confirmar, o cadastro
                    pendente vinculado também será removido.
                  </p>
                </div>
              )}
              <p className="text-sm">
                O valor será <strong>abatido do realizado</strong> exibido no BI Consórcio e a
                carta será movida para <strong>Cartas Excluídas</strong>. Esta ação não pode ser
                desfeita.
              </p>
              <div>
                <label className="text-sm font-medium">
                  Motivo da desistência <span className="text-destructive">*</span>
                </label>
                <Textarea
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="Descreva o motivo da desistência…"
                  rows={3}
                  className="mt-1"
                />
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={!reason.trim() || excluir.isPending}
            onClick={async e => {
              e.preventDefault();
              if (!proposal || !reason.trim()) return;
              try {
                await excluir.mutateAsync({ proposal_id: proposal.id, reason });
                onClose();
              } catch {
                /* toast já exibido */
              }
            }}
          >
            {excluir.isPending ? 'Registrando…' : 'Registrar desistência'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}


// ─── Total Crédito Summary (integral + por closer) ───────────
function TotalCreditoSummary({
  propostas,
  title,
  className,
}: {
  propostas: Array<{ valor_credito?: number | null; closer_name?: string | null; created_at?: string | null; cartas?: unknown[]; qtd_cartas?: number | null }>;
  title: string;
  className?: string;
}) {
  const MIN_MONTH = '2026-07';
  const [mesFilter, setMesFilter] = useState<string>('all');

  const propostasAposMin = useMemo(
    () => propostas.filter(p => !p.created_at || p.created_at.slice(0, 7) >= MIN_MONTH),
    [propostas]
  );

  const mesesDisponiveis = useMemo(() => {
    const set = new Set<string>();
    for (const p of propostasAposMin) {
      if (p.created_at) set.add(p.created_at.slice(0, 7));
    }
    return Array.from(set).sort().reverse();
  }, [propostasAposMin]);

  const filtered = useMemo(
    () => (mesFilter === 'all' ? propostasAposMin : propostasAposMin.filter(p => (p.created_at || '').slice(0, 7) === mesFilter)),
    [propostasAposMin, mesFilter],
  );

  const { total, totalCartas, porCloser, porMes } = useMemo(() => {
    let total = 0;
    let totalCartas = 0;
    const map = new Map<string, number>();
    const mesMap = new Map<string, { valor: number; count: number; cartas: number }>();
    for (const p of filtered) {
      const v = Number(p.valor_credito) || 0;
      // Mesma fórmula do funil (FunilConsorcioTimeline.tsx:147): soma de
      // p.cartas?.length, fallback qtd_cartas, fallback 1 (propostas legadas).
      const nCartas = p.cartas?.length || p.qtd_cartas || 1;
      total += v;
      totalCartas += nCartas;
      const key = p.closer_name || '— Sem Closer';
      map.set(key, (map.get(key) || 0) + v);
      const mesKey = (p.created_at || '').slice(0, 7) || '— Sem data';
      const cur = mesMap.get(mesKey) || { valor: 0, count: 0, cartas: 0 };
      mesMap.set(mesKey, { valor: cur.valor + v, count: cur.count + 1, cartas: cur.cartas + nCartas });
    }
    const porCloser = Array.from(map.entries())
      .map(([name, valor]) => ({ name, valor }))
      .sort((a, b) => b.valor - a.valor);
    const porMes = Array.from(mesMap.entries())
      .map(([mes, v]) => ({ mes, ...v }))
      .sort((a, b) => (a.mes < b.mes ? 1 : -1));
    return { total, totalCartas, porCloser, porMes };
  }, [filtered]);

  const fmt = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

  const fmtMes = (mes: string) => {
    if (!/^\d{4}-\d{2}$/.test(mes)) return mes;
    const [y, m] = mes.split('-');
    const d = new Date(Number(y), Number(m) - 1, 1);
    return format(d, "MMM/yy", { locale: ptBR });
  };

  return (
    <Card className={cn('bg-muted/30', className)}>
      <CardContent className="p-4">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-6">
            <div className="min-w-[220px]">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">{title}</p>
              <p className="text-2xl font-bold text-primary">{fmt(total)}</p>
              <p className="text-xs text-muted-foreground">{filtered.length} {filtered.length === 1 ? 'venda' : 'vendas'} · {totalCartas} {totalCartas === 1 ? 'carta' : 'cartas'}</p>
            </div>
            <div className="min-w-[180px]">
              <p className="text-xs font-semibold text-muted-foreground mb-1">Filtrar por mês</p>
              <Select value={mesFilter} onValueChange={setMesFilter}>
                <SelectTrigger className="h-8 w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os meses</SelectItem>
                  {mesesDisponiveis.map(m => (
                    <SelectItem key={m} value={m}>{fmtMes(m)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[300px]">
              <p className="text-xs font-semibold text-muted-foreground mb-2">Por Closer</p>
              {porCloser.length === 0 ? (
                <p className="text-sm text-muted-foreground">—</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {porCloser.map(c => (
                    <div key={c.name} className="rounded-md border bg-background px-3 py-1.5">
                      <p className="text-[11px] text-muted-foreground leading-tight">{c.name}</p>
                      <p className="text-sm font-semibold leading-tight">{fmt(c.valor)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">Por Mês</p>
            {porMes.length === 0 ? (
              <p className="text-sm text-muted-foreground">—</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {porMes.map(m => (
                  <div key={m.mes} className="rounded-md border bg-background px-3 py-1.5">
                    <p className="text-[11px] text-muted-foreground leading-tight capitalize">{fmtMes(m.mes)}</p>
                    <p className="text-sm font-semibold leading-tight">{fmt(m.valor)}</p>
                    <p className="text-[10px] text-muted-foreground leading-tight">{m.count} {m.count === 1 ? 'venda' : 'vendas'} · {m.cartas} {m.cartas === 1 ? 'carta' : 'cartas'}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
