import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { SdrStatusBadge } from '@/components/sdr-fechamento/SdrStatusBadge';
import { useSdrPayouts, useRecalculateAllPayouts } from '@/hooks/useSdrFechamento';
import { formatCurrency } from '@/lib/formatters';
import { Calculator, Download, Eye, RefreshCw } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const FechamentoSDRList = () => {
  const navigate = useNavigate();
  const currentMonth = format(new Date(), 'yyyy-MM');
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  
  const { data: payouts, isLoading } = useSdrPayouts(selectedMonth);
  const recalculateAll = useRecalculateAllPayouts();

  // Fetch comp_plans for all SDRs to get OTE
  const { data: compPlans } = useQuery({
    queryKey: ['sdr-comp-plans', selectedMonth],
    queryFn: async () => {
      const [year, month] = selectedMonth.split('-').map(Number);
      const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
      
      const { data, error } = await supabase
        .from('sdr_comp_plan')
        .select('*')
        .lte('vigencia_inicio', monthStart)
        .or(`vigencia_fim.is.null,vigencia_fim.gte.${monthStart}`)
        .eq('status', 'active');
      
      if (error) throw error;
      return data;
    },
  });

  // Generate months from January 2025 to current month
  const generateMonthOptions = () => {
    const options = [];
    const startDate = new Date(2025, 0, 1); // January 2025
    const endDate = new Date();
    
    let current = endDate;
    while (current >= startDate) {
      options.push({
        value: format(current, 'yyyy-MM'),
        label: format(current, 'MMMM yyyy', { locale: ptBR }),
      });
      current = subMonths(current, 1);
    }
    return options;
  };

  const monthOptions = generateMonthOptions();

  const getCompPlanForSdr = (sdrId: string) => {
    return compPlans?.find(cp => cp.sdr_id === sdrId);
  };

  const calculateGlobalPct = (payout: NonNullable<typeof payouts>[0]) => {
    const pcts = [
      payout.pct_reunioes_agendadas,
      payout.pct_reunioes_realizadas,
      payout.pct_tentativas,
      payout.pct_organizacao,
    ].filter((p) => p !== null) as number[];
    
    if (pcts.length === 0) return 0;
    return pcts.reduce((a, b) => a + b, 0) / pcts.length;
  };

  const escapeCSV = (value: string | number | null | undefined): string => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const handleExportCSV = () => {
    if (!payouts || payouts.length === 0) return;

    const headers = [
      'Nome',
      'Nível',
      'OTE',
      '% Meta Global',
      '% Reuniões Agendadas',
      '% Reuniões Realizadas',
      '% Tentativas',
      '% Organização',
      'Valor Fixo',
      'Valor Variável',
      'Valor Reuniões Agendadas',
      'Valor Reuniões Realizadas',
      'Valor Tentativas',
      'Valor Organização',
      'Total Conta',
      'iFood Mensal',
      'iFood Ultrameta',
      'iFood Ultrameta Autorizado',
      'Total iFood',
      'Status',
    ];

    const rows = payouts.map((p) => {
      const compPlan = getCompPlanForSdr(p.sdr_id);
      const globalPct = calculateGlobalPct(p);
      return [
        escapeCSV(p.sdr?.name || ''),
        escapeCSV(p.sdr?.nivel || 1),
        escapeCSV(compPlan?.ote_total || 4000),
        escapeCSV(globalPct.toFixed(1)),
        escapeCSV((p.pct_reunioes_agendadas || 0).toFixed(1)),
        escapeCSV((p.pct_reunioes_realizadas || 0).toFixed(1)),
        escapeCSV((p.pct_tentativas || 0).toFixed(1)),
        escapeCSV((p.pct_organizacao || 0).toFixed(1)),
        escapeCSV(p.valor_fixo || 0),
        escapeCSV(p.valor_variavel_total || 0),
        escapeCSV(p.valor_reunioes_agendadas || 0),
        escapeCSV(p.valor_reunioes_realizadas || 0),
        escapeCSV(p.valor_tentativas || 0),
        escapeCSV(p.valor_organizacao || 0),
        escapeCSV(p.total_conta || 0),
        escapeCSV(p.ifood_mensal || 0),
        escapeCSV(p.ifood_ultrameta || 0),
        escapeCSV(p.ifood_ultrameta_autorizado ? 'Sim' : 'Não'),
        escapeCSV(p.total_ifood || 0),
        escapeCSV(p.status),
      ];
    });

    const csvContent = [
      headers.join(';'),
      ...rows.map((row) => row.join(';')),
    ].join('\n');

    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `fechamento-sdr-${selectedMonth}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Fechamento SDR</h1>
          <p className="text-muted-foreground">
            Gerencie o fechamento mensal dos SDRs
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            onClick={() => recalculateAll.mutate(selectedMonth)}
            disabled={recalculateAll.isPending}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${recalculateAll.isPending ? 'animate-spin' : ''}`} />
            Recalcular Mês
          </Button>

          <Button variant="outline" onClick={handleExportCSV}>
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Fechamentos de {monthOptions.find((o) => o.value === selectedMonth)?.label}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !payouts || payouts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>Nenhum fechamento encontrado para este mês.</p>
              <Button
                className="mt-4"
                onClick={() => recalculateAll.mutate(selectedMonth)}
                disabled={recalculateAll.isPending}
              >
                <Calculator className="h-4 w-4 mr-2" />
                Gerar Fechamentos
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome do SDR</TableHead>
                  <TableHead className="text-center">Nível</TableHead>
                  <TableHead className="text-right">OTE</TableHead>
                  <TableHead className="text-right">% Meta Global</TableHead>
                  <TableHead className="text-right">Variável</TableHead>
                  <TableHead className="text-right">Total Conta</TableHead>
                  <TableHead className="text-right">iFood</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payouts.map((payout) => {
                  const globalPct = calculateGlobalPct(payout);
                  const compPlan = getCompPlanForSdr(payout.sdr_id);
                  const nivel = payout.sdr?.nivel || 1;
                  const ote = compPlan?.ote_total || 4000;
                  
                  return (
                    <TableRow key={payout.id}>
                      <TableCell className="font-medium">
                        {payout.sdr?.name || 'SDR'}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="font-mono">
                          N{nivel}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(ote)}
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={
                            globalPct >= 100
                              ? 'text-green-400'
                              : globalPct >= 70
                              ? 'text-yellow-400'
                              : 'text-red-400'
                          }
                        >
                          {globalPct.toFixed(1)}%
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(payout.valor_variavel_total || 0)}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(payout.total_conta || 0)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(payout.total_ifood || 0)}
                      </TableCell>
                      <TableCell className="text-center">
                        <SdrStatusBadge status={payout.status} />
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/fechamento-sdr/${payout.id}`)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Ver
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default FechamentoSDRList;