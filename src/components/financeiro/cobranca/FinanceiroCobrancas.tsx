import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { BillingSubscription, BillingFilters, SUBSCRIPTION_STATUS_LABELS, PAYMENT_METHOD_LABELS, getSubscriptionType } from '@/types/billing';
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
import { Plus, RefreshCw, Download, CreditCard, Repeat, Handshake } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState('assinaturas');
  const syncMutation = useSyncBillingFromHubla();
  const { data: billingAlerts = [], isLoading: loadingBillingAlerts } = useBillingCobrancaAlerts();

  const subType = activeTab === 'assinaturas' ? 'assinatura' as const : activeTab === 'parcelados' ? 'parcelado' as const : undefined;
  const { data: kpis, isLoading: loadingKpis } = useBillingKPIs(currentMonth, subType);
  const { data: subscriptions = [], isLoading: loadingSubs } = useBillingSubscriptions({ ...filters, month: currentMonth });
  const { data: monthKpis, isLoading: loadingMonthKpis } = useBillingMonthKPIs(currentMonth, subType);

  const { assinaturas, parcelados } = useMemo(() => {
    const assinaturas: BillingSubscription[] = [];
    const parcelados: BillingSubscription[] = [];
    for (const sub of subscriptions) {
      if (getSubscriptionType(sub) === 'parcelado') {
        parcelados.push(sub);
      } else {
        assinaturas.push(sub);
      }
    }
    return { assinaturas, parcelados };
  }, [subscriptions]);

  const currentList = activeTab === 'assinaturas' ? assinaturas : parcelados;

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
    if (currentList.length === 0) {
      toast.error('Nenhum dado para exportar');
      return;
    }

    const rows = currentList.map(sub => ({
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
    XLSX.utils.book_append_sheet(wb, ws, activeTab === 'assinaturas' ? 'Assinaturas' : 'Parcelados');
    XLSX.writeFile(wb, `cobrancas_${activeTab}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
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
          <TabsTrigger value="assinaturas" className="gap-1.5">
            <Repeat className="h-4 w-4" />
            Assinaturas
            <Badge count={assinaturas.length} />
          </TabsTrigger>
          <TabsTrigger value="parcelados" className="gap-1.5">
            <CreditCard className="h-4 w-4" />
            Parcelados
            <Badge count={parcelados.length} />
          </TabsTrigger>
          <TabsTrigger value="acordos" className="gap-1.5">
            <Handshake className="h-4 w-4" />
            Acordos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="assinaturas">
          <SubscriptionTabContent
            subscriptions={assinaturas}
            isLoading={loadingSubs}
            filters={filters}
            onFiltersChange={setFilters}
            onSelect={handleSelect}
            currentMonth={currentMonth}
            onMonthChange={setCurrentMonth}
            monthKpis={monthKpis}
            loadingMonthKpis={loadingMonthKpis}
            monthLabel={monthLabel}
            onExport={handleExportExcel}
            onSync={() => syncMutation.mutate()}
            syncPending={syncMutation.isPending}
            onCreateNew={() => setShowCreateModal(true)}
          />
        </TabsContent>

        <TabsContent value="parcelados">
          <SubscriptionTabContent
            subscriptions={parcelados}
            isLoading={loadingSubs}
            filters={filters}
            onFiltersChange={setFilters}
            onSelect={handleSelect}
            currentMonth={currentMonth}
            onMonthChange={setCurrentMonth}
            monthKpis={monthKpis}
            loadingMonthKpis={loadingMonthKpis}
            monthLabel={monthLabel}
            onExport={handleExportExcel}
            onSync={() => syncMutation.mutate()}
            syncPending={syncMutation.isPending}
            onCreateNew={() => setShowCreateModal(true)}
          />
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

// Inline badge counter
const Badge = ({ count }: { count: number }) => (
  <span className="ml-1 inline-flex items-center justify-center rounded-full bg-muted-foreground/20 px-1.5 py-0.5 text-[10px] font-medium leading-none">
    {count}
  </span>
);

// Shared content for Assinaturas and Parcelados tabs
interface SubscriptionTabContentProps {
  subscriptions: BillingSubscription[];
  isLoading: boolean;
  filters: BillingFilters;
  onFiltersChange: (f: BillingFilters) => void;
  onSelect: (sub: BillingSubscription) => void;
  currentMonth: Date;
  onMonthChange: (d: Date) => void;
  monthKpis: any;
  loadingMonthKpis: boolean;
  monthLabel: string;
  onExport: () => void;
  onSync: () => void;
  syncPending: boolean;
  onCreateNew: () => void;
}

const SubscriptionTabContent = ({
  subscriptions, isLoading, filters, onFiltersChange, onSelect,
  currentMonth, onMonthChange, monthKpis, loadingMonthKpis, monthLabel,
  onExport, onSync, syncPending, onCreateNew,
}: SubscriptionTabContentProps) => (
  <div className="space-y-4 mt-4">
    <div className="flex items-center justify-between">
      <CobrancaMonthSelector currentMonth={currentMonth} onMonthChange={onMonthChange} />
      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={onExport} disabled={subscriptions.length === 0} className="shrink-0">
          <Download className="h-4 w-4 mr-1" /> Exportar Excel
        </Button>
        <Button variant="outline" onClick={onSync} disabled={syncPending} className="shrink-0">
          <RefreshCw className={`h-4 w-4 mr-1 ${syncPending ? 'animate-spin' : ''}`} />
          {syncPending ? 'Sincronizando...' : 'Sincronizar Hubla'}
        </Button>
        <Button onClick={onCreateNew} className="shrink-0">
          <Plus className="h-4 w-4 mr-1" /> Nova Assinatura
        </Button>
      </div>
    </div>

    <CobrancaMonthKPIs data={monthKpis} isLoading={loadingMonthKpis} monthLabel={monthLabel} />

    <div className="flex items-center justify-between gap-4">
      <CobrancaFilters filters={filters} onFiltersChange={onFiltersChange} />
    </div>

    <Card>
      <CardContent className="p-0">
        <CobrancaTable subscriptions={subscriptions} isLoading={isLoading} onSelect={onSelect} />
      </CardContent>
    </Card>
  </div>
);
