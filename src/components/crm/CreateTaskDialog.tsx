import { useState } from 'react';
import { format, addDays } from 'date-fns';
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
import { useActivityTemplates } from '@/hooks/useActivityTemplates';
import { useCreateDealTask, useCreateTasksFromTemplates, TaskType } from '@/hooks/useDealTasks';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealId: string;
  originId?: string;
  stageId?: string;
  ownerId?: string;
}

const taskTypes: { value: TaskType; label: string }[] = [
  { value: 'call', label: 'Ligação' },
  { value: 'email', label: 'E-mail' },
  { value: 'meeting', label: 'Reunião' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'other', label: 'Outro' },
];

export function CreateTaskDialog({ 
  open, 
  onOpenChange, 
  dealId, 
  originId, 
  stageId,
  ownerId 
}: CreateTaskDialogProps) {
  const { user } = useAuth();
  const { data: templates } = useActivityTemplates(originId, stageId);
  const createTask = useCreateDealTask();
  const createFromTemplates = useCreateTasksFromTemplates();

  const [mode, setMode] = useState<'manual' | 'template'>('manual');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<TaskType>('other');
  const [dueDate, setDueDate] = useState<Date | undefined>(addDays(new Date(), 1));
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);

  const handleSubmit = () => {
    if (!user?.id) return;

    if (mode === 'manual' && title.trim()) {
      createTask.mutate({
        deal_id: dealId,
        title: title.trim(),
        description: description.trim() || null,
        type,
        status: 'pending',
        due_date: dueDate?.toISOString() || null,
        created_by: user.id,
        owner_id: ownerId || null,
        contact_id: null,
        template_id: null,
      }, {
        onSuccess: () => {
          resetForm();
          onOpenChange(false);
        }
      });
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
    setDescription('');
    setType('other');
    setDueDate(addDays(new Date(), 1));
    setSelectedTemplates([]);
    setMode('manual');
  };

  const toggleTemplate = (templateId: string) => {
    setSelectedTemplates(prev => 
      prev.includes(templateId) 
        ? prev.filter(id => id !== templateId)
        : [...prev, templateId]
    );
  };

  const hasTemplates = templates && templates.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Atividade</DialogTitle>
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
              <Label htmlFor="title">Título</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Ligar para confirmar reunião"
              />
            </div>

            <div>
              <Label htmlFor="type">Tipo</Label>
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
              <Label htmlFor="description">Descrição (opcional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detalhes da atividade..."
                rows={3}
              />
            </div>
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
              createTask.isPending ||
              createFromTemplates.isPending
            }
          >
            {createTask.isPending || createFromTemplates.isPending ? 'Criando...' : 'Criar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
