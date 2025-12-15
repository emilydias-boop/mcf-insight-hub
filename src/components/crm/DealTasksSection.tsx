import { useState } from 'react';
import { format, isPast, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Phone, Mail, Calendar, MessageSquare, CheckSquare, MoreHorizontal,
  Check, X, Clock, Plus, AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useDealTasks, useCompleteDealTask, useCancelDealTask, TaskType, TaskStatus } from '@/hooks/useDealTasks';
import { useAuth } from '@/contexts/AuthContext';
import { CreateTaskDialog } from './CreateTaskDialog';

const taskTypeIcons: Record<TaskType, React.ElementType> = {
  call: Phone,
  email: Mail,
  meeting: Calendar,
  whatsapp: MessageSquare,
  other: MoreHorizontal,
};

const taskTypeLabels: Record<TaskType, string> = {
  call: 'Ligação',
  email: 'E-mail',
  meeting: 'Reunião',
  whatsapp: 'WhatsApp',
  other: 'Outro',
};

const statusColors: Record<TaskStatus, string> = {
  pending: 'bg-yellow-500/20 text-yellow-600',
  done: 'bg-green-500/20 text-green-600',
  canceled: 'bg-muted text-muted-foreground',
};

interface DealTasksSectionProps {
  dealId: string;
  originId?: string;
  stageId?: string;
  ownerId?: string;
}

export function DealTasksSection({ dealId, originId, stageId, ownerId }: DealTasksSectionProps) {
  const { user } = useAuth();
  const { data: tasks, isLoading } = useDealTasks(dealId);
  const completeTask = useCompleteDealTask();
  const cancelTask = useCancelDealTask();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('pending');

  const filteredTasks = tasks?.filter(task => {
    if (filter === 'all') return true;
    if (filter === 'pending') return task.status === 'pending';
    if (filter === 'completed') return task.status === 'done' || task.status === 'canceled';
    return true;
  }) || [];

  const pendingCount = tasks?.filter(t => t.status === 'pending').length || 0;
  const overdueCount = tasks?.filter(t => 
    t.status === 'pending' && t.due_date && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date))
  ).length || 0;

  const handleComplete = (taskId: string) => {
    if (!user?.id) return;
    completeTask.mutate({ id: taskId, dealId, userId: user.id });
  };

  const handleCancel = (taskId: string) => {
    cancelTask.mutate({ id: taskId, dealId });
  };

  if (isLoading) {
    return <div className="p-4 text-center text-muted-foreground text-sm">Carregando atividades...</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-2 p-3 border-b">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Atividades</span>
          {pendingCount > 0 && (
            <Badge variant="secondary" className="text-xs">{pendingCount} pendentes</Badge>
          )}
          {overdueCount > 0 && (
            <Badge variant="destructive" className="text-xs">{overdueCount} atrasadas</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <Button
              variant={filter === 'pending' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setFilter('pending')}
            >
              Pendentes
            </Button>
            <Button
              variant={filter === 'completed' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setFilter('completed')}
            >
              Concluídas
            </Button>
            <Button
              variant={filter === 'all' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setFilter('all')}
            >
              Todas
            </Button>
          </div>
          <Button size="sm" className="h-7" onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-3 w-3 mr-1" />
            Nova
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        {filteredTasks.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground text-sm">
            {filter === 'pending' ? 'Nenhuma atividade pendente' : 'Nenhuma atividade encontrada'}
          </div>
        ) : (
          <div className="divide-y">
            {filteredTasks.map((task) => {
              const Icon = taskTypeIcons[task.type];
              const isOverdue = task.status === 'pending' && task.due_date && 
                isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date));
              const isDueToday = task.due_date && isToday(new Date(task.due_date));

              return (
                <div 
                  key={task.id} 
                  className={`p-3 hover:bg-muted/50 transition-colors ${
                    task.status !== 'pending' ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${
                      isOverdue ? 'bg-destructive/20' : 'bg-muted'
                    }`}>
                      <Icon className={`h-4 w-4 ${
                        isOverdue ? 'text-destructive' : 'text-muted-foreground'
                      }`} />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-sm font-medium ${
                          task.status !== 'pending' ? 'line-through' : ''
                        }`}>
                          {task.title}
                        </span>
                        <Badge className={`text-xs ${statusColors[task.status]}`}>
                          {taskTypeLabels[task.type]}
                        </Badge>
                      </div>
                      
                      {task.description && (
                        <p className="text-xs text-muted-foreground mb-1 line-clamp-2">
                          {task.description}
                        </p>
                      )}
                      
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {task.due_date && (
                          <span className={`flex items-center gap-1 ${
                            isOverdue ? 'text-destructive font-medium' : 
                            isDueToday ? 'text-yellow-600 font-medium' : ''
                          }`}>
                            {isOverdue && <AlertCircle className="h-3 w-3" />}
                            <Clock className="h-3 w-3" />
                            {format(new Date(task.due_date), "dd/MM 'às' HH:mm", { locale: ptBR })}
                          </span>
                        )}
                        {task.completed_at && (
                          <span className="flex items-center gap-1 text-green-600">
                            <Check className="h-3 w-3" />
                            Concluída {format(new Date(task.completed_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                          </span>
                        )}
                      </div>
                    </div>

                    {task.status === 'pending' && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleComplete(task.id)}>
                            <Check className="h-4 w-4 mr-2 text-green-600" />
                            Concluir
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleCancel(task.id)}>
                            <X className="h-4 w-4 mr-2 text-destructive" />
                            Cancelar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>

      <CreateTaskDialog 
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        dealId={dealId}
        originId={originId}
        stageId={stageId}
        ownerId={ownerId}
      />
    </div>
  );
}
