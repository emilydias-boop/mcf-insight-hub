import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAutoDialer, type AutoDialerLead } from '@/contexts/AutoDialerContext';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Play, Pause, SkipForward, Square, Trash2, Loader2, Phone, PhoneOff, CheckCircle2, XCircle, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSDRQueueInfinite } from '@/hooks/useSDRCockpit';
import { useCRMStages, useCRMDeals } from '@/hooks/useCRMData';
import { PipelineSelector } from '@/components/crm/PipelineSelector';
import { useActiveBU } from '@/hooks/useActiveBU';
import { useBUPipelineMap } from '@/hooks/useBUPipelineMap';
import { useSDROriginOverride } from '@/hooks/useSDROriginOverride';
import { useAuth } from '@/contexts/AuthContext';
import { isSdrRole } from '@/components/auth/NegociosAccessGuard';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AutoDialerPanel({ open, onOpenChange }: Props) {
  const ad = useAutoDialer();
  const sdrQueue = useSDRQueueInfinite();
  const { role, allRoles } = useAuth();
  const isSdr = isSdrRole(role, allRoles);
  const activeBU = useActiveBU();
  const { data: buMapping } = useBUPipelineMap(activeBU);
  const { data: sdrOriginOverride } = useSDROriginOverride();

  // Origens permitidas para o SDR — override individual tem prioridade,
  // senão usa as origens mapeadas para a BU dele.
  const sdrOriginIds = useMemo<string[]>(() => {
    if (!isSdr) return [];
    if (sdrOriginOverride && sdrOriginOverride.length > 0) return sdrOriginOverride;
    return buMapping?.origins || [];
  }, [isSdr, sdrOriginOverride, buMapping]);

  // Buscar nomes das origens permitidas para mostrar no seletor (caso haja >1)
  const { data: sdrPipelineOptions = [] } = useQuery({
    queryKey: ['autodialer-sdr-pipelines', sdrOriginIds],
    queryFn: async (): Promise<{ id: string; name: string }[]> => {
      if (sdrOriginIds.length === 0) return [];
      const { data, error } = await supabase
        .from('crm_origins')
        .select('id, name')
        .in('id', sdrOriginIds)
        .not('is_archived', 'eq', true)
        .order('name');
      if (error) return [];
      return (data || []).map(o => ({ id: o.id, name: o.name as string }));
    },
    enabled: isSdr && sdrOriginIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  // Para admin/manager: undefined = sem filtro (usa o seletor padrão de funis)
  // Para SDR: usa origens permitidas (a "pipeline" é a origem aqui)
  const restrictToSdrOrigins = isSdr;

  const [pasted, setPasted] = useState('');
  const [mode, setMode] = useState<'cockpit' | 'pipeline' | 'paste'>('cockpit');
  const [pipelineId, setPipelineId] = useState<string | null>(null);
  const [stageId, setStageId] = useState<string | null>(null);

  const { data: stages, isLoading: stagesLoading } = useCRMStages(pipelineId || undefined);

  // Auto-selecionar pipeline quando o SDR só tem 1 origem disponível
  useEffect(() => {
    if (mode !== 'pipeline') return;
    if (pipelineId) return;
    if (restrictToSdrOrigins && sdrPipelineOptions.length === 1) {
      setPipelineId(sdrPipelineOptions[0].id);
    }
  }, [mode, pipelineId, restrictToSdrOrigins, sdrPipelineOptions]);

  const { data: stageDeals, isLoading: dealsLoading } = useCRMDeals(
    stageId
      ? (restrictToSdrOrigins && pipelineId
          ? { stageId, originId: pipelineId, limit: 100 }
          : { stageId, limit: 100 })
      : {}
  );

  // Reset stage quando muda pipeline
  const handleSelectPipeline = (id: string | null) => {
    setPipelineId(id);
    setStageId(null);
  };

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

  const loadFromStage = () => {
    if (!stageId || !stageDeals) return;
    const leads: AutoDialerLead[] = stageDeals
      .filter((d: any) => d.crm_contacts?.phone)
      .map((d: any) => ({
        dealId: d.id,
        contactId: d.contact_id || null,
        originId: d.origin_id || null,
        name: d.crm_contacts?.name || d.name || 'Lead',
        phone: d.crm_contacts?.phone || '',
      }))
      .slice(0, 100);
    if (leads.length === 0) {
      toast.error('Nenhum lead com telefone neste estágio');
      return;
    }
    ad.loadQueue(leads);
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
          <div>
            <label className="text-[10px] text-muted-foreground uppercase">Tentativas/lead</label>
            <Select
              value={String(ad.maxAttemptsPerLead)}
              onValueChange={(v) => ad.setMaxAttemptsPerLead(Number(v))}
              disabled={isActive}
            >
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1x (sem retry)</SelectItem>
                <SelectItem value="2">2x</SelectItem>
                <SelectItem value="3">3x</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase">Espera p/ retry</label>
            <Select
              value={String(ad.retryDelayMs)}
              onValueChange={(v) => ad.setRetryDelayMs(Number(v))}
              disabled={isActive}
            >
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="3000">3s</SelectItem>
                <SelectItem value="5000">5s</SelectItem>
                <SelectItem value="10000">10s</SelectItem>
                <SelectItem value="20000">20s</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Carregar fila */}
        {!isActive && ad.queue.length === 0 && (
          <div className="px-4 py-3 space-y-3 border-b">
            {/* Tabs de modo */}
            <div className="grid grid-cols-3 gap-1 p-1 bg-muted rounded-md">
              <button
                onClick={() => setMode('cockpit')}
                className={cn(
                  'text-[11px] font-medium py-1.5 rounded transition-colors',
                  mode === 'cockpit' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Cockpit
              </button>
              <button
                onClick={() => setMode('pipeline')}
                className={cn(
                  'text-[11px] font-medium py-1.5 rounded transition-colors',
                  mode === 'pipeline' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Por Estágio
              </button>
              <button
                onClick={() => setMode('paste')}
                className={cn(
                  'text-[11px] font-medium py-1.5 rounded transition-colors',
                  mode === 'paste' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Colar
              </button>
            </div>

            {mode === 'cockpit' && (
              <Button size="sm" variant="outline" className="w-full" onClick={loadFromCockpit} disabled={sdrQueue.isLoading}>
                {sdrQueue.isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Carregar fila do Cockpit ({sdrQueue.data?.length || 0})
              </Button>
            )}

            {mode === 'pipeline' && (
              <div className="space-y-2">
                {/* SDR: lista origens permitidas. Se só houver 1, ela é fixada
                    automaticamente e o seletor é omitido. */}
                {restrictToSdrOrigins ? (
                  sdrPipelineOptions.length > 1 && (
                    <div>
                      <label className="text-[10px] text-muted-foreground uppercase">Pipeline</label>
                      <Select
                        value={pipelineId || ''}
                        onValueChange={(v) => handleSelectPipeline(v || null)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Selecione uma pipeline" />
                        </SelectTrigger>
                        <SelectContent>
                          {sdrPipelineOptions.map(o => (
                            <SelectItem key={o.id} value={o.id} className="text-xs">
                              {o.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )
                ) : (
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase">Pipeline</label>
                    <div className="[&>div]:w-full [&_button]:w-full [&_label]:hidden">
                      <PipelineSelector
                        selectedPipelineId={pipelineId}
                        onSelectPipeline={handleSelectPipeline}
                      />
                    </div>
                  </div>
                )}
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase">Estágio</label>
                  <Select
                    value={stageId || ''}
                    onValueChange={setStageId}
                    disabled={!pipelineId || stagesLoading}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder={pipelineId ? 'Selecione um estágio' : 'Selecione um funil primeiro'} />
                    </SelectTrigger>
                    <SelectContent>
                      {(stages || []).map((s: any) => (
                        <SelectItem key={s.id} value={s.id} className="text-xs">
                          {s.stage_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={loadFromStage}
                  disabled={!stageId || dealsLoading}
                >
                  {dealsLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {stageId
                    ? `Carregar ${stageDeals?.filter((d: any) => d.crm_contacts?.phone).length || 0} leads do estágio`
                    : 'Carregar leads do estágio'}
                </Button>
              </div>
            )}

            {mode === 'paste' && (
              <div className="space-y-2">
                <div className="text-[10px] text-muted-foreground uppercase">Telefones (1 por linha)</div>
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
                const attemptCount = ad.attempts[lead.dealId] || 0;
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
                    {attemptCount > 0 && (
                      <Badge variant="secondary" className="text-[9px] py-0 px-1.5" title="Tentativas realizadas">
                        {attemptCount}/{ad.maxAttemptsPerLead}
                      </Badge>
                    )}
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
