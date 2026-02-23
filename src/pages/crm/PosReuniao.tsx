import { useState, useMemo, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Send, XCircle, CheckCircle, RotateCcw, FileText, Loader2, Search, CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { ProposalModal } from '@/components/consorcio/ProposalModal';
import { SemSucessoModal } from '@/components/consorcio/SemSucessoModal';
import { AcceptProposalModal } from '@/components/consorcio/AcceptProposalModal';
import { DealDetailsDrawer } from '@/components/crm/DealDetailsDrawer';
import {
  useRealizadas, useProposals, useSemSucesso,
  useRetomarContato,
  type CompletedMeeting, type Proposal, type SemSucessoDeal,
} from '@/hooks/useConsorcioPostMeeting';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export default function PosReuniao() {
  const [activeTab, setActiveTab] = useState('realizadas');

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="realizadas">Realizadas</TabsTrigger>
          <TabsTrigger value="propostas">Propostas</TabsTrigger>
          <TabsTrigger value="sem-sucesso">Sem Sucesso</TabsTrigger>
        </TabsList>

        <TabsContent value="realizadas"><RealizadasTab /></TabsContent>
        <TabsContent value="propostas"><PropostasTab /></TabsContent>
        <TabsContent value="sem-sucesso"><SemSucessoTab /></TabsContent>
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
                  {paginatedData.map(r => (
                    <TableRow key={r.deal_id} className="cursor-pointer" onClick={() => setSelectedDealId(r.deal_id)}>
                      <TableCell className="font-medium">
                        {r.contact_name || r.deal_name}
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
                        <Button size="sm" onClick={() => setProposalTarget(r)}>
                          <Send className="h-3 w-3 mr-1" /> Proposta
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => setSemSucessoTarget(r)}>
                          <XCircle className="h-3 w-3 mr-1" /> Sem Sucesso
                        </Button>
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
  const { data: propostas = [], isLoading } = useProposals();
  const [semSucessoTarget, setSemSucessoTarget] = useState<Proposal | null>(null);
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [acceptTarget, setAcceptTarget] = useState<Proposal | null>(null);

  if (isLoading) return <LoadingState />;

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Propostas Enviadas</CardTitle>
      </CardHeader>
      <CardContent>
        {propostas.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhuma proposta pendente.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contato</TableHead>
                <TableHead>Valor Crédito</TableHead>
                <TableHead>Prazo</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {propostas.map(p => (
                <TableRow key={p.id} className="cursor-pointer" onClick={() => setSelectedDealId(p.deal_id)}>
                  <TableCell className="font-medium">
                    {p.contact_name || p.deal_name}
                  </TableCell>
                  <TableCell>{formatCurrency(p.valor_credito)}</TableCell>
                  <TableCell>{p.prazo_meses} meses</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs capitalize">{p.tipo_produto}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.status === 'aceita' ? 'default' : 'outline'} className="text-xs capitalize">
                      {p.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-2" onClick={e => e.stopPropagation()}>
                    {p.status === 'pendente' && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => setAcceptTarget(p)}
                        >
                          <CheckCircle className="h-3 w-3 mr-1" /> Aceite
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => setSemSucessoTarget(p)}>
                          <XCircle className="h-3 w-3 mr-1" /> Recusar
                        </Button>
                      </>
                    )}
                    {p.status === 'aceita' && !p.consortium_card_id && (
                      <Button size="sm" variant="outline" asChild>
                        <a href={`/consorcio?prefill_deal=${p.deal_id}&prefill_proposal=${p.id}`}>
                          <FileText className="h-3 w-3 mr-1" /> Cadastrar Cota
                        </a>
                      </Button>
                    )}
                    {p.consortium_card_id && (
                      <Badge className="bg-primary/10 text-primary text-xs">Cota Cadastrada</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
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

        <DealDetailsDrawer dealId={selectedDealId} open={!!selectedDealId} onOpenChange={o => !o && setSelectedDealId(null)} />
      </CardContent>
    </Card>
  );
}

// ─── Sem Sucesso Tab ─────────────────────────────────────────
function SemSucessoTab() {
  const { data: deals = [], isLoading } = useSemSucesso();
  const retomar = useRetomarContato();
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);

  if (isLoading) return <LoadingState />;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Deals Sem Sucesso</CardTitle>
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

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}
