import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Plus, Save } from "lucide-react";
import { useAutomationFlow, useCreateFlow, useUpdateFlow, useFlowSteps, AutomationFlow } from "@/hooks/useAutomationFlows";
import { useCRMStages, useCRMOrigins } from "@/hooks/useCRMData";
import { FlowStepList } from "./FlowStepList";

interface FlowEditorDialogProps {
  flowId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FlowEditorDialog({ flowId, open, onOpenChange }: FlowEditorDialogProps) {
  const isEditing = !!flowId;
  const { data: flow, isLoading: flowLoading } = useAutomationFlow(flowId);
  const { data: steps, isLoading: stepsLoading } = useFlowSteps(flowId);
  const { data: origins } = useCRMOrigins();
  
  const createFlow = useCreateFlow();
  const updateFlow = useUpdateFlow();

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [stageId, setStageId] = useState<string>("");
  const [originId, setOriginId] = useState<string>("");
  const [triggerOn, setTriggerOn] = useState<'enter' | 'exit'>('enter');
  const [respectBusinessHours, setRespectBusinessHours] = useState(true);
  const [businessHoursStart, setBusinessHoursStart] = useState("09:00");
  const [businessHoursEnd, setBusinessHoursEnd] = useState("18:00");
  const [excludeWeekends, setExcludeWeekends] = useState(true);

  // Get stages for selected origin
  const { data: stages } = useCRMStages(originId || undefined);

  // Reset form when flow changes
  useEffect(() => {
    if (flow) {
      setName(flow.name);
      setDescription(flow.description || "");
      setStageId(flow.stage_id || "");
      setOriginId(flow.origin_id || "");
      setTriggerOn(flow.trigger_on);
      setRespectBusinessHours(flow.respect_business_hours);
      setBusinessHoursStart(flow.business_hours_start || "09:00");
      setBusinessHoursEnd(flow.business_hours_end || "18:00");
      setExcludeWeekends(flow.exclude_weekends);
    } else {
      setName("");
      setDescription("");
      setStageId("");
      setOriginId("");
      setTriggerOn('enter');
      setRespectBusinessHours(true);
      setBusinessHoursStart("09:00");
      setBusinessHoursEnd("18:00");
      setExcludeWeekends(true);
    }
  }, [flow, open]);

  const handleSave = async () => {
    const data: Partial<AutomationFlow> = {
      name,
      description,
      stage_id: stageId || undefined,
      origin_id: originId || undefined,
      trigger_on: triggerOn,
      respect_business_hours: respectBusinessHours,
      business_hours_start: businessHoursStart,
      business_hours_end: businessHoursEnd,
      exclude_weekends: excludeWeekends,
    };

    if (isEditing && flowId) {
      await updateFlow.mutateAsync({ id: flowId, ...data });
    } else {
      await createFlow.mutateAsync(data);
    }
    
    onOpenChange(false);
  };

  const isSaving = createFlow.isPending || updateFlow.isPending;
  const isLoading = flowLoading;

  // Flatten origins for select
  const flatOrigins = origins?.flatMap(group => 
    (group as any).origins?.map((origin: any) => ({
      id: origin.id,
      name: `${group.name} > ${origin.name}`,
    })) || []
  ) || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar Fluxo" : "Novo Fluxo de Automação"}
          </DialogTitle>
          <DialogDescription>
            Configure as regras e passos do fluxo de automação
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome do Fluxo *</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Follow-up Reunião Agendada"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Descreva o objetivo deste fluxo..."
                    rows={2}
                  />
                </div>
              </div>

              <Separator />

              {/* Trigger Configuration */}
              <div className="space-y-4">
                <h3 className="font-medium">Gatilho</h3>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Pipeline (Origem)</Label>
                    <Select value={originId} onValueChange={setOriginId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o pipeline" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Todos os pipelines</SelectItem>
                        {flatOrigins.map((origin) => (
                          <SelectItem key={origin.id} value={origin.id}>
                            {origin.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Stage *</Label>
                    <Select value={stageId} onValueChange={setStageId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o stage" />
                      </SelectTrigger>
                      <SelectContent>
                        {stages?.map((stage: any) => (
                          <SelectItem key={stage.id} value={stage.id}>
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-full" 
                                style={{ backgroundColor: stage.color || '#888' }} 
                              />
                              {stage.name || stage.stage_name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Disparar quando</Label>
                  <Select value={triggerOn} onValueChange={(v) => setTriggerOn(v as 'enter' | 'exit')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="enter">Lead entrar no stage</SelectItem>
                      <SelectItem value="exit">Lead sair do stage</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              {/* Business Hours */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Horário Comercial</h3>
                    <p className="text-sm text-muted-foreground">
                      Enviar mensagens apenas durante o horário comercial
                    </p>
                  </div>
                  <Switch
                    checked={respectBusinessHours}
                    onCheckedChange={setRespectBusinessHours}
                  />
                </div>

                {respectBusinessHours && (
                  <div className="grid grid-cols-2 gap-4 pl-4 border-l-2">
                    <div className="space-y-2">
                      <Label>Início</Label>
                      <Input
                        type="time"
                        value={businessHoursStart}
                        onChange={(e) => setBusinessHoursStart(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Fim</Label>
                      <Input
                        type="time"
                        value={businessHoursEnd}
                        onChange={(e) => setBusinessHoursEnd(e.target.value)}
                      />
                    </div>
                    <div className="col-span-2 flex items-center space-x-2">
                      <Switch
                        id="excludeWeekends"
                        checked={excludeWeekends}
                        onCheckedChange={setExcludeWeekends}
                      />
                      <Label htmlFor="excludeWeekends">
                        Excluir finais de semana
                      </Label>
                    </div>
                  </div>
                )}
              </div>

              {/* Steps Section - Only show when editing */}
              {isEditing && flowId && (
                <>
                  <Separator />
                  <FlowStepList flowId={flowId} steps={steps || []} isLoading={stepsLoading} />
                </>
              )}
            </div>
          </ScrollArea>
        )}

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!name || isSaving}>
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {isEditing ? "Salvar Alterações" : "Criar Fluxo"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
