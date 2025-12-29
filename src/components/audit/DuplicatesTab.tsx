import { useState } from 'react';
import { 
  useDuplicatesList, 
  useDuplicatesStats, 
  useUpdateDuplicateStatus,
  useBulkUpdateDuplicates,
  useRunDuplicateDetection,
  DuplicateFilters 
} from '@/hooks/useDuplicateActivities';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Copy, 
  RefreshCw, 
  Eye,
  EyeOff,
  Trash2,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Play
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function DuplicatesTab() {
  const [filters, setFilters] = useState<DuplicateFilters>({});

  const { data: duplicates, isLoading } = useDuplicatesList(filters);
  const { data: stats } = useDuplicatesStats();
  const updateStatus = useUpdateDuplicateStatus();
  const bulkUpdate = useBulkUpdateDuplicates();
  const runDetection = useRunDuplicateDetection();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ignored': return 'bg-muted text-muted-foreground';
      case 'deleted': return 'bg-red-500/10 text-red-500 border-red-500/20';
      default: return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'ignored': return 'Ignorada';
      case 'deleted': return 'Removida';
      default: return 'Pendente';
    }
  };

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Copy className="h-4 w-4 text-muted-foreground" />
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
              <EyeOff className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Ignoradas</span>
            </div>
            <p className="text-2xl font-bold">{stats?.ignored || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-red-500" />
              <span className="text-sm text-muted-foreground">Removidas</span>
            </div>
            <p className="text-2xl font-bold text-red-500">{stats?.deleted || 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Actions */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="flex gap-4">
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
                  <SelectItem value="ignored">Ignorada</SelectItem>
                  <SelectItem value="deleted">Removida</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={filters.period || 'all'}
                onValueChange={(v) => setFilters({ ...filters, period: v as any })}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="7">Últimos 7 dias</SelectItem>
                  <SelectItem value="30">Últimos 30 dias</SelectItem>
                  <SelectItem value="90">Últimos 90 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => runDetection.mutate(7)}
                disabled={runDetection.isPending}
              >
                {runDetection.isPending ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                Detectar Novas
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => bulkUpdate.mutate({ status: 'ignored', filterStatus: 'pending' })}
                disabled={bulkUpdate.isPending || !stats?.pending}
              >
                <EyeOff className="h-4 w-4 mr-2" />
                Ignorar Todas Pendentes
              </Button>
            </div>
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
                  <TableHead>Deal ID</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Gap</TableHead>
                  <TableHead>Detectado</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[120px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {duplicates?.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <span className="font-mono text-xs">
                        {d.deal_id.substring(0, 8)}...
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <span className="text-muted-foreground">{d.from_stage || '?'}</span>
                        <span className="mx-1">→</span>
                        <span className="font-medium">{d.to_stage}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">
                        {d.gap_seconds?.toFixed(1) || 0}s
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(d.detected_at), 'dd/MM HH:mm', { locale: ptBR })}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(d.status)}>
                        {getStatusLabel(d.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {d.status === 'pending' && (
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => updateStatus.mutate({ id: d.id, status: 'ignored' })}
                            disabled={updateStatus.isPending}
                            title="Ignorar"
                          >
                            <EyeOff className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => updateStatus.mutate({ id: d.id, status: 'deleted' })}
                            disabled={updateStatus.isPending}
                            title="Marcar como removida"
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {duplicates?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nenhuma duplicata encontrada
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
