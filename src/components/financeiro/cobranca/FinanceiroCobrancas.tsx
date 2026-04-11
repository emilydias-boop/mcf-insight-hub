import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { BillingSubscription } from '@/types/billing';
import { useBillingSubscriptions } from '@/hooks/useBillingSubscriptions';
import { useBillingMonthInstallments } from '@/hooks/useBillingMonthInstallments';
import { useSyncBillingFromHubla } from '@/hooks/useSyncBillingFromHubla';
import { useBillingCobrancaAlerts } from '@/hooks/useCobrancaAlerts';
import { CobrancaMonthSelector } from './CobrancaMonthSelector';
import { CobrancaWeekFilter } from './CobrancaWeekFilter';
import { CobrancaMonthTable } from './CobrancaMonthTable';
import { CobrancaReembolsosTab } from './CobrancaReembolsosTab';
import { CobrancaResumoAnual } from './CobrancaResumoAnual';
import { CobrancaDetailDrawer } from './CobrancaDetailDrawer';
import { CreateSubscriptionModal } from './CreateSubscriptionModal';

import { CobrancaAlertPanel } from '@/components/shared/CobrancaAlertPanel';
import { CobrancaHistoryPanel } from '@/components/shared/CobrancaHistoryPanel';
import { Plus, RefreshCw, Download, Undo2, LayoutList, CalendarRange, TrendingUp, DollarSign, CheckCircle2, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { formatCurrency } from '@/lib/formatters';

export const FinanceiroCobrancas = () => {
  const [selectedSub, setSelectedSub] = useState<BillingSubscription | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [weekFilter, setWeekFilter] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState('cobrancas');
  const syncMutation = useSyncBillingFromHubla();
  const { data: billingAlerts = [], isLoading: loadingBillingAlerts } = useBillingCobrancaAlerts();

  const { data: monthData, isLoading: loadingMonth } = useBillingMonthInstallments(currentMonth, weekFilter);
  const rows = monthData?.rows || [];
  const kpis = monthData?.kpis;

  // For detail drawer - need to fetch subscription by id
  const { data: subscriptions = [] } = useBillingSubscriptions({ month: currentMonth });

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

  const handleSelectSubscription = (subscriptionId: string) => {
    const sub = subscriptions.find(s => s.id === subscriptionId);
    if (sub) {
      setSelectedSub(sub);
      setDrawerOpen(true);
    }
  };


  const handleExportExcel = () => {
    if (rows.length === 0) {
      toast.error('Nenhum dado para exportar');
      return;
    }

    const exportRows = rows.map(r => ({
      'Cliente': r.customer_name,
      'Telefone': r.customer_phone || '',
      'Produto': r.product_name,
      'Parcela': `${r.numero_parcela}/${r.total_parcelas}`,
      'Valor': r.valor_original,
      'Saldo Devedor Mês': r.saldo_devedor_mes,
      'Vencimento': r.data_vencimento,
      'Status': r.status,
      'Pagamento': r.data_pagamento || '',
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cobranças');
    XLSX.writeFile(wb, `cobrancas_${format(currentMonth, 'yyyy-MM')}.xlsx`);
    toast.success(`${exportRows.length} registros exportados`);
  };

  const monthLabel = format(currentMonth, 'MMMM/yyyy', { locale: ptBR });

  return (
    <div className="space-y-4">
      <CobrancaAlertPanel
        alerts={billingAlertItems}
        isLoading={loadingBillingAlerts}
        type="billing"
        title="Parcelas com Vencimento Próximo"
      />
      <CobrancaHistoryPanel type="billing" />
      
      {/* KPIs - Estimado vs Recebido */}
      {kpis && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KPICard label="Estimado" value={formatCurrency(kpis.valorEstimado)} icon={DollarSign} color="text-blue-600" />
          <KPICard label="Recebido" value={formatCurrency(kpis.valorRecebido)} icon={CheckCircle2} color="text-green-600" />
          <KPICard label="Parcelas" value={`${kpis.parcelasPagas}/${kpis.totalParcelas}`} icon={LayoutList} color="text-foreground" />
          <KPICard label="Atrasadas" value={String(kpis.parcelasAtrasadas)} icon={AlertTriangle} color="text-amber-600" />
          <KPICard label="Reembolsos" value={String(kpis.parcelasReembolso)} icon={Undo2} color="text-purple-600" />
          <KPICard
            label="Taxa Recebimento"
            value={kpis.totalParcelas > 0 ? `${((kpis.parcelasPagas / kpis.totalParcelas) * 100).toFixed(0)}%` : '—'}
            icon={TrendingUp}
            color={kpis.totalParcelas > 0 && (kpis.parcelasPagas / kpis.totalParcelas) >= 0.8 ? 'text-green-600' : 'text-amber-600'}
          />
        </div>
      )}

      

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start">
          <TabsTrigger value="cobrancas" className="gap-1.5">
            <LayoutList className="h-4 w-4" />
            Cobranças
            <BadgeCount count={rows.length} />
          </TabsTrigger>
          <TabsTrigger value="reembolsos" className="gap-1.5">
            <Undo2 className="h-4 w-4" />
            Reembolsos
            <BadgeCount count={rows.filter(r => r.status === 'reembolso').length} />
          </TabsTrigger>
          <TabsTrigger value="resumo" className="gap-1.5">
            <CalendarRange className="h-4 w-4" />
            Resumo Anual
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cobrancas">
          <div className="space-y-4 mt-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <CobrancaMonthSelector currentMonth={currentMonth} onMonthChange={m => { setCurrentMonth(m); setWeekFilter(null); }} />
                <CobrancaWeekFilter selectedWeek={weekFilter} onWeekChange={setWeekFilter} />
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={handleExportExcel} disabled={rows.length === 0} size="sm">
                  <Download className="h-4 w-4 mr-1" /> Exportar
                </Button>
                <Button variant="outline" onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending} size="sm">
                  <RefreshCw className={`h-4 w-4 mr-1 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
                  {syncMutation.isPending ? 'Sincronizando...' : 'Sincronizar'}
                </Button>
                <Button onClick={() => setShowCreateModal(true)} size="sm">
                  <Plus className="h-4 w-4 mr-1" /> Nova Assinatura
                </Button>
              </div>
            </div>

            <Card>
              <CardContent className="p-0">
                <CobrancaMonthTable
                  rows={rows}
                  isLoading={loadingMonth}
                  onSelectSubscription={handleSelectSubscription}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="reembolsos">
          <div className="mt-4">
            <div className="flex items-center gap-3 mb-4">
              <CobrancaMonthSelector currentMonth={currentMonth} onMonthChange={m => { setCurrentMonth(m); setWeekFilter(null); }} />
            </div>
            <Card>
              <CardContent className="p-0">
                <CobrancaReembolsosTab rows={rows} isLoading={loadingMonth} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="resumo">
          <CobrancaResumoAnual year={currentMonth.getFullYear()} />
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

const KPICard = ({ label, value, icon: Icon, color }: { label: string; value: string; icon: any; color: string }) => (
  <Card>
    <CardContent className="p-3">
      <div className="flex items-center gap-1.5 mb-0.5">
        <Icon className={`h-3.5 w-3.5 ${color}`} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
    </CardContent>
  </Card>
);
