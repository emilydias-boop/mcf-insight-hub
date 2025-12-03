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
import { SdrStatusBadge } from '@/components/sdr-fechamento/SdrStatusBadge';
import { useSdrPayouts, useRecalculateAllPayouts } from '@/hooks/useSdrFechamento';
import { formatCurrency } from '@/lib/formatters';
import { Calculator, Download, Eye, RefreshCw } from 'lucide-react';

const FechamentoSDRList = () => {
  const navigate = useNavigate();
  const currentMonth = format(new Date(), 'yyyy-MM');
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  
  const { data: payouts, isLoading } = useSdrPayouts(selectedMonth);
  const recalculateAll = useRecalculateAllPayouts();

  // Generate last 12 months options
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const date = subMonths(new Date(), i);
    return {
      value: format(date, 'yyyy-MM'),
      label: format(date, 'MMMM yyyy', { locale: ptBR }),
    };
  });

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

  const handleExportCSV = () => {
    if (!payouts || payouts.length === 0) return;

    const headers = [
      'Nome',
      'OTE',
      '% Meta Global',
      'Variável (R$)',
      'Total Conta (R$)',
      'iFood (R$)',
      'Status',
    ];

    const rows = payouts.map((p) => [
      p.sdr?.name || '',
      formatCurrency(4000), // OTE padrão
      `${calculateGlobalPct(p).toFixed(1)}%`,
      formatCurrency(p.valor_variavel_total || 0),
      formatCurrency(p.total_conta || 0),
      formatCurrency(p.total_ifood || 0),
      p.status,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
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
                  return (
                    <TableRow key={payout.id}>
                      <TableCell className="font-medium">
                        {payout.sdr?.name || 'SDR'}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(4000)}
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
