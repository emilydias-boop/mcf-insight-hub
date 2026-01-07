import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useWebhookLogs, useWebhookStats, useReprocessWebhook, WebhookEvent } from "@/hooks/useWebhookLogs";
import { Activity, CheckCircle2, XCircle, Clock, RefreshCw, Search, AlertTriangle, TrendingUp, Loader2 } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

const eventTypeLabels: Record<string, string> = {
  'contact.created': 'Contato Criado',
  'contact.updated': 'Contato Atualizado',
  'deal.created': 'Deal Criado',
  'deal.updated': 'Deal Atualizado',
  'deal.stage_changed': 'Estágio Alterado',
  'origin.created': 'Origem Criada',
  'origin.updated': 'Origem Atualizada',
  'stage.created': 'Estágio Criado',
  'stage.updated': 'Estágio Atualizado',
};

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }> = {
  success: { label: 'Sucesso', variant: 'default', icon: <CheckCircle2 className="h-3 w-3" /> },
  error: { label: 'Erro', variant: 'destructive', icon: <XCircle className="h-3 w-3" /> },
  pending: { label: 'Pendente', variant: 'secondary', icon: <Clock className="h-3 w-3" /> },
  processing: { label: 'Processando', variant: 'outline', icon: <RefreshCw className="h-3 w-3 animate-spin" /> },
};

export default function Webhooks() {
  const [limit, setLimit] = useState(100);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  
  const { data: logs, isLoading: logsLoading, refetch: refetchLogs } = useWebhookLogs(limit);
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useWebhookStats();
  const reprocessMutation = useReprocessWebhook();

  const handleReprocess = async (webhookId: string) => {
    try {
      await reprocessMutation.mutateAsync(webhookId);
    } catch (error) {
      console.error('Error reprocessing:', error);
    }
  };

  const handleRefresh = () => {
    refetchLogs();
    refetchStats();
    toast.success('Dados atualizados');
  };

  // Filtrar logs
  const filteredLogs = logs?.filter(log => {
    if (statusFilter !== "all" && log.status !== statusFilter) return false;
    if (typeFilter !== "all" && log.event_type !== typeFilter) return false;
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const eventData = JSON.stringify(log.event_data).toLowerCase();
      return eventData.includes(searchLower) || log.event_type.toLowerCase().includes(searchLower);
    }
    return true;
  }) || [];

  const errorCount = logs?.filter(l => l.status === 'error').length || 0;
  const successCount = logs?.filter(l => l.status === 'success').length || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Monitoramento de Webhooks</h1>
          <p className="text-muted-foreground">Acompanhe entradas e movimentações de leads em tempo real</p>
        </div>
        <Button onClick={handleRefresh} variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Atualizar
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Hoje</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2">
              {statsLoading ? <Skeleton className="h-9 w-20" /> : stats?.totalToday || 0}
              <Activity className="h-5 w-5 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Sucesso</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2 text-green-600">
              {statsLoading ? <Skeleton className="h-9 w-20" /> : stats?.successToday || 0}
              <CheckCircle2 className="h-5 w-5" />
            </CardTitle>
          </CardHeader>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Erros</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2 text-destructive">
              {statsLoading ? <Skeleton className="h-9 w-20" /> : stats?.errorsToday || 0}
              <XCircle className="h-5 w-5" />
            </CardTitle>
          </CardHeader>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Taxa de Sucesso</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2">
              {statsLoading ? <Skeleton className="h-9 w-20" /> : `${stats?.successRate || 0}%`}
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Event Types Distribution */}
      {stats?.eventTypeCounts && Object.keys(stats.eventTypeCounts).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Tipos de Eventos (últimos 7 dias)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {Object.entries(stats.eventTypeCounts).map(([type, count]) => (
                <Badge key={type} variant="secondary" className="text-sm py-1 px-3">
                  {eventTypeLabels[type] || type}: <span className="font-bold ml-1">{count}</span>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Search className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="Buscar por email, telefone, nome..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Status</SelectItem>
                <SelectItem value="success">Sucesso</SelectItem>
                <SelectItem value="error">Erro</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="processing">Processando</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Tipos</SelectItem>
                <SelectItem value="deal.stage_changed">Estágio Alterado</SelectItem>
                <SelectItem value="deal.created">Deal Criado</SelectItem>
                <SelectItem value="deal.updated">Deal Atualizado</SelectItem>
                <SelectItem value="contact.created">Contato Criado</SelectItem>
                <SelectItem value="contact.updated">Contato Atualizado</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={limit.toString()} onValueChange={(v) => setLimit(Number(v))}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Limite" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="50">50 registros</SelectItem>
                <SelectItem value="100">100 registros</SelectItem>
                <SelectItem value="200">200 registros</SelectItem>
                <SelectItem value="500">500 registros</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Histórico de Webhooks</span>
            <div className="flex gap-2 text-sm font-normal">
              <Badge variant="default" className="gap-1">
                <CheckCircle2 className="h-3 w-3" /> {successCount}
              </Badge>
              <Badge variant="destructive" className="gap-1">
                <XCircle className="h-3 w-3" /> {errorCount}
              </Badge>
            </div>
          </CardTitle>
          <CardDescription>
            Mostrando {filteredLogs.length} de {logs?.length || 0} registros
          </CardDescription>
        </CardHeader>
        <CardContent>
          {logsLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Tempo</TableHead>
                    <TableHead>Detalhes</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => (
                    <WebhookRow 
                      key={log.id} 
                      log={log} 
                      onReprocess={handleReprocess}
                      isReprocessing={reprocessMutation.isPending}
                    />
                  ))}
                  {filteredLogs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Nenhum webhook encontrado com os filtros aplicados
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function WebhookRow({ 
  log, 
  onReprocess, 
  isReprocessing 
}: { 
  log: WebhookEvent; 
  onReprocess: (id: string) => void;
  isReprocessing: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const status = statusConfig[log.status] || statusConfig.pending;
  
  // Extrair informações úteis do event_data
  const eventData = log.event_data || {};
  const contactName = eventData.contact_name || eventData.contact?.name || '-';
  const contactEmail = eventData.contact_email || eventData.contact?.email || '-';
  const dealName = eventData.deal_name || eventData.name || '-';
  const stageName = eventData.stage_name || eventData.to_stage || '-';

  return (
    <>
      <TableRow 
        className="cursor-pointer hover:bg-muted/50" 
        onClick={() => setExpanded(!expanded)}
      >
        <TableCell className="whitespace-nowrap">
          <div className="flex flex-col">
            <span className="text-sm">{format(new Date(log.created_at), 'dd/MM HH:mm', { locale: ptBR })}</span>
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: ptBR })}
            </span>
          </div>
        </TableCell>
        <TableCell>
          <Badge variant="outline">
            {eventTypeLabels[log.event_type] || log.event_type}
          </Badge>
        </TableCell>
        <TableCell>
          <Badge variant={status.variant} className="gap-1">
            {status.icon}
            {status.label}
          </Badge>
        </TableCell>
        <TableCell>
          {log.processing_time_ms ? `${log.processing_time_ms}ms` : '-'}
        </TableCell>
        <TableCell className="max-w-[300px]">
          <div className="truncate text-sm">
            {log.status === 'error' ? (
              <span className="text-destructive flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {log.error_message?.substring(0, 50) || 'Erro desconhecido'}
              </span>
            ) : (
              <span className="text-muted-foreground">
                {contactName !== '-' ? contactName : dealName}
              </span>
            )}
          </div>
        </TableCell>
        <TableCell className="text-right">
          {log.status === 'error' && (
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                onReprocess(log.id);
              }}
              disabled={isReprocessing}
              className="gap-1"
            >
              {isReprocessing ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
              Reprocessar
            </Button>
          )}
        </TableCell>
      </TableRow>
      
      {expanded && (
        <TableRow>
          <TableCell colSpan={6} className="bg-muted/30 p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
              <div>
                <span className="text-muted-foreground">Contato:</span>
                <p className="font-medium">{contactName}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Email:</span>
                <p className="font-medium">{contactEmail}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Deal:</span>
                <p className="font-medium">{dealName}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Estágio:</span>
                <p className="font-medium">{stageName}</p>
              </div>
            </div>
            
            {log.error_message && (
              <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="text-sm text-destructive font-medium">Erro:</p>
                <p className="text-sm text-destructive/80">{log.error_message}</p>
              </div>
            )}
            
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                Ver payload completo
              </summary>
              <pre className="mt-2 p-3 bg-muted rounded-lg overflow-x-auto max-h-[300px]">
                {JSON.stringify(log.event_data, null, 2)}
              </pre>
            </details>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
