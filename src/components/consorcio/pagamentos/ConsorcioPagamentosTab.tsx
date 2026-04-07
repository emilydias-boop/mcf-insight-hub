import { useState } from 'react';
import { useConsorcioPagamentos, defaultFilters, PagamentosFiltersState, PagamentoRow } from '@/hooks/useConsorcioPagamentos';
import { useBoletosReview } from '@/hooks/useConsorcioBoletos';
import { PagamentosKPIs } from './PagamentosKPIs';
import { PagamentosAlerts } from './PagamentosAlerts';
import { PagamentosFilters } from './PagamentosFilters';
import { PagamentosTable } from './PagamentosTable';
import { PagamentoDetailDrawer } from './PagamentoDetailDrawer';
import { BoletoReviewDialog } from './BoletoReviewDialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, AlertTriangle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { formatCurrency, formatDate } from '@/lib/formatters';

interface Props {
  selectedMonth: { start: string; end: string };
}

export function ConsorcioPagamentosTab({ selectedMonth }: Props) {
  const [filters, setFilters] = useState<PagamentosFiltersState>(defaultFilters);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(200);
  const [detailRow, setDetailRow] = useState<PagamentoRow | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { data, allData, isLoading, kpis, alertData, totalItems, totalPages, filterOptions } = useConsorcioPagamentos(filters, page, pageSize, selectedMonth);

  const handleFilterChange = (f: PagamentosFiltersState) => {
    setFilters(f);
    setPage(1);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setPage(1);
  };

  const handleViewDetail = (row: PagamentoRow) => {
    setDetailRow(row);
    setDrawerOpen(true);
  };

  const handleExport = () => {
    const rows = allData.map(r => ({
      'Cliente': r.cliente_nome,
      'Grupo': r.grupo,
      'Cota': r.cota,
      'Nº Parcela': r.numero_parcela,
      'Tipo': r.tipo,
      'Valor': Number(r.valor_parcela),
      'Vencimento': r.data_vencimento,
      'Pagamento': r.data_pagamento || '',
      'Status': r.status_calculado,
      'Situação Cota': r.situacao_cota,
      'Responsável': r.vendedor_name || '',
      'Origem': r.origem || '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pagamentos');
    XLSX.writeFile(wb, 'pagamentos_consorcio.xlsx');
  };

  return (
    <div className="space-y-4">
      <PagamentosKPIs data={kpis} isLoading={isLoading} />
      <PagamentosAlerts {...alertData} />

      <div className="flex items-center justify-between">
        <PagamentosFilters filters={filters} onChange={handleFilterChange} options={filterOptions} />
        <Button variant="outline" size="sm" onClick={handleExport} className="shrink-0 ml-3">
          <Download className="h-4 w-4 mr-1" />
          Exportar
        </Button>
      </div>

      <PagamentosTable
        data={data}
        isLoading={isLoading}
        page={page}
        pageSize={pageSize}
        totalPages={totalPages}
        totalItems={totalItems}
        onPageChange={setPage}
        onPageSizeChange={handlePageSizeChange}
        onViewDetail={handleViewDetail}
      />

      <PagamentoDetailDrawer
        row={detailRow}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </div>
  );
}
