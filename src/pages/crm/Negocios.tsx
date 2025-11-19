import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { useAllClintDeals } from '@/hooks/useClintAPI';
import { DealKanbanBoard } from '@/components/crm/DealKanbanBoard';
import { OriginsSidebar } from '@/components/crm/OriginsSidebar';
import { DealFilters, DealFiltersState } from '@/components/crm/DealFilters';
import { DealFormDialog } from '@/components/crm/DealFormDialog';
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
  
  const { data: dealsData, isLoading, error } = useAllClintDeals(
    selectedOriginId ? { origin_id: selectedOriginId } : undefined
  );
  const { getVisibleStages } = useStagePermissions();
  
  const deals = dealsData?.data || [];
  const visibleStages = getVisibleStages();
  
  // Debug: Log para ver dados recebidos
  console.log('📊 Debug Negócios:', {
    totalDeals: deals.length,
    selectedOriginId,
    visibleStages,
    deals: deals.slice(0, 3) // Mostra primeiros 3 deals
  });
  
  const filteredDeals = deals.filter((deal: any) => {
    // Validar dados essenciais do deal - usar stage_id em vez de stage
    if (!deal || !deal.id || !deal.name || !deal.stage_id) {
      console.log('❌ Deal inválido (faltam dados básicos):', deal);
      return false;
    }
    
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
    
    // TEMPORÁRIO: Desabilitar filtro de permissões até migrar para banco próprio
    // O problema: visibleStages usa UUIDs do Supabase, mas deal.stage_id vem da API Clint
    /*
    if (!visibleStages.includes(deal.stage_id)) {
      console.log('⚠️ Deal filtrado por permissão de estágio:', { 
        dealName: deal.name, 
        stageId: deal.stage_id,
        stageName: deal.stage,
        visibleStages 
      });
      return false;
    }
    */
    
    return true;
  });
  
  // Debug: Log resultado final
  console.log('✅ Deals após filtros:', {
    total: filteredDeals.length,
    filteredOut: deals.length - filteredDeals.length
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
      
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="text-2xl font-bold">Pipeline de Vendas</h2>
            <p className="text-sm text-muted-foreground">
              {filteredDeals.length} oportunidade{filteredDeals.length !== 1 ? 's' : ''} de negócio
            </p>
          </div>
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
            <DealKanbanBoard deals={filteredDeals} />
          )}
        </div>
      </div>
    </div>
  );
};

export default Negocios;
