import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, AlertCircle, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { useCRMDeals, useSyncClintData } from '@/hooks/useCRMData';
import { DealKanbanBoard } from '@/components/crm/DealKanbanBoard';
import { OriginsSidebar } from '@/components/crm/OriginsSidebar';
import { DealFilters, DealFiltersState } from '@/components/crm/DealFilters';
import { DealFormDialog } from '@/components/crm/DealFormDialog';
import { useStagePermissions } from '@/hooks/useStagePermissions';
import { toast } from 'sonner';

const Negocios = () => {
  const [selectedOriginId, setSelectedOriginId] = useState<string | null>(null);
  const [filters, setFilters] = useState<DealFiltersState>({
    search: '',
    dateRange: undefined,
    tags: [],
    owner: null,
  });
  
  const { data: deals, isLoading, error } = useCRMDeals({
    originId: selectedOriginId || undefined,
  });
  const { getVisibleStages } = useStagePermissions();
  const syncMutation = useSyncClintData();
  
  const dealsData = deals || [];
  const visibleStages = getVisibleStages();
  
  const handleSync = () => {
    toast.info('Sincronizando dados do Clint...');
    syncMutation.mutate(undefined, {
      onSuccess: () => toast.success('Dados sincronizados com sucesso!'),
      onError: () => toast.error('Erro ao sincronizar dados'),
    });
  };
  
  const filteredDeals = dealsData.filter((deal: any) => {
    if (!deal || !deal.id || !deal.name) return false;
    
    if (filters.search && !deal.name.toLowerCase().includes(filters.search.toLowerCase())) {
      return false;
    }
    
    if (filters.tags && filters.tags.length > 0) {
      const dealTags = deal.tags || [];
      if (!filters.tags.some(tag => dealTags.includes(tag))) return false;
    }
    
    if (filters.owner && deal.owner_id !== filters.owner) return false;
    
    return true;
  });
  
  const clearFilters = () => {
    setFilters({
      search: '',
      dateRange: undefined,
      tags: [],
      owner: null,
    });
  };
  
  return (
    <div className="flex h-[calc(100vh-120px)]">
      <OriginsSidebar
        selectedOriginId={selectedOriginId}
        onSelectOrigin={setSelectedOriginId}
      />
      
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="text-2xl font-bold">Pipeline de Vendas</h2>
            <p className="text-sm text-muted-foreground">
              {filteredDeals.length} oportunidade{filteredDeals.length !== 1 ? 's' : ''} de negócio
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={handleSync}
              disabled={syncMutation.isPending}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
              Sincronizar
            </Button>
            <DealFormDialog
              defaultOriginId={selectedOriginId || undefined}
              trigger={
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Negócio
                </Button>
              }
            />
          </div>
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
                <div>
                  <strong className="block mb-2">Erro ao carregar negócios da API Clint</strong>
                  <p className="text-sm mb-1">
                    {error instanceof Error && error.message.includes('504') 
                      ? 'A API não respondeu a tempo (timeout 504). O servidor pode estar sobrecarregado.'
                      : 'Ocorreu um erro ao buscar os dados.'}
                  </p>
                  <p className="text-sm text-muted-foreground mb-3">
                    Tente recarregar a página ou aguarde alguns minutos.
                  </p>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => window.location.reload()}
                  >
                    Recarregar Página
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          ) : isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              <div className="text-center">
                <p className="text-lg font-semibold">Carregando negócios...</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Isso pode levar alguns segundos
                </p>
              </div>
            </div>
          ) : (
            <DealKanbanBoard 
              deals={filteredDeals.map((deal: any) => ({
                ...deal,
                stage: deal.crm_stages?.stage_name || 'Sem estágio',
              }))}
              originId={selectedOriginId || undefined}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default Negocios;
