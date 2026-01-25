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
  Loader2,
  Zap,
  Play,
  Pause,
  ChevronRight
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
    <TooltipProvider>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Fluxos de Automação
          </h2>
          <p className="text-sm text-muted-foreground">
            Configure sequências de mensagens automáticas por stage do CRM
          </p>
        </div>
        <Button onClick={() => setIsCreating(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Fluxo
        </Button>
      </div>

      {flows?.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="rounded-full bg-primary/10 p-6 mb-6">
              <Zap className="h-12 w-12 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Nenhum fluxo criado</h3>
            <p className="text-muted-foreground text-center max-w-md mb-6">
              Crie seu primeiro fluxo de automação para começar a enviar mensagens automáticas 
              via WhatsApp e Email quando leads entrarem em estágios específicos do seu CRM.
            </p>
            <Button size="lg" onClick={() => setIsCreating(true)} className="gap-2">
              <Plus className="h-5 w-5" />
              Criar Primeiro Fluxo
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {flows?.map((flow) => (
            <Card 
              key={flow.id} 
              className={`relative overflow-hidden transition-all hover:shadow-md ${!flow.is_active ? "opacity-60 grayscale" : ""}`}
            >
              {/* Status indicator */}
              <div 
                className={`absolute top-0 left-0 right-0 h-1 ${flow.is_active ? "bg-green-500" : "bg-muted"}`} 
              />
              
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 flex-1 min-w-0">
                    <CardTitle className="text-base flex items-center gap-2">
                      {flow.is_active ? (
                        <Play className="h-4 w-4 text-green-600 flex-shrink-0" />
                      ) : (
                        <Pause className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      )}
                      <span className="truncate">{flow.name}</span>
                    </CardTitle>
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
              
              <CardContent className="space-y-4">
                {/* Trigger visualization */}
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border/50">
                  <div className="flex items-center gap-1.5 text-sm">
                    <ArrowRight className="h-4 w-4 text-primary" />
                    <span className="text-muted-foreground font-medium">
                      {flow.trigger_on === 'enter' ? 'Entrada em' : 'Saída de'}
                    </span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  {flow.stage ? (
                    <Badge 
                      variant="outline" 
                      className="font-medium"
                      style={{ 
                        borderColor: flow.stage.color,
                        backgroundColor: `${flow.stage.color}15`
                      }}
                    >
                      <div 
                        className="w-2 h-2 rounded-full mr-1.5" 
                        style={{ backgroundColor: flow.stage.color }}
                      />
                      {flow.stage.name}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-sm italic">Stage não definido</span>
                  )}
                </div>

                {/* Origin info */}
                {flow.origin && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Pipeline:</span>
                    <Badge variant="secondary" className="font-normal">
                      {flow.origin.name}
                    </Badge>
                  </div>
                )}

                {/* Steps count with visual */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">
                      {flow.steps_count || 0} {flow.steps_count === 1 ? 'passo' : 'passos'}
                    </span>
                  </div>
                  
                  {/* Channel badges */}
                  <div className="flex items-center gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-1 px-2 py-1 rounded bg-green-500/10 text-green-700 dark:text-green-400">
                          <MessageCircle className="h-3.5 w-3.5" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>WhatsApp</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-1 px-2 py-1 rounded bg-blue-500/10 text-blue-700 dark:text-blue-400">
                          <Mail className="h-3.5 w-3.5" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>Email</TooltipContent>
                    </Tooltip>
                  </div>
                </div>

                {/* Business hours info */}
                {flow.respect_business_hours && (
                  <div className="text-xs text-muted-foreground bg-muted/30 rounded px-2 py-1.5">
                    ⏰ {flow.business_hours_start} - {flow.business_hours_end}
                    {flow.exclude_weekends && " • Exclui finais de semana"}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 pt-3 border-t">
                  <Button 
                    variant="default" 
                    size="sm" 
                    className="flex-1 gap-1.5"
                    onClick={() => setEditingFlowId(flow.id)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Editar Fluxo
                  </Button>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setDeletingFlowId(flow.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Excluir fluxo</TooltipContent>
                  </Tooltip>
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
              Esta ação não pode ser desfeita. Todos os passos e configurações deste fluxo serão excluídos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir Fluxo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}
