import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CalendarDays } from 'lucide-react';
import { useMeuHistoricoR1, type R1Bucket } from '@/hooks/useMeuHistoricoR1';

const BUCKET_BADGE: Record<string, { label: string; className: string }> = {
  agendada: { label: 'Agendada', className: 'bg-blue-500/15 text-blue-700 dark:text-blue-400' },
  realizada: { label: 'Realizada', className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' },
  no_show: { label: 'No-Show', className: 'bg-red-500/15 text-red-700 dark:text-red-400' },
  perdida: { label: 'Perdida', className: 'bg-orange-500/15 text-orange-700 dark:text-orange-400' },
  paga: { label: 'Contrato Pago', className: 'bg-emerald-600 text-white' },
};

interface Props {
  targetUserId: string;
  bucket: R1Bucket;
}

export function HistoricoR1Tab({ targetUserId, bucket }: Props) {
  const [days, setDays] = useState(30);
  const { data, isLoading } = useMeuHistoricoR1({ userId: targetUserId, days, bucket });

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
          <SelectTrigger className="w-[160px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Últimos 7 dias</SelectItem>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="90">Últimos 90 dias</SelectItem>
            <SelectItem value="180">Últimos 180 dias</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      )}

      {!isLoading && (data?.length ?? 0) === 0 && (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          Nenhum agendamento encontrado neste período.
        </CardContent></Card>
      )}

      {!isLoading && (data?.length ?? 0) > 0 && (
        <div className="space-y-2">
          {data!.map((r) => {
            const badge = BUCKET_BADGE[r.bucket];
            return (
              <Card key={r.id}>
                <CardContent className="p-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <div className="font-medium truncate">{r.attendee_name || 'Sem nome'}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                        <span>{r.attendee_phone || '—'}</span>
                        <span>•</span>
                        <span>
                          {r.scheduled_at
                            ? format(new Date(r.scheduled_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                            : '—'}
                        </span>
                        {r.closer_name && (
                          <>
                            <span>•</span>
                            <span>Closer: {r.closer_name}</span>
                          </>
                        )}
                        {r.is_reschedule && (
                          <>
                            <span>•</span>
                            <span className="text-orange-600">Remarcada</span>
                          </>
                        )}
                      </div>
                      {r.closer_notes && (
                        <div className="text-xs italic text-muted-foreground mt-1 line-clamp-2">{r.closer_notes}</div>
                      )}
                    </div>
                  </div>
                  {badge && <Badge className={badge.className}>{badge.label}</Badge>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}