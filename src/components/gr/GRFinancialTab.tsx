import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useGRFinancialData } from '@/hooks/useGRDetailMetrics';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { DollarSign, TrendingUp, CreditCard, Loader2 } from 'lucide-react';

interface GRFinancialTabProps {
  walletId: string;
}

export const GRFinancialTab = ({ walletId }: GRFinancialTabProps) => {
  const { data: financialData, isLoading } = useGRFinancialData(walletId);
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  
  const totalReceita = financialData?.entries.reduce((sum, e) => sum + (e.purchase_value || 0), 0) || 0;
  const totalPago = financialData?.entries.filter(e => e.status === 'convertido')
    .reduce((sum, e) => sum + (e.purchase_value || 0), 0) || 0;
  const totalPendente = totalReceita - totalPago;
  
  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <DollarSign className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Receita Total</p>
              <p className="text-2xl font-bold text-emerald-500">
                {formatCurrency(totalReceita)}
              </p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <CreditCard className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Pago</p>
              <p className="text-2xl font-bold text-blue-500">
                {formatCurrency(totalPago)}
              </p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <TrendingUp className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pendente</p>
              <p className="text-2xl font-bold text-amber-500">
                {formatCurrency(totalPendente)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Revenue by Product */}
      <Card>
        <CardHeader>
          <CardTitle>Receita por Produto</CardTitle>
        </CardHeader>
        <CardContent>
          {!financialData?.byProduct || financialData.byProduct.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum dado financeiro disponível
            </p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {financialData.byProduct.map((product) => (
                <div 
                  key={product.code}
                  className="flex flex-col items-center p-4 rounded-lg border bg-card"
                >
                  <Badge variant="secondary">{product.name}</Badge>
                  <p className="text-xl font-bold mt-2">
                    {formatCurrency(product.total)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {product.count} contrato{product.count !== 1 ? 's' : ''}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Transações</CardTitle>
        </CardHeader>
        <CardContent>
          {!financialData?.entries || financialData.entries.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhuma transação registrada
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {financialData.entries
                    .filter(e => e.purchase_value && e.purchase_value > 0)
                    .map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="font-medium">
                          {entry.customer_name}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {entry.product_purchased || 'N/A'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={entry.status === 'convertido' ? 'default' : 'secondary'}
                          >
                            {entry.status === 'convertido' ? 'Pago' : 'Pendente'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(entry.purchase_value || 0)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(entry.updated_at)}
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
};
