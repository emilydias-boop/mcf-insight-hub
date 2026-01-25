import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  Trash2, 
  MessageCircle, 
  Mail, 
  Clock, 
  GripVertical,
  Pencil,
  Loader2,
  ArrowDown,
  Zap,
  Timer
} from "lucide-react";
import { AutomationStep, useDeleteStep, useUpdateStep } from "@/hooks/useAutomationFlows";
import { StepEditorDialog } from "./StepEditorDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { cn } from "@/lib/utils";

interface FlowStepListProps {
  flowId: string;
  steps: AutomationStep[];
  isLoading: boolean;
}

export function FlowStepList({ flowId, steps, isLoading }: FlowStepListProps) {
  const deleteStep = useDeleteStep();
  const updateStep = useUpdateStep();
  
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingStepId, setDeletingStepId] = useState<string | null>(null);

  const handleDelete = () => {
    if (deletingStepId) {
      deleteStep.mutate({ id: deletingStepId, flowId });
      setDeletingStepId(null);
    }
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    
    const sourceIndex = result.source.index;
    const destIndex = result.destination.index;
    
    if (sourceIndex === destIndex) return;

    // Reorder steps
    const reorderedSteps = Array.from(steps);
    const [removed] = reorderedSteps.splice(sourceIndex, 1);
    reorderedSteps.splice(destIndex, 0, removed);

    // Update order_index for affected steps
    reorderedSteps.forEach((step, index) => {
      if (step.order_index !== index) {
        updateStep.mutate({ id: step.id, order_index: index });
      }
    });
  };

  const formatDelay = (step: AutomationStep) => {
    const parts = [];
    if (step.delay_days > 0) parts.push(`${step.delay_days} ${step.delay_days === 1 ? 'dia' : 'dias'}`);
    if (step.delay_hours > 0) parts.push(`${step.delay_hours}h`);
    if (step.delay_minutes > 0) parts.push(`${step.delay_minutes}min`);
    return parts.length > 0 ? parts.join(" ") : "Imediato";
  };

  const getDelayLabel = (step: AutomationStep, index: number) => {
    if (step.delay_days === 0 && step.delay_hours === 0 && step.delay_minutes === 0) {
      return index === 0 ? "Gatilho acionado" : "Sem delay";
    }
    return `Após ${formatDelay(step)}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Timer className="h-4 w-4 text-primary" />
            Sequência de Mensagens
          </h3>
          <p className="text-sm text-muted-foreground">
            Arraste para reordenar os passos
          </p>
        </div>
        <Button size="sm" onClick={() => setIsCreating(true)} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Adicionar Passo
        </Button>
      </div>

      {steps.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="flex flex-col items-center justify-center py-10">
            <div className="rounded-full bg-muted p-3 mb-3">
              <Zap className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground text-center mb-4">
              Nenhum passo configurado.<br />
              Adicione passos para definir a sequência de mensagens.
            </p>
            <Button variant="outline" size="sm" onClick={() => setIsCreating(true)} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Adicionar Primeiro Passo
            </Button>
          </CardContent>
        </Card>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="steps">
            {(provided, snapshot) => (
              <div 
                ref={provided.innerRef} 
                {...provided.droppableProps}
                className="relative"
              >
                {/* Timeline line */}
                <div className="absolute left-[27px] top-8 bottom-8 w-0.5 bg-border z-0" />
                
                <div className="space-y-3 relative z-10">
                  {steps.map((step, index) => (
                    <Draggable key={step.id} draggableId={step.id} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={cn(
                            "transition-all",
                            snapshot.isDragging && "z-50"
                          )}
                        >
                          {/* Delay indicator between steps */}
                          {index > 0 && (
                            <div className="flex items-center gap-2 ml-[22px] mb-2 -mt-1">
                              <div className="w-3 h-3 rounded-full bg-muted border-2 border-background flex items-center justify-center">
                                <ArrowDown className="h-2 w-2 text-muted-foreground" />
                              </div>
                              <span className="text-xs text-muted-foreground font-medium">
                                {getDelayLabel(step, index)}
                              </span>
                            </div>
                          )}
                          
                          <Card 
                            className={cn(
                              "transition-all",
                              !step.is_active && "opacity-50",
                              snapshot.isDragging && "shadow-lg ring-2 ring-primary"
                            )}
                          >
                            <CardContent className="p-3 flex items-center gap-3">
                              <div 
                                {...provided.dragHandleProps}
                                className="text-muted-foreground cursor-grab hover:text-foreground transition-colors"
                              >
                                <GripVertical className="h-5 w-5" />
                              </div>

                              <div 
                                className={cn(
                                  "flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold flex-shrink-0",
                                  step.channel === 'whatsapp' 
                                    ? "bg-green-500/20 text-green-700 dark:text-green-400" 
                                    : "bg-blue-500/20 text-blue-700 dark:text-blue-400"
                                )}
                              >
                                {index + 1}
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  {step.channel === 'whatsapp' ? (
                                    <MessageCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                                  ) : (
                                    <Mail className="h-4 w-4 text-blue-600 flex-shrink-0" />
                                  )}
                                  <span className="font-medium truncate">
                                    {step.template?.name || "Template não encontrado"}
                                  </span>
                                  <Badge 
                                    variant="outline" 
                                    className={cn(
                                      "text-xs flex-shrink-0",
                                      step.channel === 'whatsapp' 
                                        ? "border-green-500/50 text-green-700 dark:text-green-400" 
                                        : "border-blue-500/50 text-blue-700 dark:text-blue-400"
                                    )}
                                  >
                                    {step.channel === 'whatsapp' ? 'WhatsApp' : 'Email'}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <Clock className="h-3 w-3" />
                                  <span>
                                    {index === 0 && step.delay_days === 0 && step.delay_hours === 0 && step.delay_minutes === 0 
                                      ? "Envia imediatamente ao ativar gatilho"
                                      : `Aguarda ${formatDelay(step)} para enviar`
                                    }
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-1 flex-shrink-0">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => setEditingStepId(step.id)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => setDeletingStepId(step.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}

      {/* Add step button at the end */}
      {steps.length > 0 && (
        <div className="flex items-center gap-2 ml-[22px] pt-2">
          <div className="w-3 h-3 rounded-full bg-primary/20 border-2 border-background" />
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setIsCreating(true)}
            className="gap-1.5 border-dashed"
          >
            <Plus className="h-4 w-4" />
            Adicionar Passo
          </Button>
        </div>
      )}

      {/* Step Editor Dialog */}
      <StepEditorDialog
        flowId={flowId}
        stepId={editingStepId}
        orderIndex={steps.length}
        open={!!editingStepId || isCreating}
        onOpenChange={(open) => {
          if (!open) {
            setEditingStepId(null);
            setIsCreating(false);
          }
        }}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingStepId} onOpenChange={(open) => !open && setDeletingStepId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover passo?</AlertDialogTitle>
            <AlertDialogDescription>
              Este passo será removido permanentemente da sequência de automação.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Remover Passo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
