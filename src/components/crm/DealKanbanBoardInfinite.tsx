import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useUpdateCRMDeal, useCRMStages } from '@/hooks/useCRMData';
import { toast } from 'sonner';
import { useStagePermissions } from '@/hooks/useStagePermissions';
import { DealKanbanCard } from './DealKanbanCard';
import { DealDetailsDrawer } from './DealDetailsDrawer';
import { StageChangeModal } from './StageChangeModal';
import { QualificationAndScheduleModal } from './QualificationAndScheduleModal';
import { useCreateDealActivity } from '@/hooks/useDealActivities';
import { useAuth } from '@/contexts/AuthContext';
import { useBatchDealActivitySummary } from '@/hooks/useDealActivitySummary';
import { Inbox, Loader2 } from 'lucide-react';

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

interface DealKanbanBoardInfiniteProps {
  deals: Deal[];
  originId?: string;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  fetchNextPage?: () => void;
  showLostDeals?: boolean;
}

export const DealKanbanBoardInfinite = ({ 
  deals, 
  originId,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  showLostDeals = false
}: DealKanbanBoardInfiniteProps) => {
  const { canMoveFromStage, canMoveToStage, canViewStage } = useStagePermissions();
  const updateDealMutation = useUpdateCRMDeal();
  const createActivity = useCreateDealActivity();
  const { data: stages } = useCRMStages(originId);
  const { user, role } = useAuth();
  
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  
  // State para modal de mudança de estágio
  const [stageChangeModal, setStageChangeModal] = useState<{
    open: boolean;
    dealId: string;
    dealName: string;
    newStageName: string;
  }>({ open: false, dealId: '', dealName: '', newStageName: '' });
  
  // State para modal de qualificação (quando arrasta para "Sem Interesse")
  const [qualificationModal, setQualificationModal] = useState<{
    open: boolean;
    dealId: string;
    contactName: string;
  }>({ open: false, dealId: '', contactName: '' });
  
  // stage_permissions is the sole source of truth for visibility
  const visibleStages = useMemo(() => {
    const activeStages = (stages || []).filter((s: any) => s.is_active);
    return activeStages.filter((s: any) => canViewStage(s.id));
  }, [stages, canViewStage]);
  
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
  
  // Intersection Observer para scroll infinito
  useEffect(() => {
    if (!sentinelRef.current || !fetchNextPage || !hasNextPage) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );
    
    observer.observe(sentinelRef.current);
    
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);
  
  const getDealsByStage = useCallback((stageId: string) => {
    return deals.filter(deal => 
      deal && 
      deal.id && 
      deal.name && 
      deal.stage_id === stageId
    );
  }, [deals]);

  const handleDealClick = (dealId: string) => {
    setSelectedDealId(dealId);
    setDrawerOpen(true);
  };

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
    
    // Verificar se está movendo para "Sem Interesse" para abrir qualificação
    const isNoInterestStage = newStage?.stage_name?.toLowerCase().includes('sem interesse') ||
                              newStage?.stage_name?.toLowerCase().includes('não interessado') ||
                              newStage?.stage_name?.toLowerCase().includes('lost');
    
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
          
          // Se moveu para "Sem Interesse", abrir modal de qualificação
          if (isNoInterestStage && deal) {
            setQualificationModal({
              open: true,
              dealId: dealId,
              contactName: deal.name,
            });
          } else if (deal && newStage) {
            // Abrir modal para definir próxima ação
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
            const stageDeals = getDealsByStage(stage.id);
            
            return (
              <div key={stage.id} className="flex-shrink-0 w-[280px] h-full">
                <Card className="h-full flex flex-col">
                  <CardHeader className={`flex-shrink-0 ${stage.color || 'bg-muted'}`}>
                    <CardTitle className="text-sm font-medium flex items-center justify-between">
                      <span>{stage.stage_name}</span>
                      <Badge variant="secondary">{stageDeals.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  
                  <Droppable droppableId={stage.id}>
                    {(provided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className="flex-1 overflow-y-auto p-4 space-y-3"
                      >
                        {stageDeals.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-8 text-center">
                            <Inbox className="h-8 w-8 text-muted-foreground/50 mb-2" />
                            <p className="text-sm text-muted-foreground">
                              Nenhum negócio neste estágio
                            </p>
                          </div>
                        ) : (
                          stageDeals.map((deal, index) => (
                            <Draggable key={deal.id} draggableId={deal.id} index={index}>
                              {(provided, snapshot) => (
                                <DealKanbanCard
                                  deal={deal}
                                  isDragging={snapshot.isDragging}
                                  provided={provided}
                                  onClick={() => handleDealClick(deal.id)}
                                  activitySummary={activitySummaries?.get(deal.id.toLowerCase().trim())}
                                />
                              )}
                            </Draggable>
                          ))
                        )}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </Card>
              </div>
            );
          })}
          
          {/* Sentinel para scroll infinito */}
          <div ref={sentinelRef} className="flex-shrink-0 w-1 h-full" />
          
          {/* Loading indicator */}
          {isFetchingNextPage && (
            <div className="flex-shrink-0 w-[280px] h-full flex items-center justify-center">
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="text-sm">Carregando mais...</span>
              </div>
            </div>
          )}
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
      
      {/* Modal de qualificação quando move para "Sem Interesse" */}
      <QualificationAndScheduleModal
        open={qualificationModal.open}
        onOpenChange={(open) => setQualificationModal(prev => ({ ...prev, open }))}
        dealId={qualificationModal.dealId}
        contactName={qualificationModal.contactName}
        autoFocus="qualification"
      />
    </>
  );
};