import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DatePickerCustom } from '@/components/ui/DatePickerCustom';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { FileSpreadsheet, DollarSign, ShoppingCart, TrendingUp, Loader2 } from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';
import { useTransactionsByBU, } from '@/hooks/useTransactionsByBU';
import { formatCurrency } from '@/lib/formatters';
import * as XLSX from 'xlsx';
import { BusinessUnit } from '@/hooks/useMyBU';

interface SalesReportPanelProps {
  bu: BusinessUnit;
}

export function SalesReportPanel({ bu }: SalesReportPanelProps) {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  
  const filters = useMemo(() => ({
    startDate: dateRange?.from,
    endDate: dateRange?.to,
  }), [dateRange]);
  
  const { data: transactions = [], isLoading } = useTransactionsByBU(bu, filters);
  
  // Calculate stats
  const stats = useMemo(() => {
    const totalGross = transactions.reduce((sum, t) => sum + (t.gross_override || t.product_price || 0), 0);
    const totalNet = transactions.reduce((sum, t) => sum + (t.net_value || 0), 0);
    const count = transactions.length;
    const avgTicket = count > 0 ? totalNet / count : 0;
    
    return { totalGross, totalNet, count, avgTicket };
  }, [transactions]);
  
  // Export to Excel
  const handleExportExcel = () => {
    const exportData = transactions.map(row => ({
      'Data': row.sale_date ? format(parseISO(row.sale_date), 'dd/MM/yyyy', { locale: ptBR }) : '',
      'Produto': row.product_name || '',
      'Categoria': row.product_category || '',
      'Cliente': row.customer_name || '',
      'Email': row.customer_email || '',
      'Telefone': row.customer_phone || '',
      'Valor Bruto': row.gross_override || row.product_price || 0,
      'Valor Líquido': row.net_value || 0,
      'Parcela': row.installment_number ? `${row.installment_number}/${row.total_installments}` : '-',
      'Status': row.sale_status || '',
      'Fonte': row.source || '',
    }));
    
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Vendas');
    
    const fileName = `vendas_${bu}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };
  
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
            
            <Button onClick={handleExportExcel} disabled={transactions.length === 0}>
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
                <ShoppingCart className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Transações</p>
                <p className="text-3xl font-bold">{stats.count}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-success/10">
                <DollarSign className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Faturamento Bruto</p>
                <p className="text-2xl font-bold">{formatCurrency(stats.totalGross)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-warning/10">
                <DollarSign className="h-6 w-6 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Receita Líquida</p>
                <p className="text-2xl font-bold">{formatCurrency(stats.totalNet)}</p>
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
                <p className="text-sm text-muted-foreground">Ticket Médio</p>
                <p className="text-2xl font-bold">{formatCurrency(stats.avgTicket)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Data Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Transações no Período
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Nenhuma transação encontrada no período selecionado.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="text-right">Valor Bruto</TableHead>
                    <TableHead className="text-right">Valor Líquido</TableHead>
                    <TableHead>Parcela</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.slice(0, 100).map((row, index) => (
                    <TableRow key={row.id || index}>
                      <TableCell>
                        {row.sale_date 
                          ? format(parseISO(row.sale_date), 'dd/MM/yyyy', { locale: ptBR })
                          : '-'
                        }
                      </TableCell>
                      <TableCell className="font-medium max-w-[200px] truncate">
                        {row.product_name || '-'}
                      </TableCell>
                      <TableCell>{row.customer_name || '-'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.customer_email || '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(row.gross_override || row.product_price || 0)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-success">
                        {formatCurrency(row.net_value || 0)}
                      </TableCell>
                      <TableCell>
                        {row.installment_number 
                          ? `${row.installment_number}/${row.total_installments}`
                          : '-'
                        }
                      </TableCell>
                      <TableCell>
                        <Badge variant={row.sale_status === 'paid' ? 'default' : 'secondary'}>
                          {row.sale_status || '-'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {transactions.length > 100 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Mostrando 100 de {transactions.length} transações. Exporte para ver todas.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
