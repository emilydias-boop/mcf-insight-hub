import React, { useState, useMemo, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Send, XCircle, CheckCircle, RotateCcw, FileText, Loader2, Search, CalendarIcon, ChevronLeft, ChevronRight, Download, Trash2, Pencil, Radio } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { loadXLSX } from '@/lib/lazyExport';
import { ProposalModal } from '@/components/consorcio/ProposalModal';
import { SemSucessoModal } from '@/components/consorcio/SemSucessoModal';
import { AcceptProposalModal } from '@/components/consorcio/AcceptProposalModal';
import { EditProposalModal } from '@/components/consorcio/EditProposalModal';
import { UploadPendingDocumentsDialog } from '@/components/consorcio/UploadPendingDocumentsDialog';
import { ViewRegistrationDialog } from '@/components/consorcio/ViewRegistrationDialog';
import { MatchSocioParceiroTab } from '@/components/consorcio/MatchSocioParceiroTab';
import { DealDetailsDrawer } from '@/components/crm/DealDetailsDrawer';
import {
  useRealizadas, useProposals, useSemSucesso,
  useRetomarContato, useTodasReunioes, useExcluirProposta,
  useProposalHasPendingRegistration, useCartasExcluidas,
  type CompletedMeeting, type Proposal, type SemSucessoDeal, type AllMeetingDeal,
  type DeletedProposalLog,
} from '@/hooks/useConsorcioPostMeeting';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertTriangle, Info } from 'lucide-react';
import { useMyCloser } from '@/hooks/useMyCloser';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { dispatchCartaCadastradaWebhook } from '@/lib/consorcioCartaWebhook';
import { toast } from 'sonner';

export default function PosReuniao() {
  const [activeTab, setActiveTab] = useState('realizadas');

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="realizadas">Reuniões Realizadas</TabsTrigger>
          <TabsTrigger value="propostas">Cartas Negociadas</TabsTrigger>
          <TabsTrigger value="concluidas">Concluídas - Operacional</TabsTrigger>
          <TabsTrigger value="sem-sucesso">Sem Sucesso</TabsTrigger>
          <TabsTrigger value="excluidas">Cartas Excluídas</TabsTrigger>
          <TabsTrigger value="todas">Todas Reuniões</TabsTrigger>
          <TabsTrigger value="match-socio">Match sócio-parceiro</TabsTrigger>
        </TabsList>

        <TabsContent value="realizadas"><RealizadasTab /></TabsContent>
        <TabsContent value="propostas"><PropostasTab /></TabsContent>
        <TabsContent value="concluidas"><ConcluidasTab /></TabsContent>
        <TabsContent value="sem-sucesso"><SemSucessoTab /></TabsContent>
        <TabsContent value="excluidas"><CartasExcluidasTab /></TabsContent>
        <TabsContent value="todas"><TodasReunioesTab /></TabsContent>
        <TabsContent value="match-socio"><MatchSocioParceiroTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Realizadas Tab ──────────────────────────────────────────
function RealizadasTab() {
  const { data: realizadas = [], isLoading } = useRealizadas();
  const [proposalTarget, setProposalTarget] = useState<CompletedMeeting | null>(null);
  const [semSucessoTarget, setSemSucessoTarget] = useState<CompletedMeeting | null>(null);
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [pipelineFilter, setPipelineFilter] = useState('all');
  const [closerFilter, setCloserFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  const closerOptions = useMemo(() => {
    const names = [...new Set(realizadas.map(r => r.closer_name).filter(Boolean))];
    return names.sort();
  }, [realizadas]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, pipelineFilter, closerFilter, dateFrom, dateTo]);

  const filtered = useMemo(() => {
    return realizadas.filter(r => {
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchName = (r.contact_name || r.deal_name || '').toLowerCase().includes(term);
        const matchPhone = (r.contact_phone || '').toLowerCase().includes(term);
        if (!matchName && !matchPhone) return false;
      }
      if (pipelineFilter !== 'all' && r.origin_name !== pipelineFilter) return false;
      if (closerFilter !== 'all' && r.closer_name !== closerFilter) return false;
      if (dateFrom || dateTo) {
        const mDate = r.meeting_date ? new Date(r.meeting_date) : null;
        if (!mDate) return false;
        if (dateFrom && mDate < dateFrom) return false;
        if (dateTo) {
          const end = new Date(dateTo);
          end.setHours(23, 59, 59, 999);
          if (mDate > end) return false;
        }
      }
      return true;
    });
  }, [realizadas, searchTerm, pipelineFilter, closerFilter, dateFrom, dateTo]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = filtered.slice(startIndex, startIndex + itemsPerPage);

  if (isLoading) return <LoadingState />;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Reuniões Realizadas — Aguardando Ação ({filtered.length})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar nome ou telefone..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={pipelineFilter} onValueChange={setPipelineFilter}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Pipeline" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas Pipelines</SelectItem>
              <SelectItem value="PIPELINE - INSIDE SALES - VIVER DE ALUGUEL">Viver de Aluguel</SelectItem>
              <SelectItem value="Efeito Alavanca + Clube">Efeito Alavanca</SelectItem>
            </SelectContent>
          </Select>
          <Select value={closerFilter} onValueChange={setCloserFilter}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Closer" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Closers</SelectItem>
              {closerOptions.map(c => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-[200px] justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateFrom ? format(dateFrom, 'dd/MM/yyyy') : 'Data início'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-[200px] justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateTo ? format(dateTo, 'dd/MM/yyyy') : 'Data fim'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
          {(searchTerm || pipelineFilter !== 'all' || closerFilter !== 'all' || dateFrom || dateTo) && (
            <Button variant="ghost" size="sm" onClick={() => { setSearchTerm(''); setPipelineFilter('all'); setCloserFilter('all'); setDateFrom(undefined); setDateTo(undefined); }}>
              Limpar filtros
            </Button>
          )}
          <div className="ml-auto">
            <Button
              variant="outline"
              size="sm"
              disabled={filtered.length === 0}
              onClick={async () => {
                const XLSX = await loadXLSX();
                const data = filtered.map(r => ({
                  "Nome": r.contact_name || r.deal_name || '',
                  "Telefone": r.contact_phone || '',
                  "Email": r.contact_email || '',
                  "Pipeline": r.origin_name || '',
                  "Data Reunião": r.meeting_date ? format(new Date(r.meeting_date), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : '',
                  "Região": r.region || '',
                  "Renda": r.renda || '',
                  "Closer": r.closer_name || '',
                }));
                const ws = XLSX.utils.json_to_sheet(data);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, "Leads Realizadas");
                XLSX.writeFile(wb, `leads-realizadas-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
              }}
            >
              <Download className="h-4 w-4 mr-1" />
              Exportar Excel
            </Button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhuma reunião realizada pendente de ação.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contato</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Pipeline / Stage</TableHead>
                    <TableHead>Data Reunião</TableHead>
                    <TableHead>Região</TableHead>
                    <TableHead>Renda</TableHead>
                    <TableHead>Closer</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedData.map(r => {
                    const isCadastrado = !!(r.cadastro_completo || r.completa);
                    return (
                    <TableRow
                      key={r.deal_id}
                      className={cn(
                        isCadastrado
                          ? 'bg-emerald-500/10 hover:bg-emerald-500/15 cursor-not-allowed'
                          : 'cursor-pointer'
                      )}
                      onClick={() => { if (!isCadastrado) setSelectedDealId(r.deal_id); }}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <span>{r.contact_name || r.deal_name}</span>
                          {isCadastrado && (
                            <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white text-[10px]">Cadastrada</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.contact_phone || '—'}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <Badge variant="outline" className="text-xs w-fit">{r.origin_name}</Badge>
                          <span className="text-xs text-muted-foreground">{r.stage_name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {r.meeting_date
                          ? format(new Date(r.meeting_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                          : r.updated_at
                            ? format(new Date(r.updated_at), 'dd/MM/yyyy', { locale: ptBR })
                            : '—'}
                      </TableCell>
                      <TableCell className="text-sm">{r.region || '—'}</TableCell>
                      <TableCell className="text-sm">{r.renda || '—'}</TableCell>
                      <TableCell className="text-sm">{r.closer_name || '—'}</TableCell>
                      <TableCell className="text-right space-x-2" onClick={e => e.stopPropagation()}>
                        <Button size="sm" disabled={isCadastrado} onClick={() => setProposalTarget(r)}>
                          <Send className="h-3 w-3 mr-1" /> Lançar Carta
                        </Button>
                        <Button size="sm" variant="destructive" disabled={isCadastrado} onClick={() => setSemSucessoTarget(r)}>
                          <XCircle className="h-3 w-3 mr-1" /> Sem Sucesso
                        </Button>
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  Mostrando {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filtered.length)} de {filtered.length} resultados
                </span>
                <Select value={String(itemsPerPage)} onValueChange={v => { setItemsPerPage(Number(v)); setCurrentPage(1); }}>
                  <SelectTrigger className="w-20 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-sm text-muted-foreground">por página</span>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                    .reduce<(number | string)[]>((acc, p, idx, arr) => {
                      if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('...');
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((p, i) =>
                      typeof p === 'string' ? (
                        <span key={`ellipsis-${i}`} className="px-2 text-muted-foreground">…</span>
                      ) : (
                        <Button key={p} variant={p === currentPage ? 'default' : 'outline'} size="sm" className="w-8 h-8 p-0" onClick={() => setCurrentPage(p)}>
                          {p}
                        </Button>
                      )
                    )}
                  <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </>
        )}

        {proposalTarget && (
          <ProposalModal
            open={!!proposalTarget}
            onOpenChange={o => !o && setProposalTarget(null)}
            dealId={proposalTarget.deal_id}
            dealName={proposalTarget.deal_name}
            contactName={proposalTarget.contact_name}
            originId={proposalTarget.origin_id}
          />
        )}
        {semSucessoTarget && (
          <SemSucessoModal
            open={!!semSucessoTarget}
            onOpenChange={o => !o && setSemSucessoTarget(null)}
            dealId={semSucessoTarget.deal_id}
            dealName={semSucessoTarget.deal_name}
            contactName={semSucessoTarget.contact_name}
            originId={semSucessoTarget.origin_id}
          />
        )}

        <DealDetailsDrawer dealId={selectedDealId} open={!!selectedDealId} onOpenChange={o => !o && setSelectedDealId(null)} />
      </CardContent>
    </Card>
  );
}

// ─── Propostas Tab ───────────────────────────────────────────
function PropostasTab() {
  const { data: allPropostas = [], isLoading } = useProposals();
  const [statusFilter, setStatusFilter] = useState<'all' | 'pendente' | 'aceita' | 'documento-pendente'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [closerFilter, setCloserFilter] = useState('all');

  const closerOptions = useMemo(() => {
    const names = [...new Set(allPropostas.map(p => p.closer_name).filter(Boolean))];
    return names.sort();
  }, [allPropostas]);

  const propostas = useMemo(() => {
    let list = allPropostas.filter(p => !p.completa && !p.cadastro_completo);
    if (statusFilter === 'pendente') list = list.filter(p => p.status === 'pendente');
    else if (statusFilter === 'aceita') list = list.filter(p => p.status === 'aceita');
    else if (statusFilter === 'documento-pendente') list = list.filter(p => p.documentos_pendentes);
    if (closerFilter !== 'all') list = list.filter(p => p.closer_name === closerFilter);
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter(p => (p.contact_name || p.deal_name || '').toLowerCase().includes(term));
    }
    return list;
  }, [allPropostas, statusFilter, closerFilter, searchTerm]);
  const [semSucessoTarget, setSemSucessoTarget] = useState<Proposal | null>(null);
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [acceptTarget, setAcceptTarget] = useState<Proposal | null>(null);
  const [uploadTarget, setUploadTarget] = useState<Proposal | null>(null);
  const [viewTarget, setViewTarget] = useState<Proposal | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Proposal | null>(null);
  const [editTarget, setEditTarget] = useState<Proposal | null>(null);
  const excluir = useExcluirProposta();

  if (isLoading) return <LoadingState />;

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          <CardTitle className="text-base">Cartas Negociadas ({propostas.length})</CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por contato..."
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
              <SelectItem value="aceita">Cadastrada</SelectItem>
              <SelectItem value="documento-pendente">Documento pendente</SelectItem>
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
      </CardHeader>
      <CardContent>
        <TotalCreditoSummary propostas={propostas} title="Crédito Contratado — Cartas Negociadas" className="mb-4" />
        {propostas.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhuma proposta pendente.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contato</TableHead>
                <TableHead>Data Proposta</TableHead>
                <TableHead>Valor Crédito</TableHead>
                <TableHead>Prazo</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Closer</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {propostas.map(p => {
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
                    {p.contact_name || p.deal_name}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {proposalDate ? (
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground">
                          {format(proposalDate, "dd/MM/yyyy", { locale: ptBR })}
                        </span>
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
                  <TableCell>{formatCurrency(p.valor_credito)}</TableCell>
                  <TableCell>{p.prazo_meses} meses</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs capitalize">{p.tipo_produto}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1 items-start">
                      <Badge variant={p.status === 'aceita' ? 'default' : 'outline'} className="text-xs capitalize">
                        {p.status === 'aceita' ? 'Cadastrada' : p.status}
                      </Badge>
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
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{p.closer_name || '—'}</TableCell>
                  <TableCell className="text-right space-x-2" onClick={e => e.stopPropagation()}>
                    {p.status === 'pendente' && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => setAcceptTarget(p)}
                        >
                          <CheckCircle className="h-3 w-3 mr-1" /> Cadastrar
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => setSemSucessoTarget(p)}>
                          <XCircle className="h-3 w-3 mr-1" /> Recusar
                        </Button>
                      </>
                    )}
                    {p.status === 'aceita' && !p.consortium_card_id && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={p.cadastro_completo}
                          title={p.cadastro_completo ? 'Cadastro já preenchido e documento anexado' : undefined}
                          onClick={() => setAcceptTarget(p)}
                        >
                          <FileText className="h-3 w-3 mr-1" /> Inserir Dados
                        </Button>
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
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditTarget(p)}
                      title="Editar valores da proposta"
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setDeleteTarget(p)}
                      title="Excluir proposta (abate do realizado)"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

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
            vendedorName=""
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
          <ViewRegistrationDialog
            open={!!viewTarget}
            onOpenChange={o => !o && setViewTarget(null)}
            proposalId={viewTarget.id}
            consortiumCardId={viewTarget.consortium_card_id}
            contactName={viewTarget.contact_name || viewTarget.deal_name}
          />
        )}

        <DealDetailsDrawer dealId={selectedDealId} open={!!selectedDealId} onOpenChange={o => !o && setSelectedDealId(null)} />

        <DeletePropostaDialog
          proposal={deleteTarget}
          onClose={() => setDeleteTarget(null)}
        />

        {editTarget && (
          <EditProposalModal
            open={!!editTarget}
            onOpenChange={o => !o && setEditTarget(null)}
            proposalId={editTarget.id}
            contactName={editTarget.contact_name || ''}
            dealName={editTarget.deal_name || ''}
            initialValorCredito={Number(editTarget.valor_credito) || 0}
            initialPrazoMeses={Number(editTarget.prazo_meses) || 0}
            initialTipoProduto={editTarget.tipo_produto || ''}
            initialDetails={editTarget.proposal_details || ''}
            initialOrigemLead={(editTarget as any).origem_lead || ''}
          />
        )}
      </CardContent>
    </Card>
  );
}

// ─── Sem Sucesso Tab ─────────────────────────────────────────
function SemSucessoTab() {
  return <_SemSucessoTabInner />;
}

// ─── Concluídas Tab ──────────────────────────────────────────
function ConcluidasTab() {
  const { data: allPropostas = [], isLoading } = useProposals();
  const basePropostas = useMemo(
    () => allPropostas.filter(p => p.completa || p.cadastro_completo),
    [allPropostas]
  );
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [uploadTarget, setUploadTarget] = useState<Proposal | null>(null);
  const [editTarget, setEditTarget] = useState<Proposal | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [closerFilter, setCloserFilter] = useState('all');

  const closerNames = useMemo(() => {
    const names = [...new Set(basePropostas.map((p: any) => p.closer_name).filter(Boolean))];
    return names.sort();
  }, [basePropostas]);

  const propostas = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return basePropostas.filter((p: any) => {
      if (closerFilter !== 'all' && p.closer_name !== closerFilter) return false;
      if (term) {
        const contato = (p.contact_name || p.deal_name || '').toLowerCase();
        if (!contato.includes(term)) return false;
      }
      return true;
    });
  }, [basePropostas, searchTerm, closerFilter]);

  if (isLoading) return <LoadingState />;

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  return (
    <>
      <TotalCreditoSummary propostas={propostas} title="Crédito Contratado — Concluídas" />
      <Card>
      <CardHeader>
        <CardTitle className="text-base">Concluídas - Operacional ({propostas.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <Input
            placeholder="Buscar contato..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-64"
          />
          <Select value={closerFilter} onValueChange={setCloserFilter}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Closer" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Closers</SelectItem>
              {closerNames.map(n => (
                <SelectItem key={n} value={n as string}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(searchTerm || closerFilter !== 'all') && (
            <Button variant="ghost" size="sm" onClick={() => { setSearchTerm(''); setCloserFilter('all'); }}>
              Limpar
            </Button>
          )}
        </div>
        {propostas.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhuma proposta concluída ainda.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contato</TableHead>
                <TableHead>Valor Crédito</TableHead>
                <TableHead>Prazo</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Closer</TableHead>
                <TableHead>Origem do Lead</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {propostas.map(p => (
                <TableRow
                  key={p.id}
                  className="cursor-pointer bg-emerald-500/10 hover:bg-emerald-500/20 border-l-4 border-l-emerald-500"
                  onClick={() => setSelectedDealId(p.deal_id)}
                >
                  <TableCell className="font-medium">{p.contact_name || p.deal_name}</TableCell>
                  <TableCell>{formatCurrency(p.valor_credito)}</TableCell>
                  <TableCell>{p.prazo_meses} meses</TableCell>
                  <TableCell><Badge variant="secondary" className="text-xs capitalize">{p.tipo_produto}</Badge></TableCell>
                  <TableCell className="text-sm">{(p as any).closer_name || '—'}</TableCell>
                  <TableCell className="text-sm">{(p as any).origem_lead || '—'}</TableCell>
                  <TableCell>
                    <Badge className="bg-emerald-600 text-white text-xs">Check-list + Docs OK</Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-2" onClick={e => e.stopPropagation()}>
                    {p.consortium_card_id && (
                      <Button size="sm" variant="outline" onClick={() => setUploadTarget(p)}>
                        <FileText className="h-3 w-3 mr-1" /> Ver Documentos
                      </Button>
                    )}
                    {p.consortium_card_id && (
                      <Button
                        size="sm"
                        variant="ghost"
                        title="Reenviar webhook para o Make"
                        onClick={async () => {
                          const t = toast.loading('Reenviando webhook...');
                          const res = await dispatchCartaCadastradaWebhook({
                            cardId: p.consortium_card_id!,
                            proposalId: p.id,
                            force: true,
                          });
                          toast.dismiss(t);
                          if (res.sent) toast.success('Webhook reenviado com sucesso');
                          else toast.error('Falha ao reenviar webhook' + (res.error ? `: ${res.error}` : ''));
                        }}
                      >
                        <Radio className="h-3 w-3" />
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => setEditTarget(p)} title="Editar valores da proposta">
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {uploadTarget && uploadTarget.consortium_card_id && (
          <UploadPendingDocumentsDialog
            open={!!uploadTarget}
            onOpenChange={o => !o && setUploadTarget(null)}
            cardId={uploadTarget.consortium_card_id}
            contactName={uploadTarget.contact_name || uploadTarget.deal_name}
          />
        )}

        {editTarget && (
          <EditProposalModal
            open={!!editTarget}
            onOpenChange={o => !o && setEditTarget(null)}
            proposalId={editTarget.id}
            contactName={editTarget.contact_name || ''}
            dealName={editTarget.deal_name || ''}
            initialValorCredito={Number(editTarget.valor_credito) || 0}
            initialPrazoMeses={Number(editTarget.prazo_meses) || 0}
            initialTipoProduto={editTarget.tipo_produto || ''}
            initialDetails={editTarget.proposal_details || ''}
            initialOrigemLead={(editTarget as any).origem_lead || ''}
          />
        )}

        <DealDetailsDrawer dealId={selectedDealId} open={!!selectedDealId} onOpenChange={o => !o && setSelectedDealId(null)} />
      </CardContent>
    </Card>
    </>
  );
}

function _SemSucessoTabInner() {
  const { data: deals = [], isLoading } = useSemSucesso();
  const retomar = useRetomarContato();
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);

  if (isLoading) return <LoadingState />;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Deals Sem Sucesso</CardTitle>
        <Button
          variant="outline"
          size="sm"
          disabled={deals.length === 0}
          onClick={async () => {
            const XLSX = await loadXLSX();
            const data = deals.map(d => ({
              "Contato": d.contact_name || d.deal_name || '',
              "Telefone": d.contact_phone || '',
              "Email": d.contact_email || '',
              "Pipeline": d.origin_name || '',
              "Motivo": d.motivo_recusa || '',
              "Data": d.updated_at ? format(new Date(d.updated_at), 'dd/MM/yyyy', { locale: ptBR }) : '',
            }));
            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Sem Sucesso");
            XLSX.writeFile(wb, `sem-sucesso-consorcio-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
          }}
        >
          <Download className="h-4 w-4 mr-1" />
          Exportar Excel
        </Button>
      </CardHeader>
      <CardContent>
        {deals.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum deal sem sucesso.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contato</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Pipeline</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deals.map(d => (
                <TableRow key={d.deal_id} className="cursor-pointer" onClick={() => setSelectedDealId(d.deal_id)}>
                  <TableCell className="font-medium">
                    {d.contact_name || d.deal_name}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{d.contact_phone || '—'}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{d.origin_name}</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                    {d.motivo_recusa || '—'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {d.updated_at ? format(new Date(d.updated_at), 'dd/MM/yyyy', { locale: ptBR }) : '—'}
                  </TableCell>
                  <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => retomar.mutate({ deal_id: d.deal_id, origin_id: d.origin_id })}
                      disabled={retomar.isPending}
                    >
                      <RotateCcw className="h-3 w-3 mr-1" /> Retomar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <DealDetailsDrawer dealId={selectedDealId} open={!!selectedDealId} onOpenChange={o => !o && setSelectedDealId(null)} />
      </CardContent>
    </Card>
  );
}

// ─── Todas Reuniões Tab ──────────────────────────────────────
function TodasReunioesTab() {
  const { data: allMeetings = [], isLoading } = useTodasReunioes();
  const { data: myCloser } = useMyCloser();
  const { role } = useAuth();
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [pipelineFilter, setPipelineFilter] = useState('all');
  const [closerFilter, setCloserFilter] = useState('all');
  const [stageFilter, setStageFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  const isCloser = role === 'closer';

  // Auto-filter for closers
  const baseData = useMemo(() => {
    if (isCloser && myCloser?.name) {
      return allMeetings.filter(m => m.closer_name === myCloser.name);
    }
    return allMeetings;
  }, [allMeetings, isCloser, myCloser]);

  const closerOptions = useMemo(() => {
    const names = [...new Set(baseData.map(r => r.closer_name).filter(Boolean))];
    return names.sort();
  }, [baseData]);

  const stageOptions = useMemo(() => {
    const stages = [...new Set(baseData.map(r => r.stage_name).filter(Boolean))];
    return stages.sort();
  }, [baseData]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, pipelineFilter, closerFilter, stageFilter, dateFrom, dateTo]);

  const filtered = useMemo(() => {
    return baseData.filter(r => {
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchName = (r.contact_name || r.deal_name || '').toLowerCase().includes(term);
        const matchPhone = (r.contact_phone || '').toLowerCase().includes(term);
        if (!matchName && !matchPhone) return false;
      }
      if (pipelineFilter !== 'all' && r.origin_name !== pipelineFilter) return false;
      if (closerFilter !== 'all' && r.closer_name !== closerFilter) return false;
      if (stageFilter !== 'all' && r.stage_name !== stageFilter) return false;
      if (dateFrom || dateTo) {
        const mDate = r.meeting_date ? new Date(r.meeting_date) : r.updated_at ? new Date(r.updated_at) : null;
        if (!mDate) return false;
        if (dateFrom && mDate < dateFrom) return false;
        if (dateTo) {
          const end = new Date(dateTo);
          end.setHours(23, 59, 59, 999);
          if (mDate > end) return false;
        }
      }
      return true;
    });
  }, [baseData, searchTerm, pipelineFilter, closerFilter, stageFilter, dateFrom, dateTo]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = filtered.slice(startIndex, startIndex + itemsPerPage);

  if (isLoading) return <LoadingState />;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Todas as Reuniões ({filtered.length})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar nome ou telefone..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={pipelineFilter} onValueChange={setPipelineFilter}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Pipeline" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas Pipelines</SelectItem>
              <SelectItem value="PIPELINE - INSIDE SALES - VIVER DE ALUGUEL">Viver de Aluguel</SelectItem>
              <SelectItem value="Efeito Alavanca + Clube">Efeito Alavanca</SelectItem>
            </SelectContent>
          </Select>
          {!isCloser && (
            <Select value={closerFilter} onValueChange={setCloserFilter}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Closer" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Closers</SelectItem>
                {closerOptions.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={stageFilter} onValueChange={setStageFilter}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Status</SelectItem>
              {stageOptions.map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-[200px] justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateFrom ? format(dateFrom, 'dd/MM/yyyy') : 'Data início'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-[200px] justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateTo ? format(dateTo, 'dd/MM/yyyy') : 'Data fim'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
          {(searchTerm || pipelineFilter !== 'all' || closerFilter !== 'all' || stageFilter !== 'all' || dateFrom || dateTo) && (
            <Button variant="ghost" size="sm" onClick={() => { setSearchTerm(''); setPipelineFilter('all'); setCloserFilter('all'); setStageFilter('all'); setDateFrom(undefined); setDateTo(undefined); }}>
              Limpar filtros
            </Button>
          )}
          <div className="ml-auto">
            <Button
              variant="outline"
              size="sm"
              disabled={filtered.length === 0}
              onClick={async () => {
                const XLSX = await loadXLSX();
                const data = filtered.map(r => ({
                  "Nome": r.contact_name || r.deal_name || '',
                  "Telefone": r.contact_phone || '',
                  "Email": r.contact_email || '',
                  "Pipeline": r.origin_name || '',
                  "Status": r.stage_name || '',
                  "Data Reunião": r.meeting_date ? format(new Date(r.meeting_date), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : '',
                  "Região": r.region || '',
                  "Renda": r.renda || '',
                  "Closer": r.closer_name || '',
                  "Notas Closer": r.closer_notes || '',
                  "Notas": r.attendee_notes || '',
                }));
                const ws = XLSX.utils.json_to_sheet(data);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, "Todas Reuniões");
                XLSX.writeFile(wb, `todas-reunioes-consorcio-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
              }}
            >
              <Download className="h-4 w-4 mr-1" />
              Exportar Excel
            </Button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhuma reunião encontrada.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contato</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Pipeline / Status</TableHead>
                    <TableHead>Data Reunião</TableHead>
                    <TableHead>Região</TableHead>
                    <TableHead>Closer</TableHead>
                    <TableHead>Notas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedData.map(r => (
                    <TableRow key={r.deal_id} className="cursor-pointer" onClick={() => setSelectedDealId(r.deal_id)}>
                      <TableCell className="font-medium">{r.contact_name || r.deal_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.contact_phone || '—'}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <Badge variant="outline" className="text-xs w-fit">{r.origin_name}</Badge>
                          <span className="text-xs text-muted-foreground">{r.stage_name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {r.meeting_date
                          ? format(new Date(r.meeting_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                          : r.updated_at
                            ? format(new Date(r.updated_at), 'dd/MM/yyyy', { locale: ptBR })
                            : '—'}
                      </TableCell>
                      <TableCell className="text-sm">{r.region || '—'}</TableCell>
                      <TableCell className="text-sm">{r.closer_name || '—'}</TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate" title={[r.closer_notes, r.attendee_notes].filter(Boolean).join(' | ')}>
                        {r.closer_notes || r.attendee_notes ? (
                          <Badge variant="secondary" className="text-xs">
                            <FileText className="h-3 w-3 mr-1" />
                            Notas
                          </Badge>
                        ) : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  Mostrando {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filtered.length)} de {filtered.length}
                </span>
                <Select value={String(itemsPerPage)} onValueChange={v => { setItemsPerPage(Number(v)); setCurrentPage(1); }}>
                  <SelectTrigger className="w-20 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-sm text-muted-foreground">por página</span>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                    .reduce<(number | string)[]>((acc, p, idx, arr) => {
                      if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('...');
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((p, i) =>
                      typeof p === 'string' ? (
                        <span key={`ellipsis-${i}`} className="px-2 text-muted-foreground">…</span>
                      ) : (
                        <Button key={p} variant={p === currentPage ? 'default' : 'outline'} size="sm" className="w-8 h-8 p-0" onClick={() => setCurrentPage(p)}>
                          {p}
                        </Button>
                      )
                    )}
                  <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </>
        )}

        <DealDetailsDrawer dealId={selectedDealId} open={!!selectedDealId} onOpenChange={o => !o && setSelectedDealId(null)} />
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
          <AlertDialogTitle>Excluir Carta Negociada?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              {proposal && (
                <p>
                  Você está excluindo a carta de{' '}
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
                  Motivo da exclusão <span className="text-destructive">*</span>
                </label>
                <Textarea
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="Descreva o motivo da exclusão/cancelamento…"
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
            {excluir.isPending ? 'Excluindo…' : 'Excluir'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ─── Cartas Excluídas Tab ───────────────────────────────────
function CartasExcluidasTab() {
  const { data: logs, isLoading } = useCartasExcluidas();
  const [search, setSearch] = useState('');

  if (isLoading) return <LoadingState />;

  const filtered = (logs || []).filter(l =>
    !search.trim()
      ? true
      : (l.contact_name || '').toLowerCase().includes(search.toLowerCase()),
  );

  const formatCurrency = (v: number | null) =>
    v == null ? '—' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          <CardTitle className="text-base">Cartas Excluídas ({filtered.length})</CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por contato..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-8"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhuma carta excluída registrada.
          </p>
        ) : (
          <TooltipProvider delayDuration={100}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contato</TableHead>
                  <TableHead>Closer</TableHead>
                  <TableHead>Valor Crédito</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Excluída em</TableHead>
                  <TableHead>Excluída por</TableHead>
                  <TableHead>Fluxo / Log</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((l: DeletedProposalLog) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">
                      {l.contact_name || '—'}
                      {l.had_pending_registration && (
                        <Badge variant="outline" className="ml-2 text-[10px] border-amber-500/50 text-amber-700 dark:text-amber-300">
                          tinha cadastro pendente
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{l.closer_name || '—'}</TableCell>
                    <TableCell>{formatCurrency(l.valor_credito)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs capitalize">
                        {l.tipo_produto || '—'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {format(new Date(l.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-sm">
                      {l.deleted_by_name || l.deleted_by_email || '—'}
                    </TableCell>
                    <TableCell>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <Info className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="max-w-sm space-y-2">
                          <div className="text-xs">
                            <div><strong>Motivo:</strong> {l.deletion_reason}</div>
                            <div><strong>Usuário:</strong> {l.deleted_by_name || l.deleted_by_email || '—'}</div>
                            <div>
                              <strong>Data/hora:</strong>{' '}
                              {format(new Date(l.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                            </div>
                            <div>
                              <strong>Cadastro pendente vinculado:</strong>{' '}
                              {l.had_pending_registration ? 'Sim (removido junto)' : 'Não'}
                            </div>
                            {l.proposal_created_at && (
                              <div>
                                <strong>Carta criada em:</strong>{' '}
                                {format(new Date(l.proposal_created_at), "dd/MM/yyyy", { locale: ptBR })}
                              </div>
                            )}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TooltipProvider>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Total Crédito Summary (integral + por closer) ───────────
function TotalCreditoSummary({
  propostas,
  title,
  className,
}: {
  propostas: Array<{ valor_credito?: number | null; closer_name?: string | null; created_at?: string | null }>;
  title: string;
  className?: string;
}) {
  const [mesFilter, setMesFilter] = useState<string>('all');

  const mesesDisponiveis = useMemo(() => {
    const set = new Set<string>();
    for (const p of propostas) {
      if (p.created_at) set.add(p.created_at.slice(0, 7));
    }
    return Array.from(set).sort().reverse();
  }, [propostas]);

  const filtered = useMemo(
    () => (mesFilter === 'all' ? propostas : propostas.filter(p => (p.created_at || '').slice(0, 7) === mesFilter)),
    [propostas, mesFilter],
  );

  const { total, porCloser, porMes } = useMemo(() => {
    let total = 0;
    const map = new Map<string, number>();
    const mesMap = new Map<string, { valor: number; count: number }>();
    for (const p of filtered) {
      const v = Number(p.valor_credito) || 0;
      total += v;
      const key = p.closer_name || '— Sem Closer';
      map.set(key, (map.get(key) || 0) + v);
      const mesKey = (p.created_at || '').slice(0, 7) || '— Sem data';
      const cur = mesMap.get(mesKey) || { valor: 0, count: 0 };
      mesMap.set(mesKey, { valor: cur.valor + v, count: cur.count + 1 });
    }
    const porCloser = Array.from(map.entries())
      .map(([name, valor]) => ({ name, valor }))
      .sort((a, b) => b.valor - a.valor);
    const porMes = Array.from(mesMap.entries())
      .map(([mes, v]) => ({ mes, ...v }))
      .sort((a, b) => (a.mes < b.mes ? 1 : -1));
    return { total, porCloser, porMes };
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
              <p className="text-xs text-muted-foreground">{filtered.length} cartas</p>
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
                    <p className="text-[10px] text-muted-foreground leading-tight">{m.count} cartas</p>
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
