import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Phone, Copy, Check, X, Calendar, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { DealTask, TaskType } from '@/hooks/useDealTasks';
import { useTwilio } from '@/contexts/TwilioContext';
import { toast } from 'sonner';

const typeLabels: Record<TaskType, string> = {
  call: 'Ligação',
  email: 'E-mail',
  meeting: 'Reunião',
  whatsapp: 'WhatsApp',
  other: 'Outro',
};

interface TaskDetailPanelProps {
  task: DealTask | null;
  contactPhone?: string | null;
  onComplete?: () => void;
  onCancel?: () => void;
  onEdit?: () => void;
  canEdit?: boolean;
}

export function TaskDetailPanel({ 
  task, 
  contactPhone, 
  onComplete,
  onCancel,
  onEdit,
  canEdit = false,
}: TaskDetailPanelProps) {
  const { makeCall, deviceStatus } = useTwilio();
  const isDeviceReady = deviceStatus === 'ready';

  if (!task) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <Calendar className="h-8 w-8 text-muted-foreground/30 mb-2" />
        <p className="text-sm text-muted-foreground">
          Selecione uma tarefa
        </p>
      </div>
    );
  }

  const scriptBody = task.template?.script_body || task.description;

  const handleCall = () => {
    if (contactPhone && isDeviceReady) {
      makeCall(contactPhone);
    }
  };

  const handleCopyScript = async () => {
    if (scriptBody) {
      try {
        await navigator.clipboard.writeText(scriptBody);
        toast.success('Roteiro copiado!');
      } catch {
        const textarea = document.createElement('textarea');
        textarea.value = scriptBody;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        toast.success('Roteiro copiado!');
      }
    }
  };

  const renderMarkdown = (text: string) => {
    return text.split('\n').map((line, i) => {
      line = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      if (line.startsWith('- ') || line.startsWith('• ')) {
        return (
          <li key={i} className="ml-4 list-disc" dangerouslySetInnerHTML={{ __html: line.slice(2) }} />
        );
      }
      const numberedMatch = line.match(/^(\d+)\.\s/);
      if (numberedMatch) {
        return (
          <li key={i} className="ml-4 list-decimal" dangerouslySetInnerHTML={{ __html: line.slice(numberedMatch[0].length) }} />
        );
      }
      if (line.trim() === '') {
        return <br key={i} />;
      }
      return (
        <p key={i} className="mb-1" dangerouslySetInnerHTML={{ __html: line }} />
      );
    });
  };

  const dueDateText = task.due_date 
    ? format(new Date(task.due_date), "dd/MM 'às' HH:mm", { locale: ptBR })
    : 'Sem data';

  return (
    <div className="flex flex-col h-full">
      {/* Linha compacta de info */}
      <div className="px-3 py-2 border-b">
        <p className="text-xs text-muted-foreground truncate">
          {task.title} • {typeLabels[task.type]} • {dueDateText}
        </p>
      </div>

      {/* Área do roteiro */}
      <ScrollArea className="flex-1">
        <div className="p-4 bg-muted/30 min-h-full">
          {scriptBody ? (
            <div className="prose prose-sm max-w-none text-foreground text-sm leading-relaxed">
              {renderMarkdown(scriptBody)}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              Nenhum roteiro definido para esta atividade.
            </p>
          )}
        </div>
      </ScrollArea>

      {/* Barra de ações mínima */}
      {task.status === 'pending' && (
        <div className="px-3 py-2 border-t flex items-center justify-end gap-1">
          {task.type === 'call' && contactPhone && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="h-8 w-8" 
                  onClick={handleCall}
                  disabled={!isDeviceReady}
                >
                  <Phone className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Ligar</TooltipContent>
            </Tooltip>
          )}
          
          {scriptBody && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="h-8 w-8" 
                  onClick={handleCopyScript}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Copiar roteiro</TooltipContent>
            </Tooltip>
          )}
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                size="icon" 
                variant="ghost" 
                className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50" 
                onClick={onComplete}
              >
                <Check className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Concluir</TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                size="icon" 
                variant="ghost" 
                className="h-8 w-8 text-muted-foreground hover:text-destructive" 
                onClick={onCancel}
              >
                <X className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Cancelar</TooltipContent>
          </Tooltip>

          {/* Ícone de editar - apenas para admin/gestor */}
          {canEdit && onEdit && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="h-8 w-8 text-muted-foreground hover:text-primary" 
                  onClick={onEdit}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Editar atividade</TooltipContent>
            </Tooltip>
          )}
        </div>
      )}

      {/* Info de conclusão */}
      {task.status === 'done' && task.completed_at && (
        <div className="px-3 py-2 border-t">
          <p className="text-xs text-center text-muted-foreground">
            Concluída em {format(new Date(task.completed_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
          </p>
        </div>
      )}
    </div>
  );
}