import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useWebhookHistoryByEmail } from '@/hooks/useWebhookHistory';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Webhook, CheckCircle, XCircle, Clock } from 'lucide-react';

interface Props {
  email: string | null;
  open: boolean;
  onClose: () => void;
}

export function WebhookHistoryDrawer({ email, open, onClose }: Props) {
  const { data: events, isLoading } = useWebhookHistoryByEmail(email);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'processed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'processed':
        return 'default' as const;
      case 'failed':
        return 'destructive' as const;
      default:
        return 'secondary' as const;
    }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-[500px] sm:max-w-[500px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Webhook className="h-5 w-5" />
            Histórico de Webhooks
          </SheetTitle>
          {email && (
            <p className="text-sm text-muted-foreground">{email}</p>
          )}
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)] mt-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : !events?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum evento de webhook encontrado para este email.
            </div>
          ) : (
            <div className="space-y-3 pr-4">
              {events.map(event => (
                <div
                  key={event.id}
                  className="border rounded-lg p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(event.status)}
                      <Badge variant={getStatusVariant(event.status)}>
                        {event.status}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(event.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                    </span>
                  </div>

                  <div className="text-sm">
                    <span className="font-medium">Tipo:</span>{' '}
                    <code className="text-xs bg-muted px-1 py-0.5 rounded">
                      {event.event_type}
                    </code>
                  </div>

                  {event.error_message && (
                    <div className="text-sm text-destructive">
                      <span className="font-medium">Erro:</span> {event.error_message}
                    </div>
                  )}

                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                      Ver dados completos
                    </summary>
                    <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto max-h-48">
                      {JSON.stringify(event.event_data, null, 2)}
                    </pre>
                  </details>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
