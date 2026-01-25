import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  MessageCircle, 
  Mail, 
  Search,
  Loader2,
  CheckCircle2,
  Clock,
  XCircle,
  Eye,
  Send
} from "lucide-react";
import { useAutomationLogs, AutomationLog, AutomationLogFilters } from "@/hooks/useAutomationLogs";
import { useAutomationFlows } from "@/hooks/useAutomationFlows";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function AutomationLogs() {
  const [filters, setFilters] = useState<AutomationLogFilters>({
    limit: 100,
  });
  const [search, setSearch] = useState("");
  
  const { data: logs, isLoading } = useAutomationLogs(filters);
  const { data: flows } = useAutomationFlows();

  const handleSearch = () => {
    setFilters(prev => ({ ...prev, search }));
  };

  const getStatusBadge = (status: AutomationLog['status']) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" /> Pendente</Badge>;
      case 'sent':
        return <Badge variant="secondary" className="gap-1"><Send className="h-3 w-3" /> Enviado</Badge>;
      case 'delivered':
        return <Badge variant="default" className="gap-1"><CheckCircle2 className="h-3 w-3" /> Entregue</Badge>;
      case 'read':
        return <Badge className="gap-1 bg-green-600"><Eye className="h-3 w-3" /> Lido</Badge>;
      case 'failed':
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Falhou</Badge>;
      case 'cancelled':
        return <Badge variant="outline" className="gap-1 text-muted-foreground"><XCircle className="h-3 w-3" /> Cancelado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Histórico de Envios</h2>
          <p className="text-sm text-muted-foreground">
            Acompanhe todos os envios de automação
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por destinatário..."
                  className="pl-8"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
              </div>
            </div>
            
            <Select
              value={filters.channel || "all"}
              onValueChange={(value) => setFilters(prev => ({ 
                ...prev, 
                channel: value === "all" ? undefined : value as 'whatsapp' | 'email' 
              }))}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Canal" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os canais</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="email">Email</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.status || "all"}
              onValueChange={(value) => setFilters(prev => ({ 
                ...prev, 
                status: value === "all" ? undefined : value 
              }))}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="sent">Enviado</SelectItem>
                <SelectItem value="delivered">Entregue</SelectItem>
                <SelectItem value="read">Lido</SelectItem>
                <SelectItem value="failed">Falhou</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.flowId || "all"}
              onValueChange={(value) => setFilters(prev => ({ 
                ...prev, 
                flowId: value === "all" ? undefined : value 
              }))}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Fluxo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os fluxos</SelectItem>
                {flows?.map((flow) => (
                  <SelectItem key={flow.id} value={flow.id}>
                    {flow.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Canal</TableHead>
                <TableHead>Destinatário</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Template</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhum registro encontrado
                  </TableCell>
                </TableRow>
              ) : (
                logs?.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm">
                      {format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      {log.channel === 'whatsapp' ? (
                        <div className="flex items-center gap-1">
                          <MessageCircle className="h-4 w-4 text-green-600" />
                          <span className="text-xs">WhatsApp</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <Mail className="h-4 w-4 text-blue-600" />
                          <span className="text-xs">Email</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {log.recipient}
                    </TableCell>
                    <TableCell>
                      {log.contact?.name || (
                        <span className="text-muted-foreground text-xs">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {log.template?.name || (
                        <span className="text-muted-foreground text-xs">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(log.status)}
                      {log.error_message && (
                        <p className="text-xs text-destructive mt-1 max-w-[200px] truncate" title={log.error_message}>
                          {log.error_message}
                        </p>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
