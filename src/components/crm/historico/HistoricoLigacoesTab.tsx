import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Phone, PhoneIncoming, PhoneOutgoing, Volume2, Search } from 'lucide-react';
import { useMeuHistoricoCalls } from '@/hooks/useMeuHistoricoCalls';
import { CallFollowUpPopover } from './CallFollowUpPopover';
import { useAuth } from '@/contexts/AuthContext';

const SUPABASE_URL = 'https://rehcfgqvigfcekiipqkc.supabase.co';

const OUTCOME_LABELS: Record<string, { label: string; color: string }> = {
  sem_contato: { label: 'Sem contato', color: 'bg-muted text-muted-foreground' },
  ocupado: { label: 'Ocupado', color: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400' },
  caixa_postal: { label: 'Caixa postal', color: 'bg-muted text-muted-foreground' },
  voicemail: { label: 'Voicemail', color: 'bg-muted text-muted-foreground' },
  numero_errado: { label: 'Número errado', color: 'bg-red-500/15 text-red-700 dark:text-red-400' },
  interessado: { label: 'Interessado', color: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' },
  nao_interessado: { label: 'Não interessado', color: 'bg-red-500/15 text-red-700 dark:text-red-400' },
  agendou_r1: { label: 'Agendou R1', color: 'bg-blue-500/15 text-blue-700 dark:text-blue-400' },
  follow_up: { label: 'Follow-up', color: 'bg-orange-500/15 text-orange-700 dark:text-orange-400' },
  outro: { label: 'Outro', color: 'bg-muted text-muted-foreground' },
};

const FOLLOWUP_BADGES: Record<string, { label: string; className: string }> = {
  retornar: { label: 'Retornar', className: 'bg-orange-500 hover:bg-orange-500 text-white' },
  whatsapp: { label: 'WhatsApp', className: 'bg-emerald-600 hover:bg-emerald-600 text-white' },
  sem_interesse: { label: 'Sem interesse', className: 'bg-muted text-muted-foreground' },
  agendado: { label: 'Agendado', className: 'bg-blue-600 hover:bg-blue-600 text-white' },
  outro: { label: 'Outro', className: 'bg-muted text-muted-foreground' },
};

function fmtDuration(s: number | null): string {
  if (!s || s <= 0) return '0s';
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

function recordingProxy(url: string | null): string | null {
  if (!url) return null;
  const m = url.match(/Recordings\/([^.\/]+)/);
  if (!m) return url;
  return `${SUPABASE_URL}/functions/v1/twilio-recording-proxy?recordingSid=${m[1]}`;
}

interface Props {
  targetUserId: string;
}

export function HistoricoLigacoesTab({ targetUserId }: Props) {
  const { user } = useAuth();
  const [days, setDays] = useState(30);
  const [followUp, setFollowUp] = useState<'all' | 'pendente' | 'retornar' | 'whatsapp' | 'agendado' | 'sem_interesse'>('all');
  const [search, setSearch] = useState('');

  const { data, isLoading } = useMeuHistoricoCalls({
    userId: targetUserId,
    days,
    followUp,
    search,
  });

  const isOwner = user?.id === targetUserId;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, email ou telefone..."
            className="pl-8 h-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
          <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Últimos 7 dias</SelectItem>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="90">Últimos 90 dias</SelectItem>
          </SelectContent>
        </Select>
        <Select value={followUp} onValueChange={(v: any) => setFollowUp(v)}>
          <SelectTrigger className="w-[180px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pendente">Pendentes (Retornar/WA)</SelectItem>
            <SelectItem value="retornar">Retornar</SelectItem>
            <SelectItem value="whatsapp">WhatsApp</SelectItem>
            <SelectItem value="agendado">Agendados</SelectItem>
            <SelectItem value="sem_interesse">Sem interesse</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      )}

      {!isLoading && (data?.length ?? 0) === 0 && (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          Nenhuma ligação encontrada com esses filtros.
        </CardContent></Card>
      )}

      {!isLoading && (data?.length ?? 0) > 0 && (
        <div className="space-y-2">
          {data!.map((c) => {
            const out = c.outcome ? OUTCOME_LABELS[c.outcome] : null;
            const fu = c.follow_up_action ? FOLLOWUP_BADGES[c.follow_up_action] : null;
            const recUrl = recordingProxy(c.recording_url);
            return (
              <Card key={c.id}>
                <CardContent className="p-3 space-y-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {c.direction === 'inbound' ? (
                        <PhoneIncoming className="h-4 w-4 text-emerald-600 shrink-0" />
                      ) : (
                        <PhoneOutgoing className="h-4 w-4 text-blue-600 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="font-medium truncate">
                          {c.deal_name || c.to_number || c.from_number || 'Sem identificação'}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                          <span>{c.deal_phone || c.to_number || c.from_number || '—'}</span>
                          <span>•</span>
                          <span>
                            {c.started_at
                              ? format(new Date(c.started_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                              : format(new Date(c.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </span>
                          <span>•</span>
                          <span>{fmtDuration(c.duration_seconds)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      {out && (
                        <Badge variant="secondary" className={`text-xs ${out.color}`}>{out.label}</Badge>
                      )}
                      {fu && (
                        <Badge className={`text-xs ${fu.className}`}>{fu.label}</Badge>
                      )}
                      <CallFollowUpPopover
                        callId={c.id}
                        initialAction={c.follow_up_action}
                        initialAt={c.follow_up_at}
                        initialSummary={c.summary}
                        disabled={!isOwner}
                      />
                    </div>
                  </div>

                  {recUrl && (
                    <div className="flex items-center gap-2 pt-1">
                      <Volume2 className="h-3.5 w-3.5 text-muted-foreground" />
                      <audio controls preload="none" className="h-8 max-w-full">
                        <source src={recUrl} type="audio/mpeg" />
                      </audio>
                    </div>
                  )}

                  {c.summary && (
                    <div className="text-xs bg-muted/40 rounded p-2 whitespace-pre-wrap">
                      <span className="font-semibold">Resumo: </span>{c.summary}
                    </div>
                  )}
                  {!c.summary && c.notes && (
                    <div className="text-xs text-muted-foreground italic">{c.notes}</div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}