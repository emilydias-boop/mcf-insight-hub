import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Search, CalendarIcon, ChevronLeft, ChevronRight, Download, FileText, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { loadXLSX } from '@/lib/lazyExport';
import { LeadCallButton } from '@/components/crm/LeadCallButton';
import { DealDetailsDrawer } from '@/components/crm/DealDetailsDrawer';
import { useTodasReunioes } from '@/hooks/useConsorcioPostMeeting';
import { useMyCloser } from '@/hooks/useMyCloser';
import { useAuth } from '@/contexts/AuthContext';

export function TodasReunioesTab() {
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
                      <TableCell className="text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <span>{r.contact_phone || '—'}</span>
                          <LeadCallButton phone={r.contact_phone} dealId={r.deal_id} />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <Badge variant="outline" className="text-xs w-fit">{r.origin_name}</Badge>
                          <span className="text-xs text-muted-foreground">{r.stage_name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {r.meeting_date
                          ? format(new Date(r.meeting_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
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
