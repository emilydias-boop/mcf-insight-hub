import { CalendarCheck2, CheckCircle2, Trophy } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export type BlockedLeadState =
  | 'scheduled_future'
  | 'completed'
  | 'contract_paid'
  | 'won';

interface BlockedLeadCardProps {
  leadName: string;
  state: BlockedLeadState;
  meetingType?: 'r1' | 'r2';
  scheduledAt?: string | null;
  closerName?: string | null;
}

/**
 * Card de aviso destacado que substitui o bloco de "Notas" quando o lead
 * selecionado não pode ser agendado novamente (já agendado, R1 realizada,
 * contrato pago, etc.). Bloqueia visualmente o caminho de submit.
 */
export function BlockedLeadCard({
  leadName,
  state,
  meetingType = 'r1',
  scheduledAt,
  closerName,
}: BlockedLeadCardProps) {
  const meetingLabel = meetingType === 'r2' ? 'Reunião 02 (R2)' : 'Reunião 01 (R1)';

  let title = '';
  let icon = <CalendarCheck2 className="h-6 w-6" />;
  let description = '';
  let helper = '';
  let containerCls = '';
  let iconWrapCls = '';
  let titleCls = '';
  let dividerCls = '';

  if (state === 'scheduled_future') {
    title = meetingType === 'r2' ? 'R2 JÁ AGENDADA' : 'LEAD JÁ AGENDADO';
    icon = <CalendarCheck2 className="h-6 w-6" />;
    description = scheduledAt
      ? `${meetingLabel} marcada para ${format(new Date(scheduledAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`
      : `${meetingLabel} já agendada`;
    helper =
      meetingType === 'r2'
        ? 'Para mudar o horário, use a Agenda R2 e reagende a reunião existente.'
        : 'Para mudar o horário, use a Agenda e reagende a reunião existente.';
    containerCls =
      'border-yellow-500/60 bg-yellow-500/10 dark:bg-yellow-500/5';
    iconWrapCls = 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400';
    titleCls = 'text-yellow-800 dark:text-yellow-300';
    dividerCls = 'bg-yellow-500/30';
  } else if (state === 'completed') {
    title = 'R1 JÁ REALIZADA';
    icon = <CheckCircle2 className="h-6 w-6" />;
    description = 'Este lead já passou pela Reunião 01.';
    helper = 'Para agendar a R2, utilize a Agenda R2.';
    containerCls = 'border-blue-500/60 bg-blue-500/10 dark:bg-blue-500/5';
    iconWrapCls = 'bg-blue-500/20 text-blue-700 dark:text-blue-400';
    titleCls = 'text-blue-800 dark:text-blue-300';
    dividerCls = 'bg-blue-500/30';
  } else {
    // contract_paid | won
    title = 'CONTRATO JÁ PAGO';
    icon = <Trophy className="h-6 w-6" />;
    description = 'Lead concluído — venda fechada.';
    helper = 'Não é necessário (nem permitido) agendar nova reunião.';
    containerCls = 'border-green-500/60 bg-green-500/10 dark:bg-green-500/5';
    iconWrapCls = 'bg-green-500/20 text-green-700 dark:text-green-400';
    titleCls = 'text-green-800 dark:text-green-300';
    dividerCls = 'bg-green-500/30';
  }

  return (
    <div
      className={cn(
        'rounded-lg border-2 p-4 space-y-3',
        containerCls,
      )}
      role="alert"
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
            iconWrapCls,
          )}
        >
          {icon}
        </div>
        <h3
          className={cn(
            'font-bold text-sm tracking-wide uppercase',
            titleCls,
          )}
        >
          {title}
        </h3>
      </div>

      <div className={cn('h-px w-full', dividerCls)} />

      <div className="space-y-1.5">
        <p className="font-semibold text-sm text-foreground">{leadName}</p>
        <p className="text-sm text-foreground/80">{description}</p>
        {state === 'scheduled_future' && closerName && (
          <p className="text-sm text-foreground/80">
            <span className="text-muted-foreground">Closer:</span>{' '}
            <span className="font-medium">{closerName}</span>
          </p>
        )}
      </div>

      <p className="text-xs text-muted-foreground pt-1 border-t border-border/40">
        {helper}
      </p>
    </div>
  );
}
