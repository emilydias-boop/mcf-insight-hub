import { useState } from 'react';
import { format, isPast, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Phone, Mail, Calendar, MessageSquare, MoreHorizontal,
  Clock, Plus, AlertCircle, CheckSquare
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { useDealTasks, useCompleteDealTask, useCancelDealTask, DealTask, TaskType } from '@/hooks/useDealTasks';
import { useAuth } from '@/contexts/AuthContext';
import { CreateTaskDialog } from './CreateTaskDialog';
import { TaskDetailPanel } from './TaskDetailPanel';
import { cn } from '@/lib/utils';

const taskTypeIcons: Record<TaskType, React.ElementType> = {
  call: Phone,
  email: Mail,
  meeting: Calendar,
  whatsapp: MessageSquare,
  other: MoreHorizontal,
};

const taskTypeColors: Record<TaskType, string> = {
  call: 'text-blue-500',
  email: 'text-orange-500',
  meeting: 'text-purple-500',
  whatsapp: 'text-green-500',
  other: 'text-muted-foreground',
};

interface DealTasksSectionProps {
  dealId: string;
  originId?: string;
  stageId?: string;
  ownerId?: string;
  contactPhone?: string | null;
  contactEmail?: string | null;
  contactName?: string | null;
}

export function DealTasksSection({ 
  dealId, 
  originId, 
  stageId, 
  ownerId,
  contactPhone,
  contactEmail,
  contactName,
}: DealTasksSectionProps) {
  const { user } = useAuth();
  const { data: tasks, isLoading } = useDealTasks(dealId);
  const completeTask = useCompleteDealTask();
  const cancelTask = useCancelDealTask();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('pending');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

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

  const selectedTask = tasks?.find(t => t.id === selectedTaskId) || null;

  const handleComplete = (taskId: string) => {
    if (!user?.id) return;
    completeTask.mutate({ id: taskId, dealId, userId: user.id });
    if (selectedTaskId === taskId) {
      setSelectedTaskId(null);
    }
  };

  const handleCancel = (taskId: string) => {
    cancelTask.mutate({ id: taskId, dealId });
    if (selectedTaskId === taskId) {
      setSelectedTaskId(null);
    }
  };

  const handleCheckboxChange = (taskId: string, checked: boolean) => {
    if (checked && user?.id) {
      handleComplete(taskId);
    }
  };

  if (isLoading) {
    return <div className="p-4 text-center text-muted-foreground text-sm">Carregando atividades...</div>;
  }

  return (
    <div className="flex h-full">
      {/* Left Panel - Task List */}
      <div className="w-2/5 border-r flex flex-col">
        {/* Header */}
        <div className="p-3 border-b space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckSquare className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Atividades</span>
              {pendingCount > 0 && (
                <Badge variant="secondary" className="text-xs">{pendingCount}</Badge>
              )}
              {overdueCount > 0 && (
                <Badge variant="destructive" className="text-xs">{overdueCount} atrasadas</Badge>
              )}
            </div>
            <Button size="sm" variant="ghost" className="h-7" onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-3 w-3" />
            </Button>
          </div>
          
          {/* Filters */}
          <div className="flex gap-1">
            <Button
              variant={filter === 'pending' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-6 text-xs flex-1"
              onClick={() => setFilter('pending')}
            >
              Pendentes
            </Button>
            <Button
              variant={filter === 'completed' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-6 text-xs flex-1"
              onClick={() => setFilter('completed')}
            >
              Concluídas
            </Button>
            <Button
              variant={filter === 'all' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-6 text-xs flex-1"
              onClick={() => setFilter('all')}
            >
              Todas
            </Button>
          </div>
        </div>

        {/* Task List */}
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
                const isSelected = selectedTaskId === task.id;

                return (
                  <div 
                    key={task.id} 
                    className={cn(
                      "p-3 cursor-pointer transition-colors",
                      isSelected ? "bg-accent" : "hover:bg-muted/50",
                      task.status !== 'pending' && "opacity-60"
                    )}
                    onClick={() => setSelectedTaskId(task.id)}
                  >
                    <div className="flex items-start gap-3">
                      {/* Checkbox */}
                      {task.status === 'pending' && (
                        <Checkbox
                          checked={false}
                          onCheckedChange={(checked) => handleCheckboxChange(task.id, checked as boolean)}
                          onClick={(e) => e.stopPropagation()}
                          className="mt-0.5 h-5 w-5"
                        />
                      )}
                      {task.status !== 'pending' && (
                        <div className="h-5 w-5 flex items-center justify-center">
                          <div className={cn(
                            "h-3 w-3 rounded-full",
                            task.status === 'done' ? "bg-green-500" : "bg-muted-foreground"
                          )} />
                        </div>
                      )}

                      {/* Icon */}
                      <Icon className={cn("h-4 w-4 mt-0.5", taskTypeColors[task.type])} />
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <span className={cn(
                          "text-sm font-medium block truncate",
                          task.status !== 'pending' && "line-through"
                        )}>
                          {task.title}
                        </span>
                        
                        {task.due_date && (
                          <span className={cn(
                            "flex items-center gap-1 text-xs mt-0.5",
                            isOverdue ? "text-destructive font-medium" : 
                            isDueToday ? "text-yellow-600" : "text-muted-foreground"
                          )}>
                            {isOverdue && <AlertCircle className="h-3 w-3" />}
                            <Clock className="h-3 w-3" />
                            {format(new Date(task.due_date), "dd/MM 'às' HH:mm", { locale: ptBR })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Right Panel - Task Detail */}
      <div className="w-3/5 flex flex-col">
        <TaskDetailPanel
          task={selectedTask}
          contactPhone={contactPhone}
          contactEmail={contactEmail}
          contactName={contactName}
          onComplete={() => selectedTaskId && handleComplete(selectedTaskId)}
          onCancel={() => selectedTaskId && handleCancel(selectedTaskId)}
        />
      </div>

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
