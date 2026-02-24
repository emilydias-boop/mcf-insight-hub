import { useState, useMemo, useCallback } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useUpdateCRMDeal, useCRMStages } from '@/hooks/useCRMData';
import { toast } from 'sonner';
import { useStagePermissions } from '@/hooks/useStagePermissions';
import { DealKanbanCard } from './DealKanbanCard';
import { DealDetailsDrawer } from './DealDetailsDrawer';
import { StageChangeModal } from './StageChangeModal';
import { StageSelectionControls } from './StageSelectionControls';
import { StageSortDropdown, SortOption } from './StageSortDropdown';
import { useCreateDealActivity } from '@/hooks/useDealActivities';
import { useAuth } from '@/contexts/AuthContext';
import { useBatchDealActivitySummary, ActivitySummary } from '@/hooks/useDealActivitySummary';
import { SalesChannel } from '@/hooks/useBulkA010Check';
import { Inbox, ChevronDown } from 'lucide-react';

interface Deal {
  id: string;
  name: string;
  value: number;
  stage_id: string;
  stage: string;
  probability?: number;
  expected_close_date?: string;
  contact_id?: string;
  owner_id?: string;
  origin_id?: string;
}

interface DealKanbanBoardProps {
  deals: Deal[];
  originId?: string;
  showLostDeals?: boolean;
  selectedDealIds?: Set<string>;
  onSelectionChange?: (dealId: string, selected: boolean) => void;
  onSelectByCountInStage?: (dealIds: string[], count: number) => void;
  onSelectAllInStage?: (dealIds: string[]) => void;
  onClearStageSelection?: (dealIds: string[]) => void;
  channelMap?: Map<string, SalesChannel>;
  outsideMap?: Map<string, { isOutside: boolean; productName: string | null }>;
}

const INITIAL_VISIBLE_COUNT = 50;

export const DealKanbanBoard = ({ 
  deals, 
  originId, 
  showLostDeals = false,
  selectedDealIds = new Set(),
  onSelectionChange,
  onSelectByCountInStage,
  onSelectAllInStage,
  onClearStageSelection,
  channelMap,
  outsideMap,
}: DealKanbanBoardProps) => {
  const { canMoveFromStage, canMoveToStage, canViewStage } = useStagePermissions();
  const updateDealMutation = useUpdateCRMDeal();
  const createActivity = useCreateDealActivity();
  const { data: stages, isLoading: isLoadingStages } = useCRMStages(originId);
  const { user, role } = useAuth();
  
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  
  // State para virtualização por coluna - quantos cards mostrar por estágio
  const [visibleCountByStage, setVisibleCountByStage] = useState<Record<string, number>>({});
  
  // State para ordenação por coluna - default: mais novo primeiro
  const [stageSorts, setStageSorts] = useState<Record<string, SortOption>>({});
  
  // State para modal de mudança de estágio
  const [stageChangeModal, setStageChangeModal] = useState<{
    open: boolean;
    dealId: string;
    dealName: string;
    newStageName: string;
  }>({ open: false, dealId: '', dealName: '', newStageName: '' });
  
  // stage_permissions is the sole source of truth for visibility
  const visibleStages = useMemo(() => {
    const activeStages = (stages || []).filter((s: any) => s.is_active);
    return activeStages.filter((s: any) => canViewStage(s.id));
  }, [stages, canViewStage]);
  
  // Função de ordenação por critério selecionado
  const sortDeals = useCallback((
    stageDeals: Deal[], 
    sort: SortOption, 
    summaries?: Map<string, ActivitySummary>
  ): Deal[] => {
    return [...stageDeals].sort((a, b) => {
      const summaryA = summaries?.get(a.id.toLowerCase().trim());
      const summaryB = summaries?.get(b.id.toLowerCase().trim());
      
      switch (sort) {
        case 'newest':
          return new Date((b as any).created_at || 0).getTime() - new Date((a as any).created_at || 0).getTime();
        case 'oldest':
          return new Date((a as any).created_at || 0).getTime() - new Date((b as any).created_at || 0).getTime();
        case 'most_activities':
          return (summaryB?.totalActivities || 0) - (summaryA?.totalActivities || 0);
        case 'least_activities':
          return (summaryA?.totalActivities || 0) - (summaryB?.totalActivities || 0);
        case 'most_calls':
          return (summaryB?.totalCalls || 0) - (summaryA?.totalCalls || 0);
        case 'least_calls':
          return (summaryA?.totalCalls || 0) - (summaryB?.totalCalls || 0);
        default:
          return 0;
      }
    });
  }, []);
  
  // Handler para mudar ordenação de um estágio
  const handleSortChange = useCallback((stageId: string, sort: SortOption) => {
    setStageSorts(prev => ({ ...prev, [stageId]: sort }));
  }, []);
  
  // Buscar atividades de todos os deals de uma vez para performance
  // Incluir stageIds para buscar limites corretos por estágio
  const dealIds = useMemo(() => deals.map(d => d.id), [deals]);
  const stageIdsMap = useMemo(() => {
    const map = new Map<string, string>();
    deals.forEach(d => {
      if (d.stage_id) map.set(d.id, d.stage_id);
    });
    return map;
  }, [deals]);
  const { data: activitySummaries } = useBatchDealActivitySummary(dealIds, stageIdsMap);
  
  // Memoize deals por estágio COM ordenação aplicada
  const dealsByStage = useMemo(() => {
    const map: Record<string, typeof deals> = {};
    visibleStages.forEach((stage: any) => {
      const stageDeals = deals.filter(deal => 
        deal && deal.id && deal.name && deal.stage_id === stage.id
      );
      const sortOption = stageSorts[stage.id] || 'newest'; // Default: mais novo primeiro
      map[stage.id] = sortDeals(stageDeals, sortOption, activitySummaries);
    });
    return map;
  }, [deals, visibleStages, stageSorts, activitySummaries, sortDeals]);
  
  const getVisibleCountForStage = (stageId: string) => 
    visibleCountByStage[stageId] || INITIAL_VISIBLE_COUNT;
  
  const loadMoreForStage = (stageId: string) => {
    setVisibleCountByStage(prev => ({
      ...prev,
      [stageId]: (prev[stageId] || INITIAL_VISIBLE_COUNT) + 50
    }));
  };

  // Seleção always enabled - checkboxes aparecem quando há handlers
  const selectionEnabled = !!(onSelectionChange && onSelectAllInStage);

  const handleDealClick = (dealId: string) => {
    setSelectedDealId(dealId);
    setDrawerOpen(true);
  };

  // Loading state enquanto etapas carregam
  if (isLoadingStages) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!stages || stages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Inbox className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">Nenhum estágio configurado</h3>
        <p className="text-sm text-muted-foreground">
          Configure os estágios do pipeline nas configurações do CRM.
        </p>
      </div>
    );
  }

  const onDragEnd = (result: any) => {
    if (!result.destination) return;

    const dealId = result.draggableId;
    const oldStageId = result.source.droppableId;
    const newStageId = result.destination.droppableId;

    if (oldStageId === newStageId) return;

    if (!canMoveFromStage(oldStageId)) {
      toast.error('Você não tem permissão para mover deste estágio');
      return;
    }

    if (!canMoveToStage(newStageId)) {
      toast.error('Você não tem permissão para mover para este estágio');
      return;
    }
    
    const deal = deals.find(d => d.id === dealId);
    const oldStage = visibleStages.find((s: any) => s.id === oldStageId);
    const newStage = visibleStages.find((s: any) => s.id === newStageId);
    
    updateDealMutation.mutate(
      { id: dealId, stage_id: newStageId, previousStageId: oldStageId },
      {
        onSuccess: () => {
          const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Usuário';
          
          // Log activity for stage change
          createActivity.mutate({
            deal_id: (deal as any)?.clint_id || dealId,
            activity_type: 'stage_change',
            description: `Movido de "${oldStage?.stage_name || 'Estágio anterior'}" para "${newStage?.stage_name || 'Novo estágio'}"`,
            from_stage: oldStage?.stage_name || 'Estágio anterior',
            to_stage: newStage?.stage_name || 'Novo estágio',
            user_id: user?.id,
            metadata: {
              moved_by_name: userName,
              moved_by_email: user?.email,
              moved_at: new Date().toISOString(),
              from_stage_id: oldStageId,
              to_stage_id: newStageId,
            }
          });
          
          // Tasks are now generated automatically in useUpdateCRMDeal hook
          
          // Abrir modal para definir próxima ação
          if (deal && newStage) {
            setStageChangeModal({
              open: true,
              dealId: dealId,
              dealName: deal.name,
              newStageName: newStage.stage_name,
            });
          }
        },
        onError: () => {
          toast.error('Erro ao mover negócio');
        },
      }
    );
  };
  
  return (
    <>
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-3 h-full overflow-x-auto pb-4">
          {visibleStages.map((stage: any) => {
            const stageDeals = dealsByStage[stage.id] || [];
            const visibleCount = getVisibleCountForStage(stage.id);
            const visibleDeals = stageDeals.slice(0, visibleCount);
            const remainingCount = stageDeals.length - visibleCount;
            
            return (
              <div key={stage.id} className="flex-shrink-0 w-[280px] h-full">
                <Card className="h-full flex flex-col">
                  <CardHeader className={`flex-shrink-0 py-3 ${stage.color || 'bg-muted'}`}>
                    <CardTitle className="text-sm font-medium">
                      <div className="flex items-center justify-between">
                        <span>{stage.stage_name}</span>
                        <div className="flex items-center gap-1">
                          <StageSortDropdown
                            currentSort={stageSorts[stage.id] || 'newest'}
                            onSortChange={(sort) => handleSortChange(stage.id, sort)}
                          />
                          <Badge variant="secondary">{stageDeals.length}</Badge>
                        </div>
                      </div>
                      {/* Controles de seleção por estágio */}
                      {selectionEnabled && stageDeals.length > 0 && (
                        <StageSelectionControls
                          stageDeals={stageDeals}
                          selectedDealIds={selectedDealIds}
                          onSelectByCount={(dealIds, count) => onSelectByCountInStage?.(dealIds, count)}
                          onSelectAll={(dealIds) => onSelectAllInStage?.(dealIds)}
                          onClearStage={(dealIds) => onClearStageSelection?.(dealIds)}
                        />
                      )}
                    </CardTitle>
                  </CardHeader>
                  
                  <Droppable droppableId={stage.id}>
                    {(provided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className="flex-1 overflow-y-auto p-3 space-y-2"
                      >
                        {stageDeals.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-8 text-center">
                            <Inbox className="h-8 w-8 text-muted-foreground/50 mb-2" />
                            <p className="text-sm text-muted-foreground">
                              Nenhum negócio neste estágio
                            </p>
                          </div>
                        ) : (
                          <>
                            {visibleDeals.map((deal, index) => {
                              const email = (deal as any).crm_contacts?.email?.toLowerCase();
                              const salesChannel = email ? (channelMap?.get(email) || 'live') : 'live';
                              
                              return (
                                <Draggable key={deal.id} draggableId={deal.id} index={index}>
                                  {(provided, snapshot) => (
                                <DealKanbanCard
                                      deal={deal}
                                      isDragging={snapshot.isDragging}
                                      provided={provided}
                                      onClick={() => handleDealClick(deal.id)}
                                      activitySummary={activitySummaries?.get(deal.id.toLowerCase().trim())}
                                      selectionMode={selectionEnabled}
                                      isSelected={selectedDealIds.has(deal.id)}
                                      onSelect={onSelectionChange}
                                      salesChannel={salesChannel}
                                      outsideInfo={outsideMap?.get(deal.id)}
                                    />
                                  )}
                                </Draggable>
                              );
                            })}
                            {remainingCount > 0 && (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="w-full text-muted-foreground"
                                onClick={() => loadMoreForStage(stage.id)}
                              >
                                <ChevronDown className="h-4 w-4 mr-1" />
                                Carregar mais ({remainingCount})
                              </Button>
                            )}
                          </>
                        )}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </Card>
              </div>
            );
          })}
        </div>
      </DragDropContext>
      
      <DealDetailsDrawer
        dealId={selectedDealId}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
      
      <StageChangeModal
        open={stageChangeModal.open}
        onOpenChange={(open) => setStageChangeModal(prev => ({ ...prev, open }))}
        dealId={stageChangeModal.dealId}
        dealName={stageChangeModal.dealName}
        newStageName={stageChangeModal.newStageName}
      />
    </>
  );
};
