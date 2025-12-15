import { useState, useEffect } from 'react';
import { format, addDays, differenceInMinutes } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useActivityTemplates, useCreateActivityTemplate, useUpdateActivityTemplate } from '@/hooks/useActivityTemplates';
import { useCreateDealTask, useUpdateDealTask, useCreateTasksFromTemplates, TaskType, DealTask } from '@/hooks/useDealTasks';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealId: string;
  originId?: string;
  stageId?: string;
  ownerId?: string;
  editTask?: DealTask | null;
}

const taskTypes: { value: TaskType; label: string }[] = [
  { value: 'call', label: 'Ligação' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'E-mail' },
  { value: 'meeting', label: 'Reunião' },
  { value: 'other', label: 'Outro' },
];

export function CreateTaskDialog({ 
  open, 
  onOpenChange, 
  dealId, 
  originId, 
  stageId,
  ownerId,
  editTask,
}: CreateTaskDialogProps) {
  const { user, role } = useAuth();
  const { data: templates } = useActivityTemplates(originId, stageId);
  const createTask = useCreateDealTask();
  const updateTask = useUpdateDealTask();
  const createFromTemplates = useCreateTasksFromTemplates();
  const createTemplate = useCreateActivityTemplate();
  const updateTemplate = useUpdateActivityTemplate();

  const isEditing = !!editTask;
  const canManageTemplates = ['admin', 'coordenador', 'manager'].includes(role || '');

  const [mode, setMode] = useState<'manual' | 'template'>('manual');
  const [title, setTitle] = useState('');
  const [scriptBody, setScriptBody] = useState('');
  const [type, setType] = useState<TaskType>('call');
  const [dueDate, setDueDate] = useState<Date | undefined>(addDays(new Date(), 1));
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [updateTemplateAlso, setUpdateTemplateAlso] = useState(false);

  // Fill form when editing
  useEffect(() => {
    if (editTask && open) {
      setTitle(editTask.title);
      setScriptBody(editTask.template?.script_body || editTask.description || '');
      setType(editTask.type);
      setDueDate(editTask.due_date ? new Date(editTask.due_date) : undefined);
      setMode('manual');
      setSaveAsTemplate(false);
      setUpdateTemplateAlso(false);
    } else if (!open) {
      resetForm();
    }
  }, [editTask, open]);

  const handleSubmit = async () => {
    if (!user?.id) return;

    if (mode === 'manual' && title.trim()) {
      if (isEditing && editTask) {
        // Update existing task
        updateTask.mutate({
          id: editTask.id,
          dealId,
          title: title.trim(),
          description: scriptBody.trim() || null,
          type,
          due_date: dueDate?.toISOString() || null,
        }, {
          onSuccess: async () => {
            // Optionally update the template too
            if (updateTemplateAlso && editTask.template_id && canManageTemplates) {
              const slaMinutes = dueDate ? differenceInMinutes(dueDate, new Date()) : null;
              await updateTemplate.mutateAsync({
                id: editTask.template_id,
                name: title.trim(),
                type,
                script_body: scriptBody.trim() || null,
                sla_offset_minutes: slaMinutes && slaMinutes > 0 ? slaMinutes : null,
              });
              toast.success('Atividade e modelo atualizados');
            } else {
              toast.success('Atividade atualizada');
            }
            resetForm();
            onOpenChange(false);
          }
        });
      } else {
        // Create new task
        createTask.mutate({
          deal_id: dealId,
          title: title.trim(),
          description: scriptBody.trim() || null,
          type,
          status: 'pending',
          due_date: dueDate?.toISOString() || null,
          created_by: user.id,
          owner_id: ownerId || null,
          contact_id: null,
          template_id: null,
        }, {
          onSuccess: async () => {
            // Optionally save as template
            if (saveAsTemplate && canManageTemplates && stageId) {
              const slaMinutes = dueDate ? differenceInMinutes(dueDate, new Date()) : null;
              await createTemplate.mutateAsync({
                name: title.trim(),
                description: null,
                type,
                origin_id: originId || null,
                stage_id: stageId,
                default_due_days: null,
                order_index: (templates?.length || 0) + 1,
                is_active: true,
                script_title: title.trim(),
                script_body: scriptBody.trim() || null,
                sla_offset_minutes: slaMinutes && slaMinutes > 0 ? slaMinutes : null,
              });
              toast.success('Atividade criada e salva como modelo');
            } else {
              toast.success('Atividade criada');
            }
            resetForm();
            onOpenChange(false);
          }
        });
      }
    } else if (mode === 'template' && selectedTemplates.length > 0) {
      const templatesData = templates?.filter(t => selectedTemplates.includes(t.id)) || [];
      createFromTemplates.mutate({
        dealId,
        templates: templatesData,
        createdBy: user.id,
        ownerId,
      }, {
        onSuccess: () => {
          resetForm();
          onOpenChange(false);
        }
      });
    }
  };

  const resetForm = () => {
    setTitle('');
    setScriptBody('');
    setType('call');
    setDueDate(addDays(new Date(), 1));
    setSelectedTemplates([]);
    setMode('manual');
    setSaveAsTemplate(false);
    setUpdateTemplateAlso(false);
  };

  const toggleTemplate = (templateId: string) => {
    setSelectedTemplates(prev => 
      prev.includes(templateId) 
        ? prev.filter(id => id !== templateId)
        : [...prev, templateId]
    );
  };

  const hasTemplates = templates && templates.length > 0 && !isEditing;
  const isPending = createTask.isPending || updateTask.isPending || createFromTemplates.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Atividade' : 'Nova Atividade'}</DialogTitle>
        </DialogHeader>

        {hasTemplates && (
          <div className="flex gap-2 mb-4">
            <Button
              variant={mode === 'manual' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setMode('manual')}
            >
              Manual
            </Button>
            <Button
              variant={mode === 'template' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setMode('template')}
            >
              De Template ({templates.length})
            </Button>
          </div>
        )}

        {mode === 'manual' ? (
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Título *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Tentativa de Ligação 01"
              />
            </div>

            <div>
              <Label htmlFor="type">Canal</Label>
              <Select value={type} onValueChange={(v) => setType(v as TaskType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {taskTypes.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Data/Hora Limite</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dueDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dueDate ? format(dueDate, "dd/MM/yyyy HH:mm") : "Selecionar data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dueDate}
                    onSelect={setDueDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <Label htmlFor="scriptBody">Roteiro / Script da atividade</Label>
              <p className="text-xs text-muted-foreground mb-1">
                Este texto será exibido no painel direito para o SDR durante a execução.
              </p>
              <Textarea
                id="scriptBody"
                value={scriptBody}
                onChange={(e) => setScriptBody(e.target.value)}
                placeholder="Ex: Apresentar-se como consultor MCF, confirmar interesse..."
                rows={5}
              />
            </div>

            {/* Checkbox for saving as template - only for managers/admins on new tasks */}
            {canManageTemplates && !isEditing && stageId && (
              <div className="flex items-center space-x-2 pt-2 border-t">
                <Checkbox
                  id="saveAsTemplate"
                  checked={saveAsTemplate}
                  onCheckedChange={(checked) => setSaveAsTemplate(checked as boolean)}
                />
                <Label htmlFor="saveAsTemplate" className="text-sm font-normal cursor-pointer">
                  Salvar como modelo para este estágio
                </Label>
              </div>
            )}

            {/* Checkbox for updating template - only for managers/admins when editing task with template */}
            {canManageTemplates && isEditing && editTask?.template_id && (
              <div className="flex items-center space-x-2 pt-2 border-t">
                <Checkbox
                  id="updateTemplateAlso"
                  checked={updateTemplateAlso}
                  onCheckedChange={(checked) => setUpdateTemplateAlso(checked as boolean)}
                />
                <Label htmlFor="updateTemplateAlso" className="text-sm font-normal cursor-pointer">
                  Aplicar alterações também ao modelo
                </Label>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground mb-3">
              Selecione os templates para criar atividades:
            </p>
            {templates?.map((template) => (
              <div
                key={template.id}
                className={cn(
                  "p-3 border rounded-lg cursor-pointer transition-colors",
                  selectedTemplates.includes(template.id)
                    ? "border-primary bg-primary/5"
                    : "hover:bg-muted/50"
                )}
                onClick={() => toggleTemplate(template.id)}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{template.name}</span>
                  {template.default_due_days && (
                    <span className="text-xs text-muted-foreground">
                      {template.default_due_days} dias
                    </span>
                  )}
                </div>
                {template.description && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {template.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              (mode === 'manual' && !title.trim()) ||
              (mode === 'template' && selectedTemplates.length === 0) ||
              isPending
            }
          >
            {isPending ? 'Salvando...' : isEditing ? 'Salvar' : 'Criar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}