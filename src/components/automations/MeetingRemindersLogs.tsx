import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMeetingRemindersLogs } from '@/hooks/useMeetingRemindersLogs';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const OFFSETS = ['d-1', 'h-4', 'h-2', 'h-1', 'm-20', 'm-0'];

export function MeetingRemindersLogs() {
  const [status, setStatus] = useState<string>('all');
  const [offsetKey, setOffsetKey] = useState<string>('all');

  const { data: logs, isLoading } = useMeetingRemindersLogs({
    status: status === 'all' ? undefined : status,
    offsetKey: offsetKey === 'all' ? undefined : offsetKey,
    limit: 100,
  });

  const statusBadge = (s: string) => {
    if (s === 'sent') return <Badge className="bg-success text-success-foreground">Enviado</Badge>;
    if (s === 'failed') return <Badge variant="destructive">Falha</Badge>;
    return <Badge variant="secondary">Pulado</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Histórico de envios</CardTitle>
        <CardDescription>Últimos 100 lembretes (atualiza a cada 30s)</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="sent">Enviados</SelectItem>
              <SelectItem value="skipped">Pulados</SelectItem>
              <SelectItem value="failed">Falhas</SelectItem>
            </SelectContent>
          </Select>
          <Select value={offsetKey} onValueChange={setOffsetKey}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos offsets</SelectItem>
              {OFFSETS.map(o => (
                <SelectItem key={o} value={o}>{o}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="border rounded-md overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Offset</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Motivo / Erro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : !logs || logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Nenhum log encontrado
                  </TableCell>
                </TableRow>
              ) : (
                logs.map(log => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs whitespace-nowrap">
                      {format(new Date(log.sent_at), "dd/MM HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate">{log.contact_email}</TableCell>
                    <TableCell><Badge variant="outline">{log.meeting_type}</Badge></TableCell>
                    <TableCell><code className="text-xs">{log.offset_key}</code></TableCell>
                    <TableCell>{statusBadge(log.status)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[300px] truncate">
                      {log.skip_reason || log.error_message || '—'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
