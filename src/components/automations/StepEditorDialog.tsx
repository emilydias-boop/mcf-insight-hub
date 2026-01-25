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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Save, MessageCircle, Mail } from "lucide-react";
import { useFlowSteps, useCreateStep, useUpdateStep, AutomationStep } from "@/hooks/useAutomationFlows";
import { useAutomationTemplates } from "@/hooks/useAutomationTemplates";

interface StepEditorDialogProps {
  flowId: string;
  stepId: string | null;
  orderIndex: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StepEditorDialog({ flowId, stepId, orderIndex, open, onOpenChange }: StepEditorDialogProps) {
  const isEditing = !!stepId;
  const { data: steps } = useFlowSteps(flowId);
  const { data: templates } = useAutomationTemplates();
  
  const createStep = useCreateStep();
  const updateStep = useUpdateStep();

  // Form state
  const [channel, setChannel] = useState<'whatsapp' | 'email'>('whatsapp');
  const [templateId, setTemplateId] = useState("");
  const [delayDays, setDelayDays] = useState(0);
  const [delayHours, setDelayHours] = useState(0);
  const [delayMinutes, setDelayMinutes] = useState(0);
  const [isActive, setIsActive] = useState(true);

  // Get existing step data
  const existingStep = steps?.find(s => s.id === stepId);

  // Reset form when step changes
  useEffect(() => {
    if (existingStep) {
      setChannel(existingStep.channel);
      setTemplateId(existingStep.template_id);
      setDelayDays(existingStep.delay_days);
      setDelayHours(existingStep.delay_hours);
      setDelayMinutes(existingStep.delay_minutes);
      setIsActive(existingStep.is_active);
    } else {
      setChannel('whatsapp');
      setTemplateId("");
      setDelayDays(0);
      setDelayHours(0);
      setDelayMinutes(0);
      setIsActive(true);
    }
  }, [existingStep, open]);

  const handleSave = async () => {
    const data: Partial<AutomationStep> = {
      flow_id: flowId,
      template_id: templateId,
      channel,
      delay_days: delayDays,
      delay_hours: delayHours,
      delay_minutes: delayMinutes,
      order_index: existingStep?.order_index ?? orderIndex,
      is_active: isActive,
    };

    if (isEditing && stepId) {
      await updateStep.mutateAsync({ id: stepId, ...data });
    } else {
      await createStep.mutateAsync(data);
    }
    
    onOpenChange(false);
  };

  const isSaving = createStep.isPending || updateStep.isPending;

  // Filter templates by selected channel
  const filteredTemplates = templates?.filter(t => t.channel === channel && t.is_active) || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar Passo" : "Adicionar Passo"}
          </DialogTitle>
          <DialogDescription>
            Configure o canal, template e delay para este passo
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Channel Selection */}
          <div className="space-y-2">
            <Label>Canal</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={channel === 'whatsapp' ? 'default' : 'outline'}
                className="justify-start"
                onClick={() => {
                  setChannel('whatsapp');
                  setTemplateId("");
                }}
              >
                <MessageCircle className="h-4 w-4 mr-2 text-green-600" />
                WhatsApp
              </Button>
              <Button
                type="button"
                variant={channel === 'email' ? 'default' : 'outline'}
                className="justify-start"
                onClick={() => {
                  setChannel('email');
                  setTemplateId("");
                }}
              >
                <Mail className="h-4 w-4 mr-2 text-blue-600" />
                Email
              </Button>
            </div>
          </div>

          {/* Template Selection */}
          <div className="space-y-2">
            <Label>Template *</Label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um template" />
              </SelectTrigger>
              <SelectContent>
                {filteredTemplates.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground text-center">
                    Nenhum template de {channel === 'whatsapp' ? 'WhatsApp' : 'Email'} disponível
                  </div>
                ) : (
                  filteredTemplates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Delay Configuration */}
          <div className="space-y-2">
            <Label>Delay (tempo de espera)</Label>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs text-muted-foreground">Dias</Label>
                <Input
                  type="number"
                  min={0}
                  value={delayDays}
                  onChange={(e) => setDelayDays(parseInt(e.target.value) || 0)}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Horas</Label>
                <Input
                  type="number"
                  min={0}
                  max={23}
                  value={delayHours}
                  onChange={(e) => setDelayHours(parseInt(e.target.value) || 0)}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Minutos</Label>
                <Input
                  type="number"
                  min={0}
                  max={59}
                  value={delayMinutes}
                  onChange={(e) => setDelayMinutes(parseInt(e.target.value) || 0)}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {delayDays === 0 && delayHours === 0 && delayMinutes === 0 
                ? "A mensagem será enviada imediatamente" 
                : `A mensagem será enviada após ${delayDays > 0 ? `${delayDays} dia(s) ` : ''}${delayHours > 0 ? `${delayHours} hora(s) ` : ''}${delayMinutes > 0 ? `${delayMinutes} minuto(s)` : ''}`
              }
            </p>
          </div>

          {/* Active Toggle */}
          <div className="flex items-center justify-between">
            <Label htmlFor="isActive">Passo ativo</Label>
            <Switch
              id="isActive"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!templateId || isSaving}>
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {isEditing ? "Salvar" : "Adicionar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
