import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarCheck, DollarSign } from 'lucide-react';
import {
  useCloserDailyContracts,
  useCloserDailyMeetings,
  type DailyViewCloser,
} from '@/hooks/useDailyViewIncorporador';
import { formatCurrency } from '@/lib/formatters';

function classifyTag(tags: string[] | null | undefined): { label: string; cls: string } {
  const all = (tags || []).map((t) => (t || '').toUpperCase());
  if (all.some((t) => t.includes('A010'))) return { label: 'A010', cls: 'bg-primary/20 text-primary ring-1 ring-primary/40' };
  if (all.some((t) => t.includes('ANAMNESE'))) return { label: 'ANAMNESE', cls: 'bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/40' };
  if (all.some((t) => t.includes('PLANILHA'))) return { label: 'PLANILHA', cls: 'bg-purple-500/20 text-purple-300 ring-1 ring-purple-500/40' };
  if (all.some((t) => t === 'GUIA')) return { label: 'GUIA', cls: 'bg-orange-500/20 text-orange-300 ring-1 ring-orange-500/40' };
  return { label: 'OUTROS', cls: 'bg-muted text-muted-foreground ring-1 ring-border' };
}

interface Props {
  closer: DailyViewCloser | null;
  date: Date;
  open: boolean;
  onClose: () => void;
}

export function CloserDailyDrilldownDialog({ closer, date, open, onClose }: Props) {
  const meetingsQ = useCloserDailyMeetings(open ? closer?.closer_id ?? null : null, open ? date : null);
  const contractsQ = useCloserDailyContracts(open ? closer?.closer_id ?? null : null, open ? date : null);

  const hitR = closer && closer.reunioes_realizadas >= closer.meta_reunioes;
  const hitC = closer && closer.contratos_pagos >= closer.meta_contratos;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 font-display">
            <div className="w-10 h-10 rounded-full bg-primary/15 text-primary flex items-center justify-center ring-1 ring-primary/30">
              {closer?.name?.split(' ').slice(0, 2).map((p) => p[0]).join('').toUpperCase()}
            </div>
            <div className="flex-1">
              <p>{closer?.name}</p>
              <p className="text-xs text-muted-foreground font-normal">
                {format(date, "EEEE, dd 'de' MMMM", { locale: ptBR })}
              </p>
            </div>
            <div className="flex gap-2">
              <Badge className={hitR ? 'bg-primary/15 text-primary ring-1 ring-primary/40' : 'bg-destructive/15 text-destructive ring-1 ring-destructive/40'}>
                R: {closer?.reunioes_realizadas}/{closer?.meta_reunioes}
              </Badge>
              <Badge className={hitC ? 'bg-primary/15 text-primary ring-1 ring-primary/40' : 'bg-destructive/15 text-destructive ring-1 ring-destructive/40'}>
                C: {closer?.contratos_pagos}/{closer?.meta_contratos}
              </Badge>
            </div>
          </DialogTitle>
        </DialogHeader>

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <CalendarCheck className="h-4 w-4 text-primary" />
            <h3 className="font-semibold font-display">Reuniões realizadas</h3>
          </div>
          {meetingsQ.isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : (meetingsQ.data || []).length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Sem reuniões realizadas.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead</TableHead>
                  <TableHead>Horário</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Origem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(meetingsQ.data || []).map((m) => {
                  const tag = classifyTag(m.tags);
                  return (
                    <TableRow key={m.attendee_id}>
                      <TableCell className="font-medium">{m.lead_name || '—'}</TableCell>
                      <TableCell className="text-xs">{format(new Date(m.scheduled_at), 'HH:mm')}</TableCell>
                      <TableCell className="text-xs">{m.status}</TableCell>
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

        <section className="space-y-3 mt-6">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-primary" />
            <h3 className="font-semibold font-display">Contratos pagos</h3>
          </div>
          {contractsQ.isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : (contractsQ.data || []).length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Sem contratos pagos.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Pago em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(contractsQ.data || []).map((c) => (
                  <TableRow key={c.attendee_id}>
                    <TableCell className="font-medium">{c.lead_name || '—'}</TableCell>
                    <TableCell className="text-xs">{c.product_name || '—'}</TableCell>
                    <TableCell className="text-right font-mono text-xs text-primary">
                      {c.value ? formatCurrency(Number(c.value)) : '—'}
                    </TableCell>
                    <TableCell className="text-xs">{format(new Date(c.contract_paid_at), 'HH:mm')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>
      </DialogContent>
    </Dialog>
  );
}