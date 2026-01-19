import { useState, useEffect, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, AlertCircle, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useCRMDeals, useSyncClintData } from '@/hooks/useCRMData';
import { DealKanbanBoard } from '@/components/crm/DealKanbanBoard';
import { OriginsSidebar } from '@/components/crm/OriginsSidebar';
import { DealFilters, DealFiltersState } from '@/components/crm/DealFilters';
import { DealFormDialog } from '@/components/crm/DealFormDialog';
import { useCRMPipelines } from '@/components/crm/PipelineSelector';
import { useCRMOriginsByPipeline } from '@/hooks/useCRMOriginsByPipeline';
import { useStagePermissions } from '@/hooks/useStagePermissions';
import { useAuth } from '@/contexts/AuthContext';
import { useCallQualificationTrigger } from '@/hooks/useCallQualificationTrigger';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getDealStatusFromStage } from '@/lib/dealStatusHelper';
import { 
  isSdrWithNegociosAccess, 
  getAuthorizedOriginsForUser 
} from '@/components/auth/NegociosAccessGuard';
import { useNewLeadNotifications } from '@/hooks/useNewLeadNotifications';

const Negocios = () => {
  // Ativar notificações em tempo real para novos leads
  useNewLeadNotifications();
  
  // Hook que abre o modal global quando lead atende (via TwilioContext)
  useCallQualificationTrigger();
  
  const { role, user } = useAuth();
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);
  const [selectedOriginId, setSelectedOriginId] = useState<string | null>(null);
  const [filters, setFilters] = useState<DealFiltersState>({
    search: '',
    dateRange: undefined,
    tags: [],
    owner: null,
    dealStatus: 'all',
  });
  
  // Verificar se é SDR com acesso especial a Negócios
  const isSdrWithAccess = isSdrWithNegociosAccess(role, user?.id);
  const authorizedOrigins = getAuthorizedOriginsForUser(user?.id);
  
  // Ref para garantir que só define o default UMA VEZ
  const hasSetDefault = useRef(false);
  
  // Buscar pipelines para definir o default
  const { data: pipelines } = useCRMPipelines();
  
  // Buscar origens do pipeline selecionado
  const { data: pipelineOrigins } = useCRMOriginsByPipeline(selectedPipelineId);
  
  // Calcular o originId correto para usar nas queries
  const effectiveOriginId = useMemo(() => {
    // Se já tem uma origem selecionada manualmente, usar ela
    if (selectedOriginId) return selectedOriginId;
    
    // Para SDRs com acesso limitado, usar a origem autorizada diretamente
    if (isSdrWithAccess && authorizedOrigins.length > 0) {
      return authorizedOrigins[0];
    }
    
    // Se tem um pipeline selecionado, verificar se é um grupo ou uma origem
    if (selectedPipelineId && pipelineOrigins && Array.isArray(pipelineOrigins)) {
      // pipelineOrigins pode ser uma lista flat de origens quando um pipeline está selecionado
      // Nesse caso, não há originId implícito - precisamos que o usuário selecione
      // Ou podemos pegar a primeira origem como default
      if (pipelineOrigins.length > 0 && !('children' in pipelineOrigins[0])) {
        // É uma lista flat de origens - pegar a primeira como default
        return (pipelineOrigins[0] as any).id;
      }
    }
    
    return undefined;
  }, [selectedOriginId, selectedPipelineId, pipelineOrigins, isSdrWithAccess, authorizedOrigins]);
  
  // Definir pipeline padrão APENAS na primeira montagem
  useEffect(() => {
    if (pipelines && pipelines.length > 0 && !hasSetDefault.current) {
      hasSetDefault.current = true;
      
      // Se for SDR com acesso limitado, pré-selecionar a origem autorizada
      if (isSdrWithAccess && authorizedOrigins.length > 0) {
        setSelectedPipelineId(authorizedOrigins[0]); // PIPELINE INSIDE SALES
        return;
      }
      
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
  }, [pipelines, isSdrWithAccess, authorizedOrigins]);
  
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
  
  // Usar o effectiveOriginId calculado para buscar deals
  const { 
    data: dealsData, 
    isLoading, 
    error,
  } = useCRMDeals({
    originId: effectiveOriginId,
    searchTerm: filters.search || undefined,
    limit: 5000,
  });
  const { getVisibleStages } = useStagePermissions();
  const syncMutation = useSyncClintData();
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
  
  const filteredDeals = (dealsData || []).filter((deal: any) => {
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
    
    // Filtro por status do negócio (baseado no estágio)
    if (filters.dealStatus !== 'all') {
      const stageName = deal.crm_stages?.stage_name;
      const dealStatus = getDealStatusFromStage(stageName);
      if (dealStatus !== filters.dealStatus) return false;
    }
    
    return true;
  });
  
  const clearFilters = () => {
    setFilters({
      search: '',
      dateRange: undefined,
      tags: [],
      owner: null,
      dealStatus: 'all',
    });
  };
  
  // Limpar sub-origem ao trocar de pipeline
  const handlePipelineChange = (pipelineId: string | null) => {
    setSelectedPipelineId(pipelineId);
    setSelectedOriginId(null); // Reset sub-origem ao trocar pipeline
  };
  
  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-56px)] overflow-hidden">
      {/* Sidebar - hidden on mobile, hidden for restricted SDRs */}
      {!isSdrWithAccess && (
        <div className="hidden md:block">
          <OriginsSidebar
            pipelineId={selectedPipelineId}
            selectedOriginId={selectedOriginId}
            onSelectOrigin={setSelectedOriginId}
            onSelectPipeline={handlePipelineChange}
          />
        </div>
      )}
      
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-4 border-b gap-3">
          <div>
            <h2 className="text-lg sm:text-xl font-bold">
              {isRestrictedRole ? 'Meus Negócios' : 'Pipeline de Vendas'}
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {filteredDeals.length} oportunidade{filteredDeals.length !== 1 ? 's' : ''}
            </p>
          </div>
          
          <div className="flex gap-2 w-full sm:w-auto">
            <Button 
              variant="outline" 
              onClick={handleSync}
              disabled={syncMutation.isPending}
              size="sm"
              className="flex-1 sm:flex-none"
            >
              <RefreshCw className={`h-4 w-4 sm:mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Sincronizar</span>
            </Button>
            <DealFormDialog
              defaultOriginId={selectedOriginId || selectedPipelineId || undefined}
              trigger={
                <Button size="sm" className="flex-1 sm:flex-none">
                  <Plus className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Novo Negócio</span>
                  <span className="sm:hidden">Novo</span>
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
        
        <div className="flex-1 overflow-hidden p-2 sm:p-4">
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
              originId={effectiveOriginId}
              showLostDeals={filters.dealStatus === 'lost'}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default Negocios;
