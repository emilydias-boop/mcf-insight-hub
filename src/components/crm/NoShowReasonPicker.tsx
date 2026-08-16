import { useState } from 'react';
import { AlertTriangle, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { getGroupedReasons, requiresNote } from '@/lib/meetingOutcomeReasons';

export interface NoShowReasonPayload {
  reason: string;
  note?: string;
}

interface Props {
  /** Trigger do popover (botão "No-Show" de cada tela). */
  children: React.ReactNode;
  onConfirm: (payload: NoShowReasonPayload) => void;
  disabled?: boolean;
  loading?: boolean;
  align?: 'start' | 'center' | 'end';
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
}

/**
 * Seletor único de motivo de no-show — usado na Agenda, na lista de reuniões
 * e na fila R1 Agendadas do Funil Consórcio. O motivo é obrigatório;
 * "Outro" exige observação livre.
 */
export function NoShowReasonPicker({
  children,
  onConfirm,
  disabled,
  loading,
  align = 'end',
  open: openProp,
  onOpenChange,
}: Props) {
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = onOpenChange ?? setOpenState;
  const [pendingOther, setPendingOther] = useState(false);
  const [note, setNote] = useState('');

  const groups = getGroupedReasons();

  const close = () => {
    setOpen(false);
    setPendingOther(false);
    setNote('');
  };

  const pick = (code: string) => {
    if (requiresNote(code)) {
      setPendingOther(true);
      return;
    }
    onConfirm({ reason: code });
    close();
  };

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) {
          setPendingOther(false);
          setNote('');
        }
      }}
    >
      <PopoverTrigger asChild disabled={disabled}>
        {children}
      </PopoverTrigger>
      <PopoverContent align={align} className="w-[min(320px,calc(100vw-2rem))] p-2">
        <div className="mb-2 flex items-center gap-2 px-1">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <span className="text-xs font-semibold">Motivo do No-Show (obrigatório)</span>
        </div>

        {pendingOther ? (
          <div className="space-y-2 p-1">
            <p className="text-xs text-muted-foreground">
              Descreva o motivo — obrigatório para "Outro".
            </p>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex.: closer entrou na sala errada"
              rows={3}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setPendingOther(false)}>
                Voltar
              </Button>
              <Button
                size="sm"
                disabled={note.trim().length < 3 || loading}
                onClick={() => {
                  onConfirm({ reason: 'outro', note: note.trim() });
                  close();
                }}
              >
                {loading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Check className="mr-1 h-3 w-3" />}
                Confirmar
              </Button>
            </div>
          </div>
        ) : (
          <div className="max-h-[60vh] space-y-2 overflow-y-auto">
            {groups.map((g) => (
              <div key={g.group}>
                <p className="px-1 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {g.group}
                </p>
                <div className="flex flex-col">
                  {g.reasons.map((r) => (
                    <button
                      key={r.code}
                      type="button"
                      disabled={loading}
                      onClick={() => pick(r.code)}
                      className={cn(
                        'w-full rounded-md px-2 py-2.5 text-left text-sm',
                        'hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:outline-none',
                        'disabled:opacity-60',
                      )}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
