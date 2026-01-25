import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { FileSpreadsheet, Users, TrendingUp, Target, Loader2 } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/formatters';
import * as XLSX from 'xlsx';
import { BusinessUnit } from '@/hooks/useMyBU';

// BU to squad mapping
const BU_SQUAD_MAP: Record<BusinessUnit, string> = {
  incorporador: 'Comercial',
  consorcio: 'Consórcio',
  credito: 'Crédito',
  projetos: 'Projetos',
};

interface PerformanceReportPanelProps {
  bu: BusinessUnit;
}

interface PerformanceData {
  id: string;
  name: string;
  email: string;
  role: string;
  metaGlobal: number;
  reunioesAgendadas: number;
  reunioesRealizadas: number;
  tentativas: number;
  valorVariavel: number;
  totalConta: number;
}

export function PerformanceReportPanel({ bu }: PerformanceReportPanelProps) {
  const currentMonth = startOfMonth(new Date());
  const [selectedMonth, setSelectedMonth] = useState<string>(format(currentMonth, 'yyyy-MM'));
  const [roleFilter, setRoleFilter] = useState<string>('all');
  
  // Generate last 6 months for selection
  const monthOptions = useMemo(() => {
    const options = [];
    for (let i = 0; i < 6; i++) {
      const date = subMonths(currentMonth, i);
      options.push({
        value: format(date, 'yyyy-MM'),
        label: format(date, 'MMMM yyyy', { locale: ptBR }),
      });
    }
    return options;
  }, [currentMonth]);
  
  // Fetch performance data
  const { data: performanceData = [], isLoading } = useQuery<PerformanceData[]>({
    queryKey: ['performance-report', bu, selectedMonth],
    queryFn: async (): Promise<PerformanceData[]> => {
      const squad = BU_SQUAD_MAP[bu];
      const [year, month] = selectedMonth.split('-');
      const monthStart = `${selectedMonth}-01`;
      const monthEnd = format(endOfMonth(new Date(parseInt(year), parseInt(month) - 1)), 'yyyy-MM-dd');
      
      // Fetch SDR payouts for this squad
      const { data: payouts, error } = await supabase
        .from('sdr_month_payout')
        .select(`
          id,
          sdr_id,
          valor_variavel,
          total_em_conta,
          meta_global_percentage,
          reunioes_agendadas_percentage,
          reunioes_realizadas_percentage,
          tentativas_percentage,
          sdr:sdr_id (
            id,
            email,
            name,
            squad
          )
        `)
        .gte('competencia', monthStart)
        .lte('competencia', monthEnd);
      
      if (error) throw error;
      
      // Filter by squad and transform
      const filteredData = (payouts || [])
        .filter((p: any) => p.sdr?.squad === squad)
        .map((p: any) => ({
          id: p.id,
          name: p.sdr?.name || 'N/A',
          email: p.sdr?.email || '',
          role: 'SDR',
          metaGlobal: p.meta_global_percentage || 0,
          reunioesAgendadas: p.reunioes_agendadas_percentage || 0,
          reunioesRealizadas: p.reunioes_realizadas_percentage || 0,
          tentativas: p.tentativas_percentage || 0,
          valorVariavel: p.valor_variavel || 0,
          totalConta: p.total_em_conta || 0,
        }));
      
      return filteredData;
    },
  });
  
  // Filter by role
  const filteredData = useMemo(() => {
    if (roleFilter === 'all') return performanceData;
    return performanceData.filter(p => p.role.toLowerCase() === roleFilter);
  }, [performanceData, roleFilter]);
  
  // Calculate stats
  const stats = useMemo(() => {
    const count = filteredData.length;
    const avgMeta = count > 0 
      ? filteredData.reduce((sum, p) => sum + p.metaGlobal, 0) / count 
      : 0;
    const totalVariavel = filteredData.reduce((sum, p) => sum + p.valorVariavel, 0);
    const aboveMeta = filteredData.filter(p => p.metaGlobal >= 100).length;
    
    return { count, avgMeta, totalVariavel, aboveMeta };
  }, [filteredData]);
  
  // Export to Excel
  const handleExportExcel = () => {
    const exportData = filteredData.map(row => ({
      'Nome': row.name,
      'Email': row.email,
      'Cargo': row.role,
      '% Meta Global': `${row.metaGlobal.toFixed(1)}%`,
      '% Reuniões Agendadas': `${row.reunioesAgendadas.toFixed(1)}%`,
      '% Reuniões Realizadas': `${row.reunioesRealizadas.toFixed(1)}%`,
      '% Tentativas': `${row.tentativas.toFixed(1)}%`,
      'Valor Variável': row.valorVariavel,
      'Total em Conta': row.totalConta,
    }));
    
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Desempenho');
    
    const fileName = `desempenho_${bu}_${selectedMonth}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };
  
  const getMetaBadgeVariant = (meta: number) => {
    if (meta >= 100) return 'default';
    if (meta >= 70) return 'secondary';
    return 'destructive';
  };
  
  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="w-[200px]">
              <label className="text-sm font-medium text-muted-foreground mb-2 block">Mês</label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="w-[150px]">
              <label className="text-sm font-medium text-muted-foreground mb-2 block">Cargo</label>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="sdr">SDR</SelectItem>
                  <SelectItem value="closer">Closer</SelectItem>
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/10">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Pessoas</p>
                <p className="text-3xl font-bold">{stats.count}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-success/10">
                <Target className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Média Meta Global</p>
                <p className="text-3xl font-bold">{stats.avgMeta.toFixed(1)}%</p>
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
                <p className="text-sm text-muted-foreground">Acima da Meta</p>
                <p className="text-3xl font-bold">{stats.aboveMeta}</p>
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
                <p className="text-sm text-muted-foreground">Total Variável</p>
                <p className="text-2xl font-bold">{formatCurrency(stats.totalVariavel)}</p>
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
            Desempenho da Equipe
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
                    <TableHead>Nome</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead className="text-center">% Meta Global</TableHead>
                    <TableHead className="text-center">% Agendadas</TableHead>
                    <TableHead className="text-center">% Realizadas</TableHead>
                    <TableHead className="text-center">% Tentativas</TableHead>
                    <TableHead className="text-right">Variável</TableHead>
                    <TableHead className="text-right">Total Conta</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.map(row => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{row.role}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={getMetaBadgeVariant(row.metaGlobal)}>
                          {row.metaGlobal.toFixed(1)}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">{row.reunioesAgendadas.toFixed(1)}%</TableCell>
                      <TableCell className="text-center">{row.reunioesRealizadas.toFixed(1)}%</TableCell>
                      <TableCell className="text-center">{row.tentativas.toFixed(1)}%</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(row.valorVariavel)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-success">
                        {formatCurrency(row.totalConta)}
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
