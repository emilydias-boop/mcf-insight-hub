import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { useClintDeals } from '@/hooks/useClintAPI';
import { DealKanbanBoard } from '@/components/crm/DealKanbanBoard';
import { OriginsSidebar } from '@/components/crm/OriginsSidebar';
import { DealFilters, DealFiltersState } from '@/components/crm/DealFilters';
import { useStagePermissions } from '@/hooks/useStagePermissions';

const Negocios = () => {
  const [selectedOriginId, setSelectedOriginId] = useState<string | null>(null);
  const [filters, setFilters] = useState<DealFiltersState>({
    search: '',
    dateRange: undefined,
    tags: [],
    owner: null,
    minValue: null,
    maxValue: null,
  });
  
  const { data: dealsData, isLoading, error } = useClintDeals(
    selectedOriginId ? { origin_id: selectedOriginId } : undefined
  );
  const { getVisibleStages } = useStagePermissions();
  
  const deals = dealsData?.data || [];
  const visibleStages = getVisibleStages();
  
  const filteredDeals = deals.filter((deal: any) => {
    if (filters.search && !deal.name.toLowerCase().includes(filters.search.toLowerCase())) {
      return false;
    }
    
    if (filters.minValue && deal.value < filters.minValue) return false;
    if (filters.maxValue && deal.value > filters.maxValue) return false;
    
    if (filters.tags.length > 0) {
      const dealTags = deal.tags?.map((t: any) => t.id) || [];
      if (!filters.tags.some(tag => dealTags.includes(tag))) return false;
    }
    
    if (filters.owner && deal.owner_id !== filters.owner) return false;
    
    if (!visibleStages.includes(deal.stage)) return false;
    
    return true;
  });
  
  const clearFilters = () => {
    setFilters({
      search: '',
      dateRange: undefined,
      tags: [],
      owner: null,
      minValue: null,
      maxValue: null,
    });
  };
  
  return (
    <div className="flex h-[calc(100vh-180px)]">
      <OriginsSidebar
        selectedOriginId={selectedOriginId}
        onSelectOrigin={setSelectedOriginId}
      />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="text-2xl font-bold">Pipeline de Vendas</h2>
            <p className="text-sm text-muted-foreground">
              {filteredDeals.length} oportunidade{filteredDeals.length !== 1 ? 's' : ''} de negócio
            </p>
          </div>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Novo Negócio
          </Button>
        </div>
        
        <DealFilters
          filters={filters}
          onChange={setFilters}
          onClear={clearFilters}
        />
        
        <div className="flex-1 overflow-auto p-4">
          {error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Erro ao carregar negócios. Tente recarregar a página.
              </AlertDescription>
            </Alert>
          ) : isLoading ? (
            <div className="flex gap-4 overflow-x-auto pb-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex-shrink-0 w-80">
                  <Skeleton className="h-[400px] w-full" />
                </div>
              ))}
            </div>
          ) : (
            <DealKanbanBoard deals={filteredDeals} />
          )}
        </div>
      </div>
    </div>
  );
};

export default Negocios;
