import { useState, useEffect, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, AlertCircle, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useCRMDeals, useSyncClintData } from '@/hooks/useCRMData';
import { DealKanbanBoard } from '@/components/crm/DealKanbanBoard';
import { OriginsSidebar } from '@/components/crm/OriginsSidebar';
import { DealFilters, DealFiltersState } from '@/components/crm/DealFilters';
import { DealFormDialog } from '@/components/crm/DealFormDialog';
import { BulkActionsBar } from '@/components/crm/BulkActionsBar';
import { BulkTransferDialog } from '@/components/crm/BulkTransferDialog';
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
  isSdrRole, 
  getAuthorizedOriginsForRole,
  SDR_AUTHORIZED_ORIGIN_ID 
} from '@/components/auth/NegociosAccessGuard';
import { useNewLeadNotifications } from '@/hooks/useNewLeadNotifications';
import { useBulkA010Check, detectSalesChannel, SalesChannel } from '@/hooks/useBulkA010Check';
import { useBatchDealActivitySummary } from '@/hooks/useDealActivitySummary';
import { useBulkTransfer } from '@/hooks/useBulkTransfer';
import { differenceInDays } from 'date-fns';

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
    owner: null,
    dealStatus: 'all',
    inactivityDays: null,
    salesChannel: 'all',
  });
  
  // Estado para modo de seleção e transferência em massa
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedDealIds, setSelectedDealIds] = useState<Set<string>>(new Set());
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const bulkTransfer = useBulkTransfer();
  
  // Verificar se é SDR (acesso restrito ao Pipeline Inside Sales)
  const isSdr = isSdrRole(role);
  const authorizedOrigins = getAuthorizedOriginsForRole(role);
  
  // Ref para garantir que só define o default UMA VEZ
  const hasSetDefault = useRef(false);
  
  // Buscar pipelines para definir o default
  const { data: pipelines } = useCRMPipelines();
  
  // Buscar origens do pipeline selecionado
  const { data: pipelineOrigins } = useCRMOriginsByPipeline(selectedPipelineId);
  
  // Calcular o originId correto para usar nas queries
  const effectiveOriginId = useMemo(() => {
    // Para SDRs, SEMPRE usar a origem autorizada (PIPELINE INSIDE SALES)
    if (isSdr) {
      return SDR_AUTHORIZED_ORIGIN_ID;
    }
    
    // Se já tem uma origem selecionada manualmente, usar ela
    if (selectedOriginId) return selectedOriginId;
    
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
  }, [selectedOriginId, selectedPipelineId, pipelineOrigins, isSdr]);
  
  // Definir pipeline padrão APENAS na primeira montagem
  useEffect(() => {
    if (pipelines && pipelines.length > 0 && !hasSetDefault.current) {
      hasSetDefault.current = true;
      
      // Se for SDR, pré-selecionar a origem autorizada (PIPELINE INSIDE SALES)
      if (isSdr) {
        setSelectedPipelineId(SDR_AUTHORIZED_ORIGIN_ID);
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
  }, [pipelines, isSdr]);
  
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
    limit: 10000,
  });
  const { getVisibleStages } = useStagePermissions();
  const syncMutation = useSyncClintData();
  const visibleStages = getVisibleStages();
  
  // Extrair deal IDs e stage IDs para buscar atividades em batch
  const dealIds = useMemo(() => (dealsData || []).map((d: any) => d.id), [dealsData]);
  const stageIdsMap = useMemo(() => {
    const map = new Map<string, string>();
    (dealsData || []).forEach((d: any) => {
      if (d.stage_id) map.set(d.id, d.stage_id);
    });
    return map;
  }, [dealsData]);
  
  // Buscar activity summaries para filtro de inatividade
  const { data: activitySummaries } = useBatchDealActivitySummary(dealIds, stageIdsMap);
  
  // Extrair emails para verificação de A010 em batch
  const dealEmails = useMemo(() => 
    (dealsData || [])
      .map((d: any) => d.crm_contacts?.email)
      .filter(Boolean) as string[],
    [dealsData]
  );
  
  // Verificar A010 em batch
  const { data: a010StatusMap } = useBulkA010Check(dealEmails);
  
  // Criar mapa de canais (email -> SalesChannel) para passar ao board
  const channelMap = useMemo(() => {
    if (!a010StatusMap || !dealsData) return new Map<string, SalesChannel>();
    
    const map = new Map<string, SalesChannel>();
    
    // Criar set de emails A010
    const a010Emails = new Set(
      Array.from(a010StatusMap.entries())
        .filter(([_, isA010]) => isA010)
        .map(([email]) => email)
    );
    
    // Mapear cada deal para seu canal
    (dealsData as any[]).forEach((deal: any) => {
      const email = deal.crm_contacts?.email?.toLowerCase();
      if (email) {
        const channel = detectSalesChannel(email, a010Emails, {
          tags: deal.tags,
          customFields: deal.custom_fields,
        });
        map.set(email, channel);
      }
    });
    
    return map;
  }, [a010StatusMap, dealsData]);
  
  // Verificar se é SDR ou Closer (veem apenas próprios deals)
  const isRestrictedRole = role === 'sdr' || role === 'closer';
  
  const handleSync = () => {
    toast.info('Sincronizando dados do Clint...');
    syncMutation.mutate(undefined, {
      onSuccess: () => toast.success('Dados sincronizados com sucesso!'),
      onError: () => toast.error('Erro ao sincronizar dados'),
    });
  };
  
  // Handlers de seleção
  const handleSelectionChange = (dealId: string, selected: boolean) => {
    setSelectedDealIds(prev => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(dealId);
      } else {
        newSet.delete(dealId);
      }
      return newSet;
    });
  };
  
  const handleClearSelection = () => {
    setSelectedDealIds(new Set());
    setSelectionMode(false);
  };

  const handleSelectAllInStage = (dealIds: string[], selected: boolean) => {
    setSelectedDealIds(prev => {
      const newSet = new Set(prev);
      dealIds.forEach(id => {
        if (selected) {
          newSet.add(id);
        } else {
          newSet.delete(id);
        }
      });
      return newSet;
    });
  };
  
  const handleToggleSelectionMode = () => {
    setSelectionMode(!selectionMode);
    if (selectionMode) {
      setSelectedDealIds(new Set());
    }
  };
  
  const filteredDeals = useMemo(() => {
    return (dealsData || []).filter((deal: any) => {
      if (!deal || !deal.id || !deal.name) return false;
      
      // Filtro por role: SDR/Closer veem apenas seus próprios deals
      if (isRestrictedRole && userProfile?.email) {
        if (deal.owner_id !== userProfile.email) return false;
      }
      
      // Busca expandida: nome do deal, nome do contato, email e telefone
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const searchRaw = filters.search;
        
        const matchesDealName = deal.name?.toLowerCase().includes(searchLower);
        const matchesContactName = deal.crm_contacts?.name?.toLowerCase().includes(searchLower);
        const matchesEmail = deal.crm_contacts?.email?.toLowerCase().includes(searchLower);
        const matchesPhone = deal.crm_contacts?.phone?.includes(searchRaw);
        
        if (!matchesDealName && !matchesContactName && !matchesEmail && !matchesPhone) {
          return false;
        }
      }
      
      // Filtro por data de criação
      if (filters.dateRange?.from) {
        const dealDate = new Date(deal.created_at);
        const fromDate = new Date(filters.dateRange.from);
        fromDate.setHours(0, 0, 0, 0);
        
        if (dealDate < fromDate) return false;
        
        if (filters.dateRange.to) {
          const toDate = new Date(filters.dateRange.to);
          toDate.setHours(23, 59, 59, 999);
          if (dealDate > toDate) return false;
        }
      }
      
      if (filters.owner && deal.owner_id !== filters.owner) return false;
      
      // Filtro por status do negócio (baseado no estágio)
      if (filters.dealStatus !== 'all') {
        const stageName = deal.crm_stages?.stage_name;
        const dealStatus = getDealStatusFromStage(stageName);
        if (dealStatus !== filters.dealStatus) return false;
      }
      
      // Filtro por inatividade
      if (filters.inactivityDays !== null) {
        const summary = activitySummaries?.get(deal.id);
        const lastActivity = summary?.lastContactAttempt;
        
        if (!lastActivity) {
          // Sem atividade = muito tempo inativo (sempre passa no filtro)
        } else {
          const daysSince = differenceInDays(new Date(), new Date(lastActivity));
          if (daysSince < filters.inactivityDays) return false;
        }
      }
      
      // Filtro por canal de entrada (A010 vs BIO vs LIVE)
      if (filters.salesChannel !== 'all') {
        const email = deal.crm_contacts?.email?.toLowerCase();
        const isA010 = email ? (a010StatusMap?.get(email) ?? false) : false;
        
        // Detectar canal completo usando tags e custom_fields
        const a010Emails = new Set(
          Array.from(a010StatusMap?.entries() || [])
            .filter(([_, isA010]) => isA010)
            .map(([email]) => email)
        );
        
        const channel = detectSalesChannel(email, a010Emails, {
          tags: deal.tags,
          customFields: deal.custom_fields,
        });
        
        if (filters.salesChannel !== channel) return false;
      }
      
      return true;
    });
  }, [dealsData, isRestrictedRole, userProfile?.email, filters, activitySummaries, a010StatusMap]);
  
  const clearFilters = () => {
    setFilters({
      search: '',
      dateRange: undefined,
      owner: null,
      dealStatus: 'all',
      inactivityDays: null,
      salesChannel: 'all',
    });
  };
  
  // Limpar sub-origem ao trocar de pipeline
  const handlePipelineChange = (pipelineId: string | null) => {
    setSelectedPipelineId(pipelineId);
    setSelectedOriginId(null); // Reset sub-origem ao trocar pipeline
  };
  
  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-56px)] overflow-hidden">
      {/* Sidebar - hidden on mobile, hidden for SDRs */}
      {!isSdr && (
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
              defaultOriginId={effectiveOriginId}
              defaultOriginName={
                selectedOriginId 
                  ? (pipelineOrigins as any[])?.find((o: any) => o.id === selectedOriginId)?.name 
                  : pipelines?.find(p => p.id === selectedPipelineId)?.display_name || pipelines?.find(p => p.id === selectedPipelineId)?.name
              }
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
          selectionMode={selectionMode}
          onToggleSelectionMode={handleToggleSelectionMode}
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
              selectionMode={selectionMode}
              selectedDealIds={selectedDealIds}
              onSelectionChange={handleSelectionChange}
              onSelectAllInStage={handleSelectAllInStage}
              channelMap={channelMap}
            />
          )}
        </div>
      </div>
      
      {/* Barra de ações em massa */}
      <BulkActionsBar
        selectedCount={selectedDealIds.size}
        onTransfer={() => setTransferDialogOpen(true)}
        onClearSelection={handleClearSelection}
        isTransferring={bulkTransfer.isPending}
      />
      
      {/* Dialog de transferência em massa */}
      <BulkTransferDialog
        open={transferDialogOpen}
        onOpenChange={setTransferDialogOpen}
        selectedDealIds={Array.from(selectedDealIds)}
        onSuccess={handleClearSelection}
      />
    </div>
  );
};

export default Negocios;
