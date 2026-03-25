import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePickerCustom } from '@/components/ui/DatePickerCustom';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Video, Loader2, Search, CheckCircle2, Clock, MessageCircle, FileText } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';
import { useAuth } from '@/contexts/AuthContext';
import { useGestorClosers } from '@/hooks/useGestorClosers';
import { useContractReport, getDefaultContractReportFilters, ContractReportFilters } from '@/hooks/useContractReport';
import { useVideoControlBatch, useToggleVideoSent } from '@/hooks/useVideoControl';
import { BusinessUnit } from '@/hooks/useMyBU';
import { ControleDiegoDrawer } from './ControleDiegoDrawer';

interface ControleDiegoPanelProps {
  bu?: BusinessUnit;
}

function formatWhatsAppUrl(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const number = digits.startsWith('55') ? digits : `55${digits}`;
  return `https://wa.me/${number}`;
}

export function ControleDiegoPanel({ bu }: ControleDiegoPanelProps) {
  const { role } = useAuth();
  const defaultFilters = getDefaultContractReportFilters();

  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: defaultFilters.startDate,
    to: defaultFilters.endDate,
  });
  const [selectedCloserId, setSelectedCloserId] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<any>(null);

  const { data: closers = [], isLoading: loadingClosers } = useGestorClosers('r1');

  const filters: ContractReportFilters = useMemo(() => ({
    startDate: dateRange?.from || defaultFilters.startDate,
    endDate: dateRange?.to || defaultFilters.endDate,
    closerId: selectedCloserId !== 'all' ? selectedCloserId : undefined,
  }), [dateRange, selectedCloserId, defaultFilters]);

  const allowedCloserIds = useMemo(() => {
    if (role === 'admin' || role === 'manager') return null;
    return closers.map(c => c.id);
  }, [role, closers]);

  const { data: agendaData = [], isLoading: loadingAgenda } = useContractReport(filters, allowedCloserIds);

  // Build unified rows from agenda data
  const rows = useMemo(() => {
    let filtered = agendaData.map(row => ({
      id: row.id,
      closerName: row.closerName,
      leadName: row.leadName,
      leadPhone: row.leadPhone,
      leadEmail: row.contactEmail || '',
      sdrName: row.sdrName,
      originName: row.originName,
      currentStage: row.currentStage,
      date: row.contractPaidAt || row.meetingDate,
      salesChannel: row.salesChannel.toUpperCase(),
      isRefunded: row.isRefunded,
    }));

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      const termDigits = searchTerm.replace(/\D/g, '');
      filtered = filtered.filter(r => {
        return r.leadName.toLowerCase().includes(term)
          || r.leadEmail.toLowerCase().includes(term)
          || (termDigits.length >= 4 && r.leadPhone.replace(/\D/g, '').includes(termDigits));
      });
    }

    return filtered.sort((a, b) => b.date.localeCompare(a.date));
  }, [agendaData, searchTerm]);

  // Batch fetch video control status
  const attendeeIds = useMemo(() => rows.map(r => r.id), [rows]);
  const { data: videoMap = {} } = useVideoControlBatch(attendeeIds);
  const toggleMutation = useToggleVideoSent();

  // Stats
  const stats = useMemo(() => {
    const total = rows.length;
    const sent = rows.filter(r => videoMap[r.id]?.video_sent).length;
    return { total, sent, pending: total - sent };
  }, [rows, videoMap]);

  const isLoading = loadingClosers || loadingAgenda;

  const handleRowClick = (row: any) => {
    setSelectedContract(row);
    setDrawerOpen(true);
  };

  const handleInlineToggle = async (attendeeId: string, currentSent: boolean) => {
    await toggleMutation.mutateAsync({ attendeeId, videoSent: !currentSent });
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="min-w-[200px]">
              <label className="text-sm font-medium text-muted-foreground mb-2 block">Período</label>
              <DatePickerCustom
                mode="range"
                selected={dateRange}
                onSelect={(range) => range && setDateRange(range as DateRange)}
                placeholder="Selecione o período"
              />
            </div>
            <div className="w-[250px]">
              <label className="text-sm font-medium text-muted-foreground mb-2 block">Buscar</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Nome, email ou telefone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="w-[200px]">
              <label className="text-sm font-medium text-muted-foreground mb-2 block">Closer</label>
              <Select value={selectedCloserId} onValueChange={setSelectedCloserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Closers</SelectItem>
                  {closers.map(closer => (
                    <SelectItem key={closer.id} value={closer.id}>{closer.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/10">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Contratos</p>
                <p className="text-3xl font-bold">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-green-500/10">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Vídeos Enviados</p>
                <p className="text-3xl font-bold">{stats.sent}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-orange-500/10">
                <Clock className="h-6 w-6 text-orange-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pendentes</p>
                <p className="text-3xl font-bold">{stats.pending}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            Controle Diego — Contratos pagos / envio de vídeo
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Nenhum contrato encontrado no período selecionado.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">Vídeo</TableHead>
                    <TableHead>Closer</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Lead</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Pipeline</TableHead>
                    <TableHead>Canal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(row => {
                    const vc = videoMap[row.id];
                    const isSent = vc?.video_sent || false;

                    return (
                      <TableRow
                        key={row.id}
                        className="cursor-pointer"
                        onClick={() => handleRowClick(row)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={isSent}
                            onCheckedChange={() => handleInlineToggle(row.id, isSent)}
                            disabled={toggleMutation.isPending}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{row.closerName}</TableCell>
                        <TableCell>
                          {row.date ? format(parseISO(row.date), 'dd/MM/yyyy', { locale: ptBR }) : '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {row.leadName}
                            {row.isRefunded && (
                              <Badge variant="destructive" className="bg-destructive/20 text-destructive border-destructive/30 text-[10px] px-1.5">
                                Reembolsado
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          {row.leadPhone ? (
                            <a
                              href={formatWhatsAppUrl(row.leadPhone)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-green-600 hover:text-green-700 font-mono text-sm"
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                              {row.leadPhone}
                            </a>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{row.originName}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{row.salesChannel}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Drawer */}
      <ControleDiegoDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        contract={selectedContract}
        videoSent={selectedContract ? (videoMap[selectedContract.id]?.video_sent || false) : false}
        videoNotes={selectedContract ? (videoMap[selectedContract.id]?.notes || null) : null}
      />
    </div>
  );
}
