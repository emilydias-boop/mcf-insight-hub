import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useUpdateClintDealStage } from '@/hooks/useClintAPI';
import { toast } from 'sonner';
import { useDealStages } from '@/hooks/useDealStages';
import { useStagePermissions } from '@/hooks/useStagePermissions';
import { DealKanbanCard } from './DealKanbanCard';
import { useCreateDealActivity } from '@/hooks/useDealActivities';

interface Deal {
  id: string;
  name: string;
  value: number;
  stage: string;
  probability?: number;
  expected_close_date?: string;
  contact_id?: string;
}

interface DealKanbanBoardProps {
  deals: Deal[];
}

const stages = [
  { id: 'lead', name: 'Lead', color: 'bg-muted' },
  { id: 'qualified', name: 'Qualificado', color: 'bg-primary/10' },
  { id: 'proposal', name: 'Proposta', color: 'bg-warning/10' },
  { id: 'negotiation', name: 'Negociação', color: 'bg-warning/20' },
  { id: 'won', name: 'Ganho', color: 'bg-success/10' },
  { id: 'lost', name: 'Perdido', color: 'bg-destructive/10' },
];

export const DealKanbanBoard = ({ deals }: DealKanbanBoardProps) => {
  const { data: stages = [] } = useDealStages();
  const { getVisibleStages, canMoveFromStage, canMoveToStage } = useStagePermissions();
  const updateStageMutation = useUpdateClintDealStage();
  const createActivity = useCreateDealActivity();
  
  const visibleStageIds = getVisibleStages();
  const visibleStages = stages.filter(s => visibleStageIds.includes(s.stage_id) && s.stage_order < 90);
  
  const getDealsByStage = (stageId: string) => {
    return deals.filter(deal => deal.stage === stageId);
  };

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
                      {stageDeals.map((deal, index) => (
                        <Draggable key={deal.id} draggableId={deal.id} index={index}>
                          {(provided, snapshot) => (
                            <DealKanbanCard
                              deal={deal}
                              isDragging={snapshot.isDragging}
                              provided={provided}
                            />
                          )}
                        </Draggable>
                      ))}
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
