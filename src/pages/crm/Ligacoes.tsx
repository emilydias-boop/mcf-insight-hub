import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Phone, Search, Volume2, ExternalLink, Briefcase, User, Clock } from 'lucide-react';
import { DealDetailsDrawer } from '@/components/crm/DealDetailsDrawer';
import {
  useSonaxCallEvents,
  sonaxClientPhone,
  type SonaxCallEventRow,
} from '@/hooks/useSonaxCallEvents';
import { sonaxRecordingProxy, sonaxDurationSeconds, sonaxParseDate } from '@/lib/sonaxRecording';

function fmtDuration(s: number): string {
  if (!s || s <= 0) return '0s';
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

function digits(v: string | null | undefined) {
  return (v || '').replace(/\D/g, '');
}

export default function Ligacoes() {
  const [days, setDays] = useState(7);
  const [sdrEmail, setSdrEmail] = useState<string | 'all'>('all');
  const [search, setSearch] = useState('');
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);

  const { data = [], isLoading } = useSonaxCallEvents({ days, sdrEmail, search });

  const sdrOptions = useMemo(() => {
    const map = new Map<string, string>();
    data.forEach((r) => {
      if (r.sdr_email) map.set(r.sdr_email, r.sdr_name || r.sdr_email);
    });
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [data]);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return data;
    const termDigits = digits(term);
    return data.filter((r) => {
      const phone = sonaxClientPhone(r) || '';
      const nameHit = (r.deal_name || '').toLowerCase().includes(term);
      const phoneHit = termDigits.length >= 4 && digits(phone).includes(termDigits);
      return nameHit || phoneHit;
    });
  }, [data, search]);

  const withRecording = rows.filter((r) => !!r.url_gravacao).length;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Phone className="h-5 w-5 text-primary" /> Ligações (Sonax)
          </h1>
          <p className="text-sm text-muted-foreground">
            {rows.length} ligações • {withRecording} com gravação
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome do lead ou telefone..."
            className="pl-8 h-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
          <SelectTrigger className="w-[150px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Hoje / 24h</SelectItem>
            <SelectItem value="7">Últimos 7 dias</SelectItem>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="90">Últimos 90 dias</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sdrEmail} onValueChange={(v) => setSdrEmail(v)}>
          <SelectTrigger className="w-[220px] h-9"><SelectValue placeholder="SDR" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os SDRs</SelectItem>
            {sdrOptions.map(([email, name]) => (
              <SelectItem key={email} value={email}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      )}

      {!isLoading && rows.length === 0 && (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          Nenhuma ligação encontrada com esses filtros.
        </CardContent></Card>
      )}

      {!isLoading && rows.length > 0 && (
        <div className="space-y-2">
          {rows.map((r: SonaxCallEventRow) => {
            const phone = sonaxClientPhone(r);
            const dur = sonaxDurationSeconds(r.duracao_chamada);
            const when = sonaxParseDate(r.data_inicio) || new Date(r.created_at);
            const notAnswered = (r.status_atendimento || '').toUpperCase() === 'N';
            const rec = notAnswered ? null : sonaxRecordingProxy(r.url_gravacao);
            return (
              <Card key={r.id}>
                <CardContent className="p-3 space-y-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium truncate">
                        {r.deal_name || phone || 'Sem identificação'}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap mt-0.5">
                        <span>{phone || '—'}</span>
                        <span>•</span>
                        <span>{format(when, "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                        <span>•</span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" />{fmtDuration(dur)}
                        </span>
                        <span>•</span>
                        <span className="inline-flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {r.sdr_name || r.sdr_email || `ramal ${r.aliasramal || r.ramal || '—'}`}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      {notAnswered && <Badge variant="secondary" className="text-xs">Não atendida</Badge>}
                      {r.deal_id ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedDealId(r.deal_id!)}
                        >
                          <Briefcase className="h-3.5 w-3.5 mr-1.5" />
                          Abrir negócio
                        </Button>
                      ) : (
                        <Badge variant="outline" className="text-xs">Sem negócio vinculado</Badge>
                      )}
                    </div>
                  </div>

                  {rec && (
                    <div className="flex items-center gap-2 pt-1 flex-wrap">
                      <Volume2 className="h-3.5 w-3.5 text-muted-foreground" />
                      <audio controls preload="none" className="h-8 max-w-full">
                        <source src={rec} type="audio/mpeg" />
                      </audio>
                      <a
                        href={r.url_gravacao!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary inline-flex items-center gap-1 hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" /> Baixar da Sonax
                      </a>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <DealDetailsDrawer
        dealId={selectedDealId}
        open={!!selectedDealId}
        onOpenChange={(o) => !o && setSelectedDealId(null)}
      />
    </div>
  );
}
