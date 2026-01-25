import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  useWebhookConfigs, 
  useToggleWebhookConfig, 
  useDeleteWebhookConfig,
  WEBHOOK_EVENTS,
  WebhookConfig
} from '@/hooks/useWebhookConfigs';
import { WebhookFormDialog } from './WebhookFormDialog';
import { 
  Plus, 
  Pencil, 
  Trash2, 
  Webhook, 
  CheckCircle2, 
  XCircle,
  MoreHorizontal,
  ExternalLink
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface WebhookConfigEditorProps {
  originId?: string | null;
}

export function WebhookConfigEditor({ originId }: WebhookConfigEditorProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<WebhookConfig | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const { data: webhooks, isLoading } = useWebhookConfigs(originId);
  const toggleMutation = useToggleWebhookConfig();
  const deleteMutation = useDeleteWebhookConfig();

  const handleEdit = (webhook: WebhookConfig) => {
    setEditingWebhook(webhook);
    setFormOpen(true);
  };

  const handleCreate = () => {
    setEditingWebhook(null);
    setFormOpen(true);
  };

  const handleDelete = async () => {
    if (deleteConfirmId) {
      await deleteMutation.mutateAsync(deleteConfirmId);
      setDeleteConfirmId(null);
    }
  };

  const getEventLabel = (eventValue: string) => {
    return WEBHOOK_EVENTS.find(e => e.value === eventValue)?.label || eventValue;
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-9 w-32" />
        </div>
        {[1, 2].map(i => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="font-medium">Webhooks Configurados</h3>
          <p className="text-sm text-muted-foreground">
            Configure webhooks para enviar dados para sistemas externos
          </p>
        </div>
        <Button onClick={handleCreate} size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Webhook
        </Button>
      </div>

      {webhooks && webhooks.length === 0 ? (
        <div className="border border-dashed rounded-lg p-8 text-center">
          <Webhook className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h4 className="font-medium mb-2">Nenhum webhook configurado</h4>
          <p className="text-sm text-muted-foreground mb-4">
            Webhooks permitem enviar dados automaticamente para URLs externas quando eventos ocorrem.
          </p>
          <Button onClick={handleCreate} variant="outline" className="gap-2">
            <Plus className="h-4 w-4" />
            Criar primeiro webhook
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {webhooks?.map((webhook) => (
            <div
              key={webhook.id}
              className="border rounded-lg p-4 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium truncate">{webhook.name}</h4>
                    <Badge variant={webhook.is_active ? 'default' : 'secondary'}>
                      {webhook.is_active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </div>
                  
                  {webhook.description && (
                    <p className="text-sm text-muted-foreground mb-2">
                      {webhook.description}
                    </p>
                  )}

                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                    <Badge variant="outline" className="text-xs">
                      {webhook.method}
                    </Badge>
                    <span className="truncate max-w-[300px]">{webhook.url}</span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {webhook.events.map((event) => (
                      <Badge key={event} variant="secondary" className="text-xs">
                        {getEventLabel(event)}
                      </Badge>
                    ))}
                  </div>

                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                      {webhook.success_count} sucesso
                    </span>
                    <span className="flex items-center gap-1">
                      <XCircle className="h-3 w-3 text-destructive" />
                      {webhook.error_count} erros
                    </span>
                    {webhook.last_triggered_at && (
                      <span>
                        Último: {formatDistanceToNow(new Date(webhook.last_triggered_at), { 
                          addSuffix: true, 
                          locale: ptBR 
                        })}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={webhook.is_active}
                    onCheckedChange={(checked) => 
                      toggleMutation.mutate({ id: webhook.id, is_active: checked })
                    }
                  />
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEdit(webhook)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => window.open(webhook.url, '_blank')}
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Abrir URL
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => setDeleteConfirmId(webhook.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <WebhookFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        webhook={editingWebhook}
        originId={originId}
      />

      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir webhook?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O webhook será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
