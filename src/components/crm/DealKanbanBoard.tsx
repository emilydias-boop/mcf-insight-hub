import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useUpdateClintDealStage } from '@/hooks/useClintAPI';
import { toast } from 'sonner';
import { useDealStages } from '@/hooks/useDealStages';
import { useStagePermissions } from '@/hooks/useStagePermissions';
import { DealKanbanCard } from './DealKanbanCard';
import { useCreateDealActivity } from '@/hooks/useDealActivities';
import { AlertCircle, Inbox } from 'lucide-react';

interface Deal {
  id: string;
  name: string;
  value: number;
  stage_id: string;  // ID do estágio (UUID)
  stage: string;      // Nome do estágio (para exibição)
  probability?: number;
  expected_close_date?: string;
  contact_id?: string;
}

interface DealKanbanBoardProps {
  deals: Deal[];
}

export const DealKanbanBoard = ({ deals }: DealKanbanBoardProps) => {
  const { data: stages = [], isLoading: stagesLoading, error: stagesError } = useDealStages();
  const { getVisibleStages, canMoveFromStage, canMoveToStage } = useStagePermissions();
  const updateStageMutation = useUpdateClintDealStage();
  const createActivity = useCreateDealActivity();
  
  const visibleStageIds = getVisibleStages();
  const visibleStages = stages.filter(s => visibleStageIds.includes(s.stage_id) && s.stage_order < 90);
  
  const getDealsByStage = (stageId: string) => {
    return deals.filter(deal => 
      deal && 
      deal.id && 
      deal.name && 
      deal.stage_id === stageId  // Usar stage_id para comparação
    );
  };

  // Loading state
  if (stagesLoading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex-shrink-0 w-80">
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
    );
  }

  // Error state
  if (stagesError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Erro ao carregar os estágios do pipeline. Tente recarregar a página.
        </AlertDescription>
      </Alert>
    );
  }

  // Empty state
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
    const oldStage = result.source.droppableId;
    const newStage = result.destination.droppableId;

    if (!canMoveFromStage(oldStage)) {
      toast.error('Você não tem permissão para mover deste estágio');
      return;
    }

    if (!canMoveToStage(newStage)) {
      toast.error('Você não tem permissão para mover para este estágio');
      return;
    }
    
    updateStageMutation.mutate(
      { id: dealId, stage: newStage },
      {
        onSuccess: () => {
          createActivity.mutate({
            deal_id: dealId,
            activity_type: 'stage_change',
            description: `Negócio movido de ${oldStage} para ${newStage}`,
            from_stage: oldStage,
            to_stage: newStage,
          });
          toast.success('Negócio movido com sucesso');
        },
        onError: () => {
          toast.error('Erro ao mover negócio');
        },
      }
    );
  };
  
  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {visibleStages.map((stage) => {
          const stageDeals = getDealsByStage(stage.stage_id);
          
          return (
            <div key={stage.id} className="flex-shrink-0 w-80">
              <Card className="h-full">
                <CardHeader className={stage.color || 'bg-muted'}>
                  <CardTitle className="text-sm font-medium flex items-center justify-between">
                    <span>{stage.stage_name}</span>
                    <Badge variant="secondary">{stageDeals.length}</Badge>
                  </CardTitle>
                </CardHeader>
                
                <Droppable droppableId={stage.stage_id}>
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
  );
};
