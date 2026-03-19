import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { BillingSubscription, BillingFilters, SUBSCRIPTION_STATUS_LABELS, PAYMENT_METHOD_LABELS } from '@/types/billing';
import { useBillingSubscriptions, useBillingKPIs } from '@/hooks/useBillingSubscriptions';
import { useBillingMonthKPIs } from '@/hooks/useBillingMonthKPIs';
import { useSyncBillingFromHubla } from '@/hooks/useSyncBillingFromHubla';
import { CobrancaKPIs } from './CobrancaKPIs';
import { CobrancaMonthSelector } from './CobrancaMonthSelector';
import { CobrancaMonthKPIs } from './CobrancaMonthKPIs';
import { CobrancaFilters } from './CobrancaFilters';
import { CobrancaTable } from './CobrancaTable';
import { CobrancaDetailDrawer } from './CobrancaDetailDrawer';
import { CreateSubscriptionModal } from './CreateSubscriptionModal';
import { Plus, RefreshCw, Download } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

export const FinanceiroCobrancas = () => {
  const [filters, setFilters] = useState<BillingFilters>({});
  const [selectedSub, setSelectedSub] = useState<BillingSubscription | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const syncMutation = useSyncBillingFromHubla();

  const { data: kpis, isLoading: loadingKpis } = useBillingKPIs(currentMonth);
  const { data: subscriptions = [], isLoading: loadingSubs } = useBillingSubscriptions({ ...filters, month: currentMonth });
  const { data: monthKpis, isLoading: loadingMonthKpis } = useBillingMonthKPIs(currentMonth);

  const monthLabel = format(currentMonth, 'MMM/yy', { locale: ptBR });

  const handleSelect = (sub: BillingSubscription) => {
    setSelectedSub(sub);
    setDrawerOpen(true);
  };

  const handleExportExcel = () => {
    if (subscriptions.length === 0) {
      toast.error('Nenhum dado para exportar');
      return;
    }

    const rows = subscriptions.map(sub => ({
      'Cliente': sub.customer_name,
      'Email': sub.customer_email || '',
      'Telefone': sub.customer_phone || '',
      'Produto': sub.product_name,
      'Categoria': sub.product_category || '',
      'Status': SUBSCRIPTION_STATUS_LABELS[sub.status],
      'Forma Pagamento': sub.forma_pagamento ? PAYMENT_METHOD_LABELS[sub.forma_pagamento] : '',
      'Valor Total': sub.valor_total_contrato,
      'Parcelas': sub.total_parcelas,
      'Responsável': sub.responsavel_financeiro || '',
      'Início': sub.data_inicio ? format(new Date(sub.data_inicio), 'dd/MM/yyyy') : '',
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cobranças');
    XLSX.writeFile(wb, `cobrancas_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toast.success(`${rows.length} registros exportados`);
  };

  return (
    <div className="space-y-4">
      <CobrancaKPIs kpis={kpis} isLoading={loadingKpis} />

      <div className="flex items-center justify-between">
        <CobrancaMonthSelector currentMonth={currentMonth} onMonthChange={setCurrentMonth} />
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleExportExcel}
            disabled={subscriptions.length === 0}
            className="shrink-0"
          >
            <Download className="h-4 w-4 mr-1" />
            Exportar Excel
          </Button>
          <Button
            variant="outline"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="shrink-0"
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
            {syncMutation.isPending ? 'Sincronizando...' : 'Sincronizar Hubla'}
          </Button>
          <Button onClick={() => setShowCreateModal(true)} className="shrink-0">
            <Plus className="h-4 w-4 mr-1" /> Nova Assinatura
          </Button>
        </div>
      </div>

      <CobrancaMonthKPIs data={monthKpis} isLoading={loadingMonthKpis} monthLabel={monthLabel} />

      <div className="flex items-center justify-between gap-4">
        <CobrancaFilters filters={filters} onFiltersChange={setFilters} />
      </div>

      <Card>
        <CardContent className="p-0">
          <CobrancaTable
            subscriptions={subscriptions}
            isLoading={loadingSubs}
            onSelect={handleSelect}
          />
        </CardContent>
      </Card>

      <CobrancaDetailDrawer
        subscription={selectedSub}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />

      <CreateSubscriptionModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
      />
    </div>
  );
};
