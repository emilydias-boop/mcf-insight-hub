import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import {
  useMoveWebhookEndpoint,
  useCopyWebhookToOrigin,
  type WebhookEndpoint,
} from '@/hooks/useWebhookEndpoints';

interface MoveWebhookDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'move' | 'copy';
  endpoint: WebhookEndpoint | null;
  currentOriginId: string;
}

export const MoveWebhookDialog = ({
  open,
  onOpenChange,
  mode,
  endpoint,
  currentOriginId,
}: MoveWebhookDialogProps) => {
  const [selectedOriginId, setSelectedOriginId] = useState<string>('');

  const moveMutation = useMoveWebhookEndpoint();
  const copyMutation = useCopyWebhookToOrigin();

  const { data: origins, isLoading } = useQuery({
    queryKey: ['crm-origins-for-webhook-move'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_origins')
        .select('id, name, is_archived')
        .order('name');
      if (error) throw error;
      return (data || []).filter(
        (o) => o.is_archived !== true && o.id !== currentOriginId
      );
    },
    enabled: open,
  });

  const isPending = moveMutation.isPending || copyMutation.isPending;

  const handleConfirm = () => {
    if (!selectedOriginId || !endpoint) return;

    if (mode === 'move') {
      moveMutation.mutate(
        { id: endpoint.id, newOriginId: selectedOriginId },
        { onSuccess: () => { onOpenChange(false); setSelectedOriginId(''); } }
      );
    } else {
      copyMutation.mutate(
        { endpoint, newOriginId: selectedOriginId },
        { onSuccess: () => { onOpenChange(false); setSelectedOriginId(''); } }
      );
    }
  };

  const title = mode === 'move' ? 'Mover Webhook para Pipeline' : 'Copiar Webhook para Pipeline';
  const description =
    mode === 'move'
      ? 'O webhook será movido e deixará de funcionar nesta pipeline.'
      : 'Uma cópia do webhook será criada na pipeline selecionada (com novo slug).';
  const confirmLabel = mode === 'move' ? 'Mover' : 'Copiar';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Carregando pipelines...</span>
            </div>
          ) : (
            <Select value={selectedOriginId} onValueChange={setSelectedOriginId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a pipeline de destino" />
              </SelectTrigger>
              <SelectContent>
                {origins?.map((origin) => (
                  <SelectItem key={origin.id} value={origin.id}>
                    {origin.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!selectedOriginId || isPending}>
            {isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
