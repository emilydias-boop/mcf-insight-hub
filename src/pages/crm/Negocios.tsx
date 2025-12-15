import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, AlertCircle, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useCRMDeals, useSyncClintData } from '@/hooks/useCRMData';
import { DealKanbanBoard } from '@/components/crm/DealKanbanBoard';
import { OriginsSidebar } from '@/components/crm/OriginsSidebar';
import { DealFilters, DealFiltersState } from '@/components/crm/DealFilters';
import { DealFormDialog } from '@/components/crm/DealFormDialog';
import { useCRMPipelines } from '@/components/crm/PipelineSelector';
import { useStagePermissions } from '@/hooks/useStagePermissions';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const Negocios = () => {
  const { role, user } = useAuth();
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);
  const [selectedOriginId, setSelectedOriginId] = useState<string | null>(null);
  const [filters, setFilters] = useState<DealFiltersState>({
    search: '',
    dateRange: undefined,
    tags: [],
    owner: null,
  });
  
  // Ref para garantir que só define o default UMA VEZ
  const hasSetDefault = useRef(false);
  
  // Buscar pipelines para definir o default
  const { data: pipelines } = useCRMPipelines();
  
  // Definir pipeline padrão APENAS na primeira montagem
  useEffect(() => {
    if (pipelines && pipelines.length > 0 && !hasSetDefault.current) {
      hasSetDefault.current = true;
      const insideSales = pipelines.find(p => 
        p.name === 'PIPELINE INSIDE SALES' || 
        p.display_name?.includes('Inside Sales')
      );
      if (insideSales) {
        setSelectedPipelineId(insideSales.id);
      } else {
        setSelectedPipelineId(pipelines[0].id);
      }
    }
  }, [pipelines]);
  
  // Buscar email do usuário logado
  const { data: userProfile } = useQuery({
    queryKey: ['user-profile', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', user?.id)
        .single();
      return data;
    },
    enabled: !!user?.id
  });
  
  // Usar pipeline como filtro principal, sub-origem como filtro secundário
  const { data: deals, isLoading, error } = useCRMDeals({
    originId: selectedOriginId || selectedPipelineId || undefined,
  });
  const { getVisibleStages } = useStagePermissions();
  const syncMutation = useSyncClintData();
  
  const dealsData = deals || [];
  const visibleStages = getVisibleStages();
  
  // Verificar se é SDR ou Closer (veem apenas próprios deals)
  const isRestrictedRole = role === 'sdr' || role === 'closer';
  
  const handleSync = () => {
    toast.info('Sincronizando dados do Clint...');
    syncMutation.mutate(undefined, {
      onSuccess: () => toast.success('Dados sincronizados com sucesso!'),
      onError: () => toast.error('Erro ao sincronizar dados'),
    });
  };
  
  const filteredDeals = dealsData.filter((deal: any) => {
    if (!deal || !deal.id || !deal.name) return false;
    
    // Filtro por role: SDR/Closer veem apenas seus próprios deals
    if (isRestrictedRole && userProfile?.email) {
      if (deal.owner_id !== userProfile.email) return false;
    }
    
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
  
  // Limpar sub-origem ao trocar de pipeline
  const handlePipelineChange = (pipelineId: string | null) => {
    setSelectedPipelineId(pipelineId);
    setSelectedOriginId(null); // Reset sub-origem ao trocar pipeline
  };
  
  return (
    <div className="flex h-[calc(100vh-120px)]">
      <OriginsSidebar
        pipelineId={selectedPipelineId}
        selectedOriginId={selectedOriginId}
        onSelectOrigin={setSelectedOriginId}
        onSelectPipeline={handlePipelineChange}
      />
      
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <div className="flex items-center justify-between p-4 border-b gap-4">
          <div>
            <h2 className="text-xl font-bold">
              {isRestrictedRole ? 'Meus Negócios' : 'Pipeline de Vendas'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {filteredDeals.length} oportunidade{filteredDeals.length !== 1 ? 's' : ''}
            </p>
          </div>
          
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={handleSync}
              disabled={syncMutation.isPending}
              size="sm"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
              Sincronizar
            </Button>
            <DealFormDialog
              defaultOriginId={selectedOriginId || selectedPipelineId || undefined}
              trigger={
                <Button size="sm">
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
              originId={selectedOriginId || selectedPipelineId || undefined}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default Negocios;
