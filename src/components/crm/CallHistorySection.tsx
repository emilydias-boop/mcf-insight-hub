import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Phone, Clock, User, FileText, Volume2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useContactDealIds } from '@/hooks/useContactDealIds';

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

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
    );
  }

  if (!calls || calls.length === 0) {
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
        <Badge variant="secondary" className="text-xs">{calls.length}</Badge>
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto">
        {calls.map((call) => {
          const statusInfo = STATUS_LABELS[call.status] || { label: call.status, color: 'bg-gray-100' };
          const outcomeInfo = call.outcome ? OUTCOME_LABELS[call.outcome] : null;

          return (
            <div 
              key={call.id} 
              className="p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
            >
              <div className="flex justify-between items-start gap-2">
                <div className="flex-1 min-w-0">
                  {/* User and Date */}
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-3 w-3 text-muted-foreground" />
                    <span className="font-medium truncate">
                      {call.profiles?.full_name || 'Usuário'}
                    </span>
                    <span className="text-muted-foreground">•</span>
                    <span className="text-muted-foreground text-xs">
                      {format(new Date(call.created_at), "dd/MM HH:mm", { locale: ptBR })}
                    </span>
                  </div>

                  {/* Phone number */}
                  {call.to_number && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {call.to_number}
                    </p>
                  )}
                </div>

                {/* Duration Badge */}
                <div className="flex items-center gap-1 text-xs">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  <span className="font-mono">{formatDuration(getCallDuration(call))}</span>
                </div>
              </div>

              {/* Status and Outcome badges */}
              <div className="flex gap-2 mt-2 flex-wrap">
                <Badge className={`text-xs ${statusInfo.color}`}>
                  {statusInfo.label}
                </Badge>
                {outcomeInfo && (
                  <Badge className={`text-xs ${outcomeInfo.color}`}>
                    {outcomeInfo.label}
                  </Badge>
                )}
              </div>

              {/* Notes */}
              {call.notes && (
                <div className="mt-2 flex gap-1 text-xs text-muted-foreground">
                  <FileText className="h-3 w-3 mt-0.5 flex-shrink-0" />
                  <p className="line-clamp-2">{call.notes}</p>
                </div>
              )}

              {/* Audio Player for Recording */}
              {call.recording_url && (
                <div className="mt-2 pt-2 border-t border-border">
                  <div className="flex items-center gap-2 mb-1">
                    <Volume2 className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Gravação</span>
                  </div>
                  <audio 
                    controls 
                    className="w-full h-8"
                    src={getRecordingProxyUrl(call.recording_url)}
                    preload="none"
                  >
                    Seu navegador não suporta o player de áudio.
                  </audio>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
