import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useWebhookLogs, useWebhookStats, useReprocessWebhook } from "@/hooks/useWebhookLogs";
import { Webhook, CheckCircle2, AlertCircle, Clock, RefreshCw, TrendingUp, Activity } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

const statusConfig = {
  success: { label: 'Sucesso', icon: CheckCircle2, color: 'bg-green-500', variant: 'default' as const },
  error: { label: 'Erro', icon: AlertCircle, color: 'bg-destructive', variant: 'destructive' as const },
  pending: { label: 'Pendente', icon: Clock, color: 'bg-muted', variant: 'secondary' as const },
  processing: { label: 'Processando', icon: RefreshCw, color: 'bg-blue-500', variant: 'default' as const }
};

const eventTypeLabels: Record<string, string> = {
  'contact.created': 'Contato Criado',
  'contact.updated': 'Contato Atualizado',
  'contact.deleted': 'Contato Deletado',
  'deal.created': 'Deal Criado',
  'deal.updated': 'Deal Atualizado',
  'deal.stage_changed': 'Estágio Alterado',
  'deal.deleted': 'Deal Deletado',
  'origin.created': 'Origem Criada',
  'origin.updated': 'Origem Atualizada',
  'stage.created': 'Estágio Criado',
  'stage.updated': 'Estágio Atualizado'
};

export function WebhookMonitor() {
  const [showDetails, setShowDetails] = useState(false);
  const { data: stats, isLoading: statsLoading } = useWebhookStats();
  const { data: logs, isLoading: logsLoading } = useWebhookLogs(20);
  const reprocessMutation = useReprocessWebhook();

  if (statsLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="h-5 w-5" />
            Webhooks do Clint
          </CardTitle>
          <CardDescription>Carregando...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Webhook className="h-5 w-5" />
              Webhooks do Clint CRM
            </CardTitle>
            <CardDescription>
              Sincronização em tempo real via webhooks
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDetails(!showDetails)}
          >
            {showDetails ? 'Ocultar Detalhes' : 'Ver Detalhes'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 border rounded-lg bg-card">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Total Hoje</span>
            </div>
            <p className="text-2xl font-bold">{stats?.totalToday || 0}</p>
          </div>
          
          <div className="p-4 border rounded-lg bg-card">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-xs text-muted-foreground">Sucesso</span>
            </div>
            <p className="text-2xl font-bold text-green-600">{stats?.successToday || 0}</p>
          </div>

          <div className="p-4 border rounded-lg bg-card">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <span className="text-xs text-muted-foreground">Erros</span>
            </div>
            <p className="text-2xl font-bold text-destructive">{stats?.errorsToday || 0}</p>
          </div>

          <div className="p-4 border rounded-lg bg-card">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              <span className="text-xs text-muted-foreground">Taxa de Sucesso</span>
            </div>
            <p className="text-2xl font-bold text-blue-600">{stats?.successRate || 0}%</p>
          </div>
        </div>

        {/* URL do Webhook */}
        <div className="p-4 border rounded-lg bg-muted/50">
          <p className="text-sm font-medium mb-2">URL do Webhook para Configurar no Clint:</p>
          <code className="text-xs bg-background p-2 rounded block break-all">
            https://rehcfgqvigfcekiipqkc.supabase.co/functions/v1/clint-webhook-handler
          </code>
          <p className="text-xs text-muted-foreground mt-2">
            Configure esta URL no painel administrativo do Clint para receber eventos em tempo real.
          </p>
        </div>

        {/* Último Webhook */}
        {stats?.lastWebhook && (
          <div className="p-4 border rounded-lg bg-card">
            <h3 className="text-sm font-semibold mb-3">Último Webhook Recebido</h3>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">
                  {eventTypeLabels[stats.lastWebhook.event_type] || stats.lastWebhook.event_type}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(stats.lastWebhook.created_at), { 
                    addSuffix: true, 
                    locale: ptBR 
                  })}
                </p>
              </div>
              <Badge variant={statusConfig[stats.lastWebhook.status].variant}>
                {statusConfig[stats.lastWebhook.status].label}
              </Badge>
            </div>
          </div>
        )}

        {/* Eventos por Tipo */}
        {stats?.eventTypeCounts && Object.keys(stats.eventTypeCounts).length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Eventos (Últimos 7 dias)</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {Object.entries(stats.eventTypeCounts).map(([type, count]) => (
                <div key={type} className="p-3 border rounded-lg bg-card">
                  <p className="text-xs text-muted-foreground mb-1">
                    {eventTypeLabels[type] || type}
                  </p>
                  <p className="text-lg font-bold">{count}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Lista Detalhada de Webhooks */}
        {showDetails && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Últimos 20 Webhooks</h3>
            {logsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : logs && logs.length > 0 ? (
              <div className="space-y-2">
                {logs.map((log) => {
                  const config = statusConfig[log.status];
                  const Icon = config.icon;

                  return (
                    <div key={log.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`h-2 w-2 rounded-full ${config.color}`} />
                        <div>
                          <p className="text-sm font-medium">
                            {eventTypeLabels[log.event_type] || log.event_type}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(log.created_at), { 
                              addSuffix: true, 
                              locale: ptBR 
                            })}
                            {log.processing_time_ms && ` • ${log.processing_time_ms}ms`}
                          </p>
                          {log.error_message && (
                            <p className="text-xs text-destructive mt-1">{log.error_message}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={config.variant} className="gap-1">
                          <Icon className="h-3 w-3" />
                          {config.label}
                        </Badge>
                        {log.status === 'error' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => reprocessMutation.mutate(log.id)}
                            disabled={reprocessMutation.isPending}
                          >
                            <RefreshCw className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Webhook className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Nenhum webhook recebido ainda</p>
                <p className="text-xs mt-1">Configure a URL no painel do Clint para começar</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
