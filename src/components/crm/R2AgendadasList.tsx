import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Search, Filter, Copy, Check, Download, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { R2CarrinhoAttendee } from '@/hooks/useR2CarrinhoData';
import { cn } from '@/lib/utils';
import { parseDateWithoutTimezone } from '@/lib/dateHelpers';
import { toast } from 'sonner';

interface R2AgendadasListProps {
  attendees: R2CarrinhoAttendee[];
  isLoading?: boolean;
  onSelectAttendee?: (attendee: R2CarrinhoAttendee) => void;
}

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  scheduled: { label: 'Agendada', className: 'bg-blue-500 text-white border-blue-500' },
  invited: { label: 'Convidado', className: 'bg-purple-500 text-white border-purple-500' },
  completed: { label: 'Realizada', className: 'bg-green-500 text-white border-green-500' },
  no_show: { label: 'No-show', className: 'bg-red-500 text-white border-red-500' },
  contract_paid: { label: 'Contrato Pago', className: 'bg-emerald-600 text-white border-emerald-600' },
  refunded: { label: 'Reembolsado', className: 'bg-orange-500 text-white border-orange-500' },
  pending: { label: 'Pendente', className: 'bg-yellow-500 text-black border-yellow-500' },
};

const POSITION_OPTIONS = [
  { value: 'scheduled', label: 'Agendada' },
  { value: 'invited', label: 'Convidado' },
  { value: 'completed', label: 'Realizada' },
  { value: 'no_show', label: 'No-show' },
  { value: 'contract_paid', label: 'Contrato Pago' },
];

function renderStatusCell(att: R2CarrinhoAttendee) {
  const isContractPaid = att.status === 'contract_paid' || att.meeting_status === 'contract_paid';
  const isAprovado = att.r2_status_name?.toLowerCase().includes('aprovado');
  
  // Caso 1: Contrato Pago
  if (isContractPaid) {
    return (
      <div className="flex items-center justify-end gap-2">
        <span className="text-emerald-600 text-sm font-medium">
          CP {att.contract_paid_at ? format(new Date(att.contract_paid_at), 'dd/MM') : ''}
        </span>
        {isAprovado && (
          <Badge className="bg-emerald-500 text-white text-xs">Aprovado</Badge>
        )}
      </div>
    );
  }
  
  // Caso 2: Aprovado (sem contrato pago) - Badge prominente
  if (isAprovado) {
    return (
      <Badge className="bg-emerald-500 text-white text-xs">Aprovado</Badge>
    );
  }
  
  // Caso 3: Tem status R2 definido (Em análise, Reprovado, Desistente, etc)
  if (att.r2_status_name) {
    return (
      <Badge variant="outline" className="text-xs bg-purple-500/10 border-purple-500 text-purple-500">
        {att.r2_status_name}
      </Badge>
    );
  }
  
  // Caso 4: Sem status R2 - Mostra posição da reunião (Realizada, No-show, Agendada)
  const positionInfo = STATUS_LABELS[att.status] || STATUS_LABELS[att.meeting_status] || STATUS_LABELS.scheduled;
  
  return (
    <Badge variant="outline" className={cn('text-xs', positionInfo.className)}>
      {positionInfo.label}
    </Badge>
  );
}

export function R2AgendadasList({ attendees, isLoading, onSelectAttendee }: R2AgendadasListProps) {
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [closerFilter, setCloserFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [positionFilter, setPositionFilter] = useState<string>('all');
  const [copied, setCopied] = useState(false);

  // Extract unique closers from attendees
  const closers = useMemo(() => {
    const uniqueClosers = new Map<string, { id: string; name: string; color: string | null }>();
    attendees.forEach(att => {
      if (att.closer_id && att.closer_name) {
        uniqueClosers.set(att.closer_id, {
          id: att.closer_id,
          name: att.closer_name,
          color: att.closer_color || null,
        });
      }
    });
    return Array.from(uniqueClosers.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [attendees]);

  // Extract unique dates from attendees
  const meetingDates = useMemo(() => {
    const uniqueDates = new Set<string>();
    attendees.forEach(att => {
      const dateStr = format(new Date(att.scheduled_at), 'yyyy-MM-dd');
      uniqueDates.add(dateStr);
    });
    return Array.from(uniqueDates).sort();
  }, [attendees]);

  // Extract unique R2 statuses from attendees - including "Pendente" for those without status
  const r2Statuses = useMemo(() => {
    const unique = new Map<string, string>();
    let hasWithoutStatus = false;
    
    attendees.forEach(att => {
      if (att.r2_status_id && att.r2_status_name) {
        unique.set(att.r2_status_id, att.r2_status_name);
      } else {
        hasWithoutStatus = true;
      }
    });
    
    const statuses = Array.from(unique.entries()).map(([id, name]) => ({ id, name }));
    
    // Add option for leads without R2 status
    if (hasWithoutStatus) {
      statuses.unshift({ id: '__no_status__', name: 'Pendente (Sem avaliação)' });
    }
    
    return statuses;
  }, [attendees]);

  // Filter attendees based on all criteria
  const filteredAttendees = useMemo(() => {
    return attendees.filter(att => {
      // Search filter (name, phone, email)
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
      
      // Status R2 filter (Aprovado, Pendente, etc)
      if (statusFilter !== 'all') {
        if (statusFilter === '__no_status__') {
          // Filter leads WITHOUT R2 status
          if (att.r2_status_id) return false;
        } else {
          // Filter by specific status
          if (att.r2_status_id !== statusFilter) return false;
        }
      }
      
      // Position filter (Realizada, No-show, Agendada)
      if (positionFilter !== 'all' && att.status !== positionFilter) {
        return false;
      }
      
      return true;
    });
  }, [attendees, searchTerm, closerFilter, dateFilter, statusFilter, positionFilter]);

  // Check if any filter is active
  const hasActiveFilters = searchTerm || closerFilter !== 'all' || dateFilter !== 'all' || statusFilter !== 'all' || positionFilter !== 'all';

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm('');
    setCloserFilter('all');
    setDateFilter('all');
    setStatusFilter('all');
    setPositionFilter('all');
  };

  // Generate text report
  const generateReport = () => {
    let report = `*R2s da Semana*\n\nTotal: ${filteredAttendees.length}\n\n`;
    
    filteredAttendees.forEach((att) => {
      const name = att.attendee_name || att.deal_name || 'Sem nome';
      const phone = att.attendee_phone || att.contact_phone || '-';
      const closer = att.closer_name || '-';
      const dateTime = format(new Date(att.scheduled_at), 'dd/MM HH:mm');
      const statusR2 = att.r2_status_name || '-';
      const position = STATUS_LABELS[att.status]?.label || att.status || '-';
      
      report += `${name}\t${phone}\t${closer}\t${dateTime}\t${statusR2}\t${position}\n`;
    });
    
    return report;
  };

  // Copy report to clipboard
  const handleCopyReport = async () => {
    try {
      const report = generateReport();
      await navigator.clipboard.writeText(report);
      setCopied(true);
      toast.success('Relatório copiado!');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Erro ao copiar relatório');
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = ['Nome', 'Telefone', 'Email', 'Closer', 'Data/Hora', 'Status R2', 'Posição'];
    const rows = filteredAttendees.map(att => [
      att.attendee_name || att.deal_name || 'Sem nome',
      att.attendee_phone || att.contact_phone || '-',
      att.contact_email || '-',
      att.closer_name || '-',
      format(new Date(att.scheduled_at), 'dd/MM/yyyy HH:mm'),
      att.r2_status_name || '-',
      STATUS_LABELS[att.status]?.label || att.status || '-',
    ]);
    
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `r2-agendadas-${format(new Date(), 'dd-MM-yyyy')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exportado!');
  };

  if (isLoading) {
    return <div className="flex justify-center py-8">Carregando...</div>;
  }

  if (attendees.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Calendar className="h-12 w-12 mb-4 opacity-50" />
        <p>Nenhuma R2 encontrada na semana</p>
      </div>
    );
  }

  // Group filtered attendees by day
  const byDay = filteredAttendees.reduce((acc, att) => {
    const day = format(new Date(att.scheduled_at), 'yyyy-MM-dd');
    if (!acc[day]) acc[day] = [];
    acc[day].push(att);
    return acc;
  }, {} as Record<string, R2CarrinhoAttendee[]>);

  // Sort days chronologically
  const sortedDays = Object.keys(byDay).sort();

  return (
    <div className="space-y-4">
      {/* Header with count and action buttons */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Badge variant="secondary" className="text-lg px-3 py-1 w-fit">
          {filteredAttendees.length} R2s {hasActiveFilters ? 'filtradas' : 'na semana'}
        </Badge>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleCopyReport}>
            {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
            {copied ? 'Copiado!' : 'Copiar Relatório'}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, telefone ou email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        
        {/* Closer filter */}
        <Select value={closerFilter} onValueChange={setCloserFilter}>
          <SelectTrigger className="w-[160px]">
            <Filter className="h-4 w-4 mr-2 opacity-50" />
            <SelectValue placeholder="Closer" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Closers</SelectItem>
            {closers.map(closer => (
              <SelectItem key={closer.id} value={closer.id}>
                <div className="flex items-center gap-2">
                  {closer.color && (
                    <div 
                      className="w-2 h-2 rounded-full shrink-0" 
                      style={{ backgroundColor: closer.color }} 
                    />
                  )}
                  <span>{closer.name}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Date filter */}
        <Select value={dateFilter} onValueChange={setDateFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Data" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas Datas</SelectItem>
            {meetingDates.map(date => (
              <SelectItem key={date} value={date}>
                {format(parseDateWithoutTimezone(date), 'dd/MM (EEE)', { locale: ptBR })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Status R2 filter (Aprovado, Pendente, etc) */}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status R2" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Status</SelectItem>
            {r2Statuses.map(status => (
              <SelectItem key={status.id} value={status.id}>
                {status.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Position filter (Realizada, No-show, Agendada) */}
        <Select value={positionFilter} onValueChange={setPositionFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Posição" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas Posições</SelectItem>
            {POSITION_OPTIONS.map(option => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Clear filters button */}
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <XCircle className="h-4 w-4 mr-1" />
            Limpar
          </Button>
        )}
      </div>

      {/* Results */}
      {filteredAttendees.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Search className="h-12 w-12 mb-4 opacity-50" />
          <p>Nenhuma R2 encontrada com os filtros aplicados</p>
          <Button variant="link" onClick={clearFilters} className="mt-2">
            Limpar filtros
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedDays.map((day) => {
            const dayAttendees = byDay[day];
            // Sort by time within the day
            const sortedAttendees = [...dayAttendees].sort((a, b) => 
              new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
            );

            return (
              <Card key={day}>
                <CardHeader className="py-3 px-4 bg-muted/50">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold capitalize">
                      {format(parseDateWithoutTimezone(day), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                    </span>
                    <Badge variant="outline">{dayAttendees.length}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[80px]">Horário</TableHead>
                        <TableHead>Nome Lead</TableHead>
                        <TableHead className="w-[140px]">Closer R2</TableHead>
                        <TableHead className="w-[90px]">Dia R1</TableHead>
                        <TableHead className="text-right">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedAttendees.map((att) => (
                        <TableRow
                          key={att.id}
                          className="cursor-pointer hover:bg-muted/30"
                          onClick={() => onSelectAttendee?.(att)}
                        >
                          <TableCell className="font-mono font-medium text-primary">
                            {format(new Date(att.scheduled_at), 'HH:mm')}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium truncate max-w-[200px]">
                                {att.attendee_name || att.deal_name || 'Sem nome'}
                              </span>
                              {att.partner_name && (
                                <span className="text-xs text-muted-foreground">+ {att.partner_name}</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="w-[140px]">
                            <div className="flex items-center gap-2 max-w-[140px]">
                              {att.closer_color && (
                                <div 
                                  className="w-2.5 h-2.5 rounded-full shrink-0" 
                                  style={{ backgroundColor: att.closer_color }}
                                />
                              )}
                              <span className="truncate">{att.closer_name || '-'}</span>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-sm text-muted-foreground">
                            {att.r1_date ? format(new Date(att.r1_date), 'dd/MM') : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            {renderStatusCell(att)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
