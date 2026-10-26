import { useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useCompleteNextAction } from '@/hooks/usePendingNextActions';
import { DataHoraPopover } from './DataHoraPopover';
import { useRegistrarContato } from './useRegistrarContato';
import { rotuloToast, TIPO_LABEL, type ProximaTipo } from './registrarContato';

interface Props { dealId: string; tipo?: string | null; data: string; nota?: string | null; onChanged?: () => void }

export function RetornoAgendadoCard({ dealId, tipo, data, nota, onChanged }: Props) {
  const [open, setOpen] = useState(false);
  const concluir = useCompleteNextAction();
  const registrar = useRegistrarContato();
  const qc = useQueryClient();
  const vencido = new Date(data).getTime() < Date.now();

  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-start gap-2">
        <CalendarClock className={cn('mt-0.5 h-4 w-4', vencido ? 'text-destructive' : 'text-primary')} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Retorno agendado</p>
          <p className={cn('text-sm font-medium', vencido && 'text-destructive')}>
            {`${TIPO_LABEL[tipo || 'ligar'] || 'Ligar'} · ${rotuloToast(data)}`}
          </p>
          {nota && <p className="mt-0.5 whitespace-pre-wrap text-xs text-muted-foreground">{nota}</p>}
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <DataHoraPopover open={open} onOpenChange={setOpen} onConfirm={iso => registrar.mutate(
          { dealId, resultado: null, nota: null, proximaTipo: (tipo as ProximaTipo) || 'ligar', proximaEm: iso },
          { onSuccess: () => { toast.success(`Retorno agendado para ${rotuloToast(iso)}`); onChanged?.(); },
            onError: (e: unknown) => toast.error((e as { message?: string })?.message || 'Erro ao remarcar') },
        )}>
          <Button size="sm" variant="outline" disabled={registrar.isPending}>Remarcar</Button>
        </DataHoraPopover>
        <Button size="sm" disabled={concluir.isPending} onClick={() => concluir.mutate(dealId, {
          onSuccess: () => { ['crm-deal', 'deal-header-info', 'lead-full-timeline', 'kanban'].forEach(k => qc.invalidateQueries({ queryKey: [k] })); onChanged?.(); },
        })}>Concluir</Button>
      </div>
    </div>
  );
}
