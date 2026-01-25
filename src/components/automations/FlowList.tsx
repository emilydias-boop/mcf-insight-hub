import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { 
  Plus, 
  Pencil, 
  Trash2, 
  Copy, 
  MessageCircle, 
  Mail, 
  Clock,
  ArrowRight,
  Loader2
} from "lucide-react";
import { useAutomationFlows, useToggleFlowActive, useDeleteFlow } from "@/hooks/useAutomationFlows";
import { FlowEditorDialog } from "./FlowEditorDialog";
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

export function FlowList() {
  const { data: flows, isLoading } = useAutomationFlows();
  const toggleActive = useToggleFlowActive();
  const deleteFlow = useDeleteFlow();
  
  const [editingFlowId, setEditingFlowId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingFlowId, setDeletingFlowId] = useState<string | null>(null);

  const handleToggleActive = (id: string, isActive: boolean) => {
    toggleActive.mutate({ id, is_active: !isActive });
  };

  const handleDelete = () => {
    if (deletingFlowId) {
      deleteFlow.mutate(deletingFlowId);
      setDeletingFlowId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">Fluxos de Automação</h2>
          <p className="text-sm text-muted-foreground">
            Configure sequências de mensagens automáticas por stage do CRM
          </p>
        </div>
        <Button onClick={() => setIsCreating(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Fluxo
        </Button>
      </div>

      {flows?.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="rounded-full bg-muted p-4 mb-4">
              <MessageCircle className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-2">Nenhum fluxo criado</h3>
            <p className="text-muted-foreground text-center mb-4">
              Crie seu primeiro fluxo de automação para começar a enviar mensagens automáticas
            </p>
            <Button onClick={() => setIsCreating(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Primeiro Fluxo
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {flows?.map((flow) => (
            <Card key={flow.id} className={!flow.is_active ? "opacity-60" : ""}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-base">{flow.name}</CardTitle>
                    {flow.description && (
                      <CardDescription className="line-clamp-2">
                        {flow.description}
                      </CardDescription>
                    )}
                  </div>
                  <Switch
                    checked={flow.is_active}
                    onCheckedChange={() => handleToggleActive(flow.id, flow.is_active)}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Stage info */}
                <div className="flex items-center gap-2 text-sm">
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    {flow.trigger_on === 'enter' ? 'Ao entrar em' : 'Ao sair de'}:
                  </span>
                  {flow.stage ? (
                    <Badge 
                      variant="outline" 
                      style={{ borderColor: flow.stage.color }}
                    >
                      {flow.stage.name}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground italic">Stage não definido</span>
                  )}
                </div>

                {/* Origin info */}
                {flow.origin && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Pipeline:</span>
                    <Badge variant="secondary">{flow.origin.name}</Badge>
                  </div>
                )}

                {/* Steps count */}
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {flow.steps_count || 0} {flow.steps_count === 1 ? 'passo' : 'passos'}
                  </span>
                </div>

                {/* Business hours */}
                {flow.respect_business_hours && (
                  <div className="text-xs text-muted-foreground">
                    Horário comercial: {flow.business_hours_start} - {flow.business_hours_end}
                    {flow.exclude_weekends && " (exceto finais de semana)"}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2 border-t">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => setEditingFlowId(flow.id)}
                  >
                    <Pencil className="h-3 w-3 mr-1" />
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setDeletingFlowId(flow.id)}
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Flow Editor Dialog */}
      <FlowEditorDialog
        flowId={editingFlowId}
        open={!!editingFlowId || isCreating}
        onOpenChange={(open) => {
          if (!open) {
            setEditingFlowId(null);
            setIsCreating(false);
          }
        }}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingFlowId} onOpenChange={(open) => !open && setDeletingFlowId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir fluxo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todos os passos e configurações deste fluxo serão excluídos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
