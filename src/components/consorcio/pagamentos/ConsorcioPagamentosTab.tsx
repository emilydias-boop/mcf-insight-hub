import { useState, useCallback } from 'react';
import { useConsorcioPagamentos, defaultFilters, PagamentosFiltersState, PagamentoRow } from '@/hooks/useConsorcioPagamentos';
import { PagamentosKPIs } from './PagamentosKPIs';
import { PagamentosAlerts } from './PagamentosAlerts';
import { PagamentosFilters } from './PagamentosFilters';
import { PagamentosTable } from './PagamentosTable';
import { PagamentoDetailDrawer } from './PagamentoDetailDrawer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, MessageCircle, X, Loader2, Send } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props {
  selectedMonth: { start: string; end: string };
}

export function ConsorcioPagamentosTab({ selectedMonth }: Props) {
  const [filters, setFilters] = useState<PagamentosFiltersState>(defaultFilters);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(200);
  const [detailRow, setDetailRow] = useState<PagamentoRow | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendProgress, setSendProgress] = useState({ current: 0, total: 0, skipped: 0 });

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

  const handleBulkWhatsApp = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    setIsSending(true);
    setSendProgress({ current: 0, total: ids.length, skipped: 0 });
    let skipped = 0;

    for (let i = 0; i < ids.length; i++) {
      setSendProgress(prev => ({ ...prev, current: i + 1 }));

      // Find the boleto for this installment
      const { data: boletos } = await supabase
        .from('consorcio_boletos')
        .select('id')
        .eq('installment_id', ids[i])
        .limit(1);

      if (!boletos || boletos.length === 0) {
        skipped++;
        continue;
      }

      try {
        const { data: result, error } = await supabase.functions.invoke('send-boleto-whatsapp', {
          body: { boletoId: boletos[0].id, mode: 'wame' },
        });

        if (error || !result?.success) {
          skipped++;
          continue;
        }

        if (result.wameUrl) {
          window.open(result.wameUrl, '_blank');
          // Small delay to avoid popup blockers
          if (i < ids.length - 1) {
            await new Promise(r => setTimeout(r, 1500));
          }
        }
      } catch {
        skipped++;
      }
    }

    setSendProgress(prev => ({ ...prev, skipped }));
    setIsSending(false);
    setSelectedIds(new Set());

    const sent = ids.length - skipped;
    if (sent > 0) toast.success(`${sent} link(s) WhatsApp aberto(s)`);
    if (skipped > 0) toast.warning(`${skipped} boleto(s) ignorado(s) (sem telefone ou erro)`);
  }, [selectedIds]);

  const handleClearSelection = () => setSelectedIds(new Set());

  return (
    <div className="space-y-4">
      <PagamentosKPIs data={kpis} isLoading={isLoading} />
      <PagamentosAlerts {...alertData} />

      {/* Bulk action bar */}
      {bulkMode && selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg border bg-primary/5 border-primary/20">
          <Badge variant="secondary" className="text-sm">
            {selectedIds.size} selecionado(s)
          </Badge>
          <Button
            size="sm"
            onClick={handleBulkWhatsApp}
            disabled={isSending}
            className="gap-1.5"
          >
            {isSending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Enviando {sendProgress.current}/{sendProgress.total}...
              </>
            ) : (
              <>
                <MessageCircle className="h-4 w-4" />
                Enviar WhatsApp ({selectedIds.size})
              </>
            )}
          </Button>
          <Button variant="ghost" size="sm" onClick={handleClearSelection} disabled={isSending}>
            <X className="h-4 w-4 mr-1" />
            Limpar
          </Button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <PagamentosFilters filters={filters} onChange={handleFilterChange} options={filterOptions} />
        <div className="flex items-center gap-2 shrink-0 ml-3">
          <Button
            variant={bulkMode ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setBulkMode(!bulkMode);
              if (bulkMode) setSelectedIds(new Set());
            }}
          >
            <Send className="h-4 w-4 mr-1" />
            {bulkMode ? 'Sair Envio em Massa' : 'Envio em Massa'}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-1" />
            Exportar
          </Button>
        </div>
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
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        bulkMode={bulkMode}
        filtroBoleto={filters.filtroBoleto}
      />

      <PagamentoDetailDrawer
        row={detailRow}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </div>
  );
}
