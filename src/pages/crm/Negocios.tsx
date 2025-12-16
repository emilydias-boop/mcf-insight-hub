import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, AlertCircle, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useCRMDeals, useSyncClintData } from '@/hooks/useCRMData';
import { DealKanbanBoard } from '@/components/crm/DealKanbanBoard';
import { GroupsSidebar } from '@/components/crm/GroupsSidebar';
import { DealFilters, DealFiltersState } from '@/components/crm/DealFilters';
import { DealFormDialog } from '@/components/crm/DealFormDialog';
import { useStagePermissions } from '@/hooks/useStagePermissions';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getDealStatusFromStage } from '@/lib/dealStatusHelper';

const Negocios = () => {
  const { role, user } = useAuth();
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedOriginId, setSelectedOriginId] = useState<string | null>(null);
  const [filters, setFilters] = useState<DealFiltersState>({
    search: '',
    dateRange: undefined,
    tags: [],
    owner: null,
    dealStatus: 'all',
  });
  
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
  
  // Buscar origens do grupo selecionado para filtrar deals
  const { data: groupOrigins } = useQuery({
    queryKey: ['group-origins', selectedGroupId],
    queryFn: async () => {
      if (!selectedGroupId || selectedGroupId === '__ungrouped__') {
        if (selectedGroupId === '__ungrouped__') {
          const { data } = await supabase
            .from('crm_origins')
            .select('id')
            .is('group_id', null);
          return data?.map(o => o.id) || [];
        }
        return null;
      }
      
      const { data } = await supabase
        .from('crm_origins')
        .select('id')
        .eq('group_id', selectedGroupId);
      return data?.map(o => o.id) || [];
    },
    enabled: !!selectedGroupId
  });
  
  // Determinar filtro de origem para a query
  const getOriginFilter = () => {
    if (selectedOriginId) return selectedOriginId;
    return undefined; // Buscar todos e filtrar no cliente
  };
  
  const { data: deals, isLoading, error } = useCRMDeals({
    originId: getOriginFilter(),
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
    
    // Filtro por grupo (se selecionado)
    if (selectedGroupId && groupOrigins) {
      if (!groupOrigins.includes(deal.origin_id)) return false;
    }
    
    // Filtro por origem específica
    if (selectedOriginId && deal.origin_id !== selectedOriginId) return false;
    
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
  
  return (
    <div className="flex h-full">
      <GroupsSidebar
        selectedGroupId={selectedGroupId}
        selectedOriginId={selectedOriginId}
        onSelectGroup={setSelectedGroupId}
        onSelectOrigin={setSelectedOriginId}
      />
      
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <div className="flex items-center justify-between px-4 py-3 border-b gap-4 flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold">
              {isRestrictedRole ? 'Meus Negócios' : 'Pipeline de Vendas'}
            </h2>
            <p className="text-xs text-muted-foreground">
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
              defaultOriginId={selectedOriginId || undefined}
              trigger={
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Negócio
                </Button>
              }
            />
          </div>
        </div>
        
        <div className="flex-shrink-0">
          <DealFilters
            filters={filters}
            onChange={setFilters}
            onClear={clearFilters}
          />
        </div>
        
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
