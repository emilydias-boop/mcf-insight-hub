import { useState, useEffect, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, AlertCircle, RefreshCw, Settings } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useCRMDeals, useSyncClintData } from '@/hooks/useCRMData';
import { DealKanbanBoard } from '@/components/crm/DealKanbanBoard';
import { OriginsSidebar } from '@/components/crm/OriginsSidebar';
import { DealFilters, DealFiltersState } from '@/components/crm/DealFilters';
import { DealFormDialog } from '@/components/crm/DealFormDialog';
import { BulkActionsBar } from '@/components/crm/BulkActionsBar';
import { BulkTransferDialog } from '@/components/crm/BulkTransferDialog';
import { useCRMPipelines } from '@/components/crm/PipelineSelector';
import { PipelineConfigModal } from '@/components/crm/PipelineConfigModal';
import { CreatePipelineWizard } from '@/components/crm/wizard/CreatePipelineWizard';
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
  SDR_AUTHORIZED_ORIGIN_ID,
  SDR_ORIGIN_BY_BU,
  BU_DEFAULT_ORIGIN_MAP,
  SDR_MULTI_PIPELINE_BUS,
} from '@/components/auth/NegociosAccessGuard';
import { useBUPipelineMap } from '@/hooks/useBUPipelineMap';
import { useNewLeadNotifications } from '@/hooks/useNewLeadNotifications';
import { useBulkA010Check, detectSalesChannel, SalesChannel } from '@/hooks/useBulkA010Check';
import { useBatchDealActivitySummary } from '@/hooks/useDealActivitySummary';
import { useBulkTransfer } from '@/hooks/useBulkTransfer';
import { useActiveBU } from '@/hooks/useActiveBU';
import { differenceInDays } from 'date-fns';
import { useDealOwnerOptions } from '@/hooks/useDealOwnerOptions';
import { useUniqueDealTags } from '@/hooks/useUniqueDealTags';
import { useOutsideDetectionForDeals } from '@/hooks/useOutsideDetectionForDeals';
import { OutsideDistributionButton } from '@/components/crm/OutsideDistributionButton';

const Negocios = () => {
  // Ativar notificações em tempo real para novos leads
  useNewLeadNotifications();
  
  // Hook que abre o modal global quando lead atende (via TwilioContext)
  useCallQualificationTrigger();
  
  const { role, user, allRoles } = useAuth();
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);
  const [selectedOriginId, setSelectedOriginId] = useState<string | null>(null);
  const [filters, setFilters] = useState<DealFiltersState>({
    search: '',
    dateRange: undefined,
    owner: null,
    dealStatus: 'all',
    inactivityDays: null,
    salesChannel: 'all',
    attemptsRange: null,
    selectedTags: [],
    activityPriority: 'all',
    outsideFilter: 'all',
  });
  
  // Estado para seleção e transferência em massa
  const [selectedDealIds, setSelectedDealIds] = useState<Set<string>>(new Set());
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const bulkTransfer = useBulkTransfer();
  
  // Usar BU ativa (do contexto da rota ou do perfil do usuário)
  const activeBU = useActiveBU();
  const isLoadingBU = false; // useActiveBU é síncrono
  
  // Verificar se é SDR (acesso restrito ao Pipeline Inside Sales)
  // Usa allRoles para suportar usuários com múltiplas roles (ex: SDR + Closer)
  const isSdr = isSdrRole(role, allRoles);
  const authorizedOrigins = getAuthorizedOriginsForRole(role);
  
  // Verificar se é SDR ou Closer (veem apenas próprios deals)
  // Movido para cima para usar no hook useCRMDeals
  const isRestrictedRole = role === 'sdr' || role === 'closer';
  
  // Buscar mapeamento dinâmico da BU do banco de dados
  const { data: buMapping, isLoading: isBuMappingLoading } = useBUPipelineMap(activeBU);
  
  // Origens autorizadas baseadas na BU ativa (rota ou perfil)
  // CORREÇÃO: Combinar grupos E origens (não excludente)
  const buAuthorizedOrigins = useMemo(() => {
    if (!activeBU || !buMapping) return []; // Sem BU ou carregando = vê tudo (admin)
    // Combinar grupos E origens para permitir filtro completo
    return [...buMapping.groups, ...buMapping.origins];
  }, [activeBU, buMapping]);
  
  // Grupos permitidos no dropdown de funis baseados na BU ativa
  const buAllowedGroups = useMemo(() => {
    if (!activeBU || !buMapping) return []; // Sem BU ou carregando = vê tudo (admin)
    return buMapping.groups;
  }, [activeBU, buMapping]);
  
  // Ref para garantir que só define o default UMA VEZ
  const hasSetDefault = useRef(false);
  
  // Buscar pipelines para definir o default
  // Se tem BU ativa, pula deduplicação para garantir que os IDs mapeados apareçam
  const { data: pipelines } = useCRMPipelines(!!activeBU);
  
  // Buscar origens do pipeline selecionado
  const { data: pipelineOrigins } = useCRMOriginsByPipeline(selectedPipelineId);
  
  // Calcular o originId correto para usar nas queries
  const effectiveOriginId = useMemo(() => {
    // Para SDRs
    if (isSdr) {
      // SDRs de BUs com multi-pipeline podem navegar manualmente
      if (activeBU && SDR_MULTI_PIPELINE_BUS.includes(activeBU)) {
        if (selectedOriginId) return selectedOriginId;
      }
      
      // Default ou BUs com pipeline fixa
      if (activeBU && SDR_ORIGIN_BY_BU[activeBU]) {
        return SDR_ORIGIN_BY_BU[activeBU];
      }
      // Fallback para Incorporador se não tem BU definida
      return SDR_AUTHORIZED_ORIGIN_ID;
    }
    
    // Se já tem uma origem selecionada manualmente, usar ela
    if (selectedOriginId) return selectedOriginId;
    
    // Se tem um pipeline selecionado, verificar o que o hook retornou
    if (selectedPipelineId && pipelineOrigins && Array.isArray(pipelineOrigins)) {
      // pipelineOrigins pode ser uma lista flat de origens
      if (pipelineOrigins.length > 0 && !('children' in pipelineOrigins[0])) {
        // É uma lista flat de origens
        // Se só tem uma origem (caso selectedPipelineId seja um originId), usar ela
        if (pipelineOrigins.length === 1) {
          return (pipelineOrigins[0] as any).id;
        }
        // Se tem múltiplas origens, pegar a primeira como default
        return (pipelineOrigins[0] as any).id;
      }
    }
    
    // CORREÇÃO: Se pipelineOrigins ainda está carregando (undefined ou array vazio),
    // NÃO usar selectedPipelineId como fallback pois pode ser um Group ID
    // que não possui estágios diretamente vinculados. Retornar undefined para aguardar.
    if (selectedPipelineId && (!pipelineOrigins || (Array.isArray(pipelineOrigins) && pipelineOrigins.length === 0))) {
      // Não retornar selectedPipelineId aqui - pode ser um grupo sem etapas
      return undefined;
    }
    
    return undefined;
  }, [selectedOriginId, selectedPipelineId, pipelineOrigins, isSdr]);
  
  // Definir pipeline padrão APENAS na primeira montagem
  useEffect(() => {
    if (pipelines && pipelines.length > 0 && !hasSetDefault.current && !isLoadingBU) {
      hasSetDefault.current = true;
      
      // Se for SDR, pré-selecionar a origem da BU ativa
      if (isSdr) {
        if (activeBU && SDR_ORIGIN_BY_BU[activeBU]) {
          setSelectedPipelineId(SDR_ORIGIN_BY_BU[activeBU]);
        } else {
          setSelectedPipelineId(SDR_AUTHORIZED_ORIGIN_ID);
        }
        return;
      }
      
      // Se tem BU ativa (da rota ou perfil), usar a origem padrão da BU
      if (activeBU && BU_DEFAULT_ORIGIN_MAP[activeBU]) {
        setSelectedPipelineId(BU_DEFAULT_ORIGIN_MAP[activeBU]);
        return;
      }
      
      // Fallback: Tentar encontrar PIPELINE INSIDE SALES ou usar o primeiro
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
  }, [pipelines, isSdr, activeBU, isLoadingBU]);
  
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
  // CORREÇÃO: Passar ownerProfileId para SDRs/Closers para filtrar no BACKEND
  // Isso elimina a race condition onde todos os deals ficavam visíveis momentaneamente
  const { 
    data: dealsData, 
    isLoading, 
    error,
  } = useCRMDeals({
    originId: effectiveOriginId,
    searchTerm: filters.search || undefined,
    limit: 10000,
    // Se for SDR/Closer, filtrar por owner_profile_id no backend
    ownerProfileId: isRestrictedRole ? user?.id : undefined,
  });
  const { getVisibleStages } = useStagePermissions();
  const syncMutation = useSyncClintData();
  const visibleStages = getVisibleStages();
  
  // Derivar opções de owners a partir dos deals carregados
  const { ownerOptions } = useDealOwnerOptions(dealsData, activeBU);
  
  // Buscar tags únicas para o filtro
  const { data: availableTags, isLoading: isLoadingTags } = useUniqueDealTags({
    originId: effectiveOriginId,
    enabled: !!effectiveOriginId,
  });
  
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
  
  // Detectar Outside em batch para todos os deals carregados
  const { data: outsideMap } = useOutsideDetectionForDeals(dealsData || []);
  
  // isRestrictedRole já definido no topo do componente (linha 77)
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
  };

  // Handler para selecionar todos os leads de um estágio
  const handleSelectAllInStage = (dealIds: string[]) => {
    setSelectedDealIds(prev => {
      const newSet = new Set(prev);
      dealIds.forEach(id => newSet.add(id));
      return newSet;
    });
  };
  
  // Handler para limpar seleção de um estágio
  const handleClearStageSelection = (dealIds: string[]) => {
    setSelectedDealIds(prev => {
      const newSet = new Set(prev);
      dealIds.forEach(id => newSet.delete(id));
      return newSet;
    });
  };
  
  // Handler para selecionar por quantidade em um estágio específico
  const handleSelectByCountInStage = (dealIds: string[], count: number) => {
    setSelectedDealIds(prev => {
      const newSet = new Set(prev);
      // Primeiro: remover todos os deals deste estágio
      dealIds.forEach(id => newSet.delete(id));
      // Depois: adicionar apenas os primeiros N
      dealIds.slice(0, count).forEach(id => newSet.add(id));
      return newSet;
    });
  };
  
  
  const filteredDeals = useMemo(() => {
    return (dealsData || []).filter((deal: any) => {
      if (!deal || !deal.id || !deal.name) return false;
      
      // Filtro por role removido - backend já filtra por owner_profile_id
      
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
      
      // Filtro de responsável: suporta UUID e email legado (prefixo "email:")
      if (filters.owner) {
        if (filters.owner === '__no_owner__') {
          if (deal.owner_id || deal.owner_profile_id) return false;
        } else if (filters.owner.startsWith('email:')) {
          const emailFilter = filters.owner.replace('email:', '');
          if (deal.owner_id !== emailFilter) return false;
        } else {
          if (deal.owner_profile_id !== filters.owner) return false;
        }
      }
      
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
      
      // Filtro por quantidade de tentativas (range)
      // Só aplica se activitySummaries já carregou (evita filtrar erroneamente com 0)
      if (filters.attemptsRange && activitySummaries) {
        const summary = activitySummaries.get(deal.id);
        const totalCalls = summary?.totalCalls ?? 0;
        
        if (totalCalls < filters.attemptsRange.min || 
            totalCalls > filters.attemptsRange.max) {
          return false;
        }
      }
      
      // Filtro por tags selecionadas
      if (filters.selectedTags.length > 0) {
        // Garantir que tags é um array válido
        const dealTags = Array.isArray(deal.tags) ? deal.tags : [];
        
        // Normalização avançada: remove acentos, padroniza separadores (com validação de tipo)
        const normalizeTag = (t: unknown): string => {
          if (typeof t !== 'string') return '';
          return t
            .normalize('NFD')                    // Decompose para separar acentos
           .replace(/[\u0300-\u036f]/g, '')     // Remove diacríticos (acentos)
           .replace(/\s+/g, '-')                // Espaços → hífens
           .trim()
           .toLowerCase();
        };
        
        const normalizedSelectedTags = filters.selectedTags.map(normalizeTag).filter(Boolean);
        const normalizedDealTags = dealTags.map(normalizeTag).filter(Boolean);
        
        // Se nenhuma tag selecionada é válida, não filtrar
        if (normalizedSelectedTags.length > 0) {
          const hasMatchingTag = normalizedSelectedTags.some(selectedTag => 
            normalizedDealTags.includes(selectedTag)
          );
          if (!hasMatchingTag) return false;
        }
      }
      
      // Filtro por prioridade de atividade
      if (filters.activityPriority !== 'all' && activitySummaries) {
        const summary = activitySummaries.get(deal.id);
        const totalActivities = summary?.totalActivities ?? 0;
        
        switch (filters.activityPriority) {
          case 'high': // 0 atividades
            if (totalActivities !== 0) return false;
            break;
          case 'medium': // 1-3 atividades
            if (totalActivities < 1 || totalActivities > 3) return false;
            break;
          case 'low': // 4+ atividades
            if (totalActivities < 4) return false;
            break;
        }
      }
      // Filtro Outside
      if (filters.outsideFilter !== 'all' && outsideMap) {
        const isOutside = outsideMap.get(deal.id)?.isOutside || false;
        if (filters.outsideFilter === 'outside_only' && !isOutside) return false;
        if (filters.outsideFilter === 'not_outside' && isOutside) return false;
        if (filters.outsideFilter === 'outside_worked') {
          if (!isOutside) return false;
          const stageName = (deal as any).crm_stages?.stage_name?.toLowerCase() || '';
          const autoStages = ['novo lead', 'contrato pago'];
          const isInAutoStage = autoStages.some(s => stageName.includes(s));
          const summary = activitySummaries?.get(deal.id.toLowerCase().trim());
          const hasActivity = (summary?.totalActivities ?? 0) > 0;
          // Trabalhado = tem atividades reais OU está em estágio que implica trabalho SDR
          if (isInAutoStage && !hasActivity) return false;
        }
        if (filters.outsideFilter === 'outside_not_worked') {
          if (!isOutside) return false;
          const stageName = (deal as any).crm_stages?.stage_name?.toLowerCase() || '';
          const autoStages = ['novo lead', 'contrato pago'];
          const isInAutoStage = autoStages.some(s => stageName.includes(s));
          const summary = activitySummaries?.get(deal.id.toLowerCase().trim());
          const hasActivity = (summary?.totalActivities ?? 0) > 0;
          // Não Trabalhado = está em estágio automático E sem atividades
          if (!isInAutoStage || hasActivity) return false;
        }
      }
      
      return true;
    });
  }, [dealsData, isRestrictedRole, userProfile?.email, filters, activitySummaries, a010StatusMap, outsideMap]);
  
  const clearFilters = () => {
    setFilters({
      search: '',
      dateRange: undefined,
      owner: null,
      dealStatus: 'all',
      inactivityDays: null,
      salesChannel: 'all',
      attemptsRange: null,
      selectedTags: [],
      activityPriority: 'all',
      outsideFilter: 'all',
    });
  };
  
  // Limpar sub-origem ao trocar de pipeline
  const handlePipelineChange = (pipelineId: string | null) => {
    setSelectedPipelineId(pipelineId);
    setSelectedOriginId(null); // Reset sub-origem ao trocar pipeline
  };
  
  // Determinar se deve mostrar a sidebar
  // SDRs de BUs com multi-pipeline podem ver a sidebar e navegar
  const sdrCanSeeSidebar = isSdr && activeBU && SDR_MULTI_PIPELINE_BUS.includes(activeBU);
  const hasSinglePipeline = buAllowedGroups.length === 1;
  const showSidebar = (!isSdr || sdrCanSeeSidebar) && !hasSinglePipeline;
  
  // Auto-selecionar pipeline quando só tem 1 grupo
  useEffect(() => {
    if (hasSinglePipeline && buAllowedGroups[0] && !hasSetDefault.current) {
      hasSetDefault.current = true;
      setSelectedPipelineId(buAllowedGroups[0]);
    }
  }, [hasSinglePipeline, buAllowedGroups]);
  
  // Estado do modal de configuração inline (para single pipeline)
  const [configModalOpen, setConfigModalOpen] = useState(false);
  
  // Resolver nome da pipeline selecionada
  const selectedPipelineName = useMemo(() => {
    if (!selectedPipelineId || !pipelines) return '';
    const p = pipelines.find(p => p.id === selectedPipelineId);
    return p?.display_name || p?.name || '';
  }, [selectedPipelineId, pipelines]);
  
  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-56px)] overflow-hidden">
      {/* Sidebar - hidden on mobile, hidden for SDRs */}
      {showSidebar && (
        <div className="hidden md:block">
          <OriginsSidebar
            pipelineId={selectedPipelineId}
            selectedOriginId={selectedOriginId}
            onSelectOrigin={setSelectedOriginId}
            onSelectPipeline={handlePipelineChange}
            allowedOriginIds={buAuthorizedOrigins}
            allowedGroupIds={buAllowedGroups}
          />
        </div>
      )}
      
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-4 border-b gap-3">
          <div className="flex items-center gap-2">
            <div>
              <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2">
                {isRestrictedRole ? 'Meus Negócios' : hasSinglePipeline && selectedPipelineName ? selectedPipelineName : 'Pipeline de Vendas'}
                {hasSinglePipeline && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setConfigModalOpen(true)}
                    title="Configurações da Pipeline"
                  >
                    <Settings className="h-4 w-4 text-muted-foreground" />
                  </Button>
                )}
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {filteredDeals.length} oportunidade{filteredDeals.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          
          <div className="flex gap-2 w-full sm:w-auto">
            {(role === 'admin' || role === 'manager') && (
              <OutsideDistributionButton />
            )}
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
          ownerOptions={ownerOptions}
          availableTags={availableTags || []}
          isLoadingTags={isLoadingTags}
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
              selectedDealIds={selectedDealIds}
              onSelectionChange={handleSelectionChange}
              onSelectByCountInStage={handleSelectByCountInStage}
              onSelectAllInStage={handleSelectAllInStage}
              onClearStageSelection={handleClearStageSelection}
              channelMap={channelMap}
              outsideMap={outsideMap}
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
      
      {/* Modal de configuração inline para single pipeline */}
      {hasSinglePipeline && selectedPipelineId && (
        <PipelineConfigModal
          open={configModalOpen}
          onOpenChange={setConfigModalOpen}
          targetType="group"
          targetId={selectedPipelineId}
        />
      )}
    </div>
  );
};

export default Negocios;
