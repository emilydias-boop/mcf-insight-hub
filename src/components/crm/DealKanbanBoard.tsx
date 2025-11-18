import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Briefcase, DollarSign, Calendar, TrendingUp } from 'lucide-react';
import { useUpdateClintDealStage } from '@/hooks/useClintAPI';

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
  const updateStageMutation = useUpdateClintDealStage();
  
  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    
    const { draggableId, destination } = result;
    const newStage = destination.droppableId;
    
    updateStageMutation.mutate({ id: draggableId, stage: newStage });
  };
  
  const getDealsByStage = (stageId: string) => {
    return deals.filter(deal => deal.stage?.toLowerCase() === stageId);
  };
  
  const getStageTotal = (stageId: string) => {
    return getDealsByStage(stageId).reduce((sum, deal) => sum + (deal.value || 0), 0);
  };
  
  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {stages.map((stage) => {
          const stageDeals = getDealsByStage(stage.id);
          const stageTotal = getStageTotal(stage.id);
          
          return (
            <div key={stage.id} className="flex-shrink-0 w-80">
              <div className="mb-3">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-foreground">{stage.name}</h3>
                  <Badge variant="secondary" className="bg-muted text-muted-foreground">
                    {stageDeals.length}
                  </Badge>
                </div>
                <div className="text-sm font-medium text-success">
                  R$ {(stageTotal / 1000).toFixed(1)}k
                </div>
              </div>
              
              <Droppable droppableId={stage.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`space-y-3 min-h-[200px] p-3 rounded-lg border-2 border-dashed transition-colors ${
                      snapshot.isDraggingOver
                        ? 'border-primary bg-primary/5'
                        : 'border-border bg-muted/20'
                    }`}
                  >
                    {stageDeals.map((deal, index) => (
                      <Draggable key={deal.id} draggableId={deal.id} index={index}>
                        {(provided, snapshot) => (
                          <Card
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={`bg-card border-border cursor-grab active:cursor-grabbing transition-shadow ${
                              snapshot.isDragging ? 'shadow-lg' : ''
                            }`}
                          >
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center">
                                    <Briefcase className="h-4 w-4 text-primary" />
                                  </div>
                                  <h4 className="font-semibold text-foreground text-sm">
                                    {deal.name}
                                  </h4>
                                </div>
                              </div>
                              
                              <div className="space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                  <span className="text-muted-foreground flex items-center gap-1">
                                    <DollarSign className="h-3 w-3" />
                                    Valor
                                  </span>
                                  <span className="font-semibold text-success">
                                    R$ {(deal.value || 0).toLocaleString('pt-BR')}
                                  </span>
                                </div>
                                
                                {deal.probability && (
                                  <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground flex items-center gap-1">
                                      <TrendingUp className="h-3 w-3" />
                                      Prob.
                                    </span>
                                    <span className="font-medium text-foreground">
                                      {deal.probability}%
                                    </span>
                                  </div>
                                )}
                                
                                {deal.expected_close_date && (
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground pt-1">
                                    <Calendar className="h-3 w-3" />
                                    <span>
                                      {new Date(deal.expected_close_date).toLocaleDateString('pt-BR')}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                    
                    {stageDeals.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        Arraste negócios para cá
                      </div>
                    )}
                  </div>
                )}
              </Droppable>
            </div>
          );
        })}
      </div>
    </DragDropContext>
  );
};
