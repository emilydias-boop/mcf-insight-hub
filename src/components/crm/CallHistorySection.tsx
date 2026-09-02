import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Phone, Clock, User, FileText, Volume2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useContactDealIds } from '@/hooks/useContactDealIds';
import { useSonaxCallEventsByDeal, sonaxClientPhone } from '@/hooks/useSonaxCallEvents';
import { sonaxRecordingProxy, sonaxDurationSeconds, sonaxParseDate } from '@/lib/sonaxRecording';

const SUPABASE_URL = "https://rehcfgqvigfcekiipqkc.supabase.co";

interface CallHistorySectionProps {
  contactId?: string;
  dealId?: string;
}

// Call record interface
interface CallRecord {
  id: string;
  user_id: string;
  to_number: string | null;
  status: string;
  duration_seconds: number | null;
  started_at: string | null;
  ended_at: string | null;
  outcome: string | null;
  notes: string | null;
  created_at: string;
  recording_url: string | null;
  profiles?: { full_name: string | null };
}

const OUTCOME_LABELS: Record<string, { label: string; color: string }> = {
  sem_contato: { label: 'Sem contato', color: 'bg-gray-100 text-gray-700' },
  ocupado: { label: 'Ocupado', color: 'bg-yellow-100 text-yellow-700' },
  caixa_postal: { label: 'Caixa postal', color: 'bg-gray-100 text-gray-700' },
  numero_errado: { label: 'Número errado', color: 'bg-red-100 text-red-700' },
  interessado: { label: 'Interessado', color: 'bg-green-100 text-green-700' },
  nao_interessado: { label: 'Não interessado', color: 'bg-red-100 text-red-700' },
  agendou_r1: { label: 'Agendou R1', color: 'bg-blue-100 text-blue-700' },
  agendou_r2: { label: 'Agendou R2', color: 'bg-blue-100 text-blue-700' },
  follow_up: { label: 'Follow-up', color: 'bg-orange-100 text-orange-700' },
  outro: { label: 'Outro', color: 'bg-gray-100 text-gray-700' },
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  initiated: { label: 'Iniciada', color: 'bg-gray-100 text-gray-700' },
  ringing: { label: 'Chamando', color: 'bg-yellow-100 text-yellow-700' },
  'in-progress': { label: 'Em andamento', color: 'bg-blue-100 text-blue-700' },
  completed: { label: 'Completada', color: 'bg-green-100 text-green-700' },
  failed: { label: 'Falhou', color: 'bg-red-100 text-red-700' },
  busy: { label: 'Ocupado', color: 'bg-yellow-100 text-yellow-700' },
  'no-answer': { label: 'Não atendeu', color: 'bg-orange-100 text-orange-700' },
  canceled: { label: 'Cancelada', color: 'bg-gray-100 text-gray-700' },
};

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return '0s';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

// Calculate duration from timestamps if duration_seconds is 0
function getCallDuration(call: CallRecord): number {
  if (call.duration_seconds && call.duration_seconds > 0) {
    return call.duration_seconds;
  }
  if (call.started_at && call.ended_at) {
    return Math.floor((new Date(call.ended_at).getTime() - new Date(call.started_at).getTime()) / 1000);
  }
  return 0;
}

// Get proxy URL for recording playback
function getRecordingProxyUrl(recordingUrl: string): string {
  // Extract RecordingSid from URL like: https://api.twilio.com/.../Recordings/RE123.mp3
  const match = recordingUrl.match(/Recordings\/([^.\/]+)/);
  if (match && match[1]) {
    return `${SUPABASE_URL}/functions/v1/get-recording?recordingSid=${match[1]}`;
  }
  return recordingUrl;
}

export function CallHistorySection({ contactId, dealId }: CallHistorySectionProps) {
  const { data: allDealIds = [] } = useContactDealIds(dealId, contactId);
  const uniqueIds = [...new Set([...allDealIds, ...(dealId ? [dealId] : [])].filter(Boolean))];
  const { data: sonaxEvents = [], isLoading: sonaxLoading } = useSonaxCallEventsByDeal(uniqueIds as string[]);

  const { data: calls, isLoading } = useQuery({
    queryKey: ['calls-history', uniqueIds, contactId],
    queryFn: async (): Promise<CallRecord[]> => {
      let query = (supabase as any)
        .from('calls')
        .select(`
          id,
          user_id,
          to_number,
          status,
          duration_seconds,
          started_at,
          ended_at,
          outcome,
          notes,
          created_at,
          recording_url
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      // Use .in() for cross-pipeline queries
      if (uniqueIds.length > 0) {
        query = query.in('deal_id', uniqueIds);
      } else if (contactId) {
        query = query.eq('contact_id', contactId);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      // Fetch user names separately
      const userIds = (data || []).map((c: any) => c.user_id).filter((id: any): id is string => typeof id === 'string');
      const uniqueUserIds = [...new Set<string>(userIds)];
      
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', uniqueUserIds);
      
      const profileMap = new Map(profiles?.map(p => [p.id, p.full_name]) || []);
      
      return (data || []).map((call: any) => ({
        ...call,
        profiles: { full_name: profileMap.get(call.user_id) || null }
      }));
    },
    enabled: uniqueIds.length > 0 || !!contactId
  });

  // Timeline unificada: Twilio (calls) + Sonax (sonax_call_events)
  const sonaxItems: SonaxItem[] = (sonaxEvents || []).map((ev) => ({
    id: `sonax-${ev.id}`,
    at: sonaxParseDate(ev.data_inicio) || new Date(ev.created_at),
    who: ev.sdr_name || ev.sdr_email || (ev.aliasramal || ev.ramal ? `Ramal ${ev.aliasramal || ev.ramal}` : 'Sonax'),
    phone: sonaxClientPhone(ev),
    duration: sonaxDurationSeconds(ev.duracao_chamada),
    notAnswered: (ev.status_atendimento || '').toUpperCase() === 'N',
    recording: (ev.status_atendimento || '').toUpperCase() === 'N' ? null : sonaxRecordingProxy(ev.url_gravacao),
    recordingRaw: (ev.status_atendimento || '').toUpperCase() === 'N' ? null : ev.url_gravacao,
  }));

  const merged: TimelineEntry[] = [
    ...sonaxItems.map((item) => ({ at: item.at, kind: 'sonax' as const, item })),
    ...(calls || []).map((call) => ({ at: new Date(call.created_at), kind: 'twilio' as const, call })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());

  if (isLoading || sonaxLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
    );
  }

  if (merged.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        <Phone className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Nenhuma ligação registrada</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Phone className="h-4 w-4 text-muted-foreground" />
        <h3 className="font-semibold text-sm">Histórico de Ligações</h3>
        <Badge variant="secondary" className="text-xs">{merged.length}</Badge>
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto">
        {merged.map((entry) =>
          entry.kind === 'sonax'
            ? <SonaxCallCard key={entry.item.id} item={entry.item} />
            : <TwilioCallCard key={entry.call.id} call={entry.call} />
        )}
      </div>
    </div>
  );
}

interface SonaxItem {
  id: string;
  at: Date;
  who: string;
  phone: string | null;
  duration: number;
  notAnswered: boolean;
  recording: string | null;
  recordingRaw: string | null;
}

type TimelineEntry =
  | { at: Date; kind: 'sonax'; item: SonaxItem }
  | { at: Date; kind: 'twilio'; call: CallRecord };

// Player para gravações que só existem na API da Sonax (marcador sonax-api:<id>).
function SonaxApiRecording({ idChamada }: { idChamada: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(false);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  const buscar = async () => {
    setLoading(true);
    setErro(false);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/get-sonax-recording`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? ''}`,
          apikey: SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ id_chamada: idChamada }),
      });
      if (!resp.ok) {
        setErro(true);
        return;
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;
      setSrc(url);
    } catch {
      setErro(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-2 pt-2 border-t border-border">
      <div className="flex items-center gap-2 mb-1">
        <Volume2 className="h-3 w-3 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Gravação</span>
        {!src && !loading && !erro && (
          <button type="button" onClick={buscar} className="text-xs text-primary hover:underline">
            ouvir gravação
          </button>
        )}
        {loading && <span className="text-xs text-muted-foreground">Buscando gravação na Sonax…</span>}
        {erro && <span className="text-xs text-muted-foreground">Gravação indisponível na Sonax</span>}
      </div>
      {src && <audio controls className="w-full h-8" src={src} preload="none" />}
    </div>
  );
}

function SonaxCallCard({ item }: { item: SonaxItem }) {
  const apiCallId = item.recordingRaw?.startsWith('sonax-api:')
    ? item.recordingRaw.slice('sonax-api:'.length).trim()
    : null;

  return (

    <div className="p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
      <div className="flex justify-between items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-sm">
            <User className="h-3 w-3 text-muted-foreground" />
            <span className="font-medium truncate">{item.who}</span>
            <span className="text-muted-foreground">•</span>
            <span className="text-muted-foreground text-xs">
              {format(item.at, "dd/MM HH:mm", { locale: ptBR })}
            </span>
          </div>
          {item.phone && <p className="text-xs text-muted-foreground mt-1">{item.phone}</p>}
        </div>
        <div className="flex items-center gap-1 text-xs">
          <Clock className="h-3 w-3 text-muted-foreground" />
          <span className="font-mono">{formatDuration(item.duration)}</span>
        </div>
      </div>

      <div className="flex gap-2 mt-2 flex-wrap">
        <Badge variant="outline" className="text-xs">Sonax</Badge>
        <Badge className={`text-xs ${item.notAnswered ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
          {item.notAnswered ? 'Não atendeu' : 'Completada'}
        </Badge>
      </div>

      {item.recording && (
        <div className="mt-2 pt-2 border-t border-border">
          <div className="flex items-center gap-2 mb-1">
            <Volume2 className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Gravação</span>
            <a
              href={item.recordingRaw!}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline"
            >
              abrir na Sonax
            </a>
          </div>
          <audio controls className="w-full h-8" preload="none">
            <source src={item.recording} type="audio/mpeg" />
          </audio>
        </div>
      )}

      {/* Sem URL pública: o webhook gravou o marcador `sonax-api:<id_chamada>`.
          Buscamos o áudio na API somente quando o usuário pede para ouvir. */}
      {!item.recording && apiCallId && (
        <SonaxApiRecording idChamada={apiCallId} />
      )}

    </div>
  );
}

function TwilioCallCard({ call }: { call: CallRecord }) {
  const statusInfo = STATUS_LABELS[call.status] || { label: call.status, color: 'bg-gray-100' };
  const outcomeInfo = call.outcome ? OUTCOME_LABELS[call.outcome] : null;

  return (
    <div className="p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
      <div className="flex justify-between items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-sm">
            <User className="h-3 w-3 text-muted-foreground" />
            <span className="font-medium truncate">{call.profiles?.full_name || 'Usuário'}</span>
            <span className="text-muted-foreground">•</span>
            <span className="text-muted-foreground text-xs">
              {format(new Date(call.created_at), "dd/MM HH:mm", { locale: ptBR })}
            </span>
          </div>
          {call.to_number && <p className="text-xs text-muted-foreground mt-1">{call.to_number}</p>}
        </div>
        <div className="flex items-center gap-1 text-xs">
          <Clock className="h-3 w-3 text-muted-foreground" />
          <span className="font-mono">{formatDuration(getCallDuration(call))}</span>
        </div>
      </div>

      <div className="flex gap-2 mt-2 flex-wrap">
        <Badge className={`text-xs ${statusInfo.color}`}>{statusInfo.label}</Badge>
        {outcomeInfo && <Badge className={`text-xs ${outcomeInfo.color}`}>{outcomeInfo.label}</Badge>}
      </div>

      {call.notes && (
        <div className="mt-2 flex gap-1 text-xs text-muted-foreground">
          <FileText className="h-3 w-3 mt-0.5 flex-shrink-0" />
          <p className="line-clamp-2">{call.notes}</p>
        </div>
      )}

      {call.recording_url && (
        <div className="mt-2 pt-2 border-t border-border">
          <div className="flex items-center gap-2 mb-1">
            <Volume2 className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Gravação</span>
          </div>
          <audio controls className="w-full h-8" src={getRecordingProxyUrl(call.recording_url)} preload="none">
            Seu navegador não suporta o player de áudio.
          </audio>
        </div>
      )}
    </div>
  );
}
