import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { BillingSubscription, BillingFilters } from '@/types/billing';
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
import { Plus, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const FinanceiroCobrancas = () => {
  const [filters, setFilters] = useState<BillingFilters>({});
  const [selectedSub, setSelectedSub] = useState<BillingSubscription | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const syncMutation = useSyncBillingFromHubla();

  const { data: kpis, isLoading: loadingKpis } = useBillingKPIs();
  const { data: subscriptions = [], isLoading: loadingSubs } = useBillingSubscriptions(filters);
  const { data: monthKpis, isLoading: loadingMonthKpis } = useBillingMonthKPIs(currentMonth);

  const monthLabel = format(currentMonth, 'MMM/yy', { locale: ptBR });

  const handleSelect = (sub: BillingSubscription) => {
    setSelectedSub(sub);
    setDrawerOpen(true);
  };

  return (
    <div className="space-y-4">
      <CobrancaKPIs kpis={kpis} isLoading={loadingKpis} />

      <div className="flex items-center justify-between">
        <CobrancaMonthSelector currentMonth={currentMonth} onMonthChange={setCurrentMonth} />
        <div className="flex items-center gap-2">
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
