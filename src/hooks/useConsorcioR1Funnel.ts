import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Funil R1 do Consórcio (etapas 1 e 2 do Funil Pós-Reunião).
 *
 * Regras (mesmas da tela Agenda R1):
 *  - conta PARTICIPANTES (meeting_slot_attendees), nunca slots — um slot pode ter 2 leads
 *  - is_partner = false
 *  - slot com meeting_type = 'r1' e status fora de (cancelled/canceled/cancelada)
 *  - eixo de data: meeting_slots.scheduled_at dentro do período
 *  - recorte de BU: closer_id em closers com bu = 'consorcio', incluindo closers
 *    INATIVOS que tiveram reunião no período (histórico não pode sair do funil)
 *
 * "Realizadas" = SOMENTE status = 'completed'. contract_paid/refunded ficam de fora
 * (o vocabulário "contrato pago" não existe no Consórcio — decisão de negócio).
 */

const CANCELLED_SLOT_STATUS = new Set(['cancelled', 'canceled', 'cancelada']);
const SEM_DESFECHO_STATUS = new Set(['invited', 'scheduled', 'rescheduled']);

export interface R1FunnelParticipant {
  id: string;
  meeting_slot_id: string;
  deal_id: string | null;
  contact_id: string | null;
  lead_name: string;
  lead_phone: string;
  scheduled_at: string;
  closer_name: string;
  status: string;
  closer_notes: string;
  notes: string;
  sem_desfecho: boolean;
  is_partner: boolean;
  parent_attendee_id: string | null;
  outcome_reason: string | null;
  outcome_reason_note: string | null;
}

export interface R1FunnelResult {
  agendadas: number;
  realizadas: number;
  noShow: number;
  semDesfecho: number;
  participants: R1FunnelParticipant[];
}

/** Rótulos curtos usados na Agenda R1. */
export function r1StatusShortLabel(status: string): string {
  switch ((status || '').toLowerCase()) {
    case 'completed':
      return 'OK';
    case 'no_show':
      return 'NS';
    case 'rescheduled':
      return 'RE';
    default:
      return 'Ag';
  }
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function useConsorcioR1Funnel(
  range: { startDate?: Date; endDate?: Date },
  options?: { enabled?: boolean },
) {
  const startIso = range.startDate ? range.startDate.toISOString() : null;
  const endIso = range.endDate
    ? new Date(
        range.endDate.getFullYear(),
        range.endDate.getMonth(),
        range.endDate.getDate(),
        23, 59, 59, 999,
      ).toISOString()
    : null;

  return useQuery<R1FunnelResult>({
    queryKey: ['consorcio-r1-funnel', startIso, endIso],
    enabled: options?.enabled !== false,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      // 1) Closers do Consórcio (ativos) + inativos com slot no período
      const { data: activeClosers } = await supabase
        .from('closers')
        .select('id, name, is_active')
        .eq('bu', 'consorcio');

      const closerName = new Map<string, string>();
      (activeClosers || []).forEach((c: any) => closerName.set(c.id, c.name));
      const closerIds = new Set<string>(closerName.keys());

      // 2) Slots R1 do período
      let slotQuery = supabase
        .from('meeting_slots')
        .select('id, scheduled_at, status, closer_id')
        .eq('meeting_type', 'r1');
      if (startIso) slotQuery = slotQuery.gte('scheduled_at', startIso);
      if (endIso) slotQuery = slotQuery.lte('scheduled_at', endIso);
      const { data: slots, error: slotErr } = await slotQuery.order('scheduled_at', { ascending: false });
      if (slotErr) throw slotErr;

      const validSlots = (slots || []).filter(
        (s: any) =>
          s.closer_id &&
          closerIds.has(s.closer_id) &&
          !CANCELLED_SLOT_STATUS.has(String(s.status || '').toLowerCase()),
      );

      // Closers inativos/de outra BU não entram; mas closers do Consórcio já
      // desativados continuam em `closers` com bu='consorcio' (não filtramos is_active).
      if (validSlots.length === 0) {
        return { agendadas: 0, realizadas: 0, noShow: 0, semDesfecho: 0, participants: [] };
      }

      const slotById = new Map<string, any>(validSlots.map((s: any) => [s.id, s]));

      // 3) Participantes dos slots (lotes de 200 ids)
      const rows: any[] = [];
      for (const ids of chunk(Array.from(slotById.keys()), 200)) {
        const { data, error } = await supabase
          .from('meeting_slot_attendees')
          .select(
            'id, meeting_slot_id, deal_id, contact_id, attendee_name, attendee_phone, status, closer_notes, notes, is_partner, parent_attendee_id, outcome_reason, outcome_reason_note',
          )
          .in('meeting_slot_id', ids)
          .eq('is_partner', false);
        if (error) throw error;
        rows.push(...(data || []));
      }

      const now = Date.now();
      const participants: R1FunnelParticipant[] = rows.map((a) => {
        const slot = slotById.get(a.meeting_slot_id);
        const status = String(a.status || '').toLowerCase();
        const scheduledAt = slot?.scheduled_at || '';
        const passou = scheduledAt ? new Date(scheduledAt).getTime() < now : false;
        return {
          id: a.id,
          meeting_slot_id: a.meeting_slot_id,
          deal_id: a.deal_id || null,
          contact_id: a.contact_id || null,
          lead_name: a.attendee_name || '—',
          lead_phone: a.attendee_phone || '',
          scheduled_at: scheduledAt,
          closer_name: (slot?.closer_id && closerName.get(slot.closer_id)) || '—',
          status,
          closer_notes: a.closer_notes || '',
          notes: a.notes || '',
          sem_desfecho: passou && SEM_DESFECHO_STATUS.has(status),
          is_partner: !!a.is_partner,
          parent_attendee_id: a.parent_attendee_id || null,
          outcome_reason: a.outcome_reason || null,
          outcome_reason_note: a.outcome_reason_note || null,
        };
      });

      participants.sort((a, b) => (b.scheduled_at || '').localeCompare(a.scheduled_at || ''));

      return {
        agendadas: participants.length,
        realizadas: participants.filter((p) => p.status === 'completed').length,
        noShow: participants.filter((p) => p.status === 'no_show').length,
        semDesfecho: participants.filter((p) => p.sem_desfecho).length,
        participants,
      };
    },
  });
}
