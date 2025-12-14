import { useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useUpdateCRMDeal, useCRMStages } from '@/hooks/useCRMData';
import { toast } from 'sonner';
import { useStagePermissions } from '@/hooks/useStagePermissions';
import { DealKanbanCard } from './DealKanbanCard';
import { DealDetailsDrawer } from './DealDetailsDrawer';
import { StageChangeModal } from './StageChangeModal';
import { useCreateDealActivity } from '@/hooks/useDealActivities';
import { Inbox } from 'lucide-react';

interface Deal {
  id: string;
  name: string;
  value: number;
  stage_id: string;
  stage: string;
  probability?: number;
  expected_close_date?: string;
  contact_id?: string;
}

interface DealKanbanBoardProps {
  deals: Deal[];
  originId?: string;
}

export const DealKanbanBoard = ({ deals, originId }: DealKanbanBoardProps) => {
  const { getVisibleStages, canMoveFromStage, canMoveToStage } = useStagePermissions();
  const updateDealMutation = useUpdateCRMDeal();
  const createActivity = useCreateDealActivity();
  const { data: stages } = useCRMStages(originId);
  
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  
  // State para modal de mudança de estágio
  const [stageChangeModal, setStageChangeModal] = useState<{
    open: boolean;
    dealId: string;
    dealName: string;
    newStageName: string;
  }>({ open: false, dealId: '', dealName: '', newStageName: '' });
  
  const visibleStages = (stages || []).filter((s: any) => s.is_active);
  
  const getDealsByStage = (stageId: string) => {
    return deals.filter(deal => 
      deal && 
      deal.id && 
      deal.name && 
      deal.stage_id === stageId
    );
  };

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
    const newStage = visibleStages.find((s: any) => s.id === newStageId);
    
    updateDealMutation.mutate(
      { id: dealId, stage_id: newStageId },
      {
        onSuccess: () => {
          createActivity.mutate({
            deal_id: dealId,
            activity_type: 'stage_change',
            description: `Negócio movido para ${newStage?.stage_name || 'novo estágio'}`,
            from_stage: oldStageId,
            to_stage: newStageId,
          });
          
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
        <div className="flex gap-4 overflow-x-auto pb-4">
          {visibleStages.map((stage: any) => {
            const stageDeals = getDealsByStage(stage.id);
            
            return (
              <div key={stage.id} className="flex-shrink-0 w-80">
                <Card className="h-full">
                  <CardHeader className={stage.color || 'bg-muted'}>
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
                        className="p-4 space-y-3 min-h-[200px]"
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
