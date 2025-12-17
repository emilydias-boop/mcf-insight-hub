import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useFinanceiroPagamentos } from '@/hooks/useFinanceiroPagamentos';
import { formatCurrency } from '@/lib/formatters';
import { PagamentoFilters, PagamentoPJ } from '@/types/financeiro';
import { CARGO_OPTIONS, SQUAD_OPTIONS, NFSE_STATUS_LABELS, NFSE_PAGAMENTO_LABELS } from '@/types/hr';
import { Download, Filter, X, Check, Edit, ExternalLink, AlertTriangle } from 'lucide-react';
import { MarkAsPaidModal } from './MarkAsPaidModal';
import { EditNfseModal } from './EditNfseModal';
import { Skeleton } from '@/components/ui/skeleton';

const currentDate = new Date();
const currentMonth = currentDate.getMonth() + 1;
const currentYear = currentDate.getFullYear();

export const FinanceiroPagamentos = () => {
  const [filters, setFilters] = useState<PagamentoFilters>({
    mes: currentMonth,
    ano: currentYear,
    statusNfse: 'todos',
    statusPagamento: 'todos',
  });

  const [markAsPaidData, setMarkAsPaidData] = useState<PagamentoPJ | null>(null);
  const [editNfseData, setEditNfseData] = useState<PagamentoPJ | null>(null);

  const { data, isLoading, refetch } = useFinanceiroPagamentos(filters);

  const handleExportCSV = () => {
    if (!data?.pagamentos) return;

    const headers = ['Colaborador', 'Squad', 'Cargo', 'Valor Fechamento', 'NFSe', 'Valor NFSe', 'Diferença', 'Status NFSe', 'Status Pagamento', 'Data Pagamento'];
    const rows = data.pagamentos.map((p) => [
      p.employee.nome_completo,
      p.employee.squad || '',
      p.employee.cargo || '',
      p.fechamento?.total_conta || 0,
      p.nfse?.numero_nfse || 'Sem NFSe',
      p.nfse?.valor_nfse || '',
      p.diferenca !== null ? p.diferenca : '',
      p.nfse ? 'Nota enviada' : 'Pendente envio',
      p.nfse?.status_pagamento || 'pendente',
      p.nfse?.data_pagamento || '',
    ]);

    const csvContent = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pagamentos-pj-${filters.ano}-${String(filters.mes).padStart(2, '0')}.csv`;
    link.click();
  };

  const handleClearFilters = () => {
    setFilters({
      mes: currentMonth,
      ano: currentYear,
      statusNfse: 'todos',
      statusPagamento: 'todos',
    });
  };

  const months = Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    label: new Date(2024, i, 1).toLocaleDateString('pt-BR', { month: 'long' }),
  }));

  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <Select
              value={String(filters.mes)}
              onValueChange={(v) => setFilters({ ...filters, mes: Number(v) })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Mês" />
              </SelectTrigger>
              <SelectContent>
                {months.map((m) => (
                  <SelectItem key={m.value} value={String(m.value)}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={String(filters.ano)}
              onValueChange={(v) => setFilters({ ...filters, ano: Number(v) })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Ano" />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.squad || 'all'}
              onValueChange={(v) => setFilters({ ...filters, squad: v === 'all' ? undefined : v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Squad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os squads</SelectItem>
                {SQUAD_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.cargo || 'all'}
              onValueChange={(v) => setFilters({ ...filters, cargo: v === 'all' ? undefined : v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Cargo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os cargos</SelectItem>
                {CARGO_OPTIONS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.statusNfse}
              onValueChange={(v) => setFilters({ ...filters, statusNfse: v as any })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Status NFSe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="pendente_envio">Pendente envio</SelectItem>
                <SelectItem value="nota_enviada">Nota enviada</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.statusPagamento}
              onValueChange={(v) => setFilters({ ...filters, statusPagamento: v as any })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Status Pagamento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="pago">Pago</SelectItem>
                <SelectItem value="em_atraso">Em atraso</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 mt-4">
            <Button variant="outline" size="sm" onClick={handleClearFilters}>
              <X className="h-4 w-4 mr-1" />
              Limpar
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportCSV}>
              <Download className="h-4 w-4 mr-1" />
              Exportar CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total a Pagar</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className="text-2xl font-bold">{formatCurrency(data?.summary.totalAPagar || 0)}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">NFSe Enviadas</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className="text-2xl font-bold">
                {data?.summary.nfseEnviadas} de {data?.summary.totalFechamentos}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Pago</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className="text-2xl font-bold text-green-500">{formatCurrency(data?.summary.totalPago || 0)}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pendente / Em Atraso</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className="text-2xl font-bold text-yellow-500">{formatCurrency(data?.summary.pendente || 0)}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Colaborador</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead className="text-right">Valor Fechamento</TableHead>
                <TableHead>NFSe</TableHead>
                <TableHead className="text-right">Diferença</TableHead>
                <TableHead>Status NFSe</TableHead>
                <TableHead>Status Pagamento</TableHead>
                <TableHead>Data Pagamento</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 9 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : data?.pagamentos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    Nenhum colaborador PJ encontrado para o período.
                  </TableCell>
                </TableRow>
              ) : (
                data?.pagamentos.map((p) => (
                  <TableRow key={p.employee.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{p.employee.nome_completo}</p>
                        <p className="text-xs text-muted-foreground">{p.employee.squad || '-'}</p>
                      </div>
                    </TableCell>
                    <TableCell>{p.employee.cargo || '-'}</TableCell>
                    <TableCell className="text-right font-mono">
                      {p.fechamento ? formatCurrency(p.fechamento.total_conta) : '-'}
                    </TableCell>
                    <TableCell>
                      {p.nfse?.numero_nfse ? (
                        <div className="flex items-center gap-1">
                          <span>{p.nfse.numero_nfse}</span>
                          {p.nfse.arquivo_url && (
                            <a href={p.nfse.arquivo_url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                            </a>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Sem NFSe</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {p.diferenca !== null ? (
                        p.diferenca === 0 ? (
                          <span className="text-muted-foreground">OK</span>
                        ) : (
                          <span className="text-red-500 flex items-center justify-end gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            {formatCurrency(p.diferenca)}
                          </span>
                        )
                      ) : (
                        <span className="text-muted-foreground text-xs">Aguardando NFSe</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={p.nfse ? 'default' : 'secondary'} className="text-xs">
                        {p.nfse ? 'Nota enviada' : 'Pendente envio'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          p.nfse?.status_pagamento === 'pago'
                            ? 'default'
                            : p.nfse?.status_pagamento === 'em_atraso'
                            ? 'destructive'
                            : 'secondary'
                        }
                        className="text-xs"
                      >
                        {NFSE_PAGAMENTO_LABELS[p.nfse?.status_pagamento || 'pendente']?.label || 'Pendente'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {p.nfse?.data_pagamento
                        ? new Date(p.nfse.data_pagamento).toLocaleDateString('pt-BR')
                        : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {p.nfse?.status_pagamento !== 'pago' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setMarkAsPaidData(p)}
                            title="Marcar como pago"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setEditNfseData(p)}
                          title="Editar NFSe"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modals */}
      {markAsPaidData && (
        <MarkAsPaidModal
          open={!!markAsPaidData}
          onOpenChange={(open) => !open && setMarkAsPaidData(null)}
          pagamento={markAsPaidData}
          mes={filters.mes}
          ano={filters.ano}
          onSuccess={() => {
            setMarkAsPaidData(null);
            refetch();
          }}
        />
      )}

      {editNfseData && (
        <EditNfseModal
          open={!!editNfseData}
          onOpenChange={(open) => !open && setEditNfseData(null)}
          pagamento={editNfseData}
          mes={filters.mes}
          ano={filters.ano}
          onSuccess={() => {
            setEditNfseData(null);
            refetch();
          }}
        />
      )}
    </div>
  );
};
