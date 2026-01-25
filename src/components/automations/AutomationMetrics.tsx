import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Send, 
  CheckCircle2, 
  Eye, 
  XCircle,
  MessageCircle,
  Mail,
  Clock,
  TrendingUp
} from "lucide-react";
import { useAutomationMetrics, useQueueStatus } from "@/hooks/useAutomationLogs";

export function AutomationMetrics() {
  const { data: metrics, isLoading } = useAutomationMetrics('week');
  const { data: queueStatus } = useQueueStatus();

  if (isLoading || !metrics) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="h-4 w-20 bg-muted animate-pulse rounded" />
              <div className="h-4 w-4 bg-muted animate-pulse rounded" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-16 bg-muted animate-pulse rounded mb-1" />
              <div className="h-3 w-24 bg-muted animate-pulse rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Enviados</CardTitle>
          <Send className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{metrics.total_sent}</div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <MessageCircle className="h-3 w-3" />
            <span>{metrics.whatsapp_count} WhatsApp</span>
            <Mail className="h-3 w-3 ml-1" />
            <span>{metrics.email_count} Email</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Taxa de Entrega</CardTitle>
          <CheckCircle2 className="h-4 w-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{metrics.delivery_rate}%</div>
          <p className="text-xs text-muted-foreground">
            {metrics.total_delivered} de {metrics.total_sent} entregues
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Taxa de Leitura</CardTitle>
          <Eye className="h-4 w-4 text-blue-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{metrics.read_rate}%</div>
          <p className="text-xs text-muted-foreground">
            {metrics.total_read} mensagens lidas
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Na Fila</CardTitle>
          <Clock className="h-4 w-4 text-orange-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{queueStatus?.pending_count || 0}</div>
          <p className="text-xs text-muted-foreground">
            {metrics.total_failed > 0 && (
              <span className="text-destructive">{metrics.total_failed} falhas</span>
            )}
            {metrics.total_failed === 0 && "Aguardando processamento"}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
