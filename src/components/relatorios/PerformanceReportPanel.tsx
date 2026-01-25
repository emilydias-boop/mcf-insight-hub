import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePickerCustom } from '@/components/ui/DatePickerCustom';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { FileSpreadsheet, Users, TrendingUp, Target, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';
import { usePerformanceReport } from '@/hooks/usePerformanceReport';
import { useGestorClosers } from '@/hooks/useGestorClosers';
import { useAuth } from '@/contexts/AuthContext';
import * as XLSX from 'xlsx';
import { BusinessUnit } from '@/hooks/useMyBU';

interface PerformanceReportPanelProps {
  bu: BusinessUnit;
}

export function PerformanceReportPanel({ bu }: PerformanceReportPanelProps) {
  const { role } = useAuth();
  const defaultStart = startOfMonth(new Date());
  const defaultEnd = endOfMonth(new Date());
  
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: defaultStart,
    to: defaultEnd,
  });
  const [selectedCloserId, setSelectedCloserId] = useState<string>('all');
  
  // Fetch closers for filter
  const { data: closers = [], isLoading: loadingClosers } = useGestorClosers();
  
  // Build filters
  const filters = useMemo(() => ({
    startDate: dateRange?.from || defaultStart,
    endDate: dateRange?.to || defaultEnd,
    closerId: selectedCloserId !== 'all' ? selectedCloserId : undefined,
  }), [dateRange, selectedCloserId, defaultStart, defaultEnd]);
  
  // Fetch performance data from agenda
  const { data: performanceData = [], isLoading: loadingData } = usePerformanceReport(filters);
  
  // Filter by allowed closers for non-admin
  const filteredData = useMemo(() => {
    if (role === 'admin' || role === 'manager') return performanceData;
    const allowedIds = closers.map(c => c.id);
    return performanceData.filter(p => allowedIds.includes(p.closerId));
  }, [performanceData, role, closers]);
  
  // Calculate stats
  const stats = useMemo(() => {
    const count = filteredData.length;
    const totalRealizadas = filteredData.reduce((sum, p) => sum + p.realizadas, 0);
    const totalContratos = filteredData.reduce((sum, p) => sum + p.contratos, 0);
    const avgComparecimento = count > 0 
      ? filteredData.reduce((sum, p) => sum + p.percentComparecimento, 0) / count 
      : 0;
    const avgConversao = count > 0
      ? filteredData.reduce((sum, p) => sum + p.percentConversao, 0) / count
      : 0;
    
    return { count, totalRealizadas, totalContratos, avgComparecimento, avgConversao };
  }, [filteredData]);
  
  // Export to Excel
  const handleExportExcel = () => {
    const exportData = filteredData.map(row => ({
      'Closer': row.closerName,
      'Email': row.closerEmail,
      'Total Agendadas': row.totalAgendadas,
      'Realizadas': row.realizadas,
      'No-Show': row.noShows,
      'Contratos': row.contratos,
      '% Comparecimento': `${row.percentComparecimento}%`,
      '% Conversão': `${row.percentConversao}%`,
    }));
    
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Desempenho');
    
    const fileName = `desempenho_${bu}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };
  
  const getConversionBadgeVariant = (percent: number) => {
    if (percent >= 50) return 'default';
    if (percent >= 30) return 'secondary';
    return 'destructive';
  };
  
  const isLoading = loadingClosers || loadingData;
  
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
            
            <Button onClick={handleExportExcel} disabled={filteredData.length === 0}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Exportar Excel
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/10">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Closers</p>
                <p className="text-3xl font-bold">{stats.count}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-success/10">
                <CheckCircle className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Realizadas</p>
                <p className="text-3xl font-bold">{stats.totalRealizadas}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-warning/10">
                <Target className="h-6 w-6 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Contratos</p>
                <p className="text-3xl font-bold">{stats.totalContratos}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-muted">
                <TrendingUp className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">% Comparec.</p>
                <p className="text-3xl font-bold">{stats.avgComparecimento.toFixed(0)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/10">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">% Conversão</p>
                <p className="text-3xl font-bold">{stats.avgConversao.toFixed(0)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Data Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Desempenho por Closer
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredData.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Nenhum dado de desempenho encontrado para o período.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Closer</TableHead>
                    <TableHead className="text-center">Agendadas</TableHead>
                    <TableHead className="text-center">Realizadas</TableHead>
                    <TableHead className="text-center">No-Show</TableHead>
                    <TableHead className="text-center">Contratos</TableHead>
                    <TableHead className="text-center">% Comparec.</TableHead>
                    <TableHead className="text-center">% Conversão</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.map(row => (
                    <TableRow key={row.closerId}>
                      <TableCell className="font-medium">{row.closerName}</TableCell>
                      <TableCell className="text-center">{row.totalAgendadas}</TableCell>
                      <TableCell className="text-center font-medium text-success">
                        {row.realizadas}
                      </TableCell>
                      <TableCell className="text-center text-destructive">
                        {row.noShows}
                      </TableCell>
                      <TableCell className="text-center font-bold text-primary">
                        {row.contratos}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{row.percentComparecimento}%</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={getConversionBadgeVariant(row.percentConversao)}>
                          {row.percentConversao}%
                        </Badge>
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
