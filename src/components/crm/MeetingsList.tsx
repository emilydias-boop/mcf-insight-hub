import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MoreHorizontal, CheckCircle, XCircle, AlertTriangle, ExternalLink, ArrowRightLeft } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { MeetingSlot, useUpdateMeetingStatus, useCancelMeeting } from '@/hooks/useAgendaData';
import { cn } from '@/lib/utils';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface MeetingsListProps {
  meetings: MeetingSlot[];
  isLoading: boolean;
  onViewDeal: (dealId: string) => void;
  statusFilter?: string | null;
  searchTerm?: string;
  channelFilter?: string | null;
}

const ATTENDEE_STATUS_FILTERS: Record<string, string[]> = {
  scheduled: ['invited', 'scheduled'],
  rescheduled: ['rescheduled'],
  completed: ['completed'],
  no_show: ['no_show'],
  canceled: ['cancelled', 'canceled'],
  contract_paid: ['contract_paid'],
};

const ATTENDEE_STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: typeof CheckCircle }> = {
  invited: { label: 'Agendada', variant: 'default', icon: CheckCircle },
  scheduled: { label: 'Agendada', variant: 'default', icon: CheckCircle },
  rescheduled: { label: 'Reagendada', variant: 'secondary', icon: AlertTriangle },
  completed: { label: 'Realizada', variant: 'outline', icon: CheckCircle },
  no_show: { label: 'No-show', variant: 'destructive', icon: XCircle },
  canceled: { label: 'Cancelada', variant: 'outline', icon: XCircle },
  cancelled: { label: 'Cancelada', variant: 'outline', icon: XCircle },
  contract_paid: { label: 'Contrato Pago', variant: 'default', icon: CheckCircle },
  approved: { label: 'Aprovado', variant: 'default', icon: CheckCircle },
  rejected: { label: 'Rejeitado', variant: 'destructive', icon: XCircle },
  refunded: { label: 'Reembolsado', variant: 'outline', icon: XCircle },
};

/** Normaliza telefone para os últimos 9 dígitos (padrão usado em deduplicação). */
function normalizePhone9(raw: string | null | undefined): string {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  return digits.length >= 9 ? digits.slice(-9) : digits;
}

/**
 * Classificação de canal SIMPLIFICADA para a Agenda R1:
 * - A010: comprou A010 (hubla_transactions com product_category='a010' e sale_status='completed', por email/telefone)
 * - ANAMNESE: tem tag exatamente "ANAMNESE" ou "ANAMNESE-INSTA"
 * - Outro: qualquer outra coisa
 */
type SimpleChannel = 'A010' | 'ANAMNESE' | 'Outro';

function classifySimple(opts: {
  /** ms desde a venda A010 mais recente (null se não for buyer) */
  a010AgeMs: number | null;
  tags: string[];
}): SimpleChannel {
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const isA010Buyer = opts.a010AgeMs !== null;
  const isStale = opts.a010AgeMs !== null && opts.a010AgeMs > THIRTY_DAYS_MS;
  const norm = opts.tags.map((t) => (t || '').trim().toUpperCase());
  // SOMENTE tag exata "ANAMNESE" (anamnese completa). NÃO contar ANAMNESE-INSTA.
  const hasAnamnese = norm.some((t) => t === 'ANAMNESE');

  // Buyer A010 recente (≤30d) → A010, mesmo com tag ANAMNESE
  if (isA010Buyer && !isStale) return 'A010';

  // Buyer A010 esfriado (>30d) E tem tag ANAMNESE → reclassifica como ANAMNESE
  if (isA010Buyer && isStale && hasAnamnese) return 'ANAMNESE';

  // Buyer A010 esfriado SEM tag ANAMNESE → ainda é A010 (regra: precisa ter tag)
  if (isA010Buyer && isStale && !hasAnamnese) return 'A010';

  // Não é buyer A010
  if (hasAnamnese) return 'ANAMNESE';
  return 'Outro';
}

interface AttendeeRow {
  meetingId: string;
  meetingStatus: string;
  scheduledAt: string;
  closerName: string | null;
  dealId: string | null;
  attendeeId: string;
  attendeeName: string;
  attendeePhone: string | null;
  attendeeStatus: string;
  isReschedule: boolean;
  channel: SimpleChannel;
}

export function MeetingsList({ meetings, isLoading, onViewDeal, statusFilter, searchTerm = '', channelFilter }: MeetingsListProps) {
  const updateStatus = useUpdateMeetingStatus();
  const cancelMeeting = useCancelMeeting();

  // Coleta emails e telefones (últimos 9 dígitos) de todos os attendees visíveis
  const { emails, phones9 } = useMemo(() => {
    const eSet = new Set<string>();
    const pSet = new Set<string>();
    for (const m of meetings) {
      for (const att of m.attendees || []) {
        if (att.is_partner) continue;
        const email = (att.contact?.email || '').toLowerCase().trim();
        if (email) eSet.add(email);
        const phone9 = normalizePhone9(att.attendee_phone || att.contact?.phone);
        if (phone9) pSet.add(phone9);
      }
      const dealEmail = (m.deal?.contact?.email || '').toLowerCase().trim();
      if (dealEmail) eSet.add(dealEmail);
      const dealPhone9 = normalizePhone9(m.deal?.contact?.phone);
      if (dealPhone9) pSet.add(dealPhone9);
    }
    return { emails: Array.from(eSet), phones9: Array.from(pSet) };
  }, [meetings]);

  // Lookup em hubla_transactions (product_category='a010' completed): identifica buyers e traz a sale_date mais recente
  // para aplicar a regra "A010 com +30 dias e tag ANAMNESE → vira ANAMNESE".
  const { data: a010Sets } = useQuery({
    queryKey: ['a010-buyers-lookup', emails, phones9],
    queryFn: async () => {
      const emailMap = new Map<string, string>(); // email -> ISO sale_date mais recente
      const phoneMap = new Map<string, string>(); // phone9 -> ISO sale_date mais recente
      if (emails.length === 0 && phones9.length === 0) {
        return { emailMap, phoneMap };
      }
      if (emails.length > 0) {
        const { data } = await supabase
          .from('hubla_transactions')
          .select('customer_email, sale_date')
          .eq('product_category', 'a010')
          .eq('sale_status', 'completed')
          .in('customer_email', emails);
        (data || []).forEach((r: any) => {
          if (!r.customer_email) return;
          const e = String(r.customer_email).toLowerCase().trim();
          const prev = emailMap.get(e);
          if (!prev || (r.sale_date && r.sale_date > prev)) {
            emailMap.set(e, r.sale_date || prev || '');
          }
        });
      }
      if (phones9.length > 0) {
        const { data } = await supabase
          .from('hubla_transactions')
          .select('customer_phone, sale_date')
          .eq('product_category', 'a010')
          .eq('sale_status', 'completed')
          .not('customer_phone', 'is', null);
        (data || []).forEach((r: any) => {
          const p9 = normalizePhone9(r.customer_phone);
          if (!p9 || !phones9.includes(p9)) return;
          const prev = phoneMap.get(p9);
          if (!prev || (r.sale_date && r.sale_date > prev)) {
            phoneMap.set(p9, r.sale_date || prev || '');
          }
        });
      }
      return { emailMap, phoneMap };
    },
    enabled: emails.length > 0 || phones9.length > 0,
    staleTime: 60_000,
  });

  /**
   * Retorna a idade (ms) entre o evento (R1 scheduled_at) e a venda A010
   * MAIS RECENTE do lead, ou null se não for buyer. Usar scheduled_at como
   * âncora mantém o canal estável historicamente (alinhado com o Funil
   * por Canal do Relatório).
   */
  const a010Age = (
    email: string | null | undefined,
    phone: string | null | undefined,
    referenceISO: string,
  ): number | null => {
    if (!a010Sets) return null;
    const e = (email || '').toLowerCase().trim();
    const p9 = normalizePhone9(phone);
    const dates: string[] = [];
    if (e && a010Sets.emailMap.has(e)) dates.push(a010Sets.emailMap.get(e)!);
    if (p9 && a010Sets.phoneMap.has(p9)) dates.push(a010Sets.phoneMap.get(p9)!);
    const valid = dates.filter(Boolean).map((d) => new Date(d).getTime()).filter((n) => !isNaN(n));
    if (valid.length === 0) {
      // É buyer mas sem sale_date utilizável → trata como recente (A010)
      if ((e && a010Sets.emailMap.has(e)) || (p9 && a010Sets.phoneMap.has(p9))) return 0;
      return null;
    }
    const mostRecent = Math.max(...valid);
    const refMs = new Date(referenceISO).getTime();
    const baseMs = isNaN(refMs) ? Date.now() : refMs;
    return baseMs - mostRecent;
  };

  // Expand meetings into attendee-level rows
  const attendeeRows = useMemo((): AttendeeRow[] => {
    const rows: AttendeeRow[] = [];
    const validStatuses = statusFilter ? ATTENDEE_STATUS_FILTERS[statusFilter] || [statusFilter] : null;
    const search = searchTerm.trim().toLowerCase();
    const searchDigits = searchTerm.replace(/\D/g, '');

    for (const meeting of meetings) {
      if (meeting.attendees?.length) {
        for (const att of meeting.attendees) {
          // Skip partners - they share the slot with the main lead
          if (att.is_partner) continue;
          if (validStatuses && !validStatuses.includes(att.status || meeting.status)) continue;

          if (search.length >= 2) {
            const name = (att.attendee_name || att.contact?.name || '').toLowerCase();
            const phone = (att.attendee_phone || att.contact?.phone || '').replace(/\D/g, '');
            if (!name.includes(search) && !(searchDigits.length >= 2 && phone.includes(searchDigits))) continue;
          }

          const dealForChannel: any = (att as any).deal || meeting.deal;
          const rawTags = dealForChannel?.tags;
          const tagsArr: string[] = Array.isArray(rawTags)
            ? rawTags.map((t: any) => {
                if (typeof t === 'string') {
                  if (t.startsWith('{')) {
                    try { const p = JSON.parse(t); return p?.name || t; } catch { return t; }
                  }
                  return t;
                }
                return (t as any)?.name || '';
              })
            : [];
          const channel = classifySimple({
            a010AgeMs: a010Age(
              att.contact?.email,
              att.attendee_phone || att.contact?.phone,
              meeting.scheduled_at,
            ),
            tags: tagsArr,
          });

          if (channelFilter && channel !== channelFilter) continue;

          rows.push({
            meetingId: meeting.id,
            meetingStatus: meeting.status,
            scheduledAt: meeting.scheduled_at,
            closerName: meeting.closer?.name || null,
            dealId: att.deal_id || meeting.deal_id || null,
            attendeeId: att.id,
            attendeeName: att.attendee_name || att.contact?.name || 'Lead',
            attendeePhone: att.attendee_phone || att.contact?.phone || null,
            attendeeStatus: att.status || meeting.status,
            isReschedule: !!(att.parent_attendee_id && !att.is_partner &&
              !['contract_paid', 'completed', 'refunded', 'approved', 'rejected'].includes(att.status)),
            channel,
          });
        }
      } else {
        const dealForChannel: any = meeting.deal;
        const rawTags = dealForChannel?.tags;
        const tagsArr: string[] = Array.isArray(rawTags)
          ? rawTags.map((t: any) => {
              if (typeof t === 'string') {
                if (t.startsWith('{')) {
                  try { const p = JSON.parse(t); return p?.name || t; } catch { return t; }
                }
                return t;
              }
              return (t as any)?.name || '';
            })
          : [];
        const channel = classifySimple({
          a010AgeMs: a010Age(
            dealForChannel?.contact?.email,
            dealForChannel?.contact?.phone,
            meeting.scheduled_at,
          ),
          tags: tagsArr,
        });

        if (channelFilter && channel !== channelFilter) continue;

        // Slot without attendees - show slot-level info
        rows.push({
          meetingId: meeting.id,
          meetingStatus: meeting.status,
          scheduledAt: meeting.scheduled_at,
          closerName: meeting.closer?.name || null,
          dealId: meeting.deal_id || null,
          attendeeId: meeting.id,
          attendeeName: meeting.deal?.contact?.name || meeting.deal?.name || 'Sem lead',
          attendeePhone: meeting.deal?.contact?.phone || null,
          attendeeStatus: meeting.status,
          isReschedule: false,
          channel,
        });
      }
    }
    return rows;
  }, [meetings, statusFilter, searchTerm, channelFilter, a010Sets]);

  const handleUpdateStatus = (meetingId: string, status: string) => {
    updateStatus.mutate({ meetingId, status });
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (attendeeRows.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Nenhuma reunião encontrada
      </div>
    );
  }

  const channelCounts = { A010: 0, ANAMNESE: 0, Outro: 0 } as Record<SimpleChannel, number>;
  for (const r of attendeeRows) channelCounts[r.channel]++;
  const total = attendeeRows.length;

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border-b text-xs">
        <span className="text-muted-foreground">
          {channelFilter ? `Filtrado por canal: ${channelFilter}` : 'Todos os canais'}
        </span>
        <div className="flex items-center gap-2">
          {!channelFilter && (
            <>
              <Badge variant="outline" className="border-blue-400 text-blue-600">A010: {channelCounts.A010}</Badge>
              <Badge variant="outline" className="border-purple-400 text-purple-600">ANAMNESE: {channelCounts.ANAMNESE}</Badge>
              <Badge variant="outline" className="text-muted-foreground">Outro: {channelCounts.Outro}</Badge>
            </>
          )}
          <Badge variant="secondary" className="font-semibold">Total: {total}</Badge>
        </div>
      </div>
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead>Data/Hora</TableHead>
            <TableHead>Lead</TableHead>
            <TableHead>Canal</TableHead>
            <TableHead>Closer</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {attendeeRows.map(row => {
            const statusConfig = ATTENDEE_STATUS_CONFIG[row.attendeeStatus] || ATTENDEE_STATUS_CONFIG.scheduled;
            const StatusIcon = statusConfig.icon;
            const canChangeStatus = ['invited', 'scheduled', 'rescheduled'].includes(row.attendeeStatus);

            return (
              <TableRow key={`${row.meetingId}-${row.attendeeId}`}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">
                      {format(parseISO(row.scheduledAt), "dd/MM/yyyy", { locale: ptBR })}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {format(parseISO(row.scheduledAt), "HH:mm")}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium">{row.attendeeName}</span>
                      {row.isReschedule && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0 bg-orange-100 text-orange-700 border-orange-300 gap-0.5">
                          <ArrowRightLeft className="h-2.5 w-2.5" />
                          Remanej.
                        </Badge>
                      )}
                    </div>
                    {row.attendeePhone && (
                      <span className="text-sm text-muted-foreground">{row.attendeePhone}</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[11px]',
                      row.channel === 'A010' && 'border-blue-400 text-blue-600',
                      row.channel === 'ANAMNESE' && 'border-purple-400 text-purple-600',
                      row.channel === 'Outro' && 'text-muted-foreground'
                    )}
                  >
                    {row.channel}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className="font-medium">{row.closerName || '-'}</span>
                </TableCell>
                <TableCell>
                  <Badge variant={statusConfig.variant} className="gap-1">
                    <StatusIcon className="h-3 w-3" />
                    {statusConfig.label}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {row.dealId && (
                        <DropdownMenuItem onClick={() => onViewDeal(row.dealId!)}>
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Ver negócio
                        </DropdownMenuItem>
                      )}
                      {canChangeStatus && (
                        <>
                          <DropdownMenuItem onClick={() => handleUpdateStatus(row.meetingId, 'completed')}>
                            <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                            Marcar como realizada
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleUpdateStatus(row.meetingId, 'no_show')}>
                            <AlertTriangle className="h-4 w-4 mr-2 text-yellow-500" />
                            Marcar como no-show
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => cancelMeeting.mutate(row.meetingId)}
                            className="text-destructive"
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Cancelar reunião
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
