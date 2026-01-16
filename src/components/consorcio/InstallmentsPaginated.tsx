import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { Check, Clock, AlertCircle, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
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
import { ConsorcioInstallment } from '@/types/consorcio';

interface InstallmentsPaginatedProps {
  installments: ConsorcioInstallment[];
  onPayInstallment: (installment: ConsorcioInstallment) => void;
  isPaying: boolean;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

type FilterType = 'todas' | 'pendente' | 'pago' | 'atrasado';

export function InstallmentsPaginated({ 
  installments, 
  onPayInstallment, 
  isPaying 
}: InstallmentsPaginatedProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [filter, setFilter] = useState<FilterType>('todas');
  const [itemsPerPage, setItemsPerPage] = useState(12);

  const handleItemsPerPageChange = (value: string) => {
    const newValue = value === 'all' ? filteredInstallments.length : Number(value);
    setItemsPerPage(newValue);
    setCurrentPage(1);
  };

  // Filter installments
  const filteredInstallments = useMemo(() => {
    if (filter === 'todas') return installments;
    return installments.filter(i => i.status === filter);
  }, [installments, filter]);

  // Pagination
  const totalPages = Math.ceil(filteredInstallments.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentInstallments = filteredInstallments.slice(startIndex, endIndex);

  // Calculate summary for current page
  const pageSummary = useMemo(() => {
    const total = currentInstallments.reduce((acc, i) => acc + Number(i.valor_parcela), 0);
    const comissao = currentInstallments.reduce((acc, i) => acc + Number(i.valor_comissao), 0);
    const pagas = currentInstallments.filter(i => i.status === 'pago').length;
    return { total, comissao, pagas, quantidade: currentInstallments.length };
  }, [currentInstallments]);

  // Overall summary
  const overallSummary = useMemo(() => {
    const pagas = installments.filter(i => i.status === 'pago').length;
    const pendentes = installments.filter(i => i.status === 'pendente').length;
    const atrasadas = installments.filter(i => i.status === 'atrasado').length;
    return { pagas, pendentes, atrasadas, total: installments.length };
  }, [installments]);

  // Go to first pending installment
  const goToFirstPending = () => {
    const pendingIndex = filteredInstallments.findIndex(i => i.status === 'pendente');
    if (pendingIndex >= 0) {
      const page = Math.floor(pendingIndex / itemsPerPage) + 1;
      setCurrentPage(page);
    }
  };

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex items-center justify-between bg-muted/50 p-3 rounded-lg">
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1">
            <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-200">
              {overallSummary.pagas} pagas
            </Badge>
          </span>
          <span className="flex items-center gap-1">
            <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-200">
              {overallSummary.pendentes} pendentes
            </Badge>
          </span>
          {overallSummary.atrasadas > 0 && (
            <span className="flex items-center gap-1">
              <Badge variant="destructive">
                {overallSummary.atrasadas} atrasadas
              </Badge>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filter} onValueChange={(v) => { setFilter(v as FilterType); setCurrentPage(1); }}>
            <SelectTrigger className="w-32 h-8">
              <SelectValue placeholder="Filtrar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              <SelectItem value="pendente">Pendentes</SelectItem>
              <SelectItem value="pago">Pagas</SelectItem>
              <SelectItem value="atrasado">Atrasadas</SelectItem>
            </SelectContent>
          </Select>
          
          <Select 
            value={itemsPerPage >= filteredInstallments.length ? 'all' : String(itemsPerPage)} 
            onValueChange={handleItemsPerPageChange}
          >
            <SelectTrigger className="w-28 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="12">12 / pág</SelectItem>
              <SelectItem value="24">24 / pág</SelectItem>
              <SelectItem value="48">48 / pág</SelectItem>
              <SelectItem value="100">100 / pág</SelectItem>
              <SelectItem value="all">Todas</SelectItem>
            </SelectContent>
          </Select>
          
          <Button variant="outline" size="sm" onClick={goToFirstPending}>
            Ir para pendente
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">#</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">Comissão</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentInstallments.map((installment) => (
                <TableRow 
                  key={installment.id}
                  className={
                    installment.status === 'atrasado' 
                      ? 'bg-destructive/5' 
                      : installment.status === 'pago' 
                        ? 'bg-green-500/5' 
                        : ''
                  }
                >
                  <TableCell className="font-medium">{installment.numero_parcela}</TableCell>
                  <TableCell>
                    <Badge variant={installment.tipo === 'empresa' ? 'default' : 'secondary'}>
                      {installment.tipo === 'empresa' ? 'Empresa' : 'Cliente'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {format(new Date(installment.data_vencimento), 'dd/MM/yyyy')}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(Number(installment.valor_parcela))}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(Number(installment.valor_comissao))}
                  </TableCell>
                  <TableCell>
                    {installment.status === 'pago' ? (
                      <Badge className="bg-green-500">
                        <Check className="h-3 w-3 mr-1" />
                        Pago
                      </Badge>
                    ) : installment.status === 'atrasado' ? (
                      <Badge variant="destructive">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Atrasado
                      </Badge>
                    ) : (
                      <Badge variant="outline">
                        <Clock className="h-3 w-3 mr-1" />
                        Pendente
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {installment.status !== 'pago' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onPayInstallment(installment)}
                        disabled={isPaying}
                      >
                        Pagar
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Page summary */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div>
          Mostrando {pageSummary.quantidade} parcelas | 
          Total: {formatCurrency(pageSummary.total)} | 
          Comissão: {formatCurrency(pageSummary.comissao)}
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentPage(1)}
          disabled={currentPage === 1}
        >
          Primeira
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
          disabled={currentPage === 1}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        
        <div className="flex items-center gap-2">
          <span className="px-4 py-2 text-sm font-medium">
            Página {currentPage} de {totalPages || 1}
          </span>
          {itemsPerPage === 12 && totalPages > 0 && (
            <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
              Ano {currentPage} de {totalPages}
            </span>
          )}
        </div>
        
        <Button
          variant="outline"
          size="icon"
          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
          disabled={currentPage === totalPages}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentPage(totalPages)}
          disabled={currentPage === totalPages}
        >
          Última
        </Button>
      </div>
    </div>
  );
}
