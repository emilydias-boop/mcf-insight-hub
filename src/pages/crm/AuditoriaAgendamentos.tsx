import { useState } from 'react';
import { 
  useGhostAuditList, 
  useGhostAuditStats, 
  useRunGhostDetection,
  useUpdateAuditStatus,
  GhostAuditFilters,
  GhostAuditCase,
  GHOST_TYPE_LABELS,
  SEVERITY_LABELS,
  STATUS_LABELS
} from '@/hooks/useGhostAppointments';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  AlertTriangle, 
  Search, 
  Play, 
  RefreshCw, 
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
  Users,
  TrendingUp,
  Shield
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function AuditoriaAgendamentos() {
  const [filters, setFilters] = useState<GhostAuditFilters>({});
  const [selectedCase, setSelectedCase] = useState<GhostAuditCase | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');

  const { data: cases, isLoading } = useGhostAuditList(filters);
  const { data: stats } = useGhostAuditStats();
  const runDetection = useRunGhostDetection();
  const updateStatus = useUpdateAuditStatus();

  const handleStatusUpdate = (status: GhostAuditCase['status']) => {
    if (!selectedCase) return;
    updateStatus.mutate({ 
      id: selectedCase.id, 
      status, 
      notes: reviewNotes 
    }, {
      onSuccess: () => {
        setSelectedCase(null);
        setReviewNotes('');
      }
    });
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'high': return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      case 'medium': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'low': return 'bg-sky-500/10 text-sky-500 border-sky-500/20';
      default: return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
    }
  };

  const getGhostTypeColor = (ghostType: string) => {
    if (ghostType === 'webhook_duplicado') {
      return 'bg-sky-500/10 text-sky-500 border-sky-500/20';
    }
    return 'bg-muted text-muted-foreground';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed_fraud': return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'false_positive': return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'reviewed': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Auditoria de Agendamentos
          </h1>
          <p className="text-muted-foreground text-sm">
            Detecte e revise agendamentos fantasmas automaticamente
          </p>
        </div>
        <Button 
          onClick={() => runDetection.mutate(14)}
          disabled={runDetection.isPending}
        >
          {runDetection.isPending ? (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Play className="h-4 w-4 mr-2" />
          )}
          Executar Detecção
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Total</span>
            </div>
            <p className="text-2xl font-bold">{stats?.total || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-500" />
              <span className="text-sm text-muted-foreground">Pendentes</span>
            </div>
            <p className="text-2xl font-bold text-yellow-500">{stats?.pending || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <span className="text-sm text-muted-foreground">Críticos</span>
            </div>
            <p className="text-2xl font-bold text-red-500">{stats?.critical || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-orange-500" />
              <span className="text-sm text-muted-foreground">Alta Sev.</span>
            </div>
            <p className="text-2xl font-bold text-orange-500">{stats?.high || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-400" />
              <span className="text-sm text-muted-foreground">Fraudes</span>
            </div>
            <p className="text-2xl font-bold">{stats?.confirmed_fraud || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">F. Positivos</span>
            </div>
            <p className="text-2xl font-bold text-green-500">{stats?.false_positive || 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="Buscar por SDR ou Lead..."
                value={filters.sdr_email || ''}
                onChange={(e) => setFilters({ ...filters, sdr_email: e.target.value })}
                className="w-full"
              />
            </div>
            <Select
              value={filters.status || 'all'}
              onValueChange={(v) => setFilters({ ...filters, status: v })}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="confirmed_fraud">Fraude</SelectItem>
                <SelectItem value="false_positive">Falso Positivo</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filters.severity || 'all'}
              onValueChange={(v) => setFilters({ ...filters, severity: v })}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Severidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="critical">Crítico</SelectItem>
                <SelectItem value="high">Alto</SelectItem>
                <SelectItem value="medium">Médio</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filters.ghost_type || 'all'}
              onValueChange={(v) => setFilters({ ...filters, ghost_type: v })}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="tipo_a">Tipo A</SelectItem>
                <SelectItem value="tipo_b">Tipo B</SelectItem>
                <SelectItem value="ciclo_infinito">Ciclo Infinito</SelectItem>
                <SelectItem value="regressao">Regressão</SelectItem>
                <SelectItem value="excesso_requalificacao">Excesso Requalificação</SelectItem>
                <SelectItem value="webhook_duplicado">Webhook Duplicado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1,2,3,4,5].map(i => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead</TableHead>
                  <TableHead>SDR</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Severidade</TableHead>
                  <TableHead>Dias</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Detectado</TableHead>
                  <TableHead className="w-[80px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cases?.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{c.contact_name || 'Sem nome'}</p>
                        <p className="text-xs text-muted-foreground">{c.contact_email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{c.sdr_name || c.sdr_email}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs ${getGhostTypeColor(c.ghost_type)}`}>
                        {GHOST_TYPE_LABELS[c.ghost_type] || c.ghost_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={getSeverityColor(c.severity)}>
                        {SEVERITY_LABELS[c.severity]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono">{c.distinct_days}</span>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(c.status)}>
                        {STATUS_LABELS[c.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(c.detection_date), 'dd/MM', { locale: ptBR })}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setSelectedCase(c)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {cases?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Nenhum caso encontrado
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Details Sheet */}
      <Sheet open={!!selectedCase} onOpenChange={() => setSelectedCase(null)}>
        <SheetContent className="w-full sm:max-w-xl">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Detalhes do Caso
            </SheetTitle>
          </SheetHeader>

          {selectedCase && (
            <ScrollArea className="h-[calc(100vh-120px)] pr-4">
              <div className="space-y-6 py-4">
                {/* Contact Info */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Contato</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm">
                    <p><strong>Nome:</strong> {selectedCase.contact_name || 'N/A'}</p>
                    <p><strong>Email:</strong> {selectedCase.contact_email || 'N/A'}</p>
                    <p><strong>Telefone:</strong> {selectedCase.contact_phone || 'N/A'}</p>
                  </CardContent>
                </Card>

                {/* Classification */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Classificação</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex gap-2">
                      <Badge className={getSeverityColor(selectedCase.severity)}>
                        {SEVERITY_LABELS[selectedCase.severity]}
                      </Badge>
                      <Badge variant="outline">
                        {GHOST_TYPE_LABELS[selectedCase.ghost_type]}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {selectedCase.detection_reason}
                    </p>
                    <div className="grid grid-cols-3 gap-4 pt-2">
                      <div className="text-center p-2 bg-muted rounded">
                        <p className="text-xl font-bold">{selectedCase.total_r1_agendada}</p>
                        <p className="text-xs text-muted-foreground">R1 Agendada</p>
                      </div>
                      <div className="text-center p-2 bg-muted rounded">
                        <p className="text-xl font-bold">{selectedCase.distinct_days}</p>
                        <p className="text-xs text-muted-foreground">Dias Distintos</p>
                      </div>
                      <div className="text-center p-2 bg-muted rounded">
                        <p className="text-xl font-bold">{selectedCase.no_show_count}</p>
                        <p className="text-xs text-muted-foreground">No-Shows</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Timeline */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Histórico de Movimentações</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                      {selectedCase.movement_history?.map((m, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs border-l-2 border-primary/30 pl-3 py-1">
                          <span className="text-muted-foreground whitespace-nowrap">
                            {format(new Date(m.date), 'dd/MM HH:mm', { locale: ptBR })}
                          </span>
                          <span className="font-medium">
                            {m.from_stage ? `${m.from_stage} → ` : ''}{m.to_stage}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Review Section */}
                {selectedCase.status === 'pending' && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Revisão</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Textarea
                        placeholder="Adicione notas sobre este caso..."
                        value={reviewNotes}
                        onChange={(e) => setReviewNotes(e.target.value)}
                        rows={3}
                      />
                      <div className="flex gap-2">
                        <Button 
                          variant="destructive"
                          className="flex-1"
                          onClick={() => handleStatusUpdate('confirmed_fraud')}
                          disabled={updateStatus.isPending}
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Confirmar Fraude
                        </Button>
                        <Button 
                          variant="outline"
                          className="flex-1"
                          onClick={() => handleStatusUpdate('false_positive')}
                          disabled={updateStatus.isPending}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Falso Positivo
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Already Reviewed */}
                {selectedCase.status !== 'pending' && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Resultado da Revisão</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Badge className={getStatusColor(selectedCase.status)}>
                        {STATUS_LABELS[selectedCase.status]}
                      </Badge>
                      {selectedCase.review_notes && (
                        <p className="text-sm mt-2 text-muted-foreground">
                          {selectedCase.review_notes}
                        </p>
                      )}
                      {selectedCase.reviewed_at && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Revisado em {format(new Date(selectedCase.reviewed_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            </ScrollArea>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
