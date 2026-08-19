import { useState, useCallback } from 'react';
import { useConsorcioPagamentos, defaultFilters, PagamentosFiltersState, PagamentoRow } from '@/hooks/useConsorcioPagamentos';
import { PagamentosKPIs } from './PagamentosKPIs';
import { PagamentosAlerts } from './PagamentosAlerts';
import { PagamentosFilters } from './PagamentosFilters';
import { PagamentosTable } from './PagamentosTable';
import { PagamentoDetailDrawer } from './PagamentoDetailDrawer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, MessageCircle, X, Loader2, Send, PhoneCall, Clock, PhoneOff, Ban, Eraser, Tag } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useUpdateCobrancaStatus } from '@/hooks/useUpdateCobrancaStatus';
import type { CobrancaStatus } from '@/hooks/useConsorcioPagamentos';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { comprovanteTelefoneCliente, comprovanteEmailCliente } from '@/lib/consorcioComprovante';

interface Props {
  selectedMonth: { start: string; end: string };
  tipoFilter?: 'cliente' | 'empresa';
}

const STATUS_LABELS: Record<string, string> = {
  paga: 'Paga',
  vencendo: 'Vencendo',
  atrasada: 'Atrasada',
  pendente: 'Pendente',
  previsto: 'Previsto',
};

const SITUACAO_LABELS: Record<string, string> = {
  quitada: 'Quitada',
  pendente: 'Pendente',
  em_atraso: 'Em Atraso',
  cancelada: 'Cancelada',
};

const csvCell = (value: unknown) => {
  const s = value === null || value === undefined ? '' : String(value);
  // Excel/Sheets interpretam valores iniciados por = + - @ como fórmula (CSV injection).
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[;"\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

const toIsoDate = (value?: string | null) => {
  if (!value) return '';
  return String(value).slice(0, 10);
};

export function ConsorcioPagamentosTab({ selectedMonth, tipoFilter }: Props) {
  const [filters, setFilters] = useState<PagamentosFiltersState>(defaultFilters);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(200);
  const [detailRow, setDetailRow] = useState<PagamentoRow | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendProgress, setSendProgress] = useState({ current: 0, total: 0, skipped: 0 });
  const updateCobranca = useUpdateCobrancaStatus();

  const { data, allData, isLoading, kpis, alertData, totalItems, totalPages, filterOptions } = useConsorcioPagamentos(filters, page, pageSize, selectedMonth, tipoFilter);

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
    if (!allData || allData.length === 0) {
      toast.warning('Nenhuma parcela para exportar com os filtros atuais');
      return;
    }

    const header = 'id_parcela;cliente;telefone;email;tipo;grupo;cota;numero_parcela;valor;vencimento;data_pagamento;status;situacao_cota';
    const lines = allData.map(r => [
      r.id,
      r.cliente_nome,
      comprovanteTelefoneCliente(r),
      comprovanteEmailCliente(r),
      r.tipo === 'empresa' ? 'Empresa' : r.tipo === 'cliente' ? 'Cliente' : (r.tipo ?? ''),
      r.grupo,
      r.cota,
      r.numero_parcela,
      Number(r.valor_parcela ?? 0).toFixed(2),
      toIsoDate(r.data_vencimento),
      toIsoDate(r.data_pagamento),
      STATUS_LABELS[r.status_calculado] ?? r.status_calculado ?? '',
      SITUACAO_LABELS[r.situacao_cota] ?? r.situacao_cota ?? '',
    ].map(csvCell).join(';'));

    const csv = '\uFEFF' + [header, ...lines].join('\r\n') + '\r\n';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const mesRef = String(selectedMonth?.start ?? '').slice(0, 7);
    const sufixo = [tipoFilter, mesRef].filter(Boolean).join('_');
    const link = document.createElement('a');
    link.href = url;
    link.download = `pagamentos_consorcio${sufixo ? `_${sufixo}` : ''}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`${allData.length} parcela(s) exportada(s)`);
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

  const handleBulkCobranca = async (status: CobrancaStatus | null) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    for (const id of ids) {
      await updateCobranca.mutateAsync({ installmentId: id, status });
    }
    setSelectedIds(new Set());
  };

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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1.5" disabled={updateCobranca.isPending}>
                <Tag className="h-4 w-4" />
                Definir situação
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel>Aplicar a {selectedIds.size} parcela(s)</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleBulkCobranca('cobrada')}>
                <PhoneCall className="h-4 w-4 mr-2 text-blue-600" /> Cobrada
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleBulkCobranca('aguardando_retorno')}>
                <Clock className="h-4 w-4 mr-2 text-yellow-600" /> Aguardando retorno
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleBulkCobranca('sem_resposta')}>
                <PhoneOff className="h-4 w-4 mr-2 text-orange-600" /> Sem resposta
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleBulkCobranca('cancelada')}>
                <Ban className="h-4 w-4 mr-2 text-gray-600" /> Cancelada
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleBulkCobranca(null)}>
                <Eraser className="h-4 w-4 mr-2" /> Limpar situação
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
        tipoFilter={tipoFilter}
      />

      <PagamentoDetailDrawer
        row={detailRow}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </div>
  );
}
