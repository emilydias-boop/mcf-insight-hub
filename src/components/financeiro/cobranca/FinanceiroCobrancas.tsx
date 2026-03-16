import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { BillingSubscription, BillingFilters } from '@/types/billing';
import { useBillingSubscriptions, useBillingKPIs } from '@/hooks/useBillingSubscriptions';
import { useSyncBillingFromHubla } from '@/hooks/useSyncBillingFromHubla';
import { CobrancaKPIs } from './CobrancaKPIs';
import { CobrancaFilters } from './CobrancaFilters';
import { CobrancaTable } from './CobrancaTable';
import { CobrancaDetailDrawer } from './CobrancaDetailDrawer';
import { CreateSubscriptionModal } from './CreateSubscriptionModal';
import { Plus, RefreshCw } from 'lucide-react';

export const FinanceiroCobrancas = () => {
  const [filters, setFilters] = useState<BillingFilters>({});
  const [selectedSub, setSelectedSub] = useState<BillingSubscription | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const syncMutation = useSyncBillingFromHubla();

  const { data: kpis, isLoading: loadingKpis } = useBillingKPIs();
  const { data: subscriptions = [], isLoading: loadingSubs } = useBillingSubscriptions(filters);

  const handleSelect = (sub: BillingSubscription) => {
    setSelectedSub(sub);
    setDrawerOpen(true);
  };

  return (
    <div className="space-y-6">
      <CobrancaKPIs kpis={kpis} isLoading={loadingKpis} />

      <div className="flex items-center justify-between gap-4">
        <CobrancaFilters filters={filters} onFiltersChange={setFilters} />
        <Button onClick={() => setShowCreateModal(true)} className="shrink-0">
          <Plus className="h-4 w-4 mr-1" /> Nova Assinatura
        </Button>
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
