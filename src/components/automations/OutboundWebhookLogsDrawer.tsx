import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useOutboundWebhookLogs } from '@/hooks/useOutboundWebhooks';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckCircle, XCircle } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  configId: string | null;
  configName?: string;
}

export function OutboundWebhookLogsDrawer({ open, onOpenChange, configId, configName }: Props) {
  const { data: logs, isLoading } = useOutboundWebhookLogs(configId, 100);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[600px] sm:max-w-[600px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Logs — {configName ?? 'Webhook'}</SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-100px)] mt-4">
          {isLoading && <div className="text-sm text-muted-foreground">Carregando...</div>}
          {!isLoading && (logs?.length ?? 0) === 0 && (
            <div className="text-sm text-muted-foreground py-8 text-center">Nenhum disparo registrado ainda.</div>
          )}
          <div className="space-y-3">
            {logs?.map((log) => (
              <div key={log.id} className="border rounded-lg p-3 space-y-2 bg-card">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {log.success ? (
                      <CheckCircle className="h-4 w-4 text-success" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive" />
                    )}
                    <Badge variant="outline">{log.event}</Badge>
                    {log.response_status && (
                      <Badge variant={log.success ? 'default' : 'destructive'}>HTTP {log.response_status}</Badge>
                    )}
                    {log.duration_ms != null && (
                      <span className="text-xs text-muted-foreground">{log.duration_ms}ms</span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(log.created_at), "dd/MM HH:mm:ss", { locale: ptBR })}
                  </span>
                </div>
                {log.error_message && (
                  <div className="text-xs text-destructive bg-destructive/5 p-2 rounded">{log.error_message}</div>
                )}
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Payload</summary>
                  <pre className="mt-1 bg-muted p-2 rounded overflow-x-auto text-[10px]">
                    {JSON.stringify(log.payload, null, 2)}
                  </pre>
                </details>
                {log.response_body && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Resposta</summary>
                    <pre className="mt-1 bg-muted p-2 rounded overflow-x-auto text-[10px]">{log.response_body}</pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}