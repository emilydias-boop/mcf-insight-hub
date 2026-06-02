import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ShieldAlert, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  useCreateR1ForceRequest,
  type R1ForcePayload,
} from '@/hooks/useCreateR1ForceRequest';

interface RequestR1ApprovalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payload: R1ForcePayload | null;
  dealName?: string;
  contactName?: string;
  closerName?: string;
  blockReason?: 'deal_already_paid' | 'deal_already_won' | 'deal_r1_cooldown_active' | string;
  blockMessage?: string;
  requesterRole?: 'sdr' | 'closer';
  /** Tipo de pedido. Default = r1_force_paid_lead. */
  ruleKey?: 'r1_force_paid_lead' | 'r1_cooldown_bypass';
  /** Contexto extra (ex: last_r1_at, cooldown_days). */
  extra?: Record<string, any>;
  onSubmitted?: () => void;
}

const MIN_REASON = 10;

export function RequestR1ApprovalDialog({
  open,
  onOpenChange,
  payload,
  dealName,
  contactName,
  closerName,
  blockReason,
  blockMessage,
  requesterRole = 'sdr',
  ruleKey = 'r1_force_paid_lead',
  extra,
  onSubmitted,
}: RequestR1ApprovalDialogProps) {
  const [reason, setReason] = useState('');
  const createRequest = useCreateR1ForceRequest();

  const scheduledLabel = useMemo(() => {
    if (!payload?.scheduledAt) return '—';
    try {
      return format(new Date(payload.scheduledAt), "EEEE, dd/MM/yyyy 'às' HH:mm", {
        locale: ptBR,
      });
    } catch {
      return payload.scheduledAt;
    }
  }, [payload?.scheduledAt]);

  const reasonOk = reason.trim().length >= MIN_REASON;

  const isCooldown = ruleKey === 'r1_cooldown_bypass';
  const lastR1Label = extra?.last_r1_at
    ? (() => {
        try {
          return format(new Date(extra.last_r1_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
        } catch {
          return String(extra.last_r1_at);
        }
      })()
    : null;

  const handleSubmit = async () => {
    if (!payload) return;
    if (!reasonOk) {
      toast.error(`Motivo precisa ter pelo menos ${MIN_REASON} caracteres.`);
      return;
    }
    try {
      const res = await createRequest.mutateAsync({
        payload,
        reason,
        blockReason,
        blockMessage,
        requesterRole,
        ruleKey,
        extra,
      });
      if (res.deduped) {
        toast.info('Já existe uma solicitação pendente para este lead.');
      } else {
        toast.success(
          'Solicitação enviada para admin/manager/coordenador/Jessica.',
        );
      }
      setReason('');
      onOpenChange(false);
      onSubmitted?.();
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao enviar solicitação.');
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) setReason('');
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-600" />
            {isCooldown ? 'Solicitar liberação de R1 (cooldown)' : 'Solicitar liberação de R1'}
          </DialogTitle>
          <DialogDescription>
            {isCooldown ? (
              <>
                Este lead já teve R1{lastR1Label ? ` em ${lastR1Label}` : ''}
                {extra?.cooldown_days ? ` (cooldown de ${extra.cooldown_days} dias ativo)` : ''}.
                Sua solicitação será enviada para admin, manager ou coordenador
                liberarem o reagendamento.
              </>
            ) : (
              <>
                Este lead já tem contrato pago. Sua solicitação será enviada para{' '}
                admin, manager, coordenador ou Jessica liberarem.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm space-y-1.5">
          {dealName && (
            <div>
              <span className="text-muted-foreground">Negócio: </span>
              <span className="font-medium">{dealName}</span>
            </div>
          )}
          {contactName && (
            <div>
              <span className="text-muted-foreground">Contato: </span>
              <span className="font-medium">{contactName}</span>
            </div>
          )}
          {closerName && (
            <div>
              <span className="text-muted-foreground">Closer: </span>
              <span className="font-medium">{closerName}</span>
            </div>
          )}
          <div>
            <span className="text-muted-foreground">Horário pedido: </span>
            <span className="font-medium">{scheduledLabel}</span>
          </div>
          {payload?.durationMinutes != null && (
            <div>
              <span className="text-muted-foreground">Duração: </span>
              <span className="font-medium">{payload.durationMinutes} min</span>
            </div>
          )}
          {payload?.leadType && (
            <div>
              <span className="text-muted-foreground">Tipo: </span>
              <span className="font-medium">{payload.leadType}</span>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="r1-approval-reason">
            Motivo da solicitação <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="r1-approval-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={
              isCooldown
                ? 'Explique por que essa R1 precisa ser reagendada antes do fim do cooldown…'
                : 'Explique por que essa R1 precisa ser agendada mesmo com contrato pago…'
            }
            rows={4}
            maxLength={1000}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span className={reasonOk ? 'text-emerald-600' : ''}>
              Mínimo {MIN_REASON} caracteres
            </span>
            <span>{reason.length}/1000</span>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={createRequest.isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!reasonOk || createRequest.isPending || !payload}
          >
            {createRequest.isPending && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            Enviar solicitação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
