import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Copy, Check, ShoppingCart, X, Download, Search, Filter, XCircle, MessageSquare, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { R2CarrinhoAttendee, useUpdateCarrinhoStatus } from '@/hooks/useR2CarrinhoData';
import { useR2CarrinhoVendas } from '@/hooks/useR2CarrinhoVendas';
import { AprovadoDetailDrawer } from './AprovadoDetailDrawer';
import { toast } from 'sonner';
interface R2AprovadosListProps {
  attendees: R2CarrinhoAttendee[];
  isLoading?: boolean;
  weekStart: Date;
  weekEnd: Date;
}

export function R2AprovadosList({ attendees, isLoading, weekStart, weekEnd }: R2AprovadosListProps) {
  const [copied, setCopied] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [closerFilter, setCloserFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [selectedAttendee, setSelectedAttendee] = useState<R2CarrinhoAttendee | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  
  const updateStatus = useUpdateCarrinhoStatus();
  
  // Fetch real sales data (same source as Vendas tab)
  const { data: vendasData = [] } = useR2CarrinhoVendas(weekStart, weekEnd);
  
  // Use real sales count from transactions (not manual status)
  const soldCount = vendasData.length;

  // Get unique closers for filter
  const closers = useMemo(() => {
    const uniqueClosers = new Map<string, { id: string; name: string; color: string | null }>();
    attendees.forEach(att => {
      if (att.closer_id && att.closer_name) {
        uniqueClosers.set(att.closer_id, {
          id: att.closer_id,
          name: att.closer_name,
          color: att.closer_color,
        });
      }
    });
    return Array.from(uniqueClosers.values());
  }, [attendees]);

  // Get unique dates for filter
  const meetingDates = useMemo(() => {
    const uniqueDates = new Set<string>();
    attendees.forEach(att => {
      const dateStr = format(new Date(att.scheduled_at), 'yyyy-MM-dd');
      uniqueDates.add(dateStr);
    });
    return Array.from(uniqueDates).sort();
  }, [attendees]);

  // Create set of emails/phones that already purchased (from real transactions)
  const soldIdentifiers = useMemo(() => {
    const set = new Set<string>();
    vendasData.forEach(venda => {
      if (venda.customer_email) {
        set.add(venda.customer_email.toLowerCase());
      }
      if (venda.customer_phone) {
        const normalized = venda.customer_phone.replace(/\D/g, '').slice(-11);
        if (normalized.length >= 10) set.add(normalized);
      }
    });
    return set;
  }, [vendasData]);

  // Filter attendees: exclude those who bought (manual OR real transaction), apply search and filters
  const displayedAttendees = useMemo(() => {
    return attendees
      .filter(att => {
        // Exclude manual status "comprou"
        if (att.carrinho_status === 'comprou') return false;
        
        // Exclude if has real sale (match by email or phone)
        const email = att.contact_email?.toLowerCase();
        const phone = (att.attendee_phone || att.contact_phone)?.replace(/\D/g, '').slice(-11);
        
        if (email && soldIdentifiers.has(email)) return false;
        if (phone && phone.length >= 10 && soldIdentifiers.has(phone)) return false;
        
        return true;
      })
      .filter(att => {
        // Search filter
        if (searchTerm) {
          const search = searchTerm.toLowerCase();
          const name = (att.attendee_name || att.deal_name || '').toLowerCase();
          const phone = (att.attendee_phone || att.contact_phone || '').replace(/\D/g, '');
          const email = (att.contact_email || '').toLowerCase();
          const searchNormalized = search.replace(/\D/g, '');
          
          const matchesName = name.includes(search);
          const matchesPhone = searchNormalized.length > 0 && phone.includes(searchNormalized);
          const matchesEmail = email.includes(search);
          
          if (!matchesName && !matchesPhone && !matchesEmail) {
            return false;
          }
        }
        
        // Closer filter
        if (closerFilter !== 'all' && att.closer_id !== closerFilter) {
          return false;
        }
        
        // Date filter
        if (dateFilter !== 'all') {
          const attDate = format(new Date(att.scheduled_at), 'yyyy-MM-dd');
          if (attDate !== dateFilter) {
            return false;
          }
        }
        
        return true;
      });
  }, [attendees, soldIdentifiers, searchTerm, closerFilter, dateFilter]);

  const handleSetStatus = (attendeeId: string, status: 'vai_comprar' | 'comprou' | 'nao_comprou' | 'negociando' | 'quer_desistir' | null) => {
    updateStatus.mutate({ attendeeId, status });
  };

  const handleRowClick = (att: R2CarrinhoAttendee) => {
    setSelectedAttendee(att);
    setDrawerOpen(true);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setCloserFilter('all');
    setDateFilter('all');
  };

  const hasActiveFilters = searchTerm || closerFilter !== 'all' || dateFilter !== 'all';

  const generateReport = () => {
    const dateStr = format(weekEnd, 'dd/MM', { locale: ptBR });
    let report = `*Carrinho ${dateStr}*\n\n`;
    report += `*SELECIONADOS ${attendees.length}*\n\n`;
    report += `LISTA DOS QUE NÃO COMPRARAM AINDA: ${displayedAttendees.length}\n\n`;

    displayedAttendees.forEach((att) => {
      const name = att.attendee_name || att.deal_name || 'Sem nome';
      const phone = att.attendee_phone || att.contact_phone || '-';
      const closer = att.closer_name || '-';
      let suffix = '';
      
      if (att.carrinho_status === 'vai_comprar') {
        suffix = ' - VAI COMPRAR 🔥';
      } else if (att.carrinho_status === 'negociando') {
        suffix = ' - NEGOCIANDO';
      } else if (att.carrinho_status === 'quer_desistir') {
        suffix = ' - quer desistir';
      }

      const r1Closer = att.r1_closer_name || '-';
      report += `${name}\t${phone}\t${r1Closer}\t${closer}${suffix}\n`;
    });

    return report;
  };

  const handleCopyReport = async () => {
    const report = generateReport();
    await navigator.clipboard.writeText(report);
    setCopied(true);
    toast.success('Relatório copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportExcel = () => {
    const headers = ['#', 'Nome', 'Telefone', 'Email', 'Status', 'Closer R1', 'Closer R2', 'Carrinho', 'Data R2'];
    const rows = attendees.map((att, idx) => [
      idx + 1,
      att.attendee_name || att.deal_name || 'Sem nome',
      att.attendee_phone || att.contact_phone || '-',
      att.contact_email || '-',
      'Aprovado',
      att.r1_closer_name || '-',
      att.closer_name || '-',
      att.carrinho_status === 'vai_comprar' ? 'Vai Comprar' :
      att.carrinho_status === 'comprou' ? 'Comprou' :
      att.carrinho_status === 'nao_comprou' ? 'Não Comprou' :
      att.carrinho_status === 'negociando' ? 'Negociando' :
      att.carrinho_status === 'quer_desistir' ? 'Quer Desistir' : '-',
      format(new Date(att.scheduled_at), 'dd/MM/yyyy'),
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `carrinho-aprovados-${format(weekEnd, 'dd-MM-yyyy')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Arquivo exportado!');
  };

  if (isLoading) {
    return <div className="flex justify-center py-8">Carregando...</div>;
  }

  if (attendees.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <ShoppingCart className="h-12 w-12 mb-4 opacity-50" />
        <p>Nenhum aprovado na semana</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with counts */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" className="text-lg px-3 py-1">
            {displayedAttendees.length} em acompanhamento
          </Badge>
          <span className="text-sm text-muted-foreground">
            (de {attendees.length} aprovados • {soldCount} vendidos)
          </span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleCopyReport}>
            {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
            {copied ? 'Copiado!' : 'Copiar Relatório'}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportExcel}>
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, telefone ou email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        
        <div className="flex gap-2 flex-wrap">
          <Select value={closerFilter} onValueChange={setCloserFilter}>
            <SelectTrigger className="w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Closer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Closers</SelectItem>
              {closers.map(closer => (
                <SelectItem key={closer.id} value={closer.id}>
                  <div className="flex items-center gap-2">
                    {closer.color && (
                      <div 
                        className="w-2 h-2 rounded-full" 
                        style={{ backgroundColor: closer.color }}
                      />
                    )}
                    {closer.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Data" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Datas</SelectItem>
              {meetingDates.map(date => (
                <SelectItem key={date} value={date}>
                  {format(new Date(date + 'T12:00:00'), 'dd/MM (EEE)', { locale: ptBR })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <XCircle className="h-4 w-4 mr-1" />
              Limpar
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead className="hidden md:table-cell">Email</TableHead>
              <TableHead>Closer R1</TableHead>
              <TableHead>Closer R2</TableHead>
              <TableHead className="hidden sm:table-cell">Data R2</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayedAttendees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Nenhum resultado encontrado com os filtros aplicados
                </TableCell>
              </TableRow>
            ) : (
              displayedAttendees.map((att, idx) => (
                <TableRow 
                  key={att.id} 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleRowClick(att)}
                >
                  <TableCell className="font-medium">{idx + 1}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{att.attendee_name || att.deal_name || 'Sem nome'}</span>
                      {att.partner_name && (
                        <span className="text-xs text-muted-foreground">+ {att.partner_name}</span>
                      )}
                      {att.carrinho_status === 'vai_comprar' && (
                        <Badge variant="default" className="w-fit mt-1 text-xs">
                          <ShoppingCart className="h-3 w-3 mr-1" />
                          Vai Comprar
                        </Badge>
                      )}
                      {att.carrinho_status === 'negociando' && (
                        <Badge variant="outline" className="w-fit mt-1 text-xs bg-yellow-500/20 text-yellow-600 border-yellow-500">
                          <MessageSquare className="h-3 w-3 mr-1" />
                          Negociando
                        </Badge>
                      )}
                      {att.carrinho_status === 'quer_desistir' && (
                        <Badge variant="outline" className="w-fit mt-1 text-xs bg-orange-500/20 text-orange-600 border-orange-500">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Quer Desistir
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {att.attendee_phone || att.contact_phone || '-'}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground max-w-[200px] truncate">
                    {att.contact_email || '-'}
                  </TableCell>
                  <TableCell>
                    <span className="truncate text-sm">{att.r1_closer_name || '-'}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {att.closer_color && (
                        <div 
                          className="w-3 h-3 rounded-full flex-shrink-0" 
                          style={{ backgroundColor: att.closer_color }}
                        />
                      )}
                      <span className="truncate">{att.closer_name || '-'}</span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                    {format(new Date(att.scheduled_at), 'dd/MM', { locale: ptBR })}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant={att.carrinho_status === 'vai_comprar' ? 'default' : 'ghost'}
                            size="sm"
                            className="h-8 px-2"
                            onClick={() => handleSetStatus(
                              att.id, 
                              att.carrinho_status === 'vai_comprar' ? null : 'vai_comprar'
                            )}
                          >
                            <ShoppingCart className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Vai Comprar</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant={att.carrinho_status === 'negociando' ? 'default' : 'ghost'}
                            size="sm"
                            className={`h-8 px-2 ${att.carrinho_status === 'negociando' ? 'bg-yellow-500 hover:bg-yellow-600 text-white' : ''}`}
                            onClick={() => handleSetStatus(
                              att.id, 
                              att.carrinho_status === 'negociando' ? null : 'negociando'
                            )}
                          >
                            <MessageSquare className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Negociando</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant={att.carrinho_status === 'quer_desistir' ? 'default' : 'ghost'}
                            size="sm"
                            className={`h-8 px-2 ${att.carrinho_status === 'quer_desistir' ? 'bg-orange-500 hover:bg-orange-600 text-white' : ''}`}
                            onClick={() => handleSetStatus(
                              att.id, 
                              att.carrinho_status === 'quer_desistir' ? null : 'quer_desistir'
                            )}
                          >
                            <AlertTriangle className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Quer Desistir</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant={att.carrinho_status === 'comprou' ? 'default' : 'ghost'}
                            size="sm"
                            className={`h-8 px-2 ${att.carrinho_status === 'comprou' ? 'bg-primary hover:bg-primary/90' : ''}`}
                            onClick={() => handleSetStatus(
                              att.id, 
                              att.carrinho_status === 'comprou' ? null : 'comprou'
                            )}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Comprou</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant={att.carrinho_status === 'nao_comprou' ? 'destructive' : 'ghost'}
                            size="sm"
                            className="h-8 px-2"
                            onClick={() => handleSetStatus(
                              att.id, 
                              att.carrinho_status === 'nao_comprou' ? null : 'nao_comprou'
                            )}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Não Comprou</TooltipContent>
                      </Tooltip>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Detail Drawer */}
      <AprovadoDetailDrawer
        attendee={selectedAttendee}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </div>
  );
}
