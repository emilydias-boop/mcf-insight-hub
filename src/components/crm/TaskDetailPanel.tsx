import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Phone, Mail, MessageSquare, Calendar, Clock, CheckCircle2, XCircle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DealTask, TaskType, TaskStatus } from '@/hooks/useDealTasks';
import { useTwilio } from '@/contexts/TwilioContext';

const typeIcons: Record<TaskType, React.ElementType> = {
  call: Phone,
  email: Mail,
  meeting: Calendar,
  whatsapp: MessageSquare,
  other: Calendar,
};

const typeLabels: Record<TaskType, string> = {
  call: 'Ligação',
  email: 'E-mail',
  meeting: 'Reunião',
  whatsapp: 'WhatsApp',
  other: 'Outro',
};

const statusLabels: Record<TaskStatus, string> = {
  pending: 'Pendente',
  done: 'Concluída',
  canceled: 'Cancelada',
};

const statusColors: Record<TaskStatus, string> = {
  pending: 'bg-yellow-500/20 text-yellow-600 border-yellow-500/30',
  done: 'bg-green-500/20 text-green-600 border-green-500/30',
  canceled: 'bg-muted text-muted-foreground border-muted',
};

interface TaskDetailPanelProps {
  task: DealTask | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  contactName?: string | null;
  onComplete?: () => void;
  onCancel?: () => void;
}

export function TaskDetailPanel({ 
  task, 
  contactPhone, 
  contactEmail, 
  contactName,
  onComplete,
  onCancel,
}: TaskDetailPanelProps) {
  const { makeCall, deviceStatus } = useTwilio();
  const isDeviceReady = deviceStatus === 'ready';

  if (!task) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <Calendar className="h-12 w-12 text-muted-foreground/30 mb-3" />
        <p className="text-muted-foreground text-sm">
          Selecione uma tarefa para ver os detalhes
        </p>
      </div>
    );
  }

  const Icon = typeIcons[task.type];
  const scriptTitle = task.template?.script_title || task.title;
  const scriptBody = task.template?.script_body;

  const handleCall = () => {
    if (contactPhone && isDeviceReady) {
      makeCall(contactPhone);
    }
  };

  const handleWhatsApp = () => {
    if (contactPhone) {
      const phone = contactPhone.replace(/\D/g, '');
      const text = scriptBody 
        ? encodeURIComponent(scriptBody.split('\n')[0]) 
        : '';
      window.open(`https://wa.me/55${phone}${text ? `?text=${text}` : ''}`, '_blank');
    }
  };

  const handleEmail = () => {
    if (contactEmail) {
      const subject = encodeURIComponent(scriptTitle);
      const body = scriptBody ? encodeURIComponent(scriptBody) : '';
      window.open(`mailto:${contactEmail}?subject=${subject}&body=${body}`, '_blank');
    }
  };

  const renderMarkdown = (text: string) => {
    // Simple markdown rendering for script body
    return text.split('\n').map((line, i) => {
      // Bold
      line = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      // Bullets
      if (line.startsWith('- ')) {
        return (
          <li key={i} className="ml-4 list-disc" dangerouslySetInnerHTML={{ __html: line.slice(2) }} />
        );
      }
      if (line.startsWith('• ')) {
        return (
          <li key={i} className="ml-4 list-disc" dangerouslySetInnerHTML={{ __html: line.slice(2) }} />
        );
      }
      // Numbered lists
      const numberedMatch = line.match(/^(\d+)\.\s/);
      if (numberedMatch) {
        return (
          <li key={i} className="ml-4 list-decimal" dangerouslySetInnerHTML={{ __html: line.slice(numberedMatch[0].length) }} />
        );
      }
      // Empty line
      if (line.trim() === '') {
        return <br key={i} />;
      }
      return (
        <p key={i} className="mb-1" dangerouslySetInnerHTML={{ __html: line }} />
      );
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b space-y-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground">{scriptTitle}</h3>
            {contactName && (
              <p className="text-sm text-muted-foreground">{contactName}</p>
            )}
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className={statusColors[task.status]}>
            {task.status === 'done' && <CheckCircle2 className="h-3 w-3 mr-1" />}
            {task.status === 'canceled' && <XCircle className="h-3 w-3 mr-1" />}
            {statusLabels[task.status]}
          </Badge>
          <Badge variant="secondary">
            <Icon className="h-3 w-3 mr-1" />
            {typeLabels[task.type]}
          </Badge>
          {task.due_date && (
            <Badge variant="outline" className="text-muted-foreground">
              <Clock className="h-3 w-3 mr-1" />
              {format(new Date(task.due_date), "dd/MM 'às' HH:mm", { locale: ptBR })}
            </Badge>
          )}
        </div>
      </div>

      {/* Script Body */}
      <ScrollArea className="flex-1 p-4">
        {scriptBody ? (
          <div className="prose prose-sm max-w-none text-foreground">
            {renderMarkdown(scriptBody)}
          </div>
        ) : task.description ? (
          <p className="text-sm text-muted-foreground">{task.description}</p>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            Nenhum roteiro definido para esta atividade.
          </p>
        )}
      </ScrollArea>

      {/* Actions */}
      <div className="p-4 border-t space-y-2">
        {task.status === 'pending' && (
          <>
            {/* Channel-specific action */}
            {task.type === 'call' && contactPhone && (
              <Button 
                className="w-full" 
                onClick={handleCall}
                disabled={!isDeviceReady}
              >
                <Phone className="h-4 w-4 mr-2" />
                Ligar agora
              </Button>
            )}
            {task.type === 'whatsapp' && contactPhone && (
              <Button className="w-full bg-green-600 hover:bg-green-700" onClick={handleWhatsApp}>
                <MessageSquare className="h-4 w-4 mr-2" />
                Abrir WhatsApp
                <ExternalLink className="h-3 w-3 ml-2" />
              </Button>
            )}
            {task.type === 'email' && contactEmail && (
              <Button className="w-full" variant="secondary" onClick={handleEmail}>
                <Mail className="h-4 w-4 mr-2" />
                Abrir E-mail
                <ExternalLink className="h-3 w-3 ml-2" />
              </Button>
            )}

            {/* Complete/Cancel buttons */}
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="flex-1 text-green-600 hover:text-green-700 hover:bg-green-50"
                onClick={onComplete}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Concluir
              </Button>
              <Button 
                variant="ghost" 
                className="text-muted-foreground hover:text-destructive"
                onClick={onCancel}
              >
                <XCircle className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}

        {task.status === 'done' && task.completed_at && (
          <p className="text-xs text-center text-muted-foreground">
            Concluída em {format(new Date(task.completed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </p>
        )}
      </div>
    </div>
  );
}
