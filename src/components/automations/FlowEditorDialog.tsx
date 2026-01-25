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

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Save, Zap, ArrowRight, Clock, Calendar, FileText } from "lucide-react";
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
  const [groupId, setGroupId] = useState<string>("");
  const [originId, setOriginId] = useState<string>("");
  const [triggerOn, setTriggerOn] = useState<'enter' | 'exit'>('enter');
  const [respectBusinessHours, setRespectBusinessHours] = useState(true);
  const [businessHoursStart, setBusinessHoursStart] = useState("09:00");
  const [businessHoursEnd, setBusinessHoursEnd] = useState("18:00");
  const [excludeWeekends, setExcludeWeekends] = useState(true);

  // Get stages for selected origin (or group if no origin selected)
  const { data: stages } = useCRMStages(originId || groupId || undefined);

  // Get origins for selected group
  const selectedGroupOrigins = origins?.find(g => (g as any).id === groupId)?.children || [];

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
      
      // Find the group for the selected origin
      if (flow.origin_id && origins) {
        const foundGroup = origins.find((g: any) => 
          g.children?.some((o: any) => o.id === flow.origin_id)
        );
        setGroupId((foundGroup as any)?.id || "");
      } else {
        setGroupId("");
      }
    } else {
      setName("");
      setDescription("");
      setStageId("");
      setGroupId("");
      setOriginId("");
      setTriggerOn('enter');
      setRespectBusinessHours(true);
      setBusinessHoursStart("09:00");
      setBusinessHoursEnd("18:00");
      setExcludeWeekends(true);
    }
  }, [flow, open, origins]);

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


  // Form content component to avoid duplication
  const FormContent = () => (
    <div className="space-y-6">
      {/* Basic Info Card */}
      <Card className="border bg-card/50">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base font-medium">
            <FileText className="h-4 w-4 text-primary" />
            Informações Básicas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome do Fluxo *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Follow-up Reunião Agendada"
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva o objetivo deste fluxo..."
              rows={3}
              className="w-full resize-none"
            />
          </div>
        </CardContent>
      </Card>

      {/* Trigger Configuration Card */}
      <Card className="border bg-card/50">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base font-medium">
            <ArrowRight className="h-4 w-4 text-primary" />
            Configuração do Gatilho
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Grupo/Pipeline</Label>
              <Select 
                value={groupId || "__all__"} 
                onValueChange={(val) => {
                  setGroupId(val === "__all__" ? "" : val);
                  setOriginId("");
                  setStageId("");
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Todos os grupos" />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  <SelectItem value="__all__">Todos os grupos</SelectItem>
                  {origins?.map((group: any) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Origem</Label>
              <Select 
                value={originId || "__all__"} 
                onValueChange={(val) => {
                  setOriginId(val === "__all__" ? "" : val);
                  setStageId("");
                }}
                disabled={!groupId}
              >
                <SelectTrigger className={`w-full ${!groupId ? "opacity-50" : ""}`}>
                  <SelectValue placeholder={groupId ? "Todas as origens" : "Selecione um grupo"} />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  <SelectItem value="__all__">Todas as origens</SelectItem>
                  {selectedGroupOrigins.map((origin: any) => (
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
                <SelectTrigger className={`w-full ${!stageId ? "text-muted-foreground" : ""}`}>
                  <SelectValue placeholder="Escolha o stage" />
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

          <div className="space-y-2">
            <Label>Disparar quando o lead...</Label>
            <Select value={triggerOn} onValueChange={(v) => setTriggerOn(v as 'enter' | 'exit')}>
              <SelectTrigger className="w-full sm:w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover z-50">
                <SelectItem value="enter">Entrar no stage</SelectItem>
                <SelectItem value="exit">Sair do stage</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Trigger Preview */}
          {stageId && selectedStage && (
            <div className="rounded-lg border border-dashed bg-muted/30 p-4">
              <div className="flex items-center gap-3 text-sm">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10">
                  <Zap className="h-4 w-4 text-primary" />
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-muted-foreground">Quando lead</span>
                  <Badge variant="outline">
                    {triggerOn === 'enter' ? 'entrar em' : 'sair de'}
                  </Badge>
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
                  <span className="text-muted-foreground">→ iniciar sequência</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Business Hours Card */}
      <Card className="border bg-card/50">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base font-medium">
              <Calendar className="h-4 w-4 text-primary" />
              Horário Comercial
            </CardTitle>
            <Switch
              checked={respectBusinessHours}
              onCheckedChange={setRespectBusinessHours}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            Agendar envios apenas durante o horário comercial
          </p>
        </CardHeader>
        
        {respectBusinessHours && (
          <CardContent className="space-y-4 pt-0">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Início</Label>
                <Input
                  type="time"
                  value={businessHoursStart}
                  onChange={(e) => setBusinessHoursStart(e.target.value)}
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Fim</Label>
                <Input
                  type="time"
                  value={businessHoursEnd}
                  onChange={(e) => setBusinessHoursEnd(e.target.value)}
                  className="w-full"
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="excludeWeekends"
                checked={excludeWeekends}
                onCheckedChange={setExcludeWeekends}
              />
              <Label htmlFor="excludeWeekends" className="text-sm cursor-pointer">
                Excluir sábados e domingos
              </Label>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b flex-shrink-0">
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
        ) : isEditing ? (
          // Edit mode: Show tabs
          <Tabs defaultValue="config" className="flex-1 flex flex-col min-h-0">
            <TabsList className="mx-6 mt-4 w-fit flex-shrink-0">
              <TabsTrigger value="config" className="gap-2">
                <Zap className="h-4 w-4" />
                Configurações
              </TabsTrigger>
              <TabsTrigger value="steps" className="gap-2">
                <Clock className="h-4 w-4" />
                Passos ({steps?.length || 0})
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 min-h-0 overflow-y-auto">
              <TabsContent value="config" className="mt-0 px-6 py-6">
                <FormContent />
              </TabsContent>

              {flowId && (
                <TabsContent value="steps" className="mt-0 px-6 py-6">
                  <FlowStepList flowId={flowId} steps={steps || []} isLoading={stepsLoading} />
                </TabsContent>
              )}
            </div>
          </Tabs>
        ) : (
          // Create mode: Show form directly without tabs
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="px-6 py-6">
              <FormContent />
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 px-6 py-5 border-t bg-muted/20 flex-shrink-0">
          <p className="text-xs text-muted-foreground">
            {isEditing 
              ? "As alterações serão salvas imediatamente"
              : "Após criar o fluxo, você poderá adicionar os passos da sequência"
            }
          </p>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1 sm:flex-none">
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={!name || isSaving} className="gap-2 flex-1 sm:flex-none">
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {isEditing ? "Salvar" : "Criar Fluxo"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
