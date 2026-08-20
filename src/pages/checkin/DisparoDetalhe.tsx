import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle, ArrowLeft, Ban, Pause, Play } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  useControlarBroadcast,
  useWaBroadcast,
  useWaBroadcastTargets,
  useWaTargetsTotal,
  TARGETS_PAGE_SIZE,
} from '@/hooks/wa/useWaBroadcasts';
import { TargetsTable } from '@/components/checkin/broadcast/TargetsTable';
import {
  BROADCAST_STATUS_LABEL,
  interpolarPreview,
} from '@/components/checkin/broadcast/waBroadcastLabels';
import { formatDateTime } from '@/lib/formatters';

export default function DisparoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const { user, hasAnyRole } = useAuth();
  const { data: broadcast, isLoading } = useWaBroadcast(id);
  const [statusFilter, setStatusFilter] = useState('all');
  const { data: targets = [], isLoading: loadingTargets } = useWaBroadcastTargets(id, statusFilter);
  const { data: totalTargets } = useWaTargetsTotal(id, statusFilter);
  const controlar = useControlarBroadcast();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [motivo, setMotivo] = useState('');

  if (isLoading) {
    return <div className="p-6 text-muted-foreground">Carregando disparo…</div>;
  }
  if (!broadcast) {
    return <div className="p-6 text-muted-foreground">Disparo não encontrado.</div>;
  }

  const podeControlar = hasAnyRole('admin') || broadcast.criado_por === user?.id;
  const pendentes = Math.max(
    0,
    broadcast.total_alvos -
      broadcast.total_enviados -
      broadcast.total_falhas -
      broadcast.total_ignorados,
  );
  const progresso = broadcast.total_alvos
    ? ((broadcast.total_enviados + broadcast.total_falhas + broadcast.total_ignorados) /
        broadcast.total_alvos) *
      100
    : 0;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-1 -ml-2">
            <Link to="/checkin/disparos">
              <ArrowLeft className="mr-2 h-4 w-4" /> Disparos
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold">{broadcast.nome}</h1>
          <p className="text-sm text-muted-foreground">
            {broadcast.template_nome ?? broadcast.content_sid}
            {broadcast.iniciado_em && ` · iniciado em ${formatDateTime(broadcast.iniciado_em)}`}
            {broadcast.concluido_em && ` · concluído em ${formatDateTime(broadcast.concluido_em)}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={broadcast.status === 'cancelado' ? 'destructive' : 'secondary'}>
            {BROADCAST_STATUS_LABEL[broadcast.status] ?? broadcast.status}
          </Badge>
          {podeControlar && broadcast.status === 'enviando' && (
            <Button
              variant="outline"
              onClick={() => controlar.pausar(broadcast.id)}
              disabled={controlar.isPending}
            >
              <Pause className="mr-2 h-4 w-4" /> Pausar
            </Button>
          )}
          {podeControlar && broadcast.status === 'pausado' && (
            <Button onClick={() => controlar.retomar(broadcast.id)} disabled={controlar.isPending}>
              <Play className="mr-2 h-4 w-4" /> Retomar
            </Button>
          )}
          {podeControlar && ['enviando', 'pausado', 'aguardando'].includes(broadcast.status) && (
            <Button
              variant="destructive"
              onClick={() => setCancelOpen(true)}
              disabled={controlar.isPending}
            >
              <Ban className="mr-2 h-4 w-4" /> Cancelar
            </Button>
          )}
        </div>
      </div>

      {broadcast.status === 'pausado' && broadcast.motivo_cancelamento && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>O sistema pausou este disparo</AlertTitle>
          <AlertDescription>{broadcast.motivo_cancelamento}</AlertDescription>
        </Alert>
      )}

      {broadcast.status === 'cancelado' && broadcast.motivo_cancelamento && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Disparo cancelado</AlertTitle>
          <AlertDescription>{broadcast.motivo_cancelamento}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="space-y-4 pt-4">
          <Progress value={progresso} />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Metrica label="Enviados" valor={broadcast.total_enviados} />
            <Metrica label="Falhas" valor={broadcast.total_falhas} />
            <Metrica label="Ignorados" valor={broadcast.total_ignorados} />
            <Metrica label="Pendentes" valor={pendentes} />
          </div>
          {broadcast.template_preview && (
            <div className="whitespace-pre-wrap rounded-lg bg-muted p-3 text-sm">
              {interpolarPreview(broadcast.template_preview, targets[0]?.contact_name ?? null)}
            </div>
          )}
        </CardContent>
      </Card>

      <TargetsTable
        targets={targets}
        isLoading={loadingTargets}
        status={statusFilter}
        onStatusChange={setStatusFilter}
        total={totalTargets}
        pageSize={TARGETS_PAGE_SIZE}
      />

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar disparo</DialogTitle>
          </DialogHeader>
          <Textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Por que está cancelando? (fica registrado)"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>
              Voltar
            </Button>
            <Button
              variant="destructive"
              disabled={!motivo.trim() || controlar.isPending}
              onClick={async () => {
                await controlar.cancelar(broadcast.id, motivo.trim());
                setCancelOpen(false);
                setMotivo('');
              }}
            >
              Cancelar disparo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Metrica({ label, valor }: { label: string; valor: number }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold">{valor}</p>
    </div>
  );
}