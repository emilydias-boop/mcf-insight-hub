import React from 'react';
import { useEncaixeQueue, useUpdateEncaixeStatus, useRemoveFromEncaixeQueue, EncaixeQueueItem } from '@/hooks/useEncaixeQueue';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Clock, User, Calendar, Phone, Mail, Trash2, CheckCircle, Bell, AlertCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';

interface EncaixeQueuePanelProps {
  closerId?: string;
  date?: Date;
  onScheduleFromQueue?: (item: EncaixeQueueItem) => void;
  compact?: boolean;
}

const priorityConfig = {
  1: { label: 'Alta', color: 'bg-red-100 text-red-700 border-red-200' },
  2: { label: 'Média', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  3: { label: 'Baixa', color: 'bg-green-100 text-green-700 border-green-200' },
};

const statusConfig = {
  waiting: { label: 'Aguardando', color: 'bg-blue-100 text-blue-700' },
  notified: { label: 'Notificado', color: 'bg-purple-100 text-purple-700' },
  scheduled: { label: 'Agendado', color: 'bg-green-100 text-green-700' },
  expired: { label: 'Expirado', color: 'bg-gray-100 text-gray-700' },
  canceled: { label: 'Cancelado', color: 'bg-red-100 text-red-700' },
};

export function EncaixeQueuePanel({
  closerId,
  date,
  onScheduleFromQueue,
  compact = false,
}: EncaixeQueuePanelProps) {
  const { data: queueItems, isLoading, error } = useEncaixeQueue(closerId, date);
  const updateStatus = useUpdateEncaixeStatus();
  const removeFromQueue = useRemoveFromEncaixeQueue();

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Fila de Encaixe
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-2 text-destructive text-sm">
            <AlertCircle className="h-4 w-4" />
            Erro ao carregar fila de encaixe
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!queueItems || queueItems.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Fila de Encaixe
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum lead aguardando encaixe
          </p>
        </CardContent>
      </Card>
    );
  }

  const handleNotify = (item: EncaixeQueueItem) => {
    updateStatus.mutate({ id: item.id, status: 'notified' });
  };

  const handleCancel = (item: EncaixeQueueItem) => {
    updateStatus.mutate({ id: item.id, status: 'canceled' });
  };

  const handleRemove = (item: EncaixeQueueItem) => {
    removeFromQueue.mutate(item.id);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Fila de Encaixe
          </span>
          <Badge variant="secondary" className="text-xs">
            {queueItems.length} aguardando
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className={compact ? 'h-[200px]' : 'h-[300px]'}>
          <div className="space-y-2 p-4 pt-0">
            {queueItems.map((item) => {
              const contact = item.deal?.contact;
              const priority = priorityConfig[item.priority as 1 | 2 | 3] || priorityConfig[2];
              const status = statusConfig[item.status] || statusConfig.waiting;

              return (
                <div
                  key={item.id}
                  className={`p-3 rounded-lg border ${priority.color} space-y-2`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <User className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        <span className="font-medium text-sm truncate">
                          {contact?.name || item.deal?.name || 'Lead'}
                        </span>
                        <Badge variant="outline" className={`text-xs ${status.color}`}>
                          {status.label}
                        </Badge>
                      </div>

                      {!compact && (
                        <div className="mt-1.5 space-y-1 text-xs text-muted-foreground">
                          {contact?.phone && (
                            <div className="flex items-center gap-1.5">
                              <Phone className="h-3 w-3" />
                              <span>{contact.phone}</span>
                            </div>
                          )}
                          {contact?.email && (
                            <div className="flex items-center gap-1.5">
                              <Mail className="h-3 w-3" />
                              <span className="truncate">{contact.email}</span>
                            </div>
                          )}
                          {(item.preferred_time_start || item.preferred_time_end) && (
                            <div className="flex items-center gap-1.5">
                              <Clock className="h-3 w-3" />
                              <span>
                                Preferência: {item.preferred_time_start || '?'} - {item.preferred_time_end || '?'}
                              </span>
                            </div>
                          )}
                          {item.notes && (
                            <p className="text-muted-foreground/80 italic">
                              "{item.notes}"
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <Badge variant="outline" className="text-xs">
                        Lead {item.lead_type}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 pt-1">
                    <TooltipProvider>
                      {onScheduleFromQueue && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="default"
                              className="h-7 text-xs gap-1"
                              onClick={() => onScheduleFromQueue(item)}
                            >
                              <CheckCircle className="h-3 w-3" />
                              Encaixar
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Agendar este lead no próximo slot disponível</TooltipContent>
                        </Tooltip>
                      )}

                      {item.status === 'waiting' && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs gap-1"
                              onClick={() => handleNotify(item)}
                              disabled={updateStatus.isPending}
                            >
                              <Bell className="h-3 w-3" />
                              Notificar
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Marcar como notificado</TooltipContent>
                        </Tooltip>
                      )}

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                            onClick={() => handleCancel(item)}
                            disabled={updateStatus.isPending}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Remover da fila</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
