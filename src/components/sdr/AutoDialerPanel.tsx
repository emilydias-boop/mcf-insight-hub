import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAutoDialer, type AutoDialerLead } from '@/contexts/AutoDialerContext';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { isValidPhoneNumber, normalizePhoneNumber } from '@/lib/phoneUtils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Play, Pause, SkipForward, Square, Trash2, Loader2, Phone, PhoneOff, CheckCircle2, XCircle, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCRMStages, useCRMDeals } from '@/hooks/useCRMData';
import { PipelineSelector } from '@/components/crm/PipelineSelector';
import { useActiveBU } from '@/hooks/useActiveBU';
import { useBUPipelineMap } from '@/hooks/useBUPipelineMap';
import { useSDROriginOverride } from '@/hooks/useSDROriginOverride';
import { useAuth } from '@/contexts/AuthContext';
import { isSdrRole } from '@/components/auth/NegociosAccessGuard';
import { toast } from 'sonner';
import { TEMPERATURE_META, type LeadTemperature } from '@/components/crm/LeadTemperatureSelector';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PHONE_CANDIDATE_REGEX = /(?:\+?55[\s().-]*)?(?:\(?\d{2}\)?[\s().-]*)?\d{4,5}[\s.-]*\d{4}/g;

const extractPhoneCandidates = (value: string): string[] => {
  const matches = value.match(PHONE_CANDIDATE_REGEX);
  if (matches && matches.length > 0) return matches.map((match) => match.trim());

  return value.split(/[\s,;]+/).map((item) => item.trim()).filter(Boolean);
};

export function AutoDialerPanel({ open, onOpenChange }: Props) {
  const ad = useAutoDialer();
  const { user, role, allRoles } = useAuth();
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
  const [mode, setMode] = useState<'pipeline' | 'paste'>('pipeline');
  const [pipelineId, setPipelineId] = useState<string | null>(null);
  const [stageId, setStageId] = useState<string | null>(null);
  // Filtro opcional por temperatura: null = todos
  const [tempFilter, setTempFilter] = useState<LeadTemperature>(null);

  const { data: stages, isLoading: stagesLoading } = useCRMStages(pipelineId || undefined);

  // Auto-selecionar pipeline quando o SDR só tem 1 origem disponível
  useEffect(() => {
    if (mode !== 'pipeline') return;
    if (pipelineId) return;
    if (restrictToSdrOrigins && sdrPipelineOptions.length === 1) {
      setPipelineId(sdrPipelineOptions[0].id);
    }
  }, [mode, pipelineId, restrictToSdrOrigins, sdrPipelineOptions]);

  // Mantemos useCRMDeals só para mostrar a CONTAGEM aproximada no botão
  // (limite do hook = 1000). O carregamento real da fila é paginado abaixo
  // e respeita o filtro "discado hoje".
  const { data: stageDeals, isLoading: dealsLoading } = useCRMDeals(
    stageId
      ? (restrictToSdrOrigins && pipelineId
          ? { stageId, originId: pipelineId, ownerProfileId: user?.id, limit: 1000 }
          : { stageId, limit: 1000 })
      : {}
  );

  const [loadingQueue, setLoadingQueue] = useState(false);

  // Início de "hoje" em America/Sao_Paulo (ISO UTC).
  // Usamos isto para excluir leads já discados HOJE; após virar o dia,
  // o lead volta a aparecer na fila normalmente.
  const startOfTodaySaoPauloIso = (): string => {
    const ymd = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    return new Date(`${ymd}T00:00:00-03:00`).toISOString();
  };

  // Busca paginada de TODOS os deals elegíveis do estágio (sem cap de 1000),
  // já filtrando server-side os que foram discados hoje.
  const fetchEligibleStageDeals = async (): Promise<any[]> => {
    if (!stageId) return [];
    const cutoff = startOfTodaySaoPauloIso();
    const all: any[] = [];
    const pageSize = 1000;
    for (let from = 0; from < 20000; from += pageSize) {
      let q = supabase
        .from('crm_deals')
        .select('id, name, contact_id, origin_id, custom_fields, lead_temperature, owner_profile_id, crm_contacts(name, phone)')
        .eq('stage_id', stageId)
        .eq('is_duplicate', false)
        .is('archived_at', null)
        .eq('is_archived', false)
        .or(`last_auto_dialer_call_at.is.null,last_auto_dialer_call_at.lt.${cutoff}`)
        .range(from, from + pageSize - 1);
      if (restrictToSdrOrigins && pipelineId) q = q.eq('origin_id', pipelineId);
      if (restrictToSdrOrigins && user?.id) q = q.eq('owner_profile_id', user.id);
      const { data, error } = await q;
      if (error) { console.error('[autodialer] paginated fetch error', error); break; }
      const rows = data || [];
      all.push(...rows);
      if (rows.length < pageSize) break;
    }
    return all;
  };

  // Reset stage quando muda pipeline
  const handleSelectPipeline = (id: string | null) => {
    setPipelineId(id);
    setStageId(null);
  };

  // Sufixos para casar telefone com DDD + número.
  // 11 dígitos = celular novo (DDD + 9 + 8). 10 dígitos = celular antigo / fixo (DDD + 8).
  // Para celulares novos geramos também a variante "sem o 9" (DDD + 8) para casar com
  // contatos antigos. Nunca usamos só 8/9 dígitos sem DDD — cruzaria pessoas distintas.
  const phoneSuffixes = (phone: string): string[] => {
    const digits = phone.replace(/\D/g, '');
    const sufs = new Set<string>();
    if (digits.length >= 11) {
      const s11 = digits.slice(-11); // DDD(2) + 9 + 8
      sufs.add(s11);
      // Variante sem o "9" inicial do celular: DDD(2) + 8 = 10 dígitos
      if (s11[2] === '9') sufs.add(s11.slice(0, 2) + s11.slice(3));
    } else if (digits.length === 10) {
      const s10 = digits.slice(-10); // DDD(2) + 8
      sufs.add(s10);
      // Variante com "9" adicionado (celular novo): DDD(2) + 9 + 8 = 11 dígitos
      sufs.add(s10.slice(0, 2) + '9' + s10.slice(2));
    }
    return Array.from(sufs);
  };

  const matchesPhone = (storedPhone: string, originalNorm: string): boolean => {
    const a = storedPhone.replace(/\D/g, '');
    if (!a) return false;
    const variants = phoneSuffixes(originalNorm);
    return variants.some((suf) => suf.length >= 10 && a.endsWith(suf));
  };

  const lookupLeadsByPhones = async (
    phones: string[],
  ): Promise<Map<string, { dealId: string; contactId: string; originId: string | null; name: string; archived: boolean }>> => {
    const map = new Map<string, { dealId: string; contactId: string; originId: string | null; name: string; archived: boolean }>();
    // Coleta todos os sufixos (11 e 10) de todos os telefones
    const allSuffixes = new Set<string>();
    phones.forEach(p => phoneSuffixes(p).forEach(s => allSuffixes.add(s)));
    if (allSuffixes.size === 0) return map;

    const orFilter = Array.from(allSuffixes)
      .map(suf => `phone.ilike.%${suf}`)
      .join(',');

    const { data: contacts, error: cErr } = await supabase
      .from('crm_contacts')
      .select('id, name, phone')
      .or(orFilter)
      .limit(5000);
    if (cErr || !contacts || contacts.length === 0) return map;

    const contactIds = contacts.map(c => c.id);
    // Inclui deals arquivados também — preferimos um deal arquivado a marcar
    // o lead como "manual" (assim o drawer ainda abre e o operador vê o histórico).
    const { data: deals } = await supabase
      .from('crm_deals')
      .select('id, name, contact_id, origin_id, created_at, is_archived')
      .in('contact_id', contactIds)
      .order('created_at', { ascending: false })
      .limit(5000);

    // Mantém o deal mais recente por contato — preferindo não-arquivado
    const newestByContact = new Map<string, any>();
    (deals || []).forEach((d: any) => {
      const existing = newestByContact.get(d.contact_id);
      if (!existing) {
        newestByContact.set(d.contact_id, d);
        return;
      }
      // Se o atual é arquivado e o novo não, troca
      if (existing.is_archived && !d.is_archived) {
        newestByContact.set(d.contact_id, d);
      }
    });

    // Para cada telefone original, escolhe o contato cujo telefone armazenado
    // bate pelo sufixo de 11 ou 10 dígitos (DDD + número), com fallback de variante 9-extra.
    phones.forEach(orig => {
      if (map.has(orig)) return;
      const c = contacts.find(ct => matchesPhone(ct.phone || '', orig));
      if (!c) return;
      const d = newestByContact.get(c.id);
      if (!d) {
        // Contato existe mas sem deal — ainda assim retornamos o contactId
        // como "manual com nome", para o operador ter o nome no banner.
        map.set(orig, {
          dealId: `manual-contact-${c.id}`,
          contactId: c.id,
          originId: null,
          name: c.name || 'Lead',
          archived: false,
        });
        return;
      }
      map.set(orig, {
        dealId: d.id,
        contactId: c.id,
        originId: d.origin_id || null,
        name: c.name || d.name || 'Lead',
        archived: !!d.is_archived,
      });
    });
    return map;
  };

  const loadFromPaste = async () => {
    // Extrai telefones mesmo quando vêm misturados com nomes, numeração da lista
    // e observações (ex: "1. Maria +55 11 99999-8888 Completo").
    const tokens = extractPhoneCandidates(pasted);
    const valid: string[] = [];
    const invalid: string[] = [];
    const seen = new Set<string>();
    tokens.forEach(t => {
      if (isValidPhoneNumber(t)) {
        const normalized = normalizePhoneNumber(t);
        if (!seen.has(normalized)) {
          seen.add(normalized);
          valid.push(normalized);
        }
      }
      else invalid.push(t);
    });
    if (valid.length === 0) {
      toast.error('Nenhum telefone válido encontrado. Cole 1 número por linha (ex: 11987654321).');
      return;
    }
    // Faz lookup dos leads pelo sufixo de 9 dígitos do telefone
    let matchedMap = new Map<string, { dealId: string; contactId: string; originId: string | null; name: string; archived: boolean }>();
    try {
      matchedMap = await lookupLeadsByPhones(valid);
    } catch (e) {
      console.warn('[autodialer] lookup por telefone falhou', e);
    }

    let matchedCount = 0;
    let archivedCount = 0;
    let onlyContactCount = 0;
    const leads: AutoDialerLead[] = valid.map((phone, i) => {
      const m = matchedMap.get(phone);
      if (m) {
        if (m.dealId.startsWith('manual-contact-')) onlyContactCount++;
        else {
          matchedCount++;
          if (m.archived) archivedCount++;
        }
        return {
          dealId: m.dealId,
          contactId: m.contactId,
          originId: m.originId,
          name: m.archived ? `${m.name} (arquivado)` : m.name,
          phone,
        };
      }
      return {
        dealId: `manual-${Date.now()}-${i}`,
        contactId: null,
        originId: null,
        name: `Avulso ${i + 1}`,
        phone,
      };
    });
    ad.loadQueue(leads);
    const parts: string[] = [`${valid.length} telefone(s) carregado(s)`];
    if (matchedCount > 0) {
      parts.push(
        archivedCount > 0
          ? `${matchedCount} vinculado(s) ao CRM (${archivedCount} arquivado${archivedCount > 1 ? 's' : ''})`
          : `${matchedCount} vinculado(s) a leads do CRM`,
      );
    }
    if (onlyContactCount > 0) parts.push(`${onlyContactCount} só com contato (sem deal)`);
    const unmatched = valid.length - matchedCount - onlyContactCount;
    if (unmatched > 0) parts.push(`${unmatched} sem match (avulso)`);
    if (invalid.length > 0) parts.push(`${invalid.length} ignorado(s) por formato inválido`);
    const msg = parts.join(' · ');
    if (invalid.length > 0) toast.warning(msg);
    else toast.success(msg);
    setPasted('');
  };

  // Phone pode vir do contato vinculado OU do custom_fields do deal
  // (leads importados/webhook frequentemente não têm crm_contact e
  // armazenam o telefone em custom_fields.complete_phone / phone)
  const getDealPhone = (d: any): string => {
    const cf = (d?.custom_fields || {}) as Record<string, any>;
    return (
      d?.crm_contacts?.phone ||
      cf.complete_phone ||
      cf.phone ||
      ''
    );
  };

  const loadFromStage = async (opts?: { excludeAlreadyDialed?: boolean; excludeIds?: string[] }) => {
    if (!stageId) return;
    setLoadingQueue(true);
    try {
      const rows = await fetchEligibleStageDeals();
      // Dedupe local da sessão (não voltar os mesmos no "Carregar próximos")
      const fromResults = opts?.excludeAlreadyDialed
        ? Object.entries(ad.results).filter(([, r]) => r && r !== 'pending').map(([id]) => id)
        : [];
      const alreadyDialed = new Set<string>([...(opts?.excludeIds || []), ...fromResults]);
      const leads: AutoDialerLead[] = rows
        .map((d: any) => {
          const phone = getDealPhone(d);
          if (!phone) return null;
          if (alreadyDialed.has(d.id)) return null;
          if (tempFilter && d.lead_temperature !== tempFilter) return null;
          return {
            dealId: d.id,
            contactId: d.contact_id || null,
            originId: d.origin_id || null,
            name: d.crm_contacts?.name || d.name || 'Lead',
            phone,
          } as AutoDialerLead;
        })
        .filter((x): x is AutoDialerLead => !!x);
      if (leads.length === 0) {
        toast.error(
          tempFilter
            ? `Nenhum lead "${TEMPERATURE_META[tempFilter].label}" disponível neste estágio (todos já discados hoje?)`
            : 'Nenhum lead disponível neste estágio (todos já discados hoje ou sem telefone)',
        );
        return;
      }
      ad.loadQueue(leads);
      toast.success(`${leads.length} leads carregados`);
    } finally {
      setLoadingQueue(false);
    }
  };

  const isActive = ad.state === 'running' || ad.state === 'paused' || ad.state === 'paused-in-call' || ad.state === 'paused-qualifying';

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
            <div className="grid grid-cols-2 gap-1 p-1 bg-muted rounded-md">
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
                {/* Filtro por Temperatura */}
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase">Temperatura</label>
                  <div className="flex items-center gap-1 mt-1">
                    <button
                      type="button"
                      onClick={() => setTempFilter(null)}
                      className={cn(
                        'flex-1 text-[11px] py-1 rounded border transition-colors',
                        tempFilter === null
                          ? 'bg-primary/15 border-primary text-primary font-medium'
                          : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted',
                      )}
                    >
                      Todos
                    </button>
                    {(['quente', 'morno', 'frio'] as const).map((t) => {
                      const meta = TEMPERATURE_META[t];
                      const active = tempFilter === t;
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setTempFilter(active ? null : t)}
                          className={cn(
                            'flex items-center justify-center gap-1 flex-1 text-[11px] py-1 rounded border transition-colors',
                            active
                              ? `${meta.bg} ${meta.text} font-medium`
                              : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted',
                          )}
                          title={meta.label}
                        >
                          <span className={cn('h-2.5 w-2.5 rounded-full', meta.dot)} />
                          <span className="hidden sm:inline">{meta.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => loadFromStage()}
                  disabled={!stageId || dealsLoading || loadingQueue}
                >
                  {(dealsLoading || loadingQueue) ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {stageId
                    ? `Carregar leads do estágio${(stageDeals && stageDeals.length >= 1000) ? ' (1000+)' : stageDeals ? ` (~${stageDeals.filter((d: any) => !!getDealPhone(d) && (!tempFilter || d.lead_temperature === tempFilter)).length})` : ''}`
                    : 'Carregar leads do estágio'}
                </Button>
              </div>
            )}

            {mode === 'paste' && (
              <div className="space-y-2">
                <div className="text-[10px] text-muted-foreground uppercase">Telefones (1 por linha)</div>
                <Textarea
                  placeholder={"11987654321\n11991234567\n11999998888"}
                  value={pasted}
                  onChange={(e) => setPasted(e.target.value)}
                  className="min-h-[120px] text-xs font-mono"
                />
                <div className="text-[10px] text-muted-foreground">
                  Aceita quebra de linha, vírgula, ponto-e-vírgula ou espaço como separador.
                </div>
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
            ) : ad.state === 'paused' ? (
              <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700 text-white" onClick={ad.resume}>
                <Play className="h-4 w-4 mr-1" /> Retomar
              </Button>
            ) : ad.state === 'idle' ? (
              <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700 text-white" onClick={ad.start} disabled={ad.queue.length === 0}>
                <Play className="h-4 w-4 mr-1" /> Iniciar
              </Button>
            ) : ad.state === 'finished' ? (
              <div className="flex-1 flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Fila concluída</span>
                {mode === 'pipeline' && stageId && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="ml-auto"
                    onClick={() => {
                      // Captura IDs já discados ANTES do stop() (que limpa results)
                      const dialedIds = Object.entries(ad.results)
                        .filter(([, r]) => r && r !== 'pending')
                        .map(([id]) => id);
                      ad.stop();
                      setTimeout(() => loadFromStage({ excludeIds: dialedIds }), 50);
                    }}
                  >
                    Carregar próximos
                  </Button>
                )}
              </div>
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
