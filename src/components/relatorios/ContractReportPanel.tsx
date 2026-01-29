import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePickerCustom } from '@/components/ui/DatePickerCustom';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Download, FileSpreadsheet, Users, Calendar, TrendingUp, Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';
import { useAuth } from '@/contexts/AuthContext';
import { useGestorClosers } from '@/hooks/useGestorClosers';
import { useContractReport, getDefaultContractReportFilters, ContractReportFilters } from '@/hooks/useContractReport';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import * as XLSX from 'xlsx';
import { BusinessUnit } from '@/hooks/useMyBU';

// BU config - no longer filtering by pipeline name since data comes from agenda
// All contracts are fetched and shown regardless of BU

interface ContractReportPanelProps {
  bu?: BusinessUnit;
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
  
  // Fetch closers available for this user
  const { data: closers = [], isLoading: loadingClosers } = useGestorClosers('r1');
  
  // Fetch origins for filter (filtered by BU if applicable)
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
  
  // Build filters
  const filters: ContractReportFilters = useMemo(() => ({
    startDate: dateRange?.from || defaultFilters.startDate,
    endDate: dateRange?.to || defaultFilters.endDate,
    closerId: selectedCloserId !== 'all' ? selectedCloserId : undefined,
    originId: selectedOriginId !== 'all' ? selectedOriginId : undefined,
  }), [dateRange, selectedCloserId, selectedOriginId, defaultFilters]);
  
  // Determine allowed closers (null = all for admin/manager)
  const allowedCloserIds = useMemo(() => {
    if (role === 'admin' || role === 'manager') return null;
    // Coordenador sees only their squad's closers
    if (role === 'coordenador') {
      return closers.map(c => c.id);
    }
    // Other roles - pass the closers list (may be empty for restricted access)
    return closers.map(c => c.id);
  }, [role, closers]);
  
  // Fetch report data
  const { data: reportData = [], isLoading: loadingReport } = useContractReport(filters, allowedCloserIds);
  
  // Filter by sales channel
  const filteredReportData = useMemo(() => {
    return reportData.filter(row => 
      selectedChannel === 'all' || row.salesChannel === selectedChannel
    );
  }, [reportData, selectedChannel]);
  
  // Calculate stats
  const stats = useMemo(() => {
    const total = filteredReportData.length;
    const uniqueClosers = new Set(filteredReportData.map(r => r.closerEmail)).size;
    const avgPerCloser = uniqueClosers > 0 ? (total / uniqueClosers).toFixed(1) : '0';
    
    return { total, uniqueClosers, avgPerCloser };
  }, [filteredReportData]);
  
  // Export to Excel
  const handleExportExcel = () => {
    const exportData = filteredReportData.map(row => ({
      'Closer': row.closerName,
      'Email Closer': row.closerEmail,
      'Data Reunião': row.meetingDate ? format(parseISO(row.meetingDate), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : '',
      'Tipo': row.meetingType === 'r2' ? 'R2' : 'R1',
      'Lead': row.leadName,
      'Telefone': row.leadPhone,
      'SDR': row.sdrName,
      'Email SDR': row.sdrEmail,
      'Pipeline': row.originName,
      'Canal': row.salesChannel.toUpperCase(),
      'Estágio Atual': row.currentStage,
      'Profissão': row.customFields?.profissao || '',
      'Estado': row.customFields?.estado || '',
      'Renda': row.customFields?.renda || '',
      'Data Contrato': row.contractPaidAt ? format(parseISO(row.contractPaidAt), 'dd/MM/yyyy', { locale: ptBR }) : '',
    }));
    
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Contratos');
    
    const buSuffix = bu ? `_${bu}` : '';
    const fileName = `contratos${buSuffix}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };
  
  const isLoading = loadingClosers || loadingReport;
  
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
            <Button onClick={handleExportExcel} disabled={filteredReportData.length === 0}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Exportar Excel
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/10">
                <Download className="h-6 w-6 text-primary" />
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
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-warning/10">
                <TrendingUp className="h-6 w-6 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Média por Closer</p>
                <p className="text-3xl font-bold">{stats.avgPerCloser}</p>
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
          ) : filteredReportData.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Nenhum contrato encontrado no período selecionado.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Closer</TableHead>
                    <TableHead>Data Reunião</TableHead>
                    <TableHead>Lead</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>SDR</TableHead>
                    <TableHead>Pipeline</TableHead>
                    <TableHead>Canal</TableHead>
                    <TableHead>Estágio</TableHead>
                    <TableHead>Profissão</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReportData.map(row => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.closerName}</TableCell>
                      <TableCell>
                        {row.meetingDate 
                          ? format(parseISO(row.meetingDate), 'dd/MM/yyyy HH:mm', { locale: ptBR })
                          : '-'
                        }
                      </TableCell>
                      <TableCell>{row.leadName}</TableCell>
                      <TableCell className="font-mono text-sm">{row.leadPhone || '-'}</TableCell>
                      <TableCell>{row.sdrName}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{row.originName}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={row.salesChannel === 'a010' ? 'default' : 'secondary'}
                          className={
                            row.salesChannel === 'a010' 
                              ? 'bg-primary text-primary-foreground' 
                              : row.salesChannel === 'bio'
                                ? 'bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30'
                                : ''
                          }
                        >
                          {row.salesChannel.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{row.currentStage}</Badge>
                      </TableCell>
                      <TableCell>{row.customFields?.profissao || '-'}</TableCell>
                      <TableCell>{row.customFields?.estado || '-'}</TableCell>
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
