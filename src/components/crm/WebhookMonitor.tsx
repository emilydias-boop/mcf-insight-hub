import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useWebhookStats } from "@/hooks/useWebhookLogs";
import { Activity, CheckCircle2, ArrowRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";

const eventTypeLabels: Record<string, string> = {
  'contact.created': 'Contato Criado',
  'contact.updated': 'Contato Atualizado',
  'deal.created': 'Deal Criado',
  'deal.updated': 'Deal Atualizado',
  'deal.stage_changed': 'Estágio Alterado',
};

export function WebhookMonitor() {
  const { data: stats, isLoading } = useWebhookStats();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Movimentações de Leads
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Movimentações de Leads
        </CardTitle>
        <CardDescription>
          Acompanhamento em tempo real das entradas e movimentações
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Último Deal Recebido */}
        {stats?.lastWebhook ? (
          <div className="p-4 border rounded-lg bg-muted/30">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">Último Deal Recebido</h3>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <ArrowRight className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">
                    {eventTypeLabels[stats.lastWebhook.event_type] || stats.lastWebhook.event_type}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(stats.lastWebhook.created_at), { 
                      addSuffix: true, 
                      locale: ptBR 
                    })}
                  </p>
                </div>
              </div>
              <Badge variant="default" className="gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Processado
              </Badge>
            </div>
          </div>
        ) : (
          <div className="p-4 border rounded-lg bg-muted/30 text-center">
            <p className="text-muted-foreground">Nenhuma movimentação recebida ainda</p>
          </div>
        )}

        {/* Movimentações Hoje */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Movimentações Hoje</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {stats?.eventTypeCounts && Object.keys(stats.eventTypeCounts).length > 0 ? (
              Object.entries(stats.eventTypeCounts)
                .filter(([type]) => ['deal.stage_changed', 'deal.created', 'contact.created', 'deal.updated'].includes(type))
                .map(([type, count]) => (
                  <div key={type} className="p-4 border rounded-lg bg-card text-center">
                    <p className="text-xs text-muted-foreground mb-1">
                      {eventTypeLabels[type] || type}
                    </p>
                    <p className="text-2xl font-bold">{count}</p>
                  </div>
                ))
            ) : (
              <>
                <div className="p-4 border rounded-lg bg-card text-center">
                  <p className="text-xs text-muted-foreground mb-1">Estágio Alterado</p>
                  <p className="text-2xl font-bold">0</p>
                </div>
                <div className="p-4 border rounded-lg bg-card text-center">
                  <p className="text-xs text-muted-foreground mb-1">Deal Criado</p>
                  <p className="text-2xl font-bold">0</p>
                </div>
                <div className="p-4 border rounded-lg bg-card text-center">
                  <p className="text-xs text-muted-foreground mb-1">Contato Criado</p>
                  <p className="text-2xl font-bold">0</p>
                </div>
                <div className="p-4 border rounded-lg bg-card text-center">
                  <p className="text-xs text-muted-foreground mb-1">Deal Atualizado</p>
                  <p className="text-2xl font-bold">0</p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Total do dia */}
        <div className="flex items-center justify-between p-3 border rounded-lg bg-primary/5">
          <span className="text-sm font-medium">Total de movimentações hoje</span>
          <Badge variant="secondary" className="text-lg px-3 py-1">
            {stats?.totalToday || 0}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
