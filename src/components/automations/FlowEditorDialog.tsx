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
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Plus, Save, Zap, ArrowRight, Clock, Calendar, Settings2 } from "lucide-react";
import { useAutomationFlow, useCreateFlow, useUpdateFlow, useFlowSteps, AutomationFlow } from "@/hooks/useAutomationFlows";
import { useCRMStages, useCRMOrigins } from "@/hooks/useCRMData";
import { FlowStepList } from "./FlowStepList";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

  // Find selected stage for preview
  const selectedStage = stages?.find((s: any) => s.id === stageId);

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
      groupName: group.name,
      originName: origin.name,
    })) || []
  ) || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Zap className="h-5 w-5 text-primary" />
            {isEditing ? "Editar Fluxo de Automação" : "Novo Fluxo de Automação"}
          </DialogTitle>
          <DialogDescription>
            {isEditing 
              ? "Modifique as configurações e passos do fluxo"
              : "Configure as regras de disparo e adicione passos para a sequência"
            }
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <Tabs defaultValue="config" className="flex-1 flex flex-col min-h-0">
            <TabsList className="mx-6 mt-4 w-fit">
              <TabsTrigger value="config" className="gap-2">
                <Settings2 className="h-4 w-4" />
                Configurações
              </TabsTrigger>
              {isEditing && (
                <TabsTrigger value="steps" className="gap-2">
                  <Clock className="h-4 w-4" />
                  Passos ({steps?.length || 0})
                </TabsTrigger>
              )}
            </TabsList>

            <ScrollArea className="flex-1 px-6">
              <TabsContent value="config" className="mt-0 py-4 space-y-6">
                {/* Basic Info */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome do Fluxo *</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ex: Follow-up Reunião Agendada"
                      className="max-w-md"
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
                      className="max-w-md"
                    />
                  </div>
                </div>

                <Separator />

                {/* Trigger Configuration */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <ArrowRight className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold">Configuração do Gatilho</h3>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Pipeline (Origem)</Label>
                      <Select value={originId || "__all__"} onValueChange={(val) => {
                        setOriginId(val === "__all__" ? "" : val);
                        setStageId(""); // Reset stage when origin changes
                      }}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o pipeline" />
                        </SelectTrigger>
                        <SelectContent className="bg-popover z-50">
                          <SelectItem value="__all__">Todos os pipelines</SelectItem>
                          {flatOrigins.map((origin) => (
                            <SelectItem key={origin.id} value={origin.id}>
                              {origin.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Stage de Disparo *</Label>
                      <Select value={stageId} onValueChange={setStageId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o stage" />
                        </SelectTrigger>
                        <SelectContent className="bg-popover z-50">
                          {stages?.map((stage: any) => (
                            <SelectItem key={stage.id} value={stage.id}>
                              <div className="flex items-center gap-2">
                                <div 
                                  className="w-3 h-3 rounded-full flex-shrink-0" 
                                  style={{ backgroundColor: stage.color || '#888' }} 
                                />
                                <span>{stage.name || stage.stage_name}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2 max-w-xs">
                    <Label>Disparar quando o lead...</Label>
                    <Select value={triggerOn} onValueChange={(v) => setTriggerOn(v as 'enter' | 'exit')}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover z-50">
                        <SelectItem value="enter">Entrar no stage</SelectItem>
                        <SelectItem value="exit">Sair do stage</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Trigger Preview */}
                  {stageId && (
                    <Card className="bg-muted/30 border-dashed">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3 text-sm">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10">
                            <Zap className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-muted-foreground">Quando lead</span>
                            <Badge variant="outline">
                              {triggerOn === 'enter' ? 'entrar em' : 'sair de'}
                            </Badge>
                            {selectedStage && (
                              <Badge 
                                style={{ 
                                  borderColor: selectedStage.color,
                                  backgroundColor: `${selectedStage.color}15`
                                }}
                              >
                                <div 
                                  className="w-2 h-2 rounded-full mr-1.5" 
                                  style={{ backgroundColor: selectedStage.color }}
                                />
                                {selectedStage.stage_name}
                              </Badge>
                            )}
                            <span className="text-muted-foreground">→ iniciar sequência</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>

                <Separator />

                {/* Business Hours */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-5 w-5 text-primary" />
                      <div>
                        <h3 className="font-semibold">Horário Comercial</h3>
                        <p className="text-sm text-muted-foreground">
                          Agendar envios apenas durante o horário comercial
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={respectBusinessHours}
                      onCheckedChange={setRespectBusinessHours}
                    />
                  </div>

                  {respectBusinessHours && (
                    <Card className="bg-muted/30">
                      <CardContent className="p-4 space-y-4">
                        <div className="grid grid-cols-2 gap-4 max-w-xs">
                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">Início</Label>
                            <Input
                              type="time"
                              value={businessHoursStart}
                              onChange={(e) => setBusinessHoursStart(e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">Fim</Label>
                            <Input
                              type="time"
                              value={businessHoursEnd}
                              onChange={(e) => setBusinessHoursEnd(e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Switch
                            id="excludeWeekends"
                            checked={excludeWeekends}
                            onCheckedChange={setExcludeWeekends}
                          />
                          <Label htmlFor="excludeWeekends" className="text-sm">
                            Excluir sábados e domingos
                          </Label>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </TabsContent>

              {isEditing && flowId && (
                <TabsContent value="steps" className="mt-0 py-4">
                  <FlowStepList flowId={flowId} steps={steps || []} isLoading={stepsLoading} />
                </TabsContent>
              )}
            </ScrollArea>
          </Tabs>
        )}

        <div className="flex justify-between items-center gap-2 px-6 py-4 border-t bg-muted/30">
          <p className="text-xs text-muted-foreground">
            {isEditing 
              ? "As alterações serão salvas imediatamente"
              : "Após criar o fluxo, você poderá adicionar os passos da sequência"
            }
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={!name || isSaving} className="gap-2">
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {isEditing ? "Salvar Alterações" : "Criar Fluxo"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
