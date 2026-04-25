import { useState } from 'react';
import { useAutoDialer, type AutoDialerLead } from '@/contexts/AutoDialerContext';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Play, Pause, SkipForward, Square, Trash2, Loader2, Phone, PhoneOff, CheckCircle2, XCircle, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSDRQueueInfinite } from '@/hooks/useSDRCockpit';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AutoDialerPanel({ open, onOpenChange }: Props) {
  const ad = useAutoDialer();
  const sdrQueue = useSDRQueueInfinite();
  const [pasted, setPasted] = useState('');

  const loadFromCockpit = () => {
    const leads: AutoDialerLead[] = (sdrQueue.data || [])
      .filter(d => d.contactPhone)
      .map(d => ({
        dealId: d.id,
        contactId: null, // RPC não traz contactId direto; ok — fica avulso
        originId: d.originId,
        name: d.contactName || d.name || 'Lead',
        phone: d.contactPhone || '',
      }))
      .slice(0, 100);
    if (leads.length === 0) {
      return;
    }
    ad.loadQueue(leads);
  };

  const loadFromPaste = () => {
    const lines = pasted.split(/[\n,;]/).map(s => s.trim()).filter(Boolean);
    const leads: AutoDialerLead[] = lines.map((phone, i) => ({
      dealId: `manual-${Date.now()}-${i}`,
      contactId: null,
      originId: null,
      name: `Avulso ${i + 1}`,
      phone,
    }));
    ad.loadQueue(leads);
    setPasted('');
  };

  const isActive = ad.state === 'running' || ad.state === 'paused-in-call' || ad.state === 'paused-qualifying';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
        <SheetHeader className="px-4 pt-4 pb-2 border-b">
          <SheetTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" /> Auto-Discador
          </SheetTitle>
          <SheetDescription className="text-xs">
            Disca leads em sequência. Pausa quando alguém atende, retoma após qualificar.
          </SheetDescription>
        </SheetHeader>

        {/* Stats */}
        <div className="px-4 py-3 grid grid-cols-4 gap-2 border-b">
          <Stat label="Total" value={ad.stats.total} />
          <Stat label="Atendeu" value={ad.stats.answered} className="text-green-500" />
          <Stat label="Não" value={ad.stats.noAnswer} className="text-red-500" />
          <Stat label="Falha" value={ad.stats.failed} className="text-amber-500" />
        </div>

        {/* Configurações */}
        <div className="px-4 py-3 grid grid-cols-2 gap-2 border-b">
          <div>
            <label className="text-[10px] text-muted-foreground uppercase">Tempo de toque</label>
            <Select
              value={String(ad.ringTimeoutMs)}
              onValueChange={(v) => ad.setRingTimeoutMs(Number(v))}
              disabled={isActive}
            >
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="15000">15s</SelectItem>
                <SelectItem value="25000">25s</SelectItem>
                <SelectItem value="40000">40s</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase">Pausa entre</label>
            <Select
              value={String(ad.betweenCallsMs)}
              onValueChange={(v) => ad.setBetweenCallsMs(Number(v))}
              disabled={isActive}
            >
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="2000">2s</SelectItem>
                <SelectItem value="5000">5s</SelectItem>
                <SelectItem value="10000">10s</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Carregar fila */}
        {!isActive && ad.queue.length === 0 && (
          <div className="px-4 py-3 space-y-2 border-b">
            <Button size="sm" variant="outline" className="w-full" onClick={loadFromCockpit} disabled={sdrQueue.isLoading}>
              {sdrQueue.isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Carregar fila do Cockpit ({sdrQueue.data?.length || 0})
            </Button>
            <div className="text-[10px] text-muted-foreground uppercase pt-1">Ou cole telefones (1 por linha)</div>
            <Input
              placeholder="11987654321&#10;11991234567"
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              className="h-8 text-xs font-mono"
            />
            <Button size="sm" variant="outline" className="w-full" disabled={!pasted.trim()} onClick={loadFromPaste}>
              Carregar lista colada
            </Button>
          </div>
        )}

        {/* Controles */}
        {ad.queue.length > 0 && (
          <div className="px-4 py-3 flex items-center gap-2 border-b">
            {ad.state === 'running' ? (
              <Button size="sm" variant="outline" onClick={ad.pause} className="flex-1">
                <Pause className="h-4 w-4 mr-1" /> Pausar
              </Button>
            ) : ad.state === 'idle' && ad.currentIndex < ad.queue.length - 1 ? (
              <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700 text-white" onClick={ad.currentIndex < 0 ? ad.start : ad.resume}>
                <Play className="h-4 w-4 mr-1" /> {ad.currentIndex < 0 ? 'Iniciar' : 'Retomar'}
              </Button>
            ) : ad.state === 'finished' ? (
              <div className="flex-1 text-center text-xs text-muted-foreground">Fila concluída</div>
            ) : (
              <div className="flex-1 text-center text-xs text-muted-foreground">
                {ad.state === 'paused-in-call' ? 'Em ligação...' : 'Aguardando qualificação...'}
              </div>
            )}
            <Button size="sm" variant="outline" onClick={ad.skipCurrent} disabled={ad.state === 'idle' || ad.state === 'finished'}>
              <SkipForward className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={ad.stop} title="Parar e limpar fila">
              <Square className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Lista da fila */}
        <div className="flex-1 overflow-y-auto">
          {ad.queue.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Carregue uma fila para começar
            </div>
          ) : (
            <ul className="divide-y">
              {ad.queue.map((lead, i) => {
                const result = ad.results[lead.dealId] || 'pending';
                const isCurrent = i === ad.currentIndex;
                return (
                  <li key={lead.dealId} className={cn(
                    'px-4 py-2 flex items-center gap-2',
                    isCurrent && 'bg-primary/10 border-l-4 border-l-primary',
                  )}>
                    <ResultIcon result={result} isCurrent={isCurrent} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{lead.name}</div>
                      <div className="text-[11px] text-muted-foreground font-mono">{lead.phone}</div>
                    </div>
                    <Badge variant="outline" className="text-[9px] py-0 px-1.5">{i + 1}</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {ad.queue.length > 0 && !isActive && (
          <div className="px-4 py-2 border-t">
            <Button size="sm" variant="ghost" className="w-full text-xs text-muted-foreground" onClick={ad.stop}>
              <Trash2 className="h-3 w-3 mr-1" /> Limpar fila
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Stat({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <div className="text-center">
      <div className={cn('text-lg font-bold tabular-nums', className)}>{value}</div>
      <div className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</div>
    </div>
  );
}

function ResultIcon({ result, isCurrent }: { result: string; isCurrent: boolean }) {
  if (isCurrent && (result === 'in-progress' || result === 'pending')) {
    return <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />;
  }
  if (result === 'answered') return <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />;
  if (result === 'no-answer') return <PhoneOff className="h-4 w-4 text-red-500 shrink-0" />;
  if (result === 'failed') return <XCircle className="h-4 w-4 text-amber-500 shrink-0" />;
  if (result === 'skipped') return <SkipForward className="h-4 w-4 text-muted-foreground shrink-0" />;
  return <Circle className="h-4 w-4 text-muted-foreground/40 shrink-0" />;
}
