import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  useOutboundWebhooks,
  useDeleteOutboundWebhook,
  useToggleOutboundWebhook,
  useTestOutboundWebhook,
  OutboundWebhookConfig,
} from '@/hooks/useOutboundWebhooks';
import { Plus, Pencil, Trash2, Send, History, AlertCircle, CheckCircle2 } from 'lucide-react';
import { OutboundWebhookFormDialog } from './OutboundWebhookFormDialog';
import { OutboundWebhookLogsDrawer } from './OutboundWebhookLogsDrawer';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

export function OutboundWebhookList() {
  const { data: webhooks, isLoading } = useOutboundWebhooks();
  const del = useDeleteOutboundWebhook();
  const toggle = useToggleOutboundWebhook();
  const test = useTestOutboundWebhook();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<OutboundWebhookConfig | null>(null);
  const [logsConfigId, setLogsConfigId] = useState<string | null>(null);
  const [logsConfigName, setLogsConfigName] = useState<string>('');
  const [confirmDelete, setConfirmDelete] = useState<OutboundWebhookConfig | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Webhooks de Saída</h2>
          <p className="text-sm text-muted-foreground">
            Disparam para URLs externas quando uma venda é registrada/atualizada (Hubla, Kiwify, MCFPay, Asaas, Make, Manual).
          </p>
        </div>
        <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Novo Webhook
        </Button>
      </div>

      {isLoading && <div className="text-sm text-muted-foreground">Carregando...</div>}
      {!isLoading && (webhooks?.length ?? 0) === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhum webhook de saída configurado. Clique em "Novo Webhook" para criar.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3">
        {webhooks?.map((wh) => (
          <Card key={wh.id} className={wh.is_active ? '' : 'opacity-60'}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base flex items-center gap-2">
                    {wh.name}
                    {wh.last_error ? (
                      <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" /> Último: erro</Badge>
                    ) : wh.last_triggered_at ? (
                      <Badge variant="default" className="gap-1"><CheckCircle2 className="h-3 w-3" /> OK</Badge>
                    ) : null}
                  </CardTitle>
                  {wh.description && <p className="text-xs text-muted-foreground mt-1">{wh.description}</p>}
                  <p className="text-xs font-mono text-muted-foreground mt-1 truncate">{wh.method} {wh.url}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Switch
                    checked={wh.is_active}
                    onCheckedChange={(v) => toggle.mutate({ id: wh.id, is_active: v })}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <div className="flex flex-wrap gap-1">
                {wh.events.map((e) => <Badge key={e} variant="secondary" className="text-xs">{e}</Badge>)}
                {wh.sources.map((s) => <Badge key={s} variant="outline" className="text-xs">{s}</Badge>)}
              </div>
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div>
                  <div className="text-muted-foreground">Sucessos</div>
                  <div className="font-semibold text-success">{wh.success_count}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Erros</div>
                  <div className="font-semibold text-destructive">{wh.error_count}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Último disparo</div>
                  <div className="font-medium">
                    {wh.last_triggered_at ? format(new Date(wh.last_triggered_at), "dd/MM HH:mm", { locale: ptBR }) : '—'}
                  </div>
                </div>
              </div>
              {wh.last_error && (
                <div className="text-xs text-destructive bg-destructive/5 p-2 rounded truncate">
                  {wh.last_error}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => test.mutate(wh.id)} disabled={test.isPending}>
                  <Send className="h-3 w-3 mr-1" /> Testar
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setLogsConfigId(wh.id); setLogsConfigName(wh.name); }}>
                  <History className="h-3 w-3 mr-1" /> Logs
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setEditing(wh); setFormOpen(true); }}>
                  <Pencil className="h-3 w-3 mr-1" /> Editar
                </Button>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setConfirmDelete(wh)}>
                  <Trash2 className="h-3 w-3 mr-1" /> Excluir
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <OutboundWebhookFormDialog open={formOpen} onOpenChange={setFormOpen} webhook={editing} />
      <OutboundWebhookLogsDrawer
        open={!!logsConfigId}
        onOpenChange={(v) => { if (!v) setLogsConfigId(null); }}
        configId={logsConfigId}
        configName={logsConfigName}
      />

      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => { if (!v) setConfirmDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir webhook?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O webhook "{confirmDelete?.name}" será removido permanentemente, junto com todos os seus logs.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={() => { if (confirmDelete) del.mutate(confirmDelete.id); setConfirmDelete(null); }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}