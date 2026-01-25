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
  Loader2
} from "lucide-react";
import { AutomationStep, useDeleteStep } from "@/hooks/useAutomationFlows";
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

interface FlowStepListProps {
  flowId: string;
  steps: AutomationStep[];
  isLoading: boolean;
}

export function FlowStepList({ flowId, steps, isLoading }: FlowStepListProps) {
  const deleteStep = useDeleteStep();
  
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingStepId, setDeletingStepId] = useState<string | null>(null);

  const handleDelete = () => {
    if (deletingStepId) {
      deleteStep.mutate({ id: deletingStepId, flowId });
      setDeletingStepId(null);
    }
  };

  const formatDelay = (step: AutomationStep) => {
    const parts = [];
    if (step.delay_days > 0) parts.push(`${step.delay_days}d`);
    if (step.delay_hours > 0) parts.push(`${step.delay_hours}h`);
    if (step.delay_minutes > 0) parts.push(`${step.delay_minutes}min`);
    return parts.length > 0 ? parts.join(" ") : "Imediato";
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
        <h3 className="font-medium">Passos da Sequência</h3>
        <Button size="sm" onClick={() => setIsCreating(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Adicionar Passo
        </Button>
      </div>

      {steps.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Clock className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-muted-foreground text-center">
              Nenhum passo configurado. Adicione passos para definir a sequência de mensagens.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {steps.map((step, index) => (
            <Card key={step.id} className={!step.is_active ? "opacity-60" : ""}>
              <CardContent className="p-3 flex items-center gap-3">
                <div className="text-muted-foreground cursor-grab">
                  <GripVertical className="h-4 w-4" />
                </div>

                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                  {index + 1}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {step.channel === 'whatsapp' ? (
                      <MessageCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <Mail className="h-4 w-4 text-blue-600" />
                    )}
                    <span className="font-medium truncate">
                      {step.template?.name || "Template não encontrado"}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {step.channel === 'whatsapp' ? 'WhatsApp' : 'Email'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>Após {formatDelay(step)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setEditingStepId(step.id)}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => setDeletingStepId(step.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
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
              Este passo será removido da sequência de automação.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
