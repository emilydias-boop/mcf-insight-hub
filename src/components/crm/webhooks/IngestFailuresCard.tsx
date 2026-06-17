import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, RefreshCw, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { useIngestFailures, triggerRetryFailures } from '@/hooks/useIngestFailures';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { formatDate } from '@/lib/formatters';

const statusVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending: 'secondary',
  retrying: 'outline',
  resolved: 'default',
  abandoned: 'destructive',
};

const reasonLabel: Record<string, string> = {
  deal_not_created: 'Deal não criado',
  deal_creation_threw: 'Erro na criação',
  missing_email_and_phone: 'Sem email/telefone',
  create_contact_threw: 'Erro no contato',
};

export function IngestFailuresCard() {
  const qc = useQueryClient();
  const { data, isLoading } = useIngestFailures(24);
  const [retrying, setRetrying] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      const res: any = await triggerRetryFailures();
      toast.success(
        `Reprocessamento concluído: ${res?.resolved || 0} resolvidos, ${res?.retrying || 0} em retry, ${res?.abandoned || 0} abandonados.`
      );
      await qc.invalidateQueries({ queryKey: ['ingest-failures'] });
    } catch (e: any) {
      toast.error(`Falha ao reprocessar: ${e?.message || String(e)}`);
    } finally {
      setRetrying(false);
    }
  };

  const s = data?.summary;
  const hasIssues = (s?.unresolved || 0) > 0;

  return (
    <Card className={hasIssues ? 'border-destructive/40' : ''}>
      <CardHeader>
        <CardTitle className="text-lg flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <AlertTriangle className={`h-5 w-5 ${hasIssues ? 'text-destructive' : 'text-muted-foreground'}`} />
            Compras sem deal nas últimas 24h
          </span>
          <Button
            size="sm"
            variant={hasIssues ? 'destructive' : 'outline'}
            onClick={handleRetry}
            disabled={retrying || isLoading}
            className="gap-2"
          >
            {retrying ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Reprocessar agora
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Stat label="Total" value={s?.total ?? 0} />
          <Stat label="Pendentes" value={s?.pending ?? 0} tone="secondary" />
          <Stat label="Em retry" value={s?.retrying ?? 0} tone="outline" />
          <Stat label="Resolvidos" value={s?.resolved ?? 0} tone="default" icon={<CheckCircle2 className="h-3 w-3" />} />
          <Stat label="Abandonados" value={s?.abandoned ?? 0} tone="destructive" icon={<XCircle className="h-3 w-3" />} />
        </div>

        {(data?.rows.length || 0) > 0 && (
          <>
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={() => setExpanded(e => !e)}>
                {expanded ? 'Ocultar detalhes' : 'Ver detalhes'}
              </Button>
            </div>
            {expanded && (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Quando</TableHead>
                      <TableHead>Fonte</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead className="text-center">Tent.</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data!.rows.map(f => (
                      <TableRow key={f.id}>
                        <TableCell className="whitespace-nowrap text-xs">{formatDate(f.created_at)}</TableCell>
                        <TableCell><Badge variant="outline">{f.source}</Badge></TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          <div className="font-medium text-xs">{f.customer_name || '—'}</div>
                          <div className="text-xs text-muted-foreground">{f.customer_email || f.customer_phone || '—'}</div>
                        </TableCell>
                        <TableCell className="max-w-[180px] truncate text-xs">{f.product_name || '—'}</TableCell>
                        <TableCell className="text-xs">{reasonLabel[f.failure_reason] || f.failure_reason}</TableCell>
                        <TableCell className="text-center text-xs">{f.attempts}/5</TableCell>
                        <TableCell>
                          <Badge variant={statusVariant[f.status] || 'outline'}>{f.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </>
        )}

        {!isLoading && (data?.rows.length || 0) === 0 && (
          <div className="text-sm text-muted-foreground text-center py-4 flex items-center justify-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            Nenhuma falha de ingestão registrada nas últimas 24h.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, tone = 'outline', icon }: { label: string; value: number; tone?: 'default'|'secondary'|'destructive'|'outline'; icon?: React.ReactNode }) {
  return (
    <div className="rounded-md border p-3 flex flex-col gap-1">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="flex items-center gap-2">
        <span className="text-2xl font-semibold">{value}</span>
        {icon && <Badge variant={tone} className="gap-1 h-5">{icon}</Badge>}
      </div>
    </div>
  );
}