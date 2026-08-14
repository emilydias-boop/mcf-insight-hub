import { useEffect, useRef, useState } from 'react';
import { useAutoDialer } from '@/contexts/AutoDialerContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PanelRight, SkipForward, PhoneOutgoing } from 'lucide-react';
import { CALL_OUTCOMES, QUICK_OUTCOMES } from '@/lib/callOutcomes';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

function formatElapsed(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}

/**
 * Banner do Auto-Discador no motor Sonax.
 * A ligação toca no ramal/softphone do SDR (fora do navegador), então não há
 * detecção automática de atendida/duração: o SDR registra o resultado aqui e
 * a fila só avança depois disso.
 */
export function AutoDialerOutcomeBanner() {
  const { engine, state, pendingOutcome, registerOutcome, setInCallDrawerOpen, inCallDrawerOpen, skipCurrent } = useAutoDialer();
  const [elapsed, setElapsed] = useState(0);
  const [saving, setSaving] = useState(false);
  const startedRef = useRef<number | null>(null);

  useEffect(() => {
    if (state !== 'awaiting-outcome' || !pendingOutcome) { startedRef.current = null; setElapsed(0); return; }
    startedRef.current = pendingOutcome.startedAt;
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - (startedRef.current || Date.now())) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [state, pendingOutcome]);

  if (engine !== 'sonax' || state !== 'awaiting-outcome' || !pendingOutcome || pendingOutcome.autoDetecting) return null;

  const save = async (outcome: string) => {
    if (saving) return;
    setSaving(true);
    try {
      await registerOutcome(outcome);
    } finally {
      setSaving(false);
    }
  };

  const quick = CALL_OUTCOMES.filter((o) => (QUICK_OUTCOMES as readonly string[]).includes(o.value));
  const rest = CALL_OUTCOMES.filter((o) => !(QUICK_OUTCOMES as readonly string[]).includes(o.value));

  return (
    <div
      className={cn(
        'fixed top-4 left-1/2 -translate-x-1/2 z-[120] w-[min(94vw,780px)]',
        'rounded-xl border-2 border-primary bg-primary/10 backdrop-blur-md shadow-2xl',
        'px-4 py-3 space-y-2 animate-in slide-in-from-top-4',
      )}
      data-autodialer-banner=""
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setInCallDrawerOpen(true)}
          className="flex items-center gap-2 min-w-0 flex-1 text-left hover:opacity-80 transition-opacity"
          title="Abrir detalhes do lead"
        >
          <PhoneOutgoing className="h-4 w-4 shrink-0 text-primary animate-pulse" />
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">
              Discando {pendingOutcome.name} — atenda no seu softphone
            </div>
            <div className="text-xs text-muted-foreground">
              {pendingOutcome.phone} · ramal {pendingOutcome.ramal || '—'} · {formatElapsed(elapsed)}
            </div>
          </div>
        </button>
        <Badge variant="secondary" className="shrink-0 text-[10px]">via Sonax</Badge>
        <Button
          size="icon"
          variant={inCallDrawerOpen ? 'default' : 'outline'}
          className="h-9 w-9 rounded-full shrink-0"
          onClick={() => setInCallDrawerOpen(!inCallDrawerOpen)}
          title="Ver dados do lead"
        >
          <PanelRight className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="outline"
          className="h-9 w-9 rounded-full shrink-0"
          onClick={skipCurrent}
          title="Pular para o próximo (sem registrar)"
        >
          <SkipForward className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-muted-foreground mr-1">Como foi essa ligação?</span>
        {quick.map((o) => (
          <Button key={o.value} size="sm" variant="outline" className="h-8 text-xs" disabled={saving} onClick={() => save(o.value)}>
            {o.label}
          </Button>
        ))}
        <Select onValueChange={(v) => save(v)} disabled={saving}>
          <SelectTrigger className="h-8 w-[190px] text-xs"><SelectValue placeholder="Outro resultado…" /></SelectTrigger>
          <SelectContent>
            {rest.map((o) => (
              <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" variant="ghost" className="h-8 text-xs text-muted-foreground" disabled={saving} onClick={() => save('nao_registrado')}>
          Não sei / pular registro
        </Button>
      </div>
    </div>
  );
}
