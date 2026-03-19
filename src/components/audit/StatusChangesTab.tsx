import { useState, useMemo } from 'react';
import { useStatusChangeAudit, StatusChangeEntry, AuditFilterMode } from '@/hooks/useStatusChangeAudit';
import { formatMeetingStatus } from '@/utils/formatMeetingStatus';
import { StatusChangeDetailDrawer } from './StatusChangeDetailDrawer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { AlertTriangle, ArrowRight, Clock, Eye, ShieldAlert, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function StatusChangesTab() {
  const [days, setDays] = useState(7);
  const [filterMode, setFilterMode] = useState<AuditFilterMode>('manual');
  const [selectedEntry, setSelectedEntry] = useState<StatusChangeEntry | null>(null);

  const { data: changes = [], isLoading } = useStatusChangeAudit({
    days,
    filterMode,
  });

  // Stats always from "all" query would require double fetch; compute from current + label accordingly
  const stats = useMemo(() => {
    const total = changes.length;
    const suspicious = changes.filter(c => c.is_suspicious).length;
    const noShowToCompleted = changes.filter(c => c.old_status === 'no_show' && c.new_status === 'completed').length;
    const completedToNoShow = changes.filter(c => c.old_status === 'completed' && c.new_status === 'no_show').length;
    const reversals = changes.filter(c =>
      (c.old_status === 'cancelled' || c.old_status === 'refunded') && c.new_status === 'completed'
    ).length;
    return { total, suspicious, noShowToCompleted, completedToNoShow, reversals };
  }, [changes]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Label className="text-sm whitespace-nowrap">Período:</Label>
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 dias</SelectItem>
              <SelectItem value="30">30 dias</SelectItem>
              <SelectItem value="90">90 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-sm whitespace-nowrap">Tipo:</Label>
          <Select value={filterMode} onValueChange={(v) => setFilterMode(v as AuditFilterMode)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="manual">Mudanças manuais</SelectItem>
              <SelectItem value="suspicious">Apenas suspeitas</SelectItem>
              <SelectItem value="all">Todas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Eye className="h-3 w-3" /> Total
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card className="border-destructive/30">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-destructive flex items-center gap-1">
              <ShieldAlert className="h-3 w-3" /> Suspeitas
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold text-destructive">{stats.suspicious}</p>
          </CardContent>
        </Card>
        <Card className="border-orange-300/50">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-orange-600 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> No-show → Realizada
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold text-orange-600">{stats.noShowToCompleted}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" /> Realizada → No-show
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">{stats.completedToNoShow}</p>
          </CardContent>
        </Card>
        <Card className="border-orange-300/50">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-orange-600 flex items-center gap-1">
              <RotateCcw className="h-3 w-3" /> Reversões
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold text-orange-600">{stats.reversals}</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Carregando...</div>
      ) : changes.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          Nenhuma mudança de status encontrada no período.
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lead</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Closer</TableHead>
                <TableHead>De → Para</TableHead>
                <TableHead>Alterado por</TableHead>
                <TableHead>Data Reunião</TableHead>
                <TableHead>Data Alteração</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {changes.map((entry) => (
                <StatusChangeRow key={entry.id} entry={entry} onClick={() => setSelectedEntry(entry)} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <StatusChangeDetailDrawer
        entry={selectedEntry}
        open={!!selectedEntry}
        onOpenChange={(open) => { if (!open) setSelectedEntry(null); }}
      />
    </div>
  );
}

function StatusChangeRow({ entry }: { entry: StatusChangeEntry }) {
  return (
    <TableRow className={entry.is_suspicious ? 'bg-destructive/5' : ''}>
      <TableCell className="font-medium">
        {entry.attendee_name || 'N/A'}
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="text-xs">
          {entry.meeting_type === 'r2' ? 'R2' : 'R1'}
        </Badge>
      </TableCell>
      <TableCell>{entry.closer_name || 'N/A'}</TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5">
          <Badge
            variant={entry.is_suspicious ? 'destructive' : 'secondary'}
            className="text-xs"
          >
            {formatMeetingStatus(entry.old_status)}
          </Badge>
          <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
          <Badge
            variant={entry.is_suspicious ? 'destructive' : 'secondary'}
            className="text-xs"
          >
            {formatMeetingStatus(entry.new_status)}
          </Badge>
        </div>
      </TableCell>
      <TableCell className="text-sm">{entry.changed_by_name || 'Sistema'}</TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {entry.scheduled_at
          ? format(new Date(entry.scheduled_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
          : 'N/A'}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {entry.changed_at
          ? format(new Date(entry.changed_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
          : 'N/A'}
      </TableCell>
    </TableRow>
  );
}
