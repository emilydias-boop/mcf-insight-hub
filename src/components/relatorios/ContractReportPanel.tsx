import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePickerCustom } from '@/components/ui/DatePickerCustom';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Download, FileSpreadsheet, Users, Calendar, TrendingUp, Loader2, AlertCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';
import { useAuth } from '@/contexts/AuthContext';
import { useGestorClosers } from '@/hooks/useGestorClosers';
import { useContractReport, getDefaultContractReportFilters, ContractReportFilters } from '@/hooks/useContractReport';
import { useHublaA000Contracts, normalizePhoneForMatch, normalizeEmailForMatch } from '@/hooks/useHublaA000Contracts';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import * as XLSX from 'xlsx';
import { BusinessUnit } from '@/hooks/useMyBU';

type DataSource = 'all' | 'agenda' | 'hubla' | 'pending';

interface ContractReportPanelProps {
  bu?: BusinessUnit;
}

interface UnifiedContractRow {
  id: string;
  source: 'agenda' | 'hubla' | 'pending';
  closerName: string;
  closerEmail: string;
  date: string;
  leadName: string;
  leadPhone: string;
  leadEmail: string;
  sdrName: string;
  originName: string;
  currentStage: string;
  salesChannel: string;
  productName: string;
  netValue: number | null;
  customFields: Record<string, unknown>;
}

export function ContractReportPanel({ bu }: ContractReportPanelProps) {
  const { role } = useAuth();
  const defaultFilters = getDefaultContractReportFilters();
  
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: defaultFilters.startDate,
    to: defaultFilters.endDate,
  });
  const [selectedCloserId, setSelectedCloserId] = useState<string>('all');
  const [selectedOriginId, setSelectedOriginId] = useState<string>('all');
  const [selectedChannel, setSelectedChannel] = useState<string>('all');
  const [selectedSource, setSelectedSource] = useState<DataSource>('all');
  
  // Fetch closers available for this user
  const { data: closers = [], isLoading: loadingClosers } = useGestorClosers('r1');
  
  // Fetch origins for filter
  interface OriginOption {
    id: string;
    name: string;
    display_name: string | null;
  }
  
  const { data: origins = [] } = useQuery<OriginOption[]>({
    queryKey: ['crm-origins-simple'],
    queryFn: async (): Promise<OriginOption[]> => {
      const client = supabase as any;
      const result = await client
        .from('crm_origins')
        .select('id, name, display_name')
        .eq('is_active', true);
      
      if (result.error) throw result.error;
      const items = (result.data as OriginOption[]) || [];
      return items.sort((a, b) => (a.display_name || a.name).localeCompare(b.display_name || b.name));
    },
  });
  
  // Build filters for Agenda query
  const filters: ContractReportFilters = useMemo(() => ({
    startDate: dateRange?.from || defaultFilters.startDate,
    endDate: dateRange?.to || defaultFilters.endDate,
    closerId: selectedCloserId !== 'all' ? selectedCloserId : undefined,
    originId: selectedOriginId !== 'all' ? selectedOriginId : undefined,
  }), [dateRange, selectedCloserId, selectedOriginId, defaultFilters]);
  
  // Determine allowed closers (null = all for admin/manager)
  const allowedCloserIds = useMemo(() => {
    if (role === 'admin' || role === 'manager') return null;
    if (role === 'coordenador') {
      return closers.map(c => c.id);
    }
    return closers.map(c => c.id);
  }, [role, closers]);
  
  // Fetch Agenda data (contract_paid)
  const { data: agendaData = [], isLoading: loadingAgenda } = useContractReport(filters, allowedCloserIds);
  
  // Fetch Hubla A000 data
  const { data: hublaData = [], isLoading: loadingHubla } = useHublaA000Contracts({
    startDate: dateRange?.from || defaultFilters.startDate,
    endDate: dateRange?.to || defaultFilters.endDate,
  });
  
  // Build email/phone sets from Agenda for matching
  const agendaEmailSet = useMemo(() => {
    const set = new Set<string>();
    agendaData.forEach(row => {
      if (row.contactEmail) {
        set.add(normalizeEmailForMatch(row.contactEmail));
      }
    });
    return set;
  }, [agendaData]);
  
  const agendaPhoneSet = useMemo(() => {
    const set = new Set<string>();
    agendaData.forEach(row => {
      if (row.leadPhone) {
        const normalized = normalizePhoneForMatch(row.leadPhone);
        if (normalized.length >= 8) set.add(normalized);
      }
    });
    return set;
  }, [agendaData]);
  
  // Categorize Hubla transactions: matched vs pending
  const { hublaMatched, hublaPending } = useMemo(() => {
    const matched: typeof hublaData = [];
    const pending: typeof hublaData = [];
    
    hublaData.forEach(tx => {
      const emailMatch = tx.customerEmail && agendaEmailSet.has(normalizeEmailForMatch(tx.customerEmail));
      const phoneMatch = tx.customerPhone && agendaPhoneSet.has(normalizePhoneForMatch(tx.customerPhone));
      
      if (emailMatch || phoneMatch) {
        matched.push(tx);
      } else {
        pending.push(tx);
      }
    });
    
    return { hublaMatched: matched, hublaPending: pending };
  }, [hublaData, agendaEmailSet, agendaPhoneSet]);
  
  // Transform to unified format
  const unifiedData = useMemo((): UnifiedContractRow[] => {
    const rows: UnifiedContractRow[] = [];
    
    // Add Agenda rows
    if (selectedSource === 'all' || selectedSource === 'agenda') {
      agendaData.forEach(row => {
        rows.push({
          id: `agenda-${row.id}`,
          source: 'agenda',
          closerName: row.closerName,
          closerEmail: row.closerEmail,
          date: row.contractPaidAt || row.meetingDate,
          leadName: row.leadName,
          leadPhone: row.leadPhone,
          leadEmail: row.contactEmail || '',
          sdrName: row.sdrName,
          originName: row.originName,
          currentStage: row.currentStage,
          salesChannel: row.salesChannel.toUpperCase(),
          productName: 'Contrato R1',
          netValue: null,
          customFields: row.customFields,
        });
      });
    }
    
    // Add Hubla rows (all or just pending)
    if (selectedSource === 'hubla') {
      hublaData.forEach(tx => {
        rows.push({
          id: `hubla-${tx.id}`,
          source: 'hubla',
          closerName: '—',
          closerEmail: '',
          date: tx.saleDate,
          leadName: tx.customerName,
          leadPhone: tx.customerPhone || '',
          leadEmail: tx.customerEmail || '',
          sdrName: '—',
          originName: '—',
          currentStage: '—',
          salesChannel: '—',
          productName: tx.productName,
          netValue: tx.netValue,
          customFields: {},
        });
      });
    } else if (selectedSource === 'pending') {
      hublaPending.forEach(tx => {
        rows.push({
          id: `pending-${tx.id}`,
          source: 'pending',
          closerName: 'Sem atribuição',
          closerEmail: '',
          date: tx.saleDate,
          leadName: tx.customerName,
          leadPhone: tx.customerPhone || '',
          leadEmail: tx.customerEmail || '',
          sdrName: '—',
          originName: '—',
          currentStage: '—',
          salesChannel: '—',
          productName: tx.productName,
          netValue: tx.netValue,
          customFields: {},
        });
      });
    } else if (selectedSource === 'all') {
      // For "all", add pending Hubla transactions
      hublaPending.forEach(tx => {
        rows.push({
          id: `pending-${tx.id}`,
          source: 'pending',
          closerName: 'Sem atribuição',
          closerEmail: '',
          date: tx.saleDate,
          leadName: tx.customerName,
          leadPhone: tx.customerPhone || '',
          leadEmail: tx.customerEmail || '',
          sdrName: '—',
          originName: '—',
          currentStage: '—',
          salesChannel: '—',
          productName: tx.productName,
          netValue: tx.netValue,
          customFields: {},
        });
      });
    }
    
    // Filter by sales channel
    const filtered = rows.filter(row => 
      selectedChannel === 'all' || row.salesChannel === selectedChannel.toUpperCase() || row.source !== 'agenda'
    );
    
    // Sort by date DESC
    return filtered.sort((a, b) => b.date.localeCompare(a.date));
  }, [agendaData, hublaData, hublaPending, selectedSource, selectedChannel]);
  
  // Calculate stats
  const stats = useMemo(() => {
    const agendaTotal = agendaData.length;
    const hublaTotal = hublaData.length;
    const pendingTotal = hublaPending.length;
    const uniqueClosers = new Set(agendaData.map(r => r.closerEmail)).size;
    
    return { agendaTotal, hublaTotal, pendingTotal, uniqueClosers };
  }, [agendaData, hublaData, hublaPending]);
  
  // Export to Excel
  const handleExportExcel = () => {
    const exportData = unifiedData.map(row => ({
      'Fonte': row.source === 'agenda' ? 'Agenda' : row.source === 'pending' ? 'Pendente' : 'Hubla',
      'Closer': row.closerName,
      'Data': row.date ? format(parseISO(row.date), 'dd/MM/yyyy', { locale: ptBR }) : '',
      'Lead/Cliente': row.leadName,
      'Telefone': row.leadPhone,
      'Email': row.leadEmail,
      'SDR': row.sdrName,
      'Pipeline': row.originName,
      'Canal': row.salesChannel,
      'Estágio': row.currentStage,
      'Produto': row.productName,
      'Valor': row.netValue ? `R$ ${row.netValue.toFixed(2)}` : '',
      'Profissão': (row.customFields as any)?.profissao || '',
      'Estado': (row.customFields as any)?.estado || '',
    }));
    
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Contratos');
    
    const buSuffix = bu ? `_${bu}` : '';
    const sourceSuffix = selectedSource !== 'all' ? `_${selectedSource}` : '';
    const fileName = `contratos${buSuffix}${sourceSuffix}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };
  
  const isLoading = loadingClosers || loadingAgenda || loadingHubla;
  
  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium text-muted-foreground mb-2 block">Período</label>
              <DatePickerCustom
                mode="range"
                selected={dateRange}
                onSelect={(range) => range && setDateRange(range as DateRange)}
                placeholder="Selecione o período"
              />
            </div>
            
            <div className="w-[180px]">
              <label className="text-sm font-medium text-muted-foreground mb-2 block">Fonte</label>
              <Select value={selectedSource} onValueChange={(v) => setSelectedSource(v as DataSource)}>
                <SelectTrigger>
                  <SelectValue placeholder="Fonte" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Ambos</SelectItem>
                  <SelectItem value="agenda">Agenda (atribuídos)</SelectItem>
                  <SelectItem value="hubla">Hubla A000</SelectItem>
                  <SelectItem value="pending">Pendentes</SelectItem>
                </SelectContent>
              </Select>
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
                    <SelectItem key={closer.id} value={closer.id}>
                      {closer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="w-[200px]">
              <label className="text-sm font-medium text-muted-foreground mb-2 block">Pipeline</label>
              <Select value={selectedOriginId} onValueChange={setSelectedOriginId}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Pipelines</SelectItem>
                  {origins.map((origin) => (
                    <SelectItem key={origin.id} value={origin.id}>
                      {origin.display_name || origin.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="w-[150px]">
              <label className="text-sm font-medium text-muted-foreground mb-2 block">Canal</label>
              <Select value={selectedChannel} onValueChange={setSelectedChannel}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="a010">A010</SelectItem>
                  <SelectItem value="bio">BIO</SelectItem>
                  <SelectItem value="live">LIVE</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleExportExcel} disabled={unifiedData.length === 0}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Exportar Excel
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/10">
                <Download className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Agenda (Atribuídos)</p>
                <p className="text-3xl font-bold">{stats.agendaTotal}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-blue-500/10">
                <FileSpreadsheet className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Hubla A000 (Total)</p>
                <p className="text-3xl font-bold">{stats.hublaTotal}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-warning/10">
                <AlertCircle className="h-6 w-6 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pendentes</p>
                <p className="text-3xl font-bold">{stats.pendingTotal}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-success/10">
                <Users className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Closers Ativos</p>
                <p className="text-3xl font-bold">{stats.uniqueClosers}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Data Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Contratos no Período
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : unifiedData.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Nenhum contrato encontrado no período selecionado.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fonte</TableHead>
                    <TableHead>Closer</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Lead</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>SDR</TableHead>
                    <TableHead>Pipeline</TableHead>
                    <TableHead>Canal</TableHead>
                    <TableHead>Estágio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unifiedData.map(row => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <Badge 
                          variant={row.source === 'agenda' ? 'default' : row.source === 'pending' ? 'destructive' : 'secondary'}
                          className={
                            row.source === 'agenda' 
                              ? 'bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30'
                              : row.source === 'pending'
                                ? 'bg-orange-500/20 text-orange-700 dark:text-orange-400 border-orange-500/30'
                                : ''
                          }
                        >
                          {row.source === 'agenda' ? 'Agenda' : row.source === 'pending' ? 'Pendente' : 'Hubla'}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{row.closerName}</TableCell>
                      <TableCell>
                        {row.date 
                          ? format(parseISO(row.date), 'dd/MM/yyyy', { locale: ptBR })
                          : '-'
                        }
                      </TableCell>
                      <TableCell>{row.leadName}</TableCell>
                      <TableCell className="font-mono text-sm">{row.leadPhone || '-'}</TableCell>
                      <TableCell>{row.sdrName}</TableCell>
                      <TableCell>
                        {row.originName !== '—' ? (
                          <Badge variant="outline">{row.originName}</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {row.salesChannel !== '—' ? (
                          <Badge 
                            variant={row.salesChannel === 'A010' ? 'default' : 'secondary'}
                            className={
                              row.salesChannel === 'A010' 
                                ? 'bg-primary text-primary-foreground' 
                                : row.salesChannel === 'BIO'
                                  ? 'bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30'
                                  : ''
                            }
                          >
                            {row.salesChannel}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {row.currentStage !== '—' ? (
                          <Badge variant="secondary">{row.currentStage}</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
