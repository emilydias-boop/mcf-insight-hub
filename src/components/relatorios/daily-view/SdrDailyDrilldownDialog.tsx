import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Phone, CalendarCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  useSdrCallDailySummary,
  useSdrDailyBookings,
  type DailyViewSdr,
} from '@/hooks/useDailyViewIncorporador';

function classifyTag(tags: string[] | null | undefined): { label: string; cls: string } {
  const all = (tags || []).map((t) => (t || '').toUpperCase());
  if (all.some((t) => t.includes('A010'))) return { label: 'A010', cls: 'bg-primary/20 text-primary ring-1 ring-primary/40' };
  if (all.some((t) => t.includes('ANAMNESE'))) return { label: 'ANAMNESE', cls: 'bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/40' };
  if (all.some((t) => t.includes('PLANILHA'))) return { label: 'PLANILHA', cls: 'bg-purple-500/20 text-purple-300 ring-1 ring-purple-500/40' };
  return { label: 'OUTROS', cls: 'bg-muted text-muted-foreground ring-1 ring-border' };
}

function fmtDur(s: number) {
  if (!s) return '0s';
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}m${r.toString().padStart(2, '0')}s` : `${r}s`;
}

interface Props {
  sdr: DailyViewSdr | null;
  date: Date;
  open: boolean;
  onClose: () => void;
}

export function SdrDailyDrilldownDialog({ sdr, date, open, onClose }: Props) {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadUserId() {
      if (!sdr?.email) { setUserId(null); return; }
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .ilike('email', sdr.email)
        .maybeSingle();
      if (!cancelled) setUserId((data as any)?.id || null);
    }
    if (open) loadUserId();
    return () => { cancelled = true; };
  }, [sdr?.email, open]);

  const start = subDays(date, 6);
  const callsQ = useSdrCallDailySummary(open ? userId : null, open ? start : null, open ? date : null);
  const bookingsQ = useSdrDailyBookings(open ? sdr?.email ?? null : null, open ? date : null);

  const totals = (callsQ.data || []).reduce(
    (acc, r) => {
      acc.attempts += r.attempts;
      acc.effective += r.effective;
      acc.qualified += r.qualified;
      acc.dur += r.total_seconds;
      return acc;
    },
    { attempts: 0, effective: 0, qualified: 0, dur: 0 },
  );

  const hit = sdr && sdr.meta_diaria > 0 && sdr.agendamentos >= sdr.meta_diaria;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 font-display">
            <div className="w-10 h-10 rounded-full bg-primary/15 text-primary flex items-center justify-center ring-1 ring-primary/30">
              {sdr?.name?.split(' ').slice(0, 2).map((p) => p[0]).join('').toUpperCase()}
            </div>
            <div className="flex-1">
              <p>{sdr?.name}</p>
              <p className="text-xs text-muted-foreground font-normal">
                {format(date, "EEEE, dd 'de' MMMM", { locale: ptBR })}
              </p>
            </div>
            {sdr && (
              <Badge
                className={
                  hit
                    ? 'bg-primary/15 text-primary ring-1 ring-primary/40'
                    : 'bg-destructive/15 text-destructive ring-1 ring-destructive/40'
                }
              >
                {sdr.agendamentos}/{sdr.meta_diaria || '—'} agendamentos
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-primary" />
            <h3 className="font-semibold font-display">Ligações — últimos 7 dias</h3>
          </div>
          {callsQ.isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dia</TableHead>
                  <TableHead className="text-center">Tentativas</TableHead>
                  <TableHead className="text-center">Conexões</TableHead>
                  <TableHead className="text-center">Qualificadas</TableHead>
                  <TableHead className="text-center">Tempo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(callsQ.data || []).map((d) => (
                  <TableRow key={d.day}>
                    <TableCell className="capitalize">{format(new Date(d.day + 'T12:00:00'), 'EEE dd/MM', { locale: ptBR })}</TableCell>
                    <TableCell className="text-center font-semibold">{d.attempts}</TableCell>
                    <TableCell className="text-center text-blue-400">{d.effective}</TableCell>
                    <TableCell className="text-center text-primary">{d.qualified}</TableCell>
                    <TableCell className="text-center text-xs">{fmtDur(d.total_seconds)}</TableCell>
                  </TableRow>
                ))}
                {(callsQ.data || []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-4">Sem ligações no período.</TableCell>
                  </TableRow>
                )}
                {(callsQ.data || []).length > 0 && (
                  <TableRow className="bg-muted/40 font-semibold">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-center">{totals.attempts}</TableCell>
                    <TableCell className="text-center text-blue-400">{totals.effective}</TableCell>
                    <TableCell className="text-center text-primary">{totals.qualified}</TableCell>
                    <TableCell className="text-center text-xs">{fmtDur(totals.dur)}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </section>

        <section className="space-y-3 mt-6">
          <div className="flex items-center gap-2">
            <CalendarCheck className="h-4 w-4 text-primary" />
            <h3 className="font-semibold font-display">
              Leads agendados em {format(date, 'dd/MM', { locale: ptBR })}
            </h3>
          </div>
          {bookingsQ.isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : (bookingsQ.data || []).length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nenhum agendamento.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Closer</TableHead>
                  <TableHead>Horário</TableHead>
                  <TableHead>Origem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(bookingsQ.data || []).map((b) => {
                  const tag = classifyTag(b.tags);
                  return (
                    <TableRow key={b.attendee_id}>
                      <TableCell className="font-medium max-w-[220px] truncate">{b.lead_name || '—'}</TableCell>
                      <TableCell className="font-mono text-xs">{b.lead_phone || '—'}</TableCell>
                      <TableCell>{b.closer_name || '—'}</TableCell>
                      <TableCell className="text-xs">{format(new Date(b.scheduled_at), 'HH:mm')}</TableCell>
                      <TableCell>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${tag.cls}`}>{tag.label}</span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </section>
      </DialogContent>
    </Dialog>
  );
}