import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  Copy, 
  Pencil, 
  Trash2, 
  MoreHorizontal,
  ExternalLink,
  Check,
  Download
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
import { 
  useWebhookEndpoints, 
  useDeleteWebhookEndpoint, 
  useToggleWebhookEndpoint,
  getWebhookUrl 
} from '@/hooks/useWebhookEndpoints';
import { IncomingWebhookFormDialog } from './IncomingWebhookFormDialog';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface IncomingWebhookEditorProps {
  originId: string;
}

export const IncomingWebhookEditor = ({ originId }: IncomingWebhookEditorProps) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEndpoint, setEditingEndpoint] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [endpointToDelete, setEndpointToDelete] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: endpoints, isLoading } = useWebhookEndpoints(originId);
  const deleteMutation = useDeleteWebhookEndpoint();
  const toggleMutation = useToggleWebhookEndpoint();

  const handleCopyUrl = async (slug: string, id: string) => {
    const url = getWebhookUrl(slug);
    await navigator.clipboard.writeText(url);
    setCopiedId(id);
    toast.success('URL copiada!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleEdit = (id: string) => {
    setEditingEndpoint(id);
    setIsFormOpen(true);
  };

  const handleDelete = (id: string) => {
    setEndpointToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (endpointToDelete) {
      deleteMutation.mutate(endpointToDelete);
      setDeleteDialogOpen(false);
      setEndpointToDelete(null);
    }
  };

  const handleToggle = (id: string, currentStatus: boolean) => {
    toggleMutation.mutate({ id, is_active: !currentStatus });
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setEditingEndpoint(null);
  };

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Carregando...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Receba leads de formulários externos configurando URLs de webhook.
          </p>
        </div>
        <Button onClick={() => setIsFormOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Novo Webhook
        </Button>
      </div>

      {endpoints && endpoints.length === 0 ? (
        <div className="text-center py-8 border rounded-lg border-dashed">
          <Download className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            Nenhum webhook de entrada configurado.
          </p>
          <Button 
            variant="outline" 
            size="sm" 
            className="mt-3"
            onClick={() => setIsFormOpen(true)}
          >
            <Plus className="h-4 w-4 mr-1" />
            Criar primeiro webhook
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {endpoints?.map((endpoint) => (
            <div
              key={endpoint.id}
              className="flex items-start gap-3 p-4 border rounded-lg bg-card"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-medium truncate">{endpoint.name}</h4>
                  <Badge variant={endpoint.is_active ? 'default' : 'secondary'}>
                    {endpoint.is_active ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>
                
                <div className="flex items-center gap-2 mb-2">
                  <code className="text-xs bg-muted px-2 py-1 rounded truncate max-w-md">
                    {getWebhookUrl(endpoint.slug)}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => handleCopyUrl(endpoint.slug, endpoint.id)}
                  >
                    {copiedId === endpoint.id ? (
                      <Check className="h-3 w-3 text-green-500" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </div>

                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  {endpoint.auto_tags?.length > 0 && (
                    <span>
                      Tags: {endpoint.auto_tags.join(', ')}
                    </span>
                  )}
                  <span>{endpoint.leads_received} leads recebidos</span>
                  {endpoint.last_lead_at && (
                    <span>
                      Último: {formatDistanceToNow(new Date(endpoint.last_lead_at), { 
                        addSuffix: true, 
                        locale: ptBR 
                      })}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={endpoint.is_active}
                  onCheckedChange={() => handleToggle(endpoint.id, endpoint.is_active)}
                />
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleEdit(endpoint.id)}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleCopyUrl(endpoint.slug, endpoint.id)}>
                      <Copy className="h-4 w-4 mr-2" />
                      Copiar URL
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => window.open(getWebhookUrl(endpoint.slug), '_blank')}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Testar URL
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => handleDelete(endpoint.id)}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      )}

      <IncomingWebhookFormDialog
        open={isFormOpen}
        onOpenChange={handleFormClose}
        originId={originId}
        endpointId={editingEndpoint}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir webhook?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O webhook será removido e não receberá mais leads.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
