import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { BillingSubscription, BillingFilters, SUBSCRIPTION_STATUS_LABELS, PAYMENT_METHOD_LABELS } from '@/types/billing';
import { useBillingSubscriptions, useBillingKPIs } from '@/hooks/useBillingSubscriptions';
import { useBillingMonthKPIs } from '@/hooks/useBillingMonthKPIs';
import { useSyncBillingFromHubla } from '@/hooks/useSyncBillingFromHubla';
import { useBillingCobrancaAlerts } from '@/hooks/useCobrancaAlerts';
import { CobrancaKPIs } from './CobrancaKPIs';
import { CobrancaMonthSelector } from './CobrancaMonthSelector';
import { CobrancaMonthKPIs } from './CobrancaMonthKPIs';
import { CobrancaFilters } from './CobrancaFilters';
import { CobrancaTable } from './CobrancaTable';
import { CobrancaDetailDrawer } from './CobrancaDetailDrawer';
import { CreateSubscriptionModal } from './CreateSubscriptionModal';
import { CobrancaQueue } from './CobrancaQueue';
import { CobrancaAcordosTab } from './CobrancaAcordosTab';
import { CobrancaAlertPanel } from '@/components/shared/CobrancaAlertPanel';
import { CobrancaHistoryPanel } from '@/components/shared/CobrancaHistoryPanel';
import { Plus, RefreshCw, Download, Handshake, LayoutList } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState('cobrancas');
  const syncMutation = useSyncBillingFromHubla();
  const { data: billingAlerts = [], isLoading: loadingBillingAlerts } = useBillingCobrancaAlerts();

  const { data: kpis, isLoading: loadingKpis } = useBillingKPIs(currentMonth);
  const { data: subscriptions = [], isLoading: loadingSubs } = useBillingSubscriptions({ ...filters, month: currentMonth });
  const { data: monthKpis, isLoading: loadingMonthKpis } = useBillingMonthKPIs(currentMonth);

  const billingAlertItems = billingAlerts.map(a => ({
    id: a.installment_id,
    label: a.customer_name,
    sublabel: a.product_name || undefined,
    numero_parcela: a.numero_parcela,
    valor: a.valor_original,
    data_vencimento: a.data_vencimento,
    dias_para_vencer: a.dias_para_vencer,
    priority: a.priority,
  }));

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
      <CobrancaAlertPanel
        alerts={billingAlertItems}
        isLoading={loadingBillingAlerts}
        type="billing"
        title="Parcelas com Vencimento Próximo"
      />
      <CobrancaHistoryPanel type="billing" />
      <CobrancaKPIs kpis={kpis} isLoading={loadingKpis} />
      <CobrancaQueue onSelect={handleSelect} />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start">
          <TabsTrigger value="cobrancas" className="gap-1.5">
            <LayoutList className="h-4 w-4" />
            Cobranças
            <BadgeCount count={subscriptions.length} />
          </TabsTrigger>
          <TabsTrigger value="acordos" className="gap-1.5">
            <Handshake className="h-4 w-4" />
            Acordos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cobrancas">
          <div className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <CobrancaMonthSelector currentMonth={currentMonth} onMonthChange={setCurrentMonth} />
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={handleExportExcel} disabled={subscriptions.length === 0} className="shrink-0">
                  <Download className="h-4 w-4 mr-1" /> Exportar Excel
                </Button>
                <Button variant="outline" onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending} className="shrink-0">
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
                <CobrancaTable subscriptions={subscriptions} isLoading={loadingSubs} onSelect={handleSelect} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="acordos">
          <CobrancaAcordosTab />
        </TabsContent>
      </Tabs>

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

const BadgeCount = ({ count }: { count: number }) => (
  <span className="ml-1 inline-flex items-center justify-center rounded-full bg-muted-foreground/20 px-1.5 py-0.5 text-[10px] font-medium leading-none">
    {count}
  </span>
);
